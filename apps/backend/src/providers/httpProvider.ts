import { ILazadaProvider } from './types.js';
import { LazadaCheckResult } from '../types.js';

export class LazadaHttpProvider implements ILazadaProvider {
  public name = 'LazadaHttpProvider';

  async checkAvailability(urlOrId: string): Promise<LazadaCheckResult> {
    const startTime = Date.now();

    try {
      // Clean fetch with standard browser user-agent
      const response = await fetch(urlOrId, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-SG,en;q=0.9'
        }
      });

      const checkDurationMs = Date.now() - startTime;

      if (!response.ok) {
        return {
          isAvailable: false,
          rawStatus: `HTTP_${response.status}`,
          checkDurationMs,
          error: `Lazada endpoint returned HTTP ${response.status}`
        };
      }

      const html = await response.text();

      // Check common non-bypass patterns in Lazada PDP HTML/JSON signals
      const isOutOfStock = html.includes('outOfStock') || html.includes('Sold Out') || html.includes('"inStock":false');
      const isInStock = html.includes('"inStock":true') || html.includes('Add to Cart') || html.includes('Buy Now');

      const isAvailable = isInStock && !isOutOfStock;
      const rawStatus = isAvailable ? 'IN_STOCK' : isOutOfStock ? 'OUT_OF_STOCK' : 'UNKNOWN';

      return {
        isAvailable,
        rawStatus,
        checkDurationMs
      };
    } catch (err: any) {
      const checkDurationMs = Date.now() - startTime;
      return {
        isAvailable: false,
        rawStatus: 'ERROR',
        checkDurationMs,
        error: err?.message || 'Network check failed'
      };
    }
  }
}
