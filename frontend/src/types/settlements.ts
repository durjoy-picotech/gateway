export interface SettlementTerm {
  term_id: string;
  code: 'T+0' | 'T+1' | 'T+2' | 'WEEKLY' | 'MONTHLY';
  name: string;
  description: string;
  business_days_offset: number;
  calendar_days_offset: number;
  enabled: boolean;
  created_at: string;
}

export interface SettlementPolicy {
  policy_id: string;
  scope_type: 'SUPER_ADMIN' | 'PARTNER' | 'AGENT' | 'MERCHANT';
  scope_id: string;
  settlement_term: string;
  cutoff_hour: number; // 24-hour format (0-23)
  cutoff_minute: number;
  banking_days_only: boolean;
  settlement_currency: string;
  settlement_timezone: string;
  auto_settlement: boolean;
  min_settlement_amount: number;
  max_settlement_amount: number;
  weekend_mode: 'SKIP' | 'NEXT_BUSINESS_DAY' | 'PROCESS';
  holiday_calendar: string; // ISO country code for holiday calendar
  created_at: string;
  updated_at: string;
}

export interface Settlement {
  settlement_id: string;
  partner_id?: string;
  agent_id?: string;
  merchant_id?: string;
  settlement_batch_id?: string;
  settlement_currency: string;
  settlement_timezone: string;
  gross_amount: number;
  fee_amount: number;
  reserve_amount: number;
  net_amount: number;
  fx_rate_used: number;
  native_amount: number;
  native_currency: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  expected_settlement_date: string;
  actual_settlement_date?: string;
  settlement_reference: string;
  bank_reference?: string;
  failure_reason?: string;
  created_at: string;
  updated_at: string;
}

export interface SettlementBatch {
  batch_id: string;
  partner_id: string;
  settlement_date: string;
  cutoff_time: string;
  total_settlements: number;
  total_amount: number;
  batch_currency: string;
  status: 'CREATED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  processing_started_at?: string;
  processing_completed_at?: string;
  bank_file_reference?: string;
  created_at: string;
}

export interface SettlementTransaction {
  settlement_txn_id: string;
  settlement_id: string;
  transaction_id: string;
  amount: number;
  currency: string;
  fee_amount: number;
  reserve_amount: number;
  settlement_amount: number;
  fx_rate: number;
  created_at: string;
}

export interface SettlementReport {
  report_id: string;
  scope_type: string;
  scope_id: string;
  period_start: string;
  period_end: string;
  total_settlements: number;
  total_amount: number;
  currency: string;
  avg_settlement_time_hours: number;
  on_time_percentage: number;
  delayed_settlements: number;
  failed_settlements: number;
  fx_margin_earned: number;
  created_at: string;
}

export interface SettlementEngine {

  processSettlement(
    merchantId: string,
    transactions: string[],
    settlementPolicy: SettlementPolicy
  ): Promise<Settlement>;

  calculateSettlementDate(
    transactionDate: string,
    settlementTerm: string,
    cutoffHour: number,
    bankingDaysOnly: boolean,
    timezone: string,
    holidayCalendar: string
  ): Promise<string>;

  convertSettlementCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    settlementDate: string
  ): Promise<{
    convertedAmount: number;
    fxRate: number;
    fxSnapshot: any;
  }>;
}

export interface SettlementHolidayCalendar {
  calendar_id: string;
  country_code: string;
  year: number;
  holidays: Array<{
    date: string;
    name: string;
    type: 'BANK' | 'PUBLIC' | 'RELIGIOUS';
  }>;
}

export interface SettlementNotification {
  notification_id: string;
  settlement_id: string;
  type: 'SETTLEMENT_CREATED' | 'SETTLEMENT_PROCESSING' | 'SETTLEMENT_COMPLETED' | 'SETTLEMENT_FAILED' | 'SETTLEMENT_DELAYED';
  recipient_type: 'MERCHANT' | 'AGENT' | 'PARTNER' | 'SUPER_ADMIN';
  recipient_id: string;
  message: string;
  sent_at: string;
}