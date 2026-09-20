import { ILazadaProvider } from './types.js';
import { LazadaCheckResult } from '../types.js';

export class RealLazadaProvider implements ILazadaProvider {
  public name = 'RealLazadaProvider';

  async checkAvailability(urlOrId: string): Promise<LazadaCheckResult> {
    const startTime = Date.now();

    console.log(JSON.stringify({
      level: 'INFO',
      event: 'REQUEST_START',
      provider: this.name,
      url: urlOrId,
      timestamp: new Date().toISOString()
    }));

    try {
      // Standard browser User-Agent matching standard iPhone Safari web requests
      const response = await fetch(urlOrId, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-SG,en;q=0.9',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });

      const checkDurationMs = Date.now() - startTime;

      console.log(JSON.stringify({
        level: 'INFO',
        event: 'RESPONSE_RECEIVED',
        provider: this.name,
        url: urlOrId,
        httpStatus: response.status,
        checkDurationMs,
        timestamp: new Date().toISOString()
      }));

      if (!response.ok) {
        return {
          isAvailable: false,
          rawStatus: `HTTP_${response.status}`,
          checkDurationMs,
          error: `HTTP ${response.status}: ${response.statusText}`
        };
      }

      const html = await response.text();
      const parsed = this.parseLazadaProductPage(html);

      console.log(JSON.stringify({
        level: 'INFO',
        event: 'PARSING_COMPLETE',
        provider: this.name,
        url: urlOrId,
        title: parsed.title || null,
        seller: parsed.seller || null,
        price: parsed.price || null,
        isAvailable: parsed.isAvailable,
        rawStatus: parsed.rawStatus,
        timestamp: new Date().toISOString()
      }));

      return {
        productId: parsed.productId,
        skuId: parsed.skuId,
        title: parsed.title,
        isAvailable: parsed.isAvailable,
        rawStatus: parsed.rawStatus,
        checkDurationMs,
        rawResponse: {
          seller: parsed.seller,
          price: parsed.price,
          currency: parsed.currency
        }
      };
    } catch (err: any) {
      const checkDurationMs = Date.now() - startTime;
      console.error(JSON.stringify({
        level: 'ERROR',
        event: 'REQUEST_FAILED',
        provider: this.name,
        url: urlOrId,
        error: err?.message || 'Network exception',
        timestamp: new Date().toISOString()
      }));

      return {
        isAvailable: false,
        rawStatus: 'NETWORK_ERROR',
        checkDurationMs,
        error: err?.message || 'Network check failed'
      };
    }
  }

  public parseLazadaProductPage(html: string): {
    title?: string;
    productId?: string;
    skuId?: string;
    seller?: string;
    price?: number;
    currency?: string;
    isAvailable: boolean;
    rawStatus: string;
  } {
    // 1. Detect anti-bot / CAPTCHA / WAF challenge pages
    if (
      html.includes('punish') ||
      html.includes('x5step') ||
      html.includes('captcha') ||
      html.includes('sec.lazada.sg')
    ) {
      return {
        isAvailable: false,
        rawStatus: 'CAPTCHA_BLOCKED'
      };
    }

    let title: string | undefined;
    let seller: string | undefined;
    let price: number | undefined;
    let currency: string | undefined;
    let isAvailable = false;
    let rawStatus = 'UNKNOWN';

    // 2. Parse structured JSON-LD script if available (<script type="application/ld+json">)
    const jsonLdMatches = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    if (jsonLdMatches) {
      for (const match of jsonLdMatches) {
        try {
          const content = match.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
          const data = JSON.parse(content);

          if (data['@type'] === 'Product') {
            title = data.name || title;
            if (data.offers) {
              const offer = Array.isArray(data.offers) ? data.offers[0] : data.offers;
              if (offer) {
                price = typeof offer.price === 'number' ? offer.price : parseFloat(offer.price);
                currency = offer.priceCurrency;
                const availabilityUrl = offer.availability || '';
                if (availabilityUrl.includes('InStock')) {
                  isAvailable = true;
                  rawStatus = 'IN_STOCK';
                } else if (availabilityUrl.includes('OutOfStock') || availabilityUrl.includes('SoldOut')) {
                  isAvailable = false;
                  rawStatus = 'OUT_OF_STOCK';
                }
              }
            }
            if (data.brand?.name) {
              seller = data.brand.name;
            }
          }
        } catch (e) {
          // Ignore JSON parse errors in inline scripts
        }
      }
    }

    // 3. Parse embedded PDP state script (__moduleData__ or __INITIAL_DATA__)
    if (rawStatus === 'UNKNOWN') {
      const moduleDataMatch = html.match(/__moduleData__\s*=\s*(\{[\s\S]*?\});/);
      if (moduleDataMatch) {
        try {
          const pData = JSON.parse(moduleDataMatch[1]);
          const rootUrl = pData?.data?.root?.fields;
          if (rootUrl) {
            title = rootUrl.productOption?.title || title;
            seller = rootUrl.seller?.name || seller;
            price = rootUrl.skuInfos?.price?.realPrice?.value || price;
          }
        } catch (e) {
          // Ignore fallback parse errors
        }
      }
    }

    // 4. HTML string fallback heuristic checks
    if (rawStatus === 'UNKNOWN') {
      const isOutOfStock =
        html.includes('outOfStock') ||
        html.includes('"inStock":false') ||
        html.includes('Sold Out') ||
        html.includes('This item is currently out of stock');

      const isInStock =
        html.includes('"inStock":true') ||
        html.includes('"buyNowable":true') ||
        html.includes('Add to Cart') ||
        html.includes('Buy Now');

      if (isInStock && !isOutOfStock) {
        isAvailable = true;
        rawStatus = 'IN_STOCK';
      } else if (isOutOfStock) {
        isAvailable = false;
        rawStatus = 'OUT_OF_STOCK';
      }
    }

    return {
      title,
      seller,
      price,
      currency: currency || 'SGD',
      isAvailable,
      rawStatus
    };
  }
}
