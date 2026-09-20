import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { MonitoredProduct, AvailabilityEvent, NormalizedAvailability, MonitoringStatus } from '../types.js';

export interface IDatabaseRepository {
  getMonitoredProducts(): Promise<MonitoredProduct[]>;
  getProductById(id: string): Promise<MonitoredProduct | null>;
  addProduct(url: string, productId?: string): Promise<MonitoredProduct>;
  updateProductState(
    id: string,
    lastAvailability: NormalizedAvailability,
    status?: MonitoringStatus
  ): Promise<void>;
  recordAvailabilityEvent(
    event: Omit<AvailabilityEvent, 'id' | 'detected_at'>
  ): Promise<AvailabilityEvent>;
  getAvailabilityEvents(productId?: string): Promise<AvailabilityEvent[]>;
}

export class InMemoryDatabaseRepository implements IDatabaseRepository {
  private products: Map<string, MonitoredProduct> = new Map();
  private events: AvailabilityEvent[] = [];

  async getMonitoredProducts(): Promise<MonitoredProduct[]> {
    return Array.from(this.products.values());
  }

  async getProductById(id: string): Promise<MonitoredProduct | null> {
    return this.products.get(id) || null;
  }

  async addProduct(url: string, productId?: string): Promise<MonitoredProduct> {
    const now = new Date().toISOString();
    const product: MonitoredProduct = {
      id: `prod_${Math.random().toString(36).substring(2, 9)}`,
      url,
      product_id: productId || null,
      status: 'MONITORING',
      last_availability: 'UNKNOWN',
      last_checked_at: null,
      created_at: now,
      updated_at: now
    };
    this.products.set(product.id, product);
    return product;
  }

  async updateProductState(
    id: string,
    lastAvailability: NormalizedAvailability,
    status?: MonitoringStatus
  ): Promise<void> {
    const product = this.products.get(id);
    if (!product) return;

    const now = new Date().toISOString();
    product.last_availability = lastAvailability;
    product.last_checked_at = now;
    product.updated_at = now;
    if (status) {
      product.status = status;
    }
    this.products.set(id, product);
  }

  async recordAvailabilityEvent(
    event: Omit<AvailabilityEvent, 'id' | 'detected_at'>
  ): Promise<AvailabilityEvent> {
    const createdEvent: AvailabilityEvent = {
      ...event,
      id: `event_${Math.random().toString(36).substring(2, 9)}`,
      detected_at: new Date().toISOString()
    };
    this.events.push(createdEvent);
    return createdEvent;
  }

  async getAvailabilityEvents(productId?: string): Promise<AvailabilityEvent[]> {
    if (productId) {
      return this.events.filter((e) => e.product_id === productId);
    }
    return [...this.events];
  }
}

export class SupabaseDatabaseRepository implements IDatabaseRepository {
  private client: SupabaseClient;

  constructor(url: string, key: string) {
    this.client = createClient(url, key);
  }

  async getMonitoredProducts(): Promise<MonitoredProduct[]> {
    const { data, error } = await this.client
      .from('monitored_products')
      .select('*')
      .eq('status', 'MONITORING');

    if (error) throw new Error(`Supabase getMonitoredProducts error: ${error.message}`);
    return data || [];
  }

  async getProductById(id: string): Promise<MonitoredProduct | null> {
    const { data, error } = await this.client
      .from('monitored_products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) return null;
    return data;
  }

  async addProduct(url: string, productId?: string): Promise<MonitoredProduct> {
    const { data, error } = await this.client
      .from('monitored_products')
      .insert({
        url,
        product_id: productId || null,
        status: 'MONITORING',
        last_availability: 'UNKNOWN'
      })
      .select()
      .single();

    if (error) throw new Error(`Supabase addProduct error: ${error.message}`);
    return data;
  }

  async updateProductState(
    id: string,
    lastAvailability: NormalizedAvailability,
    status?: MonitoringStatus
  ): Promise<void> {
    const updates: Record<string, any> = {
      last_availability: lastAvailability,
      last_checked_at: new Date().toISOString()
    };
    if (status) {
      updates.status = status;
    }

    const { error } = await this.client
      .from('monitored_products')
      .update(updates)
      .eq('id', id);

    if (error) throw new Error(`Supabase updateProductState error: ${error.message}`);
  }

  async recordAvailabilityEvent(
    event: Omit<AvailabilityEvent, 'id' | 'detected_at'>
  ): Promise<AvailabilityEvent> {
    const { data, error } = await this.client
      .from('availability_events')
      .insert({
        product_id: event.product_id,
        previous_state: event.previous_state,
        new_state: event.new_state,
        detection_latency_ms: event.detection_latency_ms,
        raw_details: event.raw_details
      })
      .select()
      .single();

    if (error) throw new Error(`Supabase recordAvailabilityEvent error: ${error.message}`);
    return data;
  }

  async getAvailabilityEvents(productId?: string): Promise<AvailabilityEvent[]> {
    let query = this.client.from('availability_events').select('*');
    if (productId) {
      query = query.eq('product_id', productId);
    }
    const { data, error } = await query.order('detected_at', { ascending: false });
    if (error) throw new Error(`Supabase getAvailabilityEvents error: ${error.message}`);
    return data || [];
  }
}
