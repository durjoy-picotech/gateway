export interface KPIMetrics {
  volume: {
    total: number;
    approved: number;
    declined: number;
    approvalRate: number;
    declineRate: number;
  };
  byChannelType: Record<string, {
    volume: number;
    approved: number;
    declined: number;
    approvalRate: number;
  }>;
  byMethod: Record<string, {
    volume: number;
    approved: number;
    declined: number;
    approvalRate: number;
  }>;
  byVariant: Record<string, {
    volume: number;
    approved: number;
    declined: number;
    approvalRate: number;
  }>;
  byProviderAlias: Record<string, {
    volume: number;
    approved: number;
    declined: number;
    approvalRate: number;
  }>;
}

export interface FeeAnalytics {
  totalRevenue: number;
  revenueSplit: {
    superAdmin: number;
    partners: number;
    agents: number;
    merchants: number;
  };
  feeBreakdown: {
    gatewayFees: number;
    processingFees: number;
    fxFees: number;
    reserveFees: number;
  };
}

export interface FXMargins {
  totalMargin: number;
  averageMarginBps: number;
  marginByCurrencyPair: Record<string, {
    volume: number;
    margin: number;
    marginBps: number;
  }>;
  marginTrend: Array<{
    date: string;
    margin: number;
    volume: number;
  }>;
}

export interface SettlementPerformance {
  totalSettlements: number;
  successfulSettlements: number;
  failedSettlements: number;
  pendingSettlements: number;
  averageSettlementTime: number; // in hours
  settlementSuccessRate: number;
  settlementVolume: number;
  settlementFees: number;
}

export interface ReservesDepositsPenalties {
  totalReserves: number;
  availableReserves: number;
  heldReserves: number;
  deposits: number;
  penalties: number;
  reserveUtilization: number;
  reserveTrend: Array<{
    date: string;
    reserves: number;
    deposits: number;
    penalties: number;
  }>;
}

export interface BankReconciliation {
  totalTransactions: number;
  reconciledTransactions: number;
  unreconciledTransactions: number;
  reconciliationRate: number;
  discrepancies: number;
  discrepancyAmount: number;
  lastReconciliationDate: string;
}

export interface NotificationDeliveryStats {
  totalSent: number;
  delivered: number;
  failed: number;
  deliveryRate: number;
  averageDeliveryTime: number; // in seconds
  byType: Record<string, {
    sent: number;
    delivered: number;
    failed: number;
    deliveryRate: number;
  }>;
}

export interface AnalyticsData {
  kpis: KPIMetrics;
  fees: FeeAnalytics;
  fxMargins: FXMargins;
  settlementPerformance: SettlementPerformance;
  reservesDepositsPenalties: ReservesDepositsPenalties;
  bankReconciliation: BankReconciliation;
  notificationStats: NotificationDeliveryStats;
  dateRange: {
    start: string;
    end: string;
  };
}

export type ExportFormat = 'CSV' | 'PDF';