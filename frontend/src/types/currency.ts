export interface Currency {
  currency_id: string;
  code: string;
  name: string;
  symbol: string;
  type: 'fiat' | 'crypto';
  precision: number;
  enabled: boolean;
  created_at: string;
  exchange_rate?: number;
  last_updated?: string;
}

export interface CurrencyPolicy {
  policy_id: string;
  scope_type: 'SUPER_ADMIN' | 'PARTNER' | 'AGENT' | 'MERCHANT';
  scope_id: string;
  enabled_currencies: string[];
  default_currency: string;
  settlement_currencies: string[];
  created_at: string;
}

export interface FxSnapshot {
  fx_id: string;
  from_currency: string;
  to_currency: string;
  source: 'PROVIDER' | 'MARKET';
  raw_rate: number;
  final_rate: number;
  markup_bps: number;
  rounding_mode: 'BANKERS' | 'HALF_UP' | 'HALF_DOWN' | 'TRUNCATE';
  scale: number;
  created_at: string;
}

export interface MoneyAmount {
  amount: number;
  currency: string;
  precision: number;
  display_amount: string;
  raw_amount: string;
}

export interface FeeBreakdown {
  fee_id: string;
  transaction_id: string;
  fee_type: 'GATEWAY' | 'PROCESSING' | 'FX' | 'RESERVE';
  base_amount: number;
  fee_amount: number;
  currency: string;
  rounding_mode: 'BANKERS' | 'HALF_UP' | 'HALF_DOWN' | 'TRUNCATE';
  scale: number;
  calculation_details: any;
  created_at: string;
}

export type RoundingMode = 'BANKERS' | 'HALF_UP' | 'HALF_DOWN' | 'TRUNCATE';
export type PrecisionMode = 'DISPLAY' | 'FULL';