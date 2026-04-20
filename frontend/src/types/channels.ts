export interface ChannelType {
  channel_id: string;
  code: string; // Numeric string
  name: string;
  method: 'CARD' | 'BANK_TRANSFER' | 'EWALLET' | 'QR' | 'CRYPTO';
  variants: string[]; // VISA, Mastercard, Apple Pay, etc.
  enabled: boolean;
  created_at: string;
}

export interface RoutingStrategy {
  strategy_id: string;
  name: string;
  type: 'PRIORITY' | 'WEIGHTED' | 'CHEAPEST' | 'FASTEST' | 'FAILOVER';
  config: {
    providers?: Array<{
      provider_alias: string;
      priority?: number;
      weight?: number;
      max_amount?: number;
      min_amount?: number;
    }>;
    fallback_strategy?: string;
    timeout_ms?: number;
    retry_attempts?: number;
  };
  scope_type: 'SUPER_ADMIN' | 'PARTNER' | 'AGENT' | 'MERCHANT';
  scope_id: string;
  created_at: string;
}

export interface ProviderHealth {
  provider_alias: string;
  health_status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  success_rate: number;
  avg_response_time: number;
  circuit_breaker_open: boolean;
  quota_remaining: number;
  quota_reset_time: string;
  last_check: string;
}

export interface RoutingReport {
  provider_alias: string;
  channel_type: string;
  approval_rate: number;
  avg_latency: number;
  margin_earned: number;
  settlement_speed_hours: number;
  transaction_count: number;
  volume: number;
  currency: string;
  date_range: {
    from: string;
    to: string;
  };
}

export interface FxSource {
  source_id: string;
  name: string;
  type: 'PROVIDER' | 'MARKET';
  provider: string; // ECB, Binance, Coinbase, etc.
  supported_pairs: string[];
  priority: number;
  enabled: boolean;
  api_config: any;
  created_at: string;
}

export interface FxPolicy {
  policy_id: string;
  scope_type: 'SUPER_ADMIN' | 'PARTNER' | 'AGENT' | 'MERCHANT';
  scope_id: string;
  markup_bps: number;
  fixed_spread: number;
  rounding_mode: 'BANKERS' | 'HALF_UP' | 'HALF_DOWN' | 'TRUNCATE';
  staleness_cap_minutes: number;
  weekend_mode: 'FREEZE' | 'EXTEND' | 'MARKET';
  enabled_sources: string[];
  fallback_source: string;
  created_at: string;
}

export interface FxSnapshot {
  fx_id: string;
  from_currency: string;
  to_currency: string;
  source: string;
  raw_rate: number;
  final_rate: number;
  markup_bps: number;
  fixed_spread: number;
  rounding_mode: 'BANKERS' | 'HALF_UP' | 'HALF_DOWN' | 'TRUNCATE';
  scale: number;
  is_stale: boolean;
  created_at: string;
}

export interface FeePolicy {
  fee_id: string;
  scope_type: 'SUPER_ADMIN' | 'PARTNER' | 'AGENT' | 'MERCHANT';
  scope_id: string;
  channel_type?: string;
  provider_alias?: string;
  percentage: number;
  fixed_amount: number;
  min_cap: number;
  max_cap: number;
  currency: string;
  override_lower_levels: boolean;
  created_at: string;
}

export interface FeeBreakdown {
  fee_id: string;
  transaction_id: string;
  provider_cost_native: number;
  provider_cost_currency: string;
  provider_cost_converted: number;
  merchant_fee: number;
  fee_currency: string;
  profit: number;
  profit_currency: string;
  fx_rate_used: number;
  rounding_mode: string;
  scale: number;
  calculation_details: {
    base_amount: number;
    percentage_fee: number;
    fixed_fee: number;
    min_cap_applied: boolean;
    max_cap_applied: boolean;
    markup_levels: Array<{
      level: string;
      percentage: number;
      fixed: number;
    }>;
  };
  created_at: string;
}

export interface PricingEngine {
  calculateFee(
    amount: number,
    currency: string,
    channelType: string,
    providerAlias: string,
    merchantId: string
  ): Promise<FeeBreakdown>;
  
  applyFxMarkup(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    scopeType: string,
    scopeId: string
  ): Promise<{
    convertedAmount: number;
    fxSnapshot: FxSnapshot;
    marginEarned: number;
  }>;
  
  routeTransaction(
    amount: number,
    currency: string,
    channelType: string,
    merchantId: string
  ): Promise<{
    selectedProvider: string;
    routingReason: string;
    alternativeProviders: string[];
    estimatedCost: number;
  }>;
}