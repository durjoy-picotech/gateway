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
  updated_at: string;
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
  rounding_mode: 'BANKERS' | 'HALF_UP' | 'HALF_DOWN' | 'TRUNCATE';
  scale: number;
  calculation_details: {
    base_amount: number;
    percentage_fee: number;
    fixed_fee: number;
    min_cap_applied: boolean;
    max_cap_applied: boolean;
    markup_levels: Array<{
      level: string;
      scope_id: string;
      percentage: number;
      fixed: number;
      currency: string;
    }>;
    provider_costs: {
      native_amount: number;
      native_currency: string;
      fx_rate: number;
      converted_amount: number;
      converted_currency: string;
    };
  };
  created_at: string;
}

export interface PricingRequest {
  amount: number;
  currency: string;
  channel_type: string;
  provider_alias: string;
  merchant_id: string;
  agent_id?: string;
  partner_id?: string;
}

export interface PricingResponse {
  fee_breakdown: FeeBreakdown;
  total_cost: number;
  profit_margin: number;
  effective_rate: number;
}

export interface ProviderCost {
  provider_alias: string;
  channel_type: string;
  percentage: number;
  fixed_amount: number;
  currency: string;
  min_amount?: number;
  max_amount?: number;
}