import { 
  SettlementTerm, 
  SettlementPolicy, 
  Settlement, 
  SettlementBatch, 
  SettlementTransaction,
  SettlementReport,
  HolidayCalendar
} from '../types/settlements';

export const demoSettlementTerms: SettlementTerm[] = [
  {
    term_id: 'st_001',
    code: 'T+0',
    name: 'Same Day Settlement',
    description: 'Funds settled on the same business day',
    business_days_offset: 0,
    calendar_days_offset: 0,
    enabled: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    term_id: 'st_002',
    code: 'T+1',
    name: 'Next Day Settlement',
    description: 'Funds settled on the next business day',
    business_days_offset: 1,
    calendar_days_offset: 1,
    enabled: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    term_id: 'st_003',
    code: 'T+2',
    name: 'Two Day Settlement',
    description: 'Funds settled two business days later',
    business_days_offset: 2,
    calendar_days_offset: 2,
    enabled: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    term_id: 'st_004',
    code: 'WEEKLY',
    name: 'Weekly Settlement',
    description: 'Funds settled once per week',
    business_days_offset: 7,
    calendar_days_offset: 7,
    enabled: true,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    term_id: 'st_005',
    code: 'MONTHLY',
    name: 'Monthly Settlement',
    description: 'Funds settled once per month',
    business_days_offset: 30,
    calendar_days_offset: 30,
    enabled: true,
    created_at: '2024-01-01T00:00:00Z'
  }
];

export const demoSettlementPolicies: SettlementPolicy[] = [
  {
    policy_id: 'sp_001',
    scope_type: 'SUPER_ADMIN',
    scope_id: 'system',
    settlement_term: 'T+1',
    cutoff_hour: 18,
    cutoff_minute: 0,
    banking_days_only: true,
    settlement_currency: 'USD',
    settlement_timezone: 'UTC',
    auto_settlement: true,
    min_settlement_amount: 10.00,
    max_settlement_amount: 1000000.00,
    weekend_mode: 'NEXT_BUSINESS_DAY',
    holiday_calendar: 'US',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    policy_id: 'sp_002',
    scope_type: 'PARTNER',
    scope_id: 'ptr_001',
    settlement_term: 'T+1',
    cutoff_hour: 17,
    cutoff_minute: 30,
    banking_days_only: true,
    settlement_currency: 'USD',
    settlement_timezone: 'America/New_York',
    auto_settlement: true,
    min_settlement_amount: 25.00,
    max_settlement_amount: 500000.00,
    weekend_mode: 'NEXT_BUSINESS_DAY',
    holiday_calendar: 'US',
    created_at: '2024-01-15T08:00:00Z',
    updated_at: '2024-01-15T08:00:00Z'
  },
  {
    policy_id: 'sp_003',
    scope_type: 'PARTNER',
    scope_id: 'ptr_002',
    settlement_term: 'T+2',
    cutoff_hour: 16,
    cutoff_minute: 0,
    banking_days_only: true,
    settlement_currency: 'EUR',
    settlement_timezone: 'Europe/London',
    auto_settlement: true,
    min_settlement_amount: 20.00,
    max_settlement_amount: 750000.00,
    weekend_mode: 'SKIP',
    holiday_calendar: 'GB',
    created_at: '2024-01-16T09:30:00Z',
    updated_at: '2024-01-16T09:30:00Z'
  },
  {
    policy_id: 'sp_004',
    scope_type: 'AGENT',
    scope_id: 'agt_001',
    settlement_term: 'T+1',
    cutoff_hour: 15,
    cutoff_minute: 0,
    banking_days_only: true,
    settlement_currency: 'USD',
    settlement_timezone: 'America/Los_Angeles',
    auto_settlement: true,
    min_settlement_amount: 50.00,
    max_settlement_amount: 100000.00,
    weekend_mode: 'NEXT_BUSINESS_DAY',
    holiday_calendar: 'US',
    created_at: '2024-01-17T10:00:00Z',
    updated_at: '2024-01-17T10:00:00Z'
  },
  {
    policy_id: 'sp_005',
    scope_type: 'MERCHANT',
    scope_id: 'mrc_001',
    settlement_term: 'WEEKLY',
    cutoff_hour: 14,
    cutoff_minute: 0,
    banking_days_only: true,
    settlement_currency: 'USD',
    settlement_timezone: 'America/Chicago',
    auto_settlement: false,
    min_settlement_amount: 100.00,
    max_settlement_amount: 50000.00,
    weekend_mode: 'SKIP',
    holiday_calendar: 'US',
    created_at: '2024-01-18T11:00:00Z',
    updated_at: '2024-01-18T11:00:00Z'
  }
];

export const demoSettlements: Settlement[] = [
  {
    settlement_id: 'stl_001',
    merchant_id: 'mrc_001',
    settlement_batch_id: 'sb_001',
    settlement_currency: 'USD',
    settlement_timezone: 'America/New_York',
    gross_amount: 2456.78,
    fee_amount: 89.45,
    reserve_amount: 122.84,
    net_amount: 2244.49,
    fx_rate_used: 1.0,
    native_amount: 2244.49,
    native_currency: 'USD',
    status: 'COMPLETED',
    expected_settlement_date: '2024-01-21T18:00:00Z',
    actual_settlement_date: '2024-01-21T17:45:00Z',
    settlement_reference: 'STL-20240121-001',
    bank_reference: 'BNK-REF-789456123',
    created_at: '2024-01-20T18:00:00Z',
    updated_at: '2024-01-21T17:45:00Z'
  },
  {
    settlement_id: 'stl_002',
    merchant_id: 'mrc_002',
    settlement_batch_id: 'sb_001',
    settlement_currency: 'EUR',
    settlement_timezone: 'Europe/London',
    gross_amount: 1876.34,
    fee_amount: 67.89,
    reserve_amount: 93.82,
    net_amount: 1714.63,
    fx_rate_used: 0.925800,
    native_amount: 1588.42,
    native_currency: 'USD',
    status: 'PROCESSING',
    expected_settlement_date: '2024-01-22T16:00:00Z',
    settlement_reference: 'STL-20240122-002',
    created_at: '2024-01-21T16:00:00Z',
    updated_at: '2024-01-21T16:00:00Z'
  },
  {
    settlement_id: 'stl_003',
    merchant_id: 'mrc_001',
    settlement_batch_id: 'sb_002',
    settlement_currency: 'USD',
    settlement_timezone: 'America/Chicago',
    gross_amount: 3567.89,
    fee_amount: 125.67,
    reserve_amount: 178.39,
    net_amount: 3263.83,
    fx_rate_used: 1.0,
    native_amount: 3263.83,
    native_currency: 'USD',
    status: 'PENDING',
    expected_settlement_date: '2024-01-23T14:00:00Z',
    settlement_reference: 'STL-20240123-003',
    created_at: '2024-01-22T14:00:00Z',
    updated_at: '2024-01-22T14:00:00Z'
  },
  {
    settlement_id: 'stl_004',
    merchant_id: 'mrc_003',
    settlement_batch_id: 'sb_002',
    settlement_currency: 'GBP',
    settlement_timezone: 'Europe/London',
    gross_amount: 987.65,
    fee_amount: 34.56,
    reserve_amount: 49.38,
    net_amount: 903.71,
    fx_rate_used: 0.789400,
    native_amount: 713.63,
    native_currency: 'USD',
    status: 'FAILED',
    expected_settlement_date: '2024-01-22T16:00:00Z',
    settlement_reference: 'STL-20240122-004',
    failure_reason: 'Invalid bank account details',
    created_at: '2024-01-21T16:00:00Z',
    updated_at: '2024-01-22T09:30:00Z'
  }
];

export const demoSettlementBatches: SettlementBatch[] = [
  {
    batch_id: 'sb_001',
    partner_id: 'ptr_001',
    settlement_date: '2024-01-21',
    cutoff_time: '18:00:00',
    total_settlements: 45,
    total_amount: 156789.45,
    batch_currency: 'USD',
    status: 'COMPLETED',
    processing_started_at: '2024-01-21T18:00:00Z',
    processing_completed_at: '2024-01-21T18:45:00Z',
    bank_file_reference: 'BATCH-20240121-PTR001.xml',
    created_at: '2024-01-21T18:00:00Z'
  },
  {
    batch_id: 'sb_002',
    partner_id: 'ptr_001',
    settlement_date: '2024-01-22',
    cutoff_time: '17:30:00',
    total_settlements: 32,
    total_amount: 98765.32,
    batch_currency: 'USD',
    status: 'PROCESSING',
    processing_started_at: '2024-01-22T17:30:00Z',
    created_at: '2024-01-22T17:30:00Z'
  },
  {
    batch_id: 'sb_003',
    partner_id: 'ptr_002',
    settlement_date: '2024-01-23',
    cutoff_time: '16:00:00',
    total_settlements: 28,
    total_amount: 67890.12,
    batch_currency: 'EUR',
    status: 'CREATED',
    created_at: '2024-01-23T16:00:00Z'
  }
];

export const demoSettlementTransactions: SettlementTransaction[] = [
  {
    settlement_txn_id: 'stxn_001',
    settlement_id: 'stl_001',
    transaction_id: 'txn_001',
    amount: 125.50,
    currency: 'USD',
    fee_amount: 4.23,
    reserve_amount: 6.28,
    settlement_amount: 114.99,
    fx_rate: 1.0,
    created_at: '2024-01-20T18:00:00Z'
  },
  {
    settlement_txn_id: 'stxn_002',
    settlement_id: 'stl_001',
    transaction_id: 'txn_002',
    amount: 500.00,
    currency: 'USD',
    fee_amount: 7.25,
    reserve_amount: 25.00,
    settlement_amount: 467.75,
    fx_rate: 1.0,
    created_at: '2024-01-20T18:00:00Z'
  },
  {
    settlement_txn_id: 'stxn_003',
    settlement_id: 'stl_002',
    transaction_id: 'txn_005',
    amount: 89.99,
    currency: 'EUR',
    fee_amount: 3.12,
    reserve_amount: 4.50,
    settlement_amount: 82.37,
    fx_rate: 0.925800,
    created_at: '2024-01-21T16:00:00Z'
  }
];

export const demoSettlementReports: SettlementReport[] = [
  {
    report_id: 'sr_001',
    scope_type: 'PARTNER',
    scope_id: 'ptr_001',
    period_start: '2024-01-01T00:00:00Z',
    period_end: '2024-01-21T23:59:59Z',
    total_settlements: 156,
    total_amount: 567890.45,
    currency: 'USD',
    avg_settlement_time_hours: 26.5,
    on_time_percentage: 94.2,
    delayed_settlements: 9,
    failed_settlements: 3,
    fx_margin_earned: 2345.67,
    created_at: '2024-01-22T00:00:00Z'
  },
  {
    report_id: 'sr_002',
    scope_type: 'AGENT',
    scope_id: 'agt_001',
    period_start: '2024-01-01T00:00:00Z',
    period_end: '2024-01-21T23:59:59Z',
    total_settlements: 89,
    total_amount: 234567.89,
    currency: 'USD',
    avg_settlement_time_hours: 24.8,
    on_time_percentage: 96.6,
    delayed_settlements: 3,
    failed_settlements: 1,
    fx_margin_earned: 1234.56,
    created_at: '2024-01-22T00:00:00Z'
  },
  {
    report_id: 'sr_003',
    scope_type: 'MERCHANT',
    scope_id: 'mrc_001',
    period_start: '2024-01-01T00:00:00Z',
    period_end: '2024-01-21T23:59:59Z',
    total_settlements: 45,
    total_amount: 123456.78,
    currency: 'USD',
    avg_settlement_time_hours: 25.2,
    on_time_percentage: 97.8,
    delayed_settlements: 1,
    failed_settlements: 0,
    fx_margin_earned: 567.89,
    created_at: '2024-01-22T00:00:00Z'
  }
];

export const demoHolidayCalendars: HolidayCalendar[] = [
  {
    calendar_id: 'hc_001',
    country_code: 'US',
    year: 2024,
    holidays: [
      { date: '2024-01-01', name: 'New Year\'s Day', type: 'BANK' },
      { date: '2024-01-15', name: 'Martin Luther King Jr. Day', type: 'BANK' },
      { date: '2024-02-19', name: 'Presidents\' Day', type: 'BANK' },
      { date: '2024-05-27', name: 'Memorial Day', type: 'BANK' },
      { date: '2024-06-19', name: 'Juneteenth', type: 'BANK' },
      { date: '2024-07-04', name: 'Independence Day', type: 'BANK' },
      { date: '2024-09-02', name: 'Labor Day', type: 'BANK' },
      { date: '2024-10-14', name: 'Columbus Day', type: 'BANK' },
      { date: '2024-11-11', name: 'Veterans Day', type: 'BANK' },
      { date: '2024-11-28', name: 'Thanksgiving Day', type: 'BANK' },
      { date: '2024-12-25', name: 'Christmas Day', type: 'BANK' }
    ]
  },
  {
    calendar_id: 'hc_002',
    country_code: 'GB',
    year: 2024,
    holidays: [
      { date: '2024-01-01', name: 'New Year\'s Day', type: 'BANK' },
      { date: '2024-03-29', name: 'Good Friday', type: 'BANK' },
      { date: '2024-04-01', name: 'Easter Monday', type: 'BANK' },
      { date: '2024-05-06', name: 'Early May Bank Holiday', type: 'BANK' },
      { date: '2024-05-27', name: 'Spring Bank Holiday', type: 'BANK' },
      { date: '2024-08-26', name: 'Summer Bank Holiday', type: 'BANK' },
      { date: '2024-12-25', name: 'Christmas Day', type: 'BANK' },
      { date: '2024-12-26', name: 'Boxing Day', type: 'BANK' }
    ]
  },
  {
    calendar_id: 'hc_003',
    country_code: 'EU',
    year: 2024,
    holidays: [
      { date: '2024-01-01', name: 'New Year\'s Day', type: 'BANK' },
      { date: '2024-03-29', name: 'Good Friday', type: 'BANK' },
      { date: '2024-04-01', name: 'Easter Monday', type: 'BANK' },
      { date: '2024-05-01', name: 'Labour Day', type: 'BANK' },
      { date: '2024-12-25', name: 'Christmas Day', type: 'BANK' },
      { date: '2024-12-26', name: 'Boxing Day', type: 'BANK' }
    ]
  }
];