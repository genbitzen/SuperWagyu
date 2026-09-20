export type MonitoringStatus = 'IDLE' | 'MONITORING' | 'STOPPED' | 'ERROR';

export type NormalizedAvailability = 'UNKNOWN' | 'OUT_OF_STOCK' | 'IN_STOCK';

export interface MonitoredProduct {
  id: string;
  url: string;
  product_id?: string | null;
  sku_id?: string | null;
  status: MonitoringStatus;
  last_availability: NormalizedAvailability;
  last_checked_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AvailabilityEvent {
  id: string;
  product_id: string;
  previous_state: NormalizedAvailability;
  new_state: NormalizedAvailability;
  detected_at: string;
  detection_latency_ms?: number | null;
  raw_details?: Record<string, any> | null;
}

export interface LazadaCheckResult {
  productId?: string;
  skuId?: string;
  title?: string;
  isAvailable: boolean;
  rawStatus: string;
  checkDurationMs: number;
  error?: string;
  rawResponse?: Record<string, any>;
}
