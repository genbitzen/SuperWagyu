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

export interface ReservationResult {
  id: string;
  product_id: string;
  product_url: string;
  order_id: string;
  status: 'RESERVED' | 'FAILED' | 'EXPIRED' | 'PAID';
  reserved_at: string;
  expires_at: string; // 15-minute Lazada payment deadline
  error?: string;
}

export interface SessionStatus {
  is_valid: boolean;
  user_id?: string;
  last_authenticated_at?: string;
  expires_at?: string;
  provider: string;
}

export interface AvailabilityEvent {
  id: string;
  product_id: string;
  previous_state: NormalizedAvailability;
  new_state: NormalizedAvailability;
  detected_at: string;
  detection_latency_ms?: number | null;
  raw_details?: Record<string, any> | null;
  reservation?: ReservationResult | null;
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
