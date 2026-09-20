import { describe, it, expect } from 'vitest';
import { RealLazadaProvider } from '../providers/realLazadaProvider.js';

describe('RealLazadaProvider HTML/JSON Parsing & Normalization', () => {
  const provider = new RealLazadaProvider();

  it('correctly parses an IN_STOCK product page with JSON-LD schema', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@type": "Product",
          "name": "Sony Wireless Headphones WH-1000XM5",
          "brand": { "name": "Sony Official Store" },
          "offers": {
            "@type": "Offer",
            "price": 499.00,
            "priceCurrency": "SGD",
            "availability": "https://schema.org/InStock"
          }
        }
        </script>
      </head>
      <body>
        <h1>Sony Headphones</h1>
      </body>
      </html>
    `;

    const result = provider.parseLazadaProductPage(html);

    expect(result.title).toBe('Sony Wireless Headphones WH-1000XM5');
    expect(result.seller).toBe('Sony Official Store');
    expect(result.price).toBe(499.00);
    expect(result.currency).toBe('SGD');
    expect(result.isAvailable).toBe(true);
    expect(result.rawStatus).toBe('IN_STOCK');
  });

  it('correctly parses an OUT_OF_STOCK product page with JSON-LD schema', () => {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <script type="application/ld+json">
        {
          "@type": "Product",
          "name": "Limited Edition Playmat",
          "brand": { "name": "Gaming Hub SG" },
          "offers": {
            "@type": "Offer",
            "price": 29.90,
            "priceCurrency": "SGD",
            "availability": "https://schema.org/OutOfStock"
          }
        }
        </script>
      </head>
      <body>
        <div class="out-of-stock-banner">Sold Out</div>
      </body>
      </html>
    `;

    const result = provider.parseLazadaProductPage(html);

    expect(result.title).toBe('Limited Edition Playmat');
    expect(result.seller).toBe('Gaming Hub SG');
    expect(result.price).toBe(29.90);
    expect(result.isAvailable).toBe(false);
    expect(result.rawStatus).toBe('OUT_OF_STOCK');
  });

  it('correctly identifies CAPTCHA or WAF security challenge pages', () => {
    const html = `
      <html>
      <head><title>Punish Page - Security Check</title></head>
      <body>
        <script>window.x5step = true;</script>
        <div>Please solve the captcha to proceed. sec.lazada.sg</div>
      </body>
      </html>
    `;

    const result = provider.parseLazadaProductPage(html);

    expect(result.isAvailable).toBe(false);
    expect(result.rawStatus).toBe('CAPTCHA_BLOCKED');
  });

  it('falls back to HTML action buttons when JSON-LD is absent', () => {
    const html = `
      <html>
      <body>
        <div class="pdp-button-box">
          <button class="add-to-cart">Add to Cart</button>
          <button class="buy-now">Buy Now</button>
        </div>
      </body>
      </html>
    `;

    const result = provider.parseLazadaProductPage(html);

    expect(result.isAvailable).toBe(true);
    expect(result.rawStatus).toBe('IN_STOCK');
  });
});
