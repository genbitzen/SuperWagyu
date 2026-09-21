import { ReservationResult, MonitoredProduct } from '../types.js';

export interface IAutoReservationService {
  reserveProduct(product: MonitoredProduct): Promise<ReservationResult>;
}

export class MockAutoReservationService implements IAutoReservationService {
  private shouldFail: boolean;

  constructor(shouldFail: boolean = false) {
    this.shouldFail = shouldFail;
  }

  async reserveProduct(product: MonitoredProduct): Promise<ReservationResult> {
    const startTime = Date.now();
    const now = new Date();
    // 15-minute Lazada payment deadline
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString();

    if (this.shouldFail) {
      return {
        id: `res-err-${Date.now()}`,
        product_id: product.id,
        product_url: product.url,
        order_id: '',
        status: 'FAILED',
        reserved_at: now.toISOString(),
        expires_at: expiresAt,
        error: 'Session cookie expired or checkout captcha triggered'
      };
    }

    // Generate realistic Lazada Order Number format (e.g. LZ-SG-20260921-88412)
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const orderId = `LZ-SG-${now.toISOString().slice(0, 10).replace(/-/g, '')}-${randomSuffix}`;

    console.log(`[AutoReservationService] Successfully reserved product ${product.id}! Created Order: ${orderId}. Payment Deadline: ${expiresAt}`);

    return {
      id: `res-${Date.now()}`,
      product_id: product.id,
      product_url: product.url,
      order_id: orderId,
      status: 'RESERVED',
      reserved_at: now.toISOString(),
      expires_at: expiresAt
    };
  }
}
