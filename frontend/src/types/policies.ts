export interface ReservePolicy {
  policy_id: string;
  scope_type: 'SUPER_ADMIN' | 'PARTNER' | 'AGENT' | 'MERCHANT';
  scope_id: string;
  enabled: boolean;
  hold_percentage: number; // DECIMAL(18,6) - percentage to hold
  duration_days: number; // days to hold funds
  release_frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ON_DEMAND';
  release_threshold?: number; // DECIMAL(18,6) - minimum amount to release
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface SecurityDepositPolicy {
  policy_id: string;
  scope_type: 'SUPER_ADMIN' | 'PARTNER' | 'AGENT' | 'MERCHANT';
  scope_id: string;
  enabled: boolean;
  required_deposit: number; // DECIMAL(18,6) - fixed deposit amount
  withholding_percentage: number; // DECIMAL(18,6) - percentage to withhold
  upfront_required: boolean; // whether deposit is required upfront
  refundable: boolean; // whether deposit is refundable
  refund_conditions: string; // conditions for refund
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface PenaltyPolicy {
  policy_id: string;
  scope_type: 'SUPER_ADMIN' | 'PARTNER' | 'AGENT' | 'MERCHANT';
  scope_id: string;
  enabled: boolean;
  trigger_type: 'CHARGEBACK' | 'SLA_BREACH' | 'HIGH_RISK' | 'COMPLIANCE_VIOLATION';
  threshold_amount?: number; // DECIMAL(18,6) - amount threshold for penalty
  threshold_percentage?: number; // DECIMAL(18,6) - percentage threshold
  penalty_type: 'FIXED' | 'PERCENTAGE';
  penalty_amount: number; // DECIMAL(18,6) - fixed amount or percentage
  apply_to: 'PAYOUT' | 'INVOICE';
  max_penalty_amount?: number; // DECIMAL(18,6) - cap on penalty
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface OperatingWindow {
  day_of_week: number; // 0-6, 0 = Sunday
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  timezone: string;
}

export interface MethodPolicy {
  policy_id: string;
  scope_type: 'SUPER_ADMIN' | 'PARTNER' | 'AGENT' | 'MERCHANT';
  scope_id: string;
  channel_type?: string;
  provider_alias?: string;
  enabled: boolean;
  min_transaction_amount: number; // DECIMAL(18,6)
  max_transaction_amount: number; // DECIMAL(18,6)
  daily_limit: number; // DECIMAL(18,6)
  rolling_limit_days: number; // number of days for rolling limit
  rolling_limit_amount: number; // DECIMAL(18,6)
  operating_mode: '24_7' | 'WINDOWED' | 'BANKING_DAYS';
  operating_windows: OperatingWindow[]; // JSON array of operating windows
  holiday_calendar_country?: string; // ISO country code
  action_on_limit: 'BLOCK' | 'ROUTE_FALLBACK' | 'QUEUE';
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface HolidayCalendar {
  country_code: string;
  year: number;
  holidays: Array<{
    date: string; // YYYY-MM-DD
    name: string;
    type: 'BANK' | 'PUBLIC' | 'RELIGIOUS';
  }>;
}