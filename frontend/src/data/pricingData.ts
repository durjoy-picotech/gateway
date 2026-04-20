import { FeePolicy, FeeBreakdown, ProviderCost } from '../types/pricing';

export const demoFeePolicies: FeePolicy[] = [
  // SUPER_ADMIN Level Policies
  {
    fee_id: 'fp_001',
    scope_type: 'SUPER_ADMIN',
    scope_id: 'system',
    channel_type: 'CARD',
    provider_alias: 'stripe_main',
    percentage: 2.4,
    fixed_amount: 0.25,
    min_cap: 0.50,
    max_cap: 100.00,
    currency: 'USD',
    override_lower_levels: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    fee_id: 'fp_002',
    scope_type: 'SUPER_ADMIN',
    scope_id: 'system',
    channel_type: 'BANK_TRANSFER',
    percentage: 1.0,
    fixed_amount: 0.50,
    min_cap: 1.00,
    max_cap: 50.00,
    currency: 'USD',
    override_lower_levels: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    fee_id: 'fp_003',
    scope_type: 'SUPER_ADMIN',
    scope_id: 'system',
    channel_type: 'EWALLET',
    percentage: 2.0,
    fixed_amount: 0.30,
    min_cap: 0.40,
    max_cap: 75.00,
    currency: 'USD',
    override_lower_levels: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },

  // PARTNER Level Policies
  {
    fee_id: 'fp_004',
    scope_type: 'PARTNER',
    scope_id: 'ptr_001',
    channel_type: 'CARD',
    percentage: 0.5,
    fixed_amount: 0.10,
    min_cap: 0.20,
    max_cap: 25.00,
    currency: 'USD',
    override_lower_levels: false,
    created_at: '2024-01-15T08:00:00Z',
    updated_at: '2024-01-15T08:00:00Z'
  },
  {
    fee_id: 'fp_005',
    scope_type: 'PARTNER',
    scope_id: 'ptr_001',
    channel_type: 'BANK_TRANSFER',
    percentage: 0.3,
    fixed_amount: 0.25,
    min_cap: 0.50,
    max_cap: 15.00,
    currency: 'USD',
    override_lower_levels: false,
    created_at: '2024-01-15T08:00:00Z',
    updated_at: '2024-01-15T08:00:00Z'
  },

  // AGENT Level Policies
  {
    fee_id: 'fp_006',
    scope_type: 'AGENT',
    scope_id: 'agt_001',
    channel_type: 'CARD',
    percentage: 0.3,
    fixed_amount: 0.05,
    min_cap: 0.15,
    max_cap: 10.00,
    currency: 'USD',
    override_lower_levels: false,
    created_at: '2024-01-17T10:00:00Z',
    updated_at: '2024-01-17T10:00:00Z'
  },
  {
    fee_id: 'fp_007',
    scope_type: 'AGENT',
    scope_id: 'agt_001',
    channel_type: 'EWALLET',
    percentage: 0.4,
    fixed_amount: 0.10,
    min_cap: 0.20,
    max_cap: 12.00,
    currency: 'USD',
    override_lower_levels: false,
    created_at: '2024-01-17T10:00:00Z',
    updated_at: '2024-01-17T10:00:00Z'
  },

  // MERCHANT Level Policies (Override Example)
  {
    fee_id: 'fp_008',
    scope_type: 'MERCHANT',
    scope_id: 'mrc_001',
    channel_type: 'CARD',
    percentage: 2.9,
    fixed_amount: 0.30,
    min_cap: 0.50,
    max_cap: 50.00,
    currency: 'USD',
    override_lower_levels: true, // This merchant has negotiated special rates
    created_at: '2024-01-18T11:00:00Z',
    updated_at: '2024-01-18T11:00:00Z'
  }
];

export const demoProviderCosts: ProviderCost[] = [
  {
    provider_alias: 'stripe_main',
    channel_type: 'CARD',
    percentage: 2.4,
    fixed_amount: 0.25,
    currency: 'USD'
  },
  {
    provider_alias: 'stripe_main',
    channel_type: 'BANK_TRANSFER',
    percentage: 0.8,
    fixed_amount: 0.50,
    currency: 'USD'
  },
  {
    provider_alias: 'adyen_eu',
    channel_type: 'CARD',
    percentage: 2.2,
    fixed_amount: 0.20,
    currency: 'EUR'
  },
  {
    provider_alias: 'adyen_eu',
    channel_type: 'EWALLET',
    percentage: 1.8,
    fixed_amount: 0.15,
    currency: 'EUR'
  },
  {
    provider_alias: 'paypal_exp',
    channel_type: 'EWALLET',
    percentage: 2.8,
    fixed_amount: 0.30,
    currency: 'USD'
  },
  {
    provider_alias: 'square_pos',
    channel_type: 'CARD',
    percentage: 2.6,
    fixed_amount: 0.10,
    currency: 'USD'
  }
];

export const demoFeeBreakdowns: FeeBreakdown[] = [
  {
    fee_id: 'fb_001',
    transaction_id: 'txn_001',
    provider_cost_native: 3.25,
    provider_cost_currency: 'USD',
    provider_cost_converted: 3.25,
    merchant_fee: 4.23,
    fee_currency: 'USD',
    profit: 0.98,
    profit_currency: 'USD',
    fx_rate_used: 1.0,
    rounding_mode: 'BANKERS',
    scale: 6,
    calculation_details: {
      base_amount: 125.50,
      percentage_fee: 3.64,
      fixed_fee: 0.59,
      min_cap_applied: false,
      max_cap_applied: false,
      markup_levels: [
        {
          level: 'SUPER_ADMIN',
          scope_id: 'system',
          percentage: 2.4,
          fixed: 0.25,
          currency: 'USD'
        },
        {
          level: 'PARTNER',
          scope_id: 'ptr_001',
          percentage: 0.5,
          fixed: 0.10,
          currency: 'USD'
        },
        {
          level: 'AGENT',
          scope_id: 'agt_001',
          percentage: 0.3,
          fixed: 0.05,
          currency: 'USD'
        }
      ],
      provider_costs: {
        native_amount: 3.25,
        native_currency: 'USD',
        fx_rate: 1.0,
        converted_amount: 3.25,
        converted_currency: 'USD'
      }
    },
    created_at: '2024-01-20T14:22:00Z'
  },
  {
    fee_id: 'fb_002',
    transaction_id: 'txn_005',
    provider_cost_native: 2.18,
    provider_cost_currency: 'EUR',
    provider_cost_converted: 2.35,
    merchant_fee: 3.12,
    fee_currency: 'USD',
    profit: 0.77,
    profit_currency: 'USD',
    fx_rate_used: 1.08,
    rounding_mode: 'BANKERS',
    scale: 6,
    calculation_details: {
      base_amount: 89.99,
      percentage_fee: 2.61,
      fixed_fee: 0.51,
      min_cap_applied: false,
      max_cap_applied: false,
      markup_levels: [
        {
          level: 'SUPER_ADMIN',
          scope_id: 'system',
          percentage: 2.4,
          fixed: 0.25,
          currency: 'USD'
        },
        {
          level: 'PARTNER',
          scope_id: 'ptr_001',
          percentage: 0.5,
          fixed: 0.10,
          currency: 'USD'
        },
        {
          level: 'AGENT',
          scope_id: 'agt_001',
          percentage: 0.3,
          fixed: 0.05,
          currency: 'USD'
        }
      ],
      provider_costs: {
        native_amount: 2.18,
        native_currency: 'EUR',
        fx_rate: 1.08,
        converted_amount: 2.35,
        converted_currency: 'USD'
      }
    },
    created_at: '2024-01-20T18:15:00Z'
  }
];