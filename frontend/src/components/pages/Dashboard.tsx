import React, { useState, useEffect } from 'react';
import DashboardStats from '../dashboard/DashboardStats';
import DashboardStatsTwo from '../dashboard/DashboardStatsTwo';
import MoneyDisplay from '../common/MoneyDisplay';
import { useAuth } from '../../contexts/AuthContext';
import DataTable from '../common/DataTable';
import StatusBadge from '../common/StatusBadge';
import { Transaction } from '../../types';
import { apiClient } from '../../services/api';
import { useNotifications } from '../../hooks/useNotifications';
interface DashboardData {
  stats: Array<{
    title: string;
    value: string;
    change: string;
    trend: 'up' | 'down';
  }>;
  roleData: any;
  recentTransactions: Array<{
    txn_id: string;
    amount: number;
    currency: string;
    status: string;
    provider_alias: string;
    created_at: string;
  }>;
}

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const { notifications } = useNotifications();
  const [revenue, setRevenue] = useState<{ wallets: any; total: number } | null>(null);
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const response = await apiClient.getDashboard();
        if (response.success) {
          setDashboardData(response.data as DashboardData);
        } else {
          console.error('Dashboard API failed:', response.error);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  useEffect(() => {
    fetchRevenue();
  }, [user]);
  const fetchRevenue = async (page = 1) => {
    try {
      const params: Record<string, string> = {
        page: page.toString(),
      };
      if (user) params.user_id = user.user_id;

      const response = await apiClient.get("/revenue-by-wallet", params);

      if (response.success) {
        const data = response.data;
        setRevenue(data);
      }
    } catch (error) {
      console.error("Failed to fetch revenue:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  if (!dashboardData) {
    return <div className="text-center text-red-500">Failed to load dashboard data</div>;
  }

  const { stats = [], roleData = {}, recentTransactions = [] } = dashboardData;

  const transactionColumns = [
    {
      key: 'txn_id',
      label: 'Transaction ID',
      sortable: true
    },
    {
      key: 'details',
      label: 'Details',
      sortable: false,
      render: (value: any, row: Transaction) => (
        <div className="space-y-1 text-xs sm:text-sm">
          {/* Amount */}
          <div className="flex items-center space-x-1">
            <span className="font-medium text-gray-500 dark:text-gray-400">Amount:</span>
            <MoneyDisplay
              amount={row.amount}
              currency={row.currency}
              colorize={true}
            />
          </div>

          {/* Status */}
          <div className="flex items-center space-x-1">
            <span className="font-medium text-gray-500 dark:text-gray-400">Status:</span>
            <StatusBadge status={row.status} type="transaction" />
          </div>

          {/* Date */}
          <div className="flex items-center space-x-1">
            <span className="font-medium text-gray-500 dark:text-gray-400">Date:</span>
            <span className="text-gray-700 dark:text-gray-300">
              {new Date(row.created_at).toLocaleString()}
            </span>
          </div>
        </div>
      )
    },
    {
      key: 'type_provider',
      label: 'Type / Provider',
      sortable: true,
      render: (value: any, row: Transaction) => (
        <div className="space-y-1 text-xs sm:text-sm">
          {/* Transaction Type */}
          <div className="flex items-center space-x-1">
            <span className="font-medium text-gray-500 dark:text-gray-400">Type:</span>
            <span className="px-[10px] py-0 text-[11px] font-semibold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
              {row.transaction_type}
            </span>
          </div>

          {/* Provider Alias */}
          <div className="flex items-center space-x-1">
            <span className="font-medium text-gray-500 dark:text-gray-400">Provider:</span>
            <span className="text-gray-700 dark:text-gray-300">
              {row.provider_alias || 'N/A'}
            </span>
          </div>
        </div>
      )
    },
    {
      key: 'user',
      label: 'User',
      sortable: true,
      render: (value: any, row: Transaction) => {
        let roleLabel = '';

        if (row.merchant) {
          roleLabel = `Merchant: ${row.merchant}`;
        } else if (row.partner) {
          roleLabel = `Partner: ${row.partner}`;
        } else if (row.agent) {
          roleLabel = `Agent: ${row.agent}`;
        } else {
          roleLabel = `System`;
        }

        return (
          <div className="text-xs sm:text-sm">
            {roleLabel && (
              <span className="px-2 py-1 font-semibold bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded">
                {roleLabel}
              </span>
            )}
          </div>
        );
      }
    },

  ];

  const getDashboardContent = () => {
    if (!user?.role) {
      return (
        <div className="text-center text-red-500">
          User role not found. Please contact support.
        </div>
      );
    }

    switch (user.role) {
      case 'SUPER_ADMIN':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Super Admin Dashboard
            </h2>
            <DashboardStats stats={stats} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Recent Alerts
                </h3>
                <div className="space-y-3">
                  {notifications?.slice(0, 5).map((alert: any) => {
                    // Map notification types to colors
                    const typeColors: Record<string, string> = {
                      WARNING: 'bg-yellow-500',
                      SUCCESS: 'bg-green-500',
                      INFO: 'bg-blue-500',
                      AGENT_CREATED: 'bg-purple-500',
                      MERCHANT_CREATED: 'bg-indigo-500',
                      PARTNER_CREATED: 'bg-pink-500',
                      TRANSACTION_STATUS_UPDATED: 'bg-teal-500',
                    };

                    const dotColor = typeColors[alert.type] || 'bg-gray-400';

                    return (
                      <div key={alert.notification_id} className="flex items-center space-x-2 mb-2">
                        <div className={`w-2 h-2 rounded-full ${dotColor}`}></div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            {alert.title}
                          </span>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {alert.message}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Revenue By Wallets
                </h3>
                {loading ? (
                  <p className="text-gray-500 dark:text-gray-400">Loading...</p>
                ) : revenue ? (
                  <div className="space-y-2 text-gray-700 dark:text-gray-300">
                    {Object.entries(revenue?.wallets || {}).map(([currency, amount]) => (
                      <div key={currency} className="flex justify-between">
                        <span>{currency}</span>
                        <span>
                          <MoneyDisplay
                            amount={amount || 0}
                            currency={currency}
                            colorize
                            className="text-md font-semibold"
                          />
                          {/* {amount || 0} */}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">No data available.</p>
                )}
              </div>
            </div>
          </div>
        );

      case 'PARTNER':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Partner Dashboard
            </h2>
            <DashboardStats stats={stats} />

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Agent Performance
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{roleData.agentPerformance?.activeAgents || 0}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Active Agents</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">{roleData.agentPerformance?.totalMerchants || 0}</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Total Merchants</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">${(roleData.agentPerformance?.monthlyVolume / 1000000 || 0).toFixed(1)}M</div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Monthly Volume</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Revenue By Wallets
                </h3>
                {loading ? (
                  <p className="text-gray-500 dark:text-gray-400">Loading...</p>
                ) : revenue ? (
                  <div className="space-y-2 text-gray-700 dark:text-gray-300">
                    {Object.entries(revenue?.wallets || {}).map(([currency, amount]) => (
                      <div key={currency} className="flex justify-between">
                        <span>{currency}</span>
                        <span>
                          <MoneyDisplay
                            amount={amount || 0}
                            currency={currency}
                            colorize
                            className="text-2xl font-semibold"
                          />
                          {/* {amount || 0} */}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">No data available.</p>
                )}
              </div>
            </div>
          </div>
        );

      case 'AGENT':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Agent Dashboard
            </h2>
            <DashboardStatsTwo stats={stats} />

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Merchant Status Overview
              </h3>
              <div className="grid grid-cols-3 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">{roleData.merchantStatusOverview?.active || 0}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Active</div>
                </div>
                {/* <div className="text-center">
                  <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{roleData.merchantStatusOverview?.pendingKYB || 3}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Pending KYB</div>
                </div> */}
                <div className="text-center">
                  <div className="text-xl font-bold text-red-600 dark:text-red-400">{roleData.merchantStatusOverview?.suspended || 0}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Suspended</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-600 dark:text-gray-400">{roleData.merchantStatusOverview?.inactive || 0}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Inactive</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Revenue By Wallets
                </h3>
                {loading ? (
                  <p className="text-gray-500 dark:text-gray-400">Loading...</p>
                ) : revenue ? (
                  <div className="space-y-2 text-gray-700 dark:text-gray-300">
                    {Object.entries(revenue?.wallets || {}).map(([currency, amount]) => (
                      <div key={currency} className="flex justify-between">
                        <span>{currency}</span>
                        <span>
                          <MoneyDisplay
                            amount={amount || 0}
                            currency={currency}
                            colorize
                            className="text-2xl font-semibold"
                          />
                          {/* {amount || 0} */}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">No data available.</p>
                )}
              </div>
            </div>
          </div>
        );

      case 'MERCHANT':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Merchant Dashboard
            </h2>
            <DashboardStats stats={stats} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  {/* Payment Methods */}
                  Wallet Information
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400">{roleData.walletInfo?.currency} Wallet</span>
                    <span className="text-blue-600 dark:text-blue-400 font-medium">{roleData.walletInfo?.balance?.toFixed(0) || 0}$</span>
                  </div>

                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Settlement Information
                </h3>
                <div className="space-y-3">
                  <div className="text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Settlement Date:</span>

                    <span className="ml-2 font-medium text-gray-900 dark:text-white">{roleData.settlementInformation?.settlementDate || 'N/A'}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                    <span className="ml-2 font-medium text-green-600 dark:text-green-400">${roleData.settlementInformation?.amount?.toFixed(2) || '0'}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Settlement Status:</span>
                    <span className="ml-2 font-medium text-blue-600 dark:text-blue-400">{roleData.settlementInformation?.status || 'N/A'}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Settlement Currency:</span>
                    <span className="ml-2 font-medium text-purple-600 dark:text-purple-400">{roleData.settlementInformation?.settlementCurrency}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center text-red-500">
            Unsupported user role: {user.role}. Please contact support.
          </div>
        );
    }
  };

  return (
    <div className="space-y-6">
      {getDashboardContent()}

      {/* Recent Transactions */}
      <div className="space-y-4">
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
          Recent Transactions
        </h3>
        <DataTable
          data={recentTransactions}
          columns={transactionColumns}
          searchPlaceholder="Search transactions..."
        />
      </div>
    </div>
  );
};

export default Dashboard;