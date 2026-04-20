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
  can_create_own_bank: boolean;
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
  merchant_id: string;
  channel_type: string;
  provider_alias: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  fx_rate: number;
  fee_breakdown: any;
  created_at: string;
  customer_email?: string;
  routing_strategy?: string;
  routing_reason?: string;
  estimated_cost?: number;
  fee_breakdown_id?: string;
  provider_cost?: number;
  merchant_fee?: number;
  profit_margin?: number;
  settlement_id?: string;
  settlement_status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  expected_settlement_date?: string;
  actual_settlement_date?: string;
}

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  read: boolean;
  created_at: string;
  user_id: string;
}

export const demoUsers: User[] = [
  {
    user_id: 'usr_001',
    role: 'SUPER_ADMIN',
    name: 'John Smith',
    email: 'john@platform.com',
    phone: '+1-555-0101',
    timezone: 'UTC',
    two_factor_enabled: true,
    created_at: '2024-01-15T08:30:00Z'
  },
  {
    user_id: 'usr_002',
    role: 'PARTNER',
    name: 'Sarah Johnson',
    email: 'sarah@partner1.com',
    phone: '+1-555-0102',
    timezone: 'America/New_York',
    two_factor_enabled: true,
    created_at: '2024-01-16T09:15:00Z',
    partner_id: 'ptr_001'
  },
  {
    user_id: 'usr_003',
    role: 'AGENT',
    name: 'Mike Chen',
    email: 'mike@agent1.com',
    phone: '+1-555-0103',
    timezone: 'America/Los_Angeles',
    two_factor_enabled: false,
    created_at: '2024-01-17T10:45:00Z',
    partner_id: 'ptr_001',
    agent_id: 'agt_001'
  },
  {
    user_id: 'usr_004',
    role: 'MERCHANT',
    name: 'Emma Wilson',
    email: 'emma@merchant1.com',
    phone: '+1-555-0104',
    timezone: 'America/Chicago',
    two_factor_enabled: false,
    created_at: '2024-01-18T11:20:00Z',
    partner_id: 'ptr_001',
    agent_id: 'agt_001'
  }
];

export const demoPartners: Partner[] = [
  {
    partner_id: 'ptr_001',
    name: 'TechPay Solutions',
    domain_branding: 'techpay.com',
    default_currency: 'USD',
    enabled_currencies: ['USD', 'EUR', 'GBP', 'CAD'],
    settlement_policy: { frequency: 'DAILY', cutoff: '18:00' },
    reserve_policy: { percentage: 5, duration: 30 },
    kyc_policy: true,
    can_create_own_bank: false,
    created_at: '2024-01-15T08:00:00Z',
    status: 'ACTIVE'
  },
  {
    partner_id: 'ptr_002',
    name: 'Global Payments Co',
    domain_branding: 'globalpay.net',
    default_currency: 'EUR',
    enabled_currencies: ['EUR', 'USD', 'GBP'],
    settlement_policy: { frequency: 'WEEKLY', cutoff: '17:00' },
    reserve_policy: { percentage: 3, duration: 21 },
    kyc_policy: false,
    can_create_own_bank: true,
    created_at: '2024-01-16T09:30:00Z',
    status: 'ACTIVE'
  }
];

export const demoAgents: Agent[] = [
  {
    agent_id: 'agt_001',
    partner_id: 'ptr_001',
    name: 'North America Agent',
    status: 'ACTIVE',
    allowed_sub_agents: true,
    default_currency: 'USD',
    created_at: '2024-01-17T10:00:00Z'
  },
  {
    agent_id: 'agt_002',
    partner_id: 'ptr_001',
    parent_agent_id: 'agt_001',
    name: 'West Coast Sub-Agent',
    status: 'ACTIVE',
    allowed_sub_agents: false,
    default_currency: 'USD',
    created_at: '2024-01-18T14:15:00Z'
  }
];

export const demoMerchants: Merchant[] = [
  {
    merchant_id: 'mrc_001',
    agent_id: 'agt_001',
    name: 'E-Commerce Store',
    status: 'ACTIVE',
    default_currency: 'USD',
    enabled_currencies: ['USD', 'EUR'],
    settlement_terms: 'T+1',
    kyb_status: 'APPROVED',
    created_at: '2024-01-18T11:00:00Z'
  },
  {
    merchant_id: 'mrc_002',
    agent_id: 'agt_002',
    name: 'Digital Services LLC',
    status: 'PENDING_KYB',
    default_currency: 'USD',
    enabled_currencies: ['USD'],
    settlement_terms: 'T+2',
    kyb_status: 'PENDING',
    created_at: '2024-01-19T13:30:00Z'
  }
];

export const demoTransactions: Transaction[] = [
  {
    txn_id: 'txn_001',
    merchant_id: 'mrc_001',
    channel_type: 'CARD',
    provider_alias: 'stripe_main',
    amount: 125.50,
    currency: 'USD',
    status: 'SUCCESS',
    fx_rate: 1.0,
    fee_breakdown: { gateway: 2.9, processing: 0.30 },
    created_at: '2024-01-20T14:22:00Z',
    customer_email: 'customer@email.com',
    routing_strategy: 'PRIORITY',
    routing_reason: 'Highest priority provider',
    estimated_cost: 3.94,
    fee_breakdown_id: 'fb_001',
    provider_cost: 3.25,
    merchant_fee: 4.23,
    profit_margin: 23.2,
    settlement_id: 'stl_001',
    settlement_status: 'COMPLETED',
    expected_settlement_date: '2024-01-21T18:00:00Z',
    actual_settlement_date: '2024-01-21T17:45:00Z'
  },
  {
    txn_id: 'txn_002',
    merchant_id: 'mrc_001',
    channel_type: 'BANK',
    provider_alias: 'plaid_ach',
    amount: 500.00,
    currency: 'USD',
    status: 'PENDING',
    fx_rate: 1.0,
    fee_breakdown: { gateway: 1.2, processing: 0.50 },
    created_at: '2024-01-20T15:45:00Z',
    customer_email: 'business@example.com',
    routing_strategy: 'CHEAPEST',
    routing_reason: 'Lowest cost provider',
    estimated_cost: 6.50,
    provider_cost: 5.50,
    merchant_fee: 7.25,
    profit_margin: 24.1,
    settlement_id: 'stl_002',
    settlement_status: 'PROCESSING',
    expected_settlement_date: '2024-01-22T16:00:00Z'
  },
  {
    txn_id: 'txn_003',
    merchant_id: 'mrc_001',
    channel_type: 'WALLET',
    provider_alias: 'paypal_exp',
    amount: 75.25,
    currency: 'USD',
    status: 'FAILED',
    fx_rate: 1.0,
    fee_breakdown: { gateway: 2.2, processing: 0.30 },
    created_at: '2024-01-20T16:10:00Z',
    customer_email: 'user@domain.com',
    routing_strategy: 'WEIGHTED',
    routing_reason: 'Weighted selection',
    estimated_cost: 2.86,
    provider_cost: 2.41,
    merchant_fee: 2.86,
    profit_margin: 15.7,
    settlement_status: 'FAILED'
  },
  {
    txn_id: 'txn_004',
    merchant_id: 'mrc_001',
    channel_type: 'CRYPTO',
    provider_alias: 'coinbase_pro',
    amount: 0.002156,
    currency: 'BTC',
    status: 'SUCCESS',
    fx_rate: 42567.89,
    fee_breakdown: { gateway: 1.5, processing: 0.0001 },
    created_at: '2024-01-20T17:30:00Z',
    customer_email: 'crypto@example.com',
    routing_strategy: 'FASTEST',
    routing_reason: 'Fastest response time',
    estimated_cost: 1.38,
    provider_cost: 1.15,
    merchant_fee: 1.38,
    profit_margin: 16.7,
    settlement_id: 'stl_003',
    settlement_status: 'PENDING',
    expected_settlement_date: '2024-01-23T14:00:00Z'
  },
  {
    txn_id: 'txn_005',
    merchant_id: 'mrc_002',
    channel_type: 'CARD',
    provider_alias: 'stripe_main',
    amount: 89.99,
    currency: 'EUR',
    status: 'SUCCESS',
    fx_rate: 0.9258,
    fee_breakdown: { gateway: 2.9, processing: 0.30 },
    created_at: '2024-01-20T18:15:00Z',
    customer_email: 'europe@example.com',
    routing_strategy: 'PRIORITY',
    routing_reason: 'Primary provider available',
    estimated_cost: 2.91,
    fee_breakdown_id: 'fb_002',
    provider_cost: 2.35,
    merchant_fee: 3.12,
    profit_margin: 24.7,
    settlement_id: 'stl_002',
    settlement_status: 'PROCESSING',
    expected_settlement_date: '2024-01-22T16:00:00Z'
  }
];

export const demoNotifications: Notification[] = [
  {
    id: 'not_001',
    title: 'Settlement Completed',
    message: 'Settlement for merchant E-Commerce Store has been completed successfully.',
    type: 'SUCCESS',
    read: false,
    created_at: '2024-01-20T16:30:00Z',
    user_id: 'usr_004'
  },
  {
    id: 'not_002',
    title: 'KYB Review Required',
    message: 'Merchant Digital Services LLC requires KYB document review.',
    type: 'WARNING',
    read: false,
    created_at: '2024-01-20T15:45:00Z',
    user_id: 'usr_003'
  },
  {
    id: 'not_003',
    title: 'Transaction Failed',
    message: 'Transaction txn_003 failed due to insufficient funds.',
    type: 'ERROR',
    read: true,
    created_at: '2024-01-20T16:10:00Z',
    user_id: 'usr_004'
  },
  {
    id: 'not_004',
    title: 'New Partner Registered',
    message: 'Global Payments Co has successfully registered as a new partner.',
    type: 'INFO',
    read: false,
    created_at: '2024-01-16T09:30:00Z',
    user_id: 'usr_001'
  }
];

// API Endpoints Structure
export const API_ENDPOINTS = {
  // Authentication
  auth: {
    login: 'POST /api/auth/login',
    refresh: 'POST /api/auth/refresh',
    logout: 'POST /api/auth/logout',
    profile: 'GET /api/auth/profile'
  },
  
  // Users Management
  users: {
    list: 'GET /api/users',
    create: 'POST /api/users',
    get: 'GET /api/users/:id',
    update: 'PUT /api/users/:id',
    delete: 'DELETE /api/users/:id',
    updatePassword: 'PUT /api/users/:id/password',
    toggle2FA: 'PUT /api/users/:id/2fa'
  },
  
  // Partners Management
  partners: {
    list: 'GET /api/partners',
    create: 'POST /api/partners',
    get: 'GET /api/partners/:id',
    update: 'PUT /api/partners/:id',
    delete: 'DELETE /api/partners/:id',
  },
  
  // Agents Management
  agents: {
    list: 'GET /api/agents',
    create: 'POST /api/agents',
    get: 'GET /api/agents/:id',
    update: 'PUT /api/agents/:id',
    delete: 'DELETE /api/agents/:id',
  },
  
  // Merchants Management
  merchants: {
    list: 'GET /api/merchants',
    create: 'POST /api/merchants',
    get: 'GET /api/merchants/:id',
    update: 'PUT /api/merchants/:id',
    delete: 'DELETE /api/merchants/:id',
  },
  
  // Transactions
  transactions: {
    list: 'GET /api/transactions',
    get: 'GET /api/transactions/:id',
    create: 'POST /api/pay/V2',
    query: 'GET /api/pay/queryV2',
    payout: 'POST /api/defray/V2',
    queryPayout: 'GET /api/defray/queryV2',
    balance: 'GET /api/balance/V2'
  },
  
  // Notifications
  notifications: {
    list: 'GET /api/notifications',
    markRead: 'PUT /api/notifications/:id/read',
    markAllRead: 'PUT /api/notifications/read-all',
    delete: 'DELETE /api/notifications/:id'
  },
  
  // Analytics & Reports
  analytics: {
    dashboard: 'GET /api/analytics/dashboard',
    transactions: 'GET /api/analytics/transactions',
    settlements: 'GET /api/analytics/settlements',
    fees: 'GET /api/analytics/fees',
    export: 'GET /api/analytics/export'
  },
  
  // Settings
  settings: {
    fees: 'GET/PUT /api/settings/fees',
    reserves: 'GET/PUT /api/settings/reserves',
    settlements: 'GET/PUT /api/settings/settlements',
    security: 'GET/PUT /api/settings/security',
    notifications: 'GET/PUT /api/settings/notifications'
  }
};