export interface User {
  user_id: string;
  role: 'SUPER_ADMIN' | 'PARTNER' | 'AGENT' | 'MERCHANT';
  name: string;
  email: string;
  phone: string;
  timezone: string;
  two_factor_enabled: boolean;
  created_at: string;
  partner_id?: string;
  agent_id?: string;
  merchant_id?: string;
}

export interface Partner {
  partner_id: string;
  name: string;
  domain_branding: string;
  default_currency: string;
  enabled_currencies: string[];
  settlement_policy: any;
  reserve_policy: any;
  kyc_policy: boolean;
  created_at: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export interface Agent {
  agent_id: string;
  partner_id: string;
  parent_agent_id?: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  allowed_sub_agents: boolean;
  default_currency: string;
  created_at: string;
}

export interface Merchant {
  merchant_id: string;
  agent_id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING_KYB';
  default_currency: string;
  enabled_currencies: string[];
  settlement_terms: string;
  kyb_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
}

export interface Transaction {
  txn_id: string;
  token_id?: string;
  reference_id?: string;
  merchant_id: string;
  channel_type: string;
  transaction_type: 'PAY_IN' | 'PAY_OUT' | 'TOP_UP' | 'SETTLEMENT' | 'ADJUSTMENT' | 'REFUND';
  method: string;
  variant: string;
  provider_alias: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  fx_rate: number;
  fee_breakdown: any;
  created_at: string;
  completed_at?: string;
  customer_email?: string;
  settlement_status?: string;
  expected_settlement_date?: string;
  actual_settlement_date?: string;
  settlement_id?: string;
  routing_strategy?: string;
  routing_reason?: string;
  provider_cost?: number;
  profit_margin?: number;
  estimated_cost?: number;
}

export interface Notification {
  notification_id: string;
  user_id: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  title: string;
  message: string;
  data: Record<string, any>;
  read: boolean;
  read_at?: string;
  created_at: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  expires_at?: string;
}

export interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  loginLoading: boolean;
}

// Re-export policy types
export * from './policies';

// Re-export analytics types
export * from './analytics';

// Re-export automation types
export * from './automation';

// Re-export settlements types
export * from './settlements';

export interface Wallet {
  currency: string;
  balance: number;
  held_balance: number;
  available_balance: number;
  status: 'ACTIVE' | 'FROZEN' | 'SUSPENDED';
  last_updated: string;
}

export interface WalletBalance {
  user_id: string;
  role: 'SUPER_ADMIN' | 'PARTNER' | 'AGENT' | 'MERCHANT';
  currency: string;
  balance: number;
  held_balance: number;
  available_balance: number;
  status: 'ACTIVE' | 'FROZEN' | 'SUSPENDED';
  last_updated: string;
}

export interface WalletsData {
  user_id: string;
  role: 'SUPER_ADMIN' | 'PARTNER' | 'AGENT' | 'MERCHANT';
  wallets: Wallet[];
}