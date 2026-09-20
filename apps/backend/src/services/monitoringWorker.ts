import { ILazadaProvider } from '../providers/types.js';
import { IDatabaseRepository } from '../repository/db.js';
import { normalizeAvailability, isRestockTransition } from './normalizer.js';
import { MonitoredProduct, AvailabilityEvent } from '../types.js';

export interface MonitoringWorkerOptions {
  provider: ILazadaProvider;
  db: IDatabaseRepository;
  pollIntervalMs?: number;
}

export class MonitoringWorker {
  private provider: ILazadaProvider;
  private db: IDatabaseRepository;
  private pollIntervalMs: number;
  private isRunning: boolean = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(options: MonitoringWorkerOptions) {
    this.provider = options.provider;
    this.db = options.db;
    this.pollIntervalMs = options.pollIntervalMs || 3000;
  }

  public async checkProduct(product: MonitoredProduct): Promise<{
    newState: string;
    transitionOccurred: boolean;
    event?: AvailabilityEvent;
  }> {
    const checkStartTime = Date.now();
    const previousState = product.last_availability;

    const result = await this.provider.checkAvailability(product.url);
    const newState = normalizeAvailability(result);
    const latencyMs = Date.now() - checkStartTime;

    const restockDetected = isRestockTransition(previousState, newState);
    let event: AvailabilityEvent | undefined;

    if (restockDetected) {
      event = await this.db.recordAvailabilityEvent({
        product_id: product.id,
        previous_state: previousState,
        new_state: newState,
        detection_latency_ms: latencyMs,
        raw_details: {
          provider: this.provider.name,
          checkDurationMs: result.checkDurationMs,
          rawStatus: result.rawStatus
        }
      });
    }

    // Always persist latest checked timestamp & normalized availability
    await this.db.updateProductState(product.id, newState);

    // Structured logging (no credentials or tokens logged)
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      provider: this.provider.name,
      productId: product.id,
      url: product.url,
      previousState,
      newState,
      restockDetected,
      latencyMs,
      error: result.error || null
    }));

    return {
      newState,
      transitionOccurred: restockDetected,
      event
    };
  }

  public async runBatch(): Promise<number> {
    const products = await this.db.getMonitoredProducts();
    const activeProducts = products.filter((p) => p.status === 'MONITORING');

    for (const product of activeProducts) {
      try {
        await this.checkProduct(product);
      } catch (err: any) {
        console.error(JSON.stringify({
          timestamp: new Date().toISOString(),
          productId: product.id,
          error: err?.message || 'Error processing product check'
        }));
      }
    }

    return activeProducts.length;
  }

  public start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[MonitoringWorker] Started monitoring loop using ${this.provider.name} (interval: ${this.pollIntervalMs}ms)`);

    const loop = async () => {
      if (!this.isRunning) return;
      await this.runBatch();
      if (this.isRunning) {
        this.timer = setTimeout(loop, this.pollIntervalMs);
      }
    };

    loop();
  }

  public stop(): void {
    this.isRunning = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    console.log('[MonitoringWorker] Stopped monitoring worker loop');
  }
}
