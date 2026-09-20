import { ILazadaProvider } from './types.js';
import { LazadaCheckResult } from '../types.js';

export class MockLazadaProvider implements ILazadaProvider {
  public name = 'MockLazadaProvider';
  private productStates: Map<string, { isAvailable: boolean; rawStatus: string }> = new Map();

  constructor(defaultAvailable: boolean = false) {
    this.defaultState = defaultAvailable;
  }

  private defaultState: boolean;

  public setProductAvailability(urlOrId: string, isAvailable: boolean, rawStatus?: string): void {
    this.productStates.set(urlOrId, {
      isAvailable,
      rawStatus: rawStatus || (isAvailable ? 'IN_STOCK' : 'OUT_OF_STOCK')
    });
  }

  public toggleAvailability(urlOrId: string): boolean {
    const current = this.productStates.get(urlOrId);
    const nextState = current ? !current.isAvailable : !this.defaultState;
    this.setProductAvailability(urlOrId, nextState);
    return nextState;
  }

  async checkAvailability(urlOrId: string): Promise<LazadaCheckResult> {
    const startTime = Date.now();

    // Small simulated network latency (5-20ms)
    await new Promise((resolve) => setTimeout(resolve, 10));

    const state = this.productStates.get(urlOrId) || {
      isAvailable: this.defaultState,
      rawStatus: this.defaultState ? 'IN_STOCK' : 'OUT_OF_STOCK'
    };

    const checkDurationMs = Date.now() - startTime;

    return {
      productId: 'mock-product-123',
      skuId: 'mock-sku-456',
      title: 'Mock Lazada Product',
      isAvailable: state.isAvailable,
      rawStatus: state.rawStatus,
      checkDurationMs,
      rawResponse: {
        mock: true,
        urlOrId,
        timestamp: new Date().toISOString()
      }
    };
  }
}
