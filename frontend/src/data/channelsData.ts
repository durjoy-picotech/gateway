import { 
  ChannelType, 
  RoutingStrategy, 
  ProviderHealth, 
  RoutingReport,
  FxSource,
  FxPolicy,
  FxSnapshot,
  FeePolicy,
  FeeBreakdown
} from '../types/channels';

export const demoChannelTypes: ChannelType[] = [
  {
    channel_id: 'ch_001',
    code: '001',
    name: 'Credit/Debit Cards',
    method: 'CARD',
    variants: ['VISA', 'MASTERCARD', 'AMEX', 'DISCOVER'],
    enabled: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    channel_id: 'ch_002',
    code: '002',
    name: 'Bank Transfer',
    method: 'BANK_TRANSFER',
    variants: [ 'WIRE','FASTER_PAYMENTS'],
    enabled: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    channel_id: 'ch_003',
    code: '003',
    name: 'Digital Wallets',
    method: 'EWALLET',
    variants: ['PAYPAL', 'APPLE_PAY', 'GOOGLE_PAY', 'SAMSUNG_PAY'],
    enabled: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    channel_id: 'ch_004',
    code: '004',
    name: 'QR Code Payments',
    method: 'QR',
    variants: ['ALIPAY', 'WECHAT_PAY', 'GRABPAY', 'BOOST'],
    enabled: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    channel_id: 'ch_005',
    code: '005',
    name: 'Cryptocurrency',
    method: 'CRYPTO',
    variants: ['BITCOIN', 'ETHEREUM', 'USDT', 'USDC'],
    enabled: true,
    created_at: '2024-01-01T00:00:00Z'
  }
];

export const demoRoutingStrategies: RoutingStrategy[] = [
  {
    strategy_id: 'rs_001',
    name: 'Priority Routing',
    type: 'PRIORITY',
    config: {
      providers: [
        { provider_alias: 'stripe_main', priority: 1, max_amount: 10000 },
        { provider_alias: 'adyen_eu', priority: 2, max_amount: 50000 },
        { provider_alias: 'paypal_exp', priority: 3, max_amount: 5000 }
      ],
      timeout_ms: 30000,
      retry_attempts: 2
    },
    scope_type: 'PARTNER',
    scope_id: 'ptr_001',
    created_at: '2024-01-15T08:00:00Z'
  },
  {
    strategy_id: 'rs_002',
    name: 'Weighted Distribution',
    type: 'WEIGHTED',
    config: {
      providers: [
        { provider_alias: 'stripe_main', weight: 60 },
        { provider_alias: 'adyen_eu', weight: 30 },
        { provider_alias: 'paypal_exp', weight: 10 }
      ],
      fallback_strategy: 'PRIORITY',
      timeout_ms: 25000
    },
    scope_type: 'AGENT',
    scope_id: 'agt_001',
    created_at: '2024-01-17T10:00:00Z'
  },
  {
    strategy_id: 'rs_003',
    name: 'Cost Optimization',
    type: 'CHEAPEST',
    config: {
      providers: [
        { provider_alias: 'stripe_main' },
        { provider_alias: 'adyen_eu' },
        { provider_alias: 'square_pos' }
      ],
      timeout_ms: 20000,
      retry_attempts: 1
    },
    scope_type: 'MERCHANT',
    scope_id: 'mrc_001',
    created_at: '2024-01-18T11:00:00Z'
  }
];

export const demoProviderHealth: ProviderHealth[] = [
  {
    provider_alias: 'stripe_main',
    health_status: 'HEALTHY',
    success_rate: 99.2,
    avg_response_time: 145,
    circuit_breaker_open: false,
    quota_remaining: 8500,
    quota_reset_time: '2024-01-21T00:00:00Z',
    last_check: '2024-01-20T16:45:00Z'
  },
  {
    provider_alias: 'adyen_eu',
    health_status: 'DEGRADED',
    success_rate: 97.1,
    avg_response_time: 450,
    circuit_breaker_open: false,
    quota_remaining: 2100,
    quota_reset_time: '2024-01-21T00:00:00Z',
    last_check: '2024-01-20T16:45:00Z'
  },
  {
    provider_alias: 'paypal_exp',
    health_status: 'HEALTHY',
    success_rate: 98.7,
    avg_response_time: 230,
    circuit_breaker_open: false,
    quota_remaining: 5600,
    quota_reset_time: '2024-01-21T00:00:00Z',
    last_check: '2024-01-20T16:45:00Z'
  }
];

export const demoRoutingReports: RoutingReport[] = [
  {
    provider_alias: 'stripe_main',
    channel_type: 'CARD',
    approval_rate: 94.5,
    avg_latency: 145,
    margin_earned: 12567.89,
    settlement_speed_hours: 24,
    transaction_count: 1245,
    volume: 156789.45,
    currency: 'USD',
    date_range: {
      from: '2024-01-01T00:00:00Z',
      to: '2024-01-20T23:59:59Z'
    }
  },
  {
    provider_alias: 'adyen_eu',
    channel_type: 'CARD',
    approval_rate: 92.1,
    avg_latency: 450,
    margin_earned: 8934.56,
    settlement_speed_hours: 48,
    transaction_count: 876,
    volume: 98765.32,
    currency: 'EUR',
    date_range: {
      from: '2024-01-01T00:00:00Z',
      to: '2024-01-20T23:59:59Z'
    }
  },
  {
    provider_alias: 'paypal_exp',
    channel_type: 'EWALLET',
    approval_rate: 96.8,
    avg_latency: 230,
    margin_earned: 5432.10,
    settlement_speed_hours: 12,
    transaction_count: 567,
    volume: 67890.12,
    currency: 'USD',
    date_range: {
      from: '2024-01-01T00:00:00Z',
      to: '2024-01-20T23:59:59Z'
    }
  }
];

export const demoFxSources: FxSource[] = [
  {
    source_id: 'fxs_001',
    name: 'European Central Bank',
    type: 'MARKET',
    provider: 'ECB',
    supported_pairs: ['EUR/USD', 'EUR/GBP', 'EUR/JPY', 'EUR/CHF'],
    priority: 1,
    enabled: true,
    api_config: {
      endpoint: 'https://api.exchangerate-api.com/v4/latest/',
      update_frequency: '1h',
      timeout: 10000
    },
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    source_id: 'fxs_002',
    name: 'Binance Exchange',
    type: 'MARKET',
    provider: 'BINANCE',
    supported_pairs: ['BTC/USD', 'ETH/USD', 'USDT/USD', 'USDC/USD'],
    priority: 1,
    enabled: true,
    api_config: {
      endpoint: 'https://api.binance.com/api/v3/ticker/price',
      update_frequency: '5m',
      timeout: 5000
    },
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    source_id: 'fxs_003',
    name: 'Stripe Provider Rates',
    type: 'PROVIDER',
    provider: 'STRIPE',
    supported_pairs: ['USD/EUR', 'USD/GBP', 'USD/CAD', 'USD/AUD'],
    priority: 2,
    enabled: true,
    api_config: {
      endpoint: 'internal',
      update_frequency: '15m',
      timeout: 30000
    },
    created_at: '2024-01-01T00:00:00Z'
  }
];

export const demoFxPolicies: FxPolicy[] = [
  {
    policy_id: 'fxp_001',
    scope_type: 'SUPER_ADMIN',
    scope_id: 'system',
    markup_bps: 50,
    fixed_spread: 0.001,
    rounding_mode: 'BANKERS',
    staleness_cap_minutes: 60,
    weekend_mode: 'FREEZE',
    enabled_sources: ['fxs_001', 'fxs_002', 'fxs_003'],
    fallback_source: 'fxs_001',
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    policy_id: 'fxp_002',
    scope_type: 'PARTNER',
    scope_id: 'ptr_001',
    markup_bps: 75,
    fixed_spread: 0.002,
    rounding_mode: 'BANKERS',
    staleness_cap_minutes: 30,
    weekend_mode: 'EXTEND',
    enabled_sources: ['fxs_001', 'fxs_003'],
    fallback_source: 'fxs_001',
    created_at: '2024-01-15T08:00:00Z'
  },
  {
    policy_id: 'fxp_003',
    scope_type: 'AGENT',
    scope_id: 'agt_001',
    markup_bps: 100,
    fixed_spread: 0.003,
    rounding_mode: 'HALF_UP',
    staleness_cap_minutes: 15,
    weekend_mode: 'MARKET',
    enabled_sources: ['fxs_001'],
    fallback_source: 'fxs_001',
    created_at: '2024-01-17T10:00:00Z'
  }
];

export const demoFxSnapshots: FxSnapshot[] = [
  {
    fx_id: 'fx_001',
    from_currency: 'USD',
    to_currency: 'EUR',
    source: 'ECB',
    raw_rate: 0.925847,
    final_rate: 0.925800,
    markup_bps: 50,
    fixed_spread: 0.001,
    rounding_mode: 'BANKERS',
    scale: 6,
    is_stale: false,
    created_at: '2024-01-20T16:00:00Z'
  },
  {
    fx_id: 'fx_002',
    from_currency: 'BTC',
    to_currency: 'USD',
    source: 'BINANCE',
    raw_rate: 42567.891234,
    final_rate: 42567.890000,
    markup_bps: 100,
    fixed_spread: 0.000000,
    rounding_mode: 'BANKERS',
    scale: 6,
    is_stale: false,
    created_at: '2024-01-20T16:00:00Z'
  },
  {
    fx_id: 'fx_003',
    from_currency: 'GBP',
    to_currency: 'USD',
    source: 'ECB',
    raw_rate: 1.267845,
    final_rate: 1.267800,
    markup_bps: 75,
    fixed_spread: 0.002,
    rounding_mode: 'BANKERS',
    scale: 6,
    is_stale: false,
    created_at: '2024-01-20T16:00:00Z'
  }
];

export const demoFeePolicies: FeePolicy[] = [
  {
    fee_id: 'fp_001',
    scope_type: 'SUPER_ADMIN',
    scope_id: 'system',
    channel_type: 'CARD',
    provider_alias: 'stripe_main',
    percentage: 2.9,
    fixed_amount: 0.30,
    min_cap: 0.50,
    max_cap: 100.00,
    currency: 'USD',
    override_lower_levels: false,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    fee_id: 'fp_002',
    scope_type: 'PARTNER',
    scope_id: 'ptr_001',
    channel_type: 'CARD',
    percentage: 3.2,
    fixed_amount: 0.35,
    min_cap: 0.60,
    max_cap: 150.00,
    currency: 'USD',
    override_lower_levels: false,
    created_at: '2024-01-15T08:00:00Z'
  },
  {
    fee_id: 'fp_003',
    scope_type: 'AGENT',
    scope_id: 'agt_001',
    channel_type: 'BANK_TRANSFER',
    percentage: 1.5,
    fixed_amount: 0.50,
    min_cap: 1.00,
    max_cap: 50.00,
    currency: 'USD',
    override_lower_levels: false,
    created_at: '2024-01-17T10:00:00Z'
  },
  {
    fee_id: 'fp_004',
    scope_type: 'MERCHANT',
    scope_id: 'mrc_001',
    channel_type: 'EWALLET',
    percentage: 2.5,
    fixed_amount: 0.25,
    min_cap: 0.40,
    max_cap: 75.00,
    currency: 'USD',
    override_lower_levels: true,
    created_at: '2024-01-18T11:00:00Z'
  }
];

export const demoFeeBreakdowns: FeeBreakdown[] = [
  {
    fee_id: 'fb_001',
    transaction_id: 'txn_001',
    provider_cost_native: 3.65,
    provider_cost_currency: 'USD',
    provider_cost_converted: 3.65,
    merchant_fee: 4.23,
    fee_currency: 'USD',
    profit: 0.58,
    profit_currency: 'USD',
    fx_rate_used: 1.0,
    rounding_mode: 'BANKERS',
    scale: 6,
    calculation_details: {
      base_amount: 125.50,
      percentage_fee: 3.64,
      fixed_fee: 0.30,
      min_cap_applied: false,
      max_cap_applied: false,
      markup_levels: [
        { level: 'SUPER_ADMIN', percentage: 2.9, fixed: 0.30 },
        { level: 'PARTNER', percentage: 0.3, fixed: 0.05 }
      ]
    },
    created_at: '2024-01-20T14:22:00Z'
  },
  {
    fee_id: 'fb_002',
    transaction_id: 'txn_002',
    provider_cost_native: 6.00,
    provider_cost_currency: 'USD',
    provider_cost_converted: 6.00,
    merchant_fee: 8.20,
    fee_currency: 'USD',
    profit: 2.20,
    profit_currency: 'USD',
    fx_rate_used: 1.0,
    rounding_mode: 'BANKERS',
    scale: 6,
    calculation_details: {
      base_amount: 500.00,
      percentage_fee: 7.50,
      fixed_fee: 0.50,
      min_cap_applied: false,
      max_cap_applied: false,
      markup_levels: [
        { level: 'SUPER_ADMIN', percentage: 1.2, fixed: 0.50 },
        { level: 'AGENT', percentage: 0.3, fixed: 0.00 }
      ]
    },
    created_at: '2024-01-20T15:45:00Z'
  }
];