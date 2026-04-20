import { SettlementPolicy, Settlement, SettlementBatch, HolidayCalendar } from '../types/settlements';
import { CurrencyFormatter } from './currency';
import { FxEngine } from './routing';

export class SettlementEngine {
  private static settlementPolicies: Map<string, SettlementPolicy> = new Map();
  private static holidayCalendars: Map<string, HolidayCalendar> = new Map();

  static setSettlementPolicies(policies: SettlementPolicy[]) {
    this.settlementPolicies.clear();
    policies.forEach(policy => {
      const key = `${policy.scope_type}:${policy.scope_id}`;
      this.settlementPolicies.set(key, policy);
    });
  }

  static setHolidayCalendars(calendars: HolidayCalendar[]) {
    this.holidayCalendars.clear();
    calendars.forEach(calendar => {
      this.holidayCalendars.set(calendar.country_code, calendar);
    });
  }


  static async processSettlement(
    merchantId: string,
    transactions: any[],
    settlementPolicy: SettlementPolicy
  ): Promise<Settlement> {
    const settlementId = `stl_${Date.now()}`;
    
    // Calculate gross amount from transactions
    const grossAmount = transactions.reduce((sum, txn) => sum + txn.amount, 0);
    
    // Calculate fees and reserves
    const feeAmount = transactions.reduce((sum, txn) => sum + (txn.merchant_fee || 0), 0);
    const reserveAmount = grossAmount * 0.05; // 5% reserve
    const netAmount = grossAmount - feeAmount - reserveAmount;

    // Calculate expected settlement date
    const expectedDate = await this.calculateSettlementDate(
      new Date().toISOString(),
      settlementPolicy.settlement_term,
      settlementPolicy.cutoff_hour,
      settlementPolicy.banking_days_only,
      settlementPolicy.settlement_timezone,
      settlementPolicy.holiday_calendar
    );

    // Handle currency conversion if needed
    let fxRate = 1.0;
    let nativeAmount = netAmount;
    let nativeCurrency = settlementPolicy.settlement_currency;

    if (transactions[0]?.currency !== settlementPolicy.settlement_currency) {
      const fxResult = await FxEngine.convertCurrency(
        netAmount,
        transactions[0].currency,
        settlementPolicy.settlement_currency,
        'MERCHANT',
        merchantId
      );
      fxRate = fxResult.finalRate;
      nativeAmount = fxResult.convertedAmount;
    }

    return {
      settlement_id: settlementId,
      merchant_id: merchantId,
      settlement_batch_id: `sb_${Date.now()}`,
      settlement_currency: settlementPolicy.settlement_currency,
      settlement_timezone: settlementPolicy.settlement_timezone,
      gross_amount: CurrencyFormatter.roundAmount(grossAmount, 6, 'BANKERS'),
      fee_amount: CurrencyFormatter.roundAmount(feeAmount, 6, 'BANKERS'),
      reserve_amount: CurrencyFormatter.roundAmount(reserveAmount, 6, 'BANKERS'),
      net_amount: CurrencyFormatter.roundAmount(netAmount, 6, 'BANKERS'),
      fx_rate_used: fxRate,
      native_amount: CurrencyFormatter.roundAmount(nativeAmount, 6, 'BANKERS'),
      native_currency: nativeCurrency,
      status: 'PENDING',
      expected_settlement_date: expectedDate,
      settlement_reference: `STL-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${settlementId.slice(-3)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  }

  static async calculateSettlementDate(
    transactionDate: string,
    settlementTerm: string,
    cutoffHour: number,
    bankingDaysOnly: boolean,
    timezone: string,
    holidayCalendar: string
  ): Promise<string> {
    const txnDate = new Date(transactionDate);
    const cutoffToday = new Date(txnDate);
    cutoffToday.setHours(cutoffHour, 0, 0, 0);

    let settlementDate = new Date(txnDate);

    // If transaction is after cutoff, move to next day
    if (txnDate > cutoffToday) {
      settlementDate.setDate(settlementDate.getDate() + 1);
    }

    // Apply settlement term offset
    switch (settlementTerm) {
      case 'T+0':
        // Same day if before cutoff, next day if after
        break;
      case 'T+1':
        settlementDate.setDate(settlementDate.getDate() + 1);
        break;
      case 'T+2':
        settlementDate.setDate(settlementDate.getDate() + 2);
        break;
      case 'WEEKLY':
        // Next Friday
        const daysUntilFriday = (5 - settlementDate.getDay() + 7) % 7;
        settlementDate.setDate(settlementDate.getDate() + (daysUntilFriday || 7));
        break;
      case 'MONTHLY':
        // Last business day of month
        settlementDate.setMonth(settlementDate.getMonth() + 1, 0);
        break;
    }

    // Adjust for banking days and holidays
    if (bankingDaysOnly) {
      settlementDate = this.adjustForBusinessDays(settlementDate, holidayCalendar);
    }

    return settlementDate.toISOString();
  }

  private static adjustForBusinessDays(date: Date, holidayCalendar: string): Date {
    const calendar = this.holidayCalendars.get(holidayCalendar);
    const adjustedDate = new Date(date);

    // Skip weekends
    while (adjustedDate.getDay() === 0 || adjustedDate.getDay() === 6) {
      adjustedDate.setDate(adjustedDate.getDate() + 1);
    }

    // Skip holidays
    if (calendar) {
      const dateString = adjustedDate.toISOString().split('T')[0];
      const isHoliday = calendar.holidays.some(holiday => 
        holiday.date === dateString && holiday.type === 'BANK'
      );
      
      if (isHoliday) {
        adjustedDate.setDate(adjustedDate.getDate() + 1);
        return this.adjustForBusinessDays(adjustedDate, holidayCalendar);
      }
    }

    return adjustedDate;
  }

  static async convertSettlementCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    settlementDate: string
  ): Promise<{
    convertedAmount: number;
    fxRate: number;
    fxSnapshot: any;
  }> {
    if (fromCurrency === toCurrency) {
      return {
        convertedAmount: amount,
        fxRate: 1.0,
        fxSnapshot: null
      };
    }

    const fxResult = await FxEngine.convertCurrency(
      amount,
      fromCurrency,
      toCurrency,
      'SUPER_ADMIN',
      'system'
    );

    return {
      convertedAmount: fxResult.convertedAmount,
      fxRate: fxResult.finalRate,
      fxSnapshot: fxResult.fxSnapshot
    };
  }

  static calculateSettlementTiming(
    expectedDate: string,
    actualDate?: string
  ): {
    isOnTime: boolean;
    delayHours: number;
    status: 'ON_TIME' | 'DELAYED' | 'EARLY';
  } {
    const expected = new Date(expectedDate);
    const actual = actualDate ? new Date(actualDate) : new Date();
    
    const diffMs = actual.getTime() - expected.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    let status: 'ON_TIME' | 'DELAYED' | 'EARLY';
    if (Math.abs(diffHours) <= 2) {
      status = 'ON_TIME';
    } else if (diffHours > 2) {
      status = 'DELAYED';
    } else {
      status = 'EARLY';
    }

    return {
      isOnTime: Math.abs(diffHours) <= 2,
      delayHours: Math.abs(diffHours),
      status
    };
  }

  static findApplicablePolicy(
    merchantId: string,
    agentId?: string,
    partnerId?: string
  ): SettlementPolicy | null {
    // Try merchant-specific policy first
    let policy = this.settlementPolicies.get(`MERCHANT:${merchantId}`);
    if (policy) return policy;

    // Try agent policy
    if (agentId) {
      policy = this.settlementPolicies.get(`AGENT:${agentId}`);
      if (policy) return policy;
    }

    // Try partner policy
    if (partnerId) {
      policy = this.settlementPolicies.get(`PARTNER:${partnerId}`);
      if (policy) return policy;
    }

    // Fallback to system default
    return this.settlementPolicies.get('SUPER_ADMIN:system') || null;
  }

  static generateSettlementReference(
    settlementDate: string,
    merchantId: string,
    sequence: number
  ): string {
    const date = settlementDate.split('T')[0].replace(/-/g, '');
    const merchantCode = merchantId.slice(-3).toUpperCase();
    const seq = sequence.toString().padStart(3, '0');
    return `STL-${date}-${merchantCode}-${seq}`;
  }

  static validateSettlementPolicy(policy: SettlementPolicy): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (policy.cutoff_hour < 0 || policy.cutoff_hour > 23) {
      errors.push('Cutoff hour must be between 0 and 23');
    }

    if (policy.cutoff_minute < 0 || policy.cutoff_minute > 59) {
      errors.push('Cutoff minute must be between 0 and 59');
    }

    if (policy.min_settlement_amount < 0) {
      errors.push('Minimum settlement amount cannot be negative');
    }

    if (policy.max_settlement_amount <= policy.min_settlement_amount) {
      errors.push('Maximum settlement amount must be greater than minimum');
    }

    if (!['T+0', 'T+1', 'T+2', 'WEEKLY', 'MONTHLY'].includes(policy.settlement_term)) {
      errors.push('Invalid settlement term');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

export class SettlementReportEngine {
  static generatePerformanceReport(
    settlements: Settlement[],
    scopeType: string,
    scopeId: string,
    periodStart: string,
    periodEnd: string
  ): any {
    const filteredSettlements = settlements.filter(s => {
      const settlementDate = new Date(s.created_at);
      const start = new Date(periodStart);
      const end = new Date(periodEnd);
      return settlementDate >= start && settlementDate <= end;
    });

    const totalSettlements = filteredSettlements.length;
    const totalAmount = filteredSettlements.reduce((sum, s) => sum + s.net_amount, 0);
    
    const completedSettlements = filteredSettlements.filter(s => s.status === 'COMPLETED');
    const delayedSettlements = completedSettlements.filter(s => {
      if (!s.actual_settlement_date) return false;
      const timing = SettlementEngine.calculateSettlementTiming(
        s.expected_settlement_date,
        s.actual_settlement_date
      );
      return timing.status === 'DELAYED';
    });

    const failedSettlements = filteredSettlements.filter(s => s.status === 'FAILED');

    const avgSettlementTime = completedSettlements.length > 0 
      ? completedSettlements.reduce((sum, s) => {
          if (!s.actual_settlement_date) return sum;
          const expected = new Date(s.expected_settlement_date);
          const actual = new Date(s.actual_settlement_date);
          return sum + (actual.getTime() - expected.getTime()) / (1000 * 60 * 60);
        }, 0) / completedSettlements.length
      : 0;

    const onTimePercentage = completedSettlements.length > 0
      ? ((completedSettlements.length - delayedSettlements.length) / completedSettlements.length) * 100
      : 0;

    const fxMarginEarned = filteredSettlements.reduce((sum, s) => {
      if (s.fx_rate_used !== 1.0) {
        // Simplified FX margin calculation
        return sum + (s.net_amount * 0.001); // 0.1% FX margin
      }
      return sum;
    }, 0);

    return {
      report_id: `sr_${Date.now()}`,
      scope_type: scopeType,
      scope_id: scopeId,
      period_start: periodStart,
      period_end: periodEnd,
      total_settlements: totalSettlements,
      total_amount: CurrencyFormatter.roundAmount(totalAmount, 6, 'BANKERS'),
      currency: 'USD', // Default reporting currency
      avg_settlement_time_hours: Math.round(avgSettlementTime * 100) / 100,
      on_time_percentage: Math.round(onTimePercentage * 100) / 100,
      delayed_settlements: delayedSettlements.length,
      failed_settlements: failedSettlements.length,
      fx_margin_earned: CurrencyFormatter.roundAmount(fxMarginEarned, 6, 'BANKERS'),
      created_at: new Date().toISOString()
    };
  }

  static calculateExpectedVsActual(settlements: Settlement[]): {
    onTime: number;
    early: number;
    delayed: number;
    avgDelayHours: number;
  } {
    const completed = settlements.filter(s => s.status === 'COMPLETED' && s.actual_settlement_date);
    
    let onTime = 0;
    let early = 0;
    let delayed = 0;
    let totalDelayHours = 0;

    completed.forEach(settlement => {
      const timing = SettlementEngine.calculateSettlementTiming(
        settlement.expected_settlement_date,
        settlement.actual_settlement_date
      );

      switch (timing.status) {
        case 'ON_TIME':
          onTime++;
          break;
        case 'EARLY':
          early++;
          break;
        case 'DELAYED':
          delayed++;
          totalDelayHours += timing.delayHours;
          break;
      }
    });

    return {
      onTime,
      early,
      delayed,
      avgDelayHours: delayed > 0 ? totalDelayHours / delayed : 0
    };
  }

  static getSettlementSchedule(
    merchantId: string,
    policy: SettlementPolicy,
    startDate: string,
    endDate: string
  ): Array<{
    date: string;
    cutoffTime: string;
    isBusinessDay: boolean;
    isHoliday: boolean;
  }> {
    const schedule: Array<{
      date: string;
      cutoffTime: string;
      isBusinessDay: boolean;
      isHoliday: boolean;
    }> = [];

    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);

    while (current <= end) {
      const dateString = current.toISOString().split('T')[0];
      const isWeekend = current.getDay() === 0 || current.getDay() === 6;
      const isBusinessDay = !isWeekend;
      
      const calendar = this.holidayCalendars.get(policy.holiday_calendar);
      const isHoliday = calendar?.holidays.some(h => h.date === dateString && h.type === 'BANK') || false;

      // Determine if settlement should occur on this date
      let shouldSettle = false;
      switch (policy.settlement_term) {
        case 'T+0':
        case 'T+1':
        case 'T+2':
          shouldSettle = isBusinessDay && !isHoliday;
          break;
        case 'WEEKLY':
          shouldSettle = current.getDay() === 5 && isBusinessDay && !isHoliday; // Friday
          break;
        case 'MONTHLY':
          // Last business day of month
          const nextDay = new Date(current);
          nextDay.setDate(nextDay.getDate() + 1);
          shouldSettle = nextDay.getMonth() !== current.getMonth() && isBusinessDay && !isHoliday;
          break;
      }

      if (shouldSettle) {
        schedule.push({
          date: dateString,
          cutoffTime: `${policy.cutoff_hour.toString().padStart(2, '0')}:${policy.cutoff_minute.toString().padStart(2, '0')}`,
          isBusinessDay,
          isHoliday
        });
      }

      current.setDate(current.getDate() + 1);
    }

    return schedule;
  }
}

export const formatSettlementTerm = (term: string): string => {
  switch (term) {
    case 'T+0':
      return 'Same Day';
    case 'T+1':
      return 'Next Day';
    case 'T+2':
      return 'Two Days';
    case 'WEEKLY':
      return 'Weekly';
    case 'MONTHLY':
      return 'Monthly';
    default:
      return term;
  }
};

export const getSettlementStatusColor = (status: string): string => {
  switch (status) {
    case 'COMPLETED':
      return 'text-green-600 dark:text-green-400';
    case 'PROCESSING':
      return 'text-blue-600 dark:text-blue-400';
    case 'PENDING':
      return 'text-yellow-600 dark:text-yellow-400';
    case 'FAILED':
    case 'CANCELLED':
      return 'text-red-600 dark:text-red-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
};

export const calculateSettlementMetrics = (settlements: Settlement[]) => {
  const total = settlements.length;
  const completed = settlements.filter(s => s.status === 'COMPLETED').length;
  const pending = settlements.filter(s => s.status === 'PENDING').length;
  const processing = settlements.filter(s => s.status === 'PROCESSING').length;
  const failed = settlements.filter(s => s.status === 'FAILED').length;

  const totalAmount = settlements.reduce((sum, s) => sum + s.net_amount, 0);
  const completedAmount = settlements
    .filter(s => s.status === 'COMPLETED')
    .reduce((sum, s) => sum + s.net_amount, 0);

  const successRate = total > 0 ? (completed / total) * 100 : 0;

  return {
    total,
    completed,
    pending,
    processing,
    failed,
    totalAmount,
    completedAmount,
    successRate
  };
};