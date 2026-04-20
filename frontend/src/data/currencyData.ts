import { Currency, CurrencyPolicy, FxSnapshot } from '../types/currency';

export const demoCurrencies: Currency[] = [
  // Fiat Currencies
  {
    currency_id: 'cur_001',
    code: 'USD',
    name: 'US Dollar',
    symbol: '$',
    type: 'fiat',
    precision: 2,
    enabled: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    currency_id: 'cur_002',
    code: 'EUR',
    name: 'Euro',
    symbol: '€',
    type: 'fiat',
    precision: 2,
    enabled: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    currency_id: 'cur_003',
    code: 'GBP',
    name: 'British Pound',
    symbol: '£',
    type: 'fiat',
    precision: 2,
    enabled: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    currency_id: 'cur_004',
    code: 'AUD',
    name: 'Australian Dollar',
    symbol: 'A$',
    type: 'fiat',
    precision: 2,
    enabled: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    currency_id: 'cur_005',
    code: 'MYR',
    name: 'Malaysian Ringgit',
    symbol: 'RM',
    type: 'fiat',
    precision: 2,
    enabled: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    currency_id: 'cur_006',
    code: 'CAD',
    name: 'Canadian Dollar',
    symbol: 'C$',
    type: 'fiat',
    precision: 2,
    enabled: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    currency_id: 'cur_007',
    code: 'JPY',
    name: 'Japanese Yen',
    symbol: '¥',
    type: 'fiat',
    precision: 0,
    enabled: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    currency_id: 'cur_008',
    code: 'CHF',
    name: 'Swiss Franc',
    symbol: 'CHF',
    type: 'fiat',
    precision: 2,
    enabled: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  // Crypto Currencies
  {
    currency_id: 'cur_009',
    code: 'BTC',
    name: 'Bitcoin',
    symbol: '₿',
    type: 'crypto',
    precision: 8,
    enabled: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    currency_id: 'cur_010',
    code: 'USDT',
    name: 'Tether USD',
    symbol: 'USDT',
    type: 'crypto',
    precision: 6,
    enabled: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    currency_id: 'cur_011',
    code: 'USDC',
    name: 'USD Coin',
    symbol: 'USDC',
    type: 'crypto',
    precision: 6,
    enabled: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    currency_id: 'cur_012',
    code: 'ETH',
    name: 'Ethereum',
    symbol: 'Ξ',
    type: 'crypto',
    precision: 18,
    enabled: true,
    created_at: '2024-01-01T00:00:00Z'
  }
];

export const demoCurrencyPolicies: CurrencyPolicy[] = [
  {
    policy_id: 'cp_001',
    scope_type: 'SUPER_ADMIN',
    scope_id: 'system',
    enabled_currencies: ['USD', 'EUR', 'GBP', 'AUD', 'MYR', 'CAD', 'JPY', 'CHF', 'BTC', 'USDT', 'USDC', 'ETH'],
    default_currency: 'USD',
    settlement_currencies: ['USD', 'EUR', 'GBP'],
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    policy_id: 'cp_002',
    scope_type: 'PARTNER',
    scope_id: 'ptr_001',
    enabled_currencies: ['USD', 'EUR', 'GBP', 'CAD'],
    default_currency: 'USD',
    settlement_currencies: ['USD', 'EUR'],
    created_at: '2024-01-15T08:00:00Z'
  },
  {
    policy_id: 'cp_003',
    scope_type: 'PARTNER',
    scope_id: 'ptr_002',
    enabled_currencies: ['EUR', 'USD', 'GBP'],
    default_currency: 'EUR',
    settlement_currencies: ['EUR', 'USD'],
    created_at: '2024-01-16T09:30:00Z'
  },
  {
    policy_id: 'cp_004',
    scope_type: 'AGENT',
    scope_id: 'agt_001',
    enabled_currencies: ['USD', 'EUR'],
    default_currency: 'USD',
    settlement_currencies: ['USD'],
    created_at: '2024-01-17T10:00:00Z'
  },
  {
    policy_id: 'cp_005',
    scope_type: 'MERCHANT',
    scope_id: 'mrc_001',
    enabled_currencies: ['USD', 'EUR'],
    default_currency: 'USD',
    settlement_currencies: ['USD'],
    created_at: '2024-01-18T11:00:00Z'
  }
];

export const demoFxSnapshots: FxSnapshot[] = [
  {
    fx_id: 'fx_001',
    from_currency: 'USD',
    to_currency: 'EUR',
    source: 'MARKET',
    raw_rate: 0.925847,
    final_rate: 0.925800,
    markup_bps: 50,
    rounding_mode: 'BANKERS',
    scale: 6,
    created_at: '2024-01-20T16:00:00Z'
  },
  {
    fx_id: 'fx_002',
    from_currency: 'EUR',
    to_currency: 'USD',
    source: 'MARKET',
    raw_rate: 1.080234,
    final_rate: 1.080200,
    markup_bps: 50,
    rounding_mode: 'BANKERS',
    scale: 6,
    created_at: '2024-01-20T16:00:00Z'
  },
  {
    fx_id: 'fx_003',
    from_currency: 'USD',
    to_currency: 'GBP',
    source: 'MARKET',
    raw_rate: 0.789456,
    final_rate: 0.789400,
    markup_bps: 75,
    rounding_mode: 'BANKERS',
    scale: 6,
    created_at: '2024-01-20T16:00:00Z'
  },
  {
    fx_id: 'fx_004',
    from_currency: 'BTC',
    to_currency: 'USD',
    source: 'PROVIDER',
    raw_rate: 42567.891234,
    final_rate: 42567.890000,
    markup_bps: 100,
    rounding_mode: 'BANKERS',
    scale: 6,
    created_at: '2024-01-20T16:00:00Z'
  },
  {
    fx_id: 'fx_005',
    from_currency: 'USDT',
    to_currency: 'USD',
    source: 'PROVIDER',
    raw_rate: 0.999876,
    final_rate: 0.999900,
    markup_bps: 25,
    rounding_mode: 'BANKERS',
    scale: 6,
    created_at: '2024-01-20T16:00:00Z'
  }
];