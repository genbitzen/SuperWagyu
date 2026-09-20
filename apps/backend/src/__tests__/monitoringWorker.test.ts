import { describe, it, expect, beforeEach } from 'vitest';
import { MonitoringWorker } from '../services/monitoringWorker.js';
import { MockLazadaProvider } from '../providers/mockProvider.js';
import { InMemoryDatabaseRepository } from '../repository/db.js';

describe('Monitoring Worker State Transition Integration', () => {
  let db: InMemoryDatabaseRepository;
  let mockProvider: MockLazadaProvider;
  let worker: MonitoringWorker;

  beforeEach(() => {
    db = new InMemoryDatabaseRepository();
    mockProvider = new MockLazadaProvider(false); // Default to OUT_OF_STOCK
    worker = new MonitoringWorker({
      provider: mockProvider,
      db,
      pollIntervalMs: 100
    });
  });

  it('detects OUT_OF_STOCK -> IN_STOCK transition and generates AvailabilityEvent', async () => {
    const product = await db.addProduct('https://www.lazada.sg/products/test-item.html');

    // 1. Initial check: item is OUT_OF_STOCK
    mockProvider.setProductAvailability(product.url, false, 'OUT_OF_STOCK');
    const firstCheck = await worker.checkProduct(product);

    expect(firstCheck.newState).toBe('OUT_OF_STOCK');
    expect(firstCheck.transitionOccurred).toBe(false);

    let events = await db.getAvailabilityEvents(product.id);
    expect(events.length).toBe(0);

    // Get refreshed product state from DB
    const refreshedProduct = (await db.getProductById(product.id))!;
    expect(refreshedProduct.last_availability).toBe('OUT_OF_STOCK');

    // 2. Restock occurs: item becomes IN_STOCK
    mockProvider.setProductAvailability(product.url, true, 'IN_STOCK');
    const restockCheck = await worker.checkProduct(refreshedProduct);

    expect(restockCheck.newState).toBe('IN_STOCK');
    expect(restockCheck.transitionOccurred).toBe(true);

    events = await db.getAvailabilityEvents(product.id);
    expect(events.length).toBe(1);
    expect(events[0].previous_state).toBe('OUT_OF_STOCK');
    expect(events[0].new_state).toBe('IN_STOCK');
  });

  it('does NOT generate duplicate events for consecutive IN_STOCK checks', async () => {
    const product = await db.addProduct('https://www.lazada.sg/products/test-item.html');
    await db.updateProductState(product.id, 'IN_STOCK');

    const refreshedProduct = (await db.getProductById(product.id))!;

    // Check 1 when already IN_STOCK
    mockProvider.setProductAvailability(product.url, true, 'IN_STOCK');
    const check1 = await worker.checkProduct(refreshedProduct);

    expect(check1.newState).toBe('IN_STOCK');
    expect(check1.transitionOccurred).toBe(false);

    // Check 2 when still IN_STOCK
    const check2 = await worker.checkProduct(refreshedProduct);
    expect(check2.newState).toBe('IN_STOCK');
    expect(check2.transitionOccurred).toBe(false);

    const events = await db.getAvailabilityEvents(product.id);
    expect(events.length).toBe(0);
  });

  it('handles IN_STOCK -> OUT_OF_STOCK without generating a restock event', async () => {
    const product = await db.addProduct('https://www.lazada.sg/products/test-item.html');
    await db.updateProductState(product.id, 'IN_STOCK');

    const refreshedProduct = (await db.getProductById(product.id))!;

    // Stock runs out
    mockProvider.setProductAvailability(product.url, false, 'OUT_OF_STOCK');
    const check = await worker.checkProduct(refreshedProduct);

    expect(check.newState).toBe('OUT_OF_STOCK');
    expect(check.transitionOccurred).toBe(false);

    const updated = (await db.getProductById(product.id))!;
    expect(updated.last_availability).toBe('OUT_OF_STOCK');

    const events = await db.getAvailabilityEvents(product.id);
    expect(events.length).toBe(0);
  });

  it('handles provider error gracefully without throwing or corrupting product state', async () => {
    const product = await db.addProduct('https://www.lazada.sg/products/test-item.html');

    // Force error response
    mockProvider.setProductAvailability(product.url, false, 'HTTP_503');
    const check = await worker.checkProduct(product);

    expect(check.newState).toBe('UNKNOWN');
    expect(check.transitionOccurred).toBe(false);

    const updated = (await db.getProductById(product.id))!;
    expect(updated.last_availability).toBe('UNKNOWN');
  });
});
