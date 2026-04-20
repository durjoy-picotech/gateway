import React, { useEffect, useState } from "react";
import apiClient from "../../services/api";
import MoneyDisplay from "../common/MoneyDisplay";
import { useAuth } from "../../contexts/AuthContext";
import {
  DollarSign,
  CalendarDays,
  BarChart3,
  Infinity,
} from "lucide-react";
import DataTable from "../common/DataTable";
import StatusBadge from "../common/StatusBadge";
interface Transaction {
  id: number;
  txn_id: string;
  transaction_type: string;
  provider_alias: string | null;
  amount: string;
  currency: string;
  status: string;
  created_at: string;
  merchant?: string;
  partner?: string;
  agent?: string;
  token_id?: string;
  reference_id?: string;
}

const RevenuePage: React.FC = () => {
  const [revenue, setRevenue] = useState({
    today: 0,
    month: 0,
    year: 0,
    lifetime: 0,
  });
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    minAmount: '',
    maxAmount: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: localStorage.getItem('items_per_page') ?? 10,
    total: 0,
    pages: 0,
  });
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  const [wallets, setWallets] = useState([]);
  useEffect(() => {
    fetchRevenue();
  }, [user,filters,selectedCurrency]);
  const fetchRevenue = async (page = 1, isPagination = false) => {
      if (!isPagination) setLoading(true);
      try {
        const params: Record<string, string> = {
          page: page.toString(),
          limit: pagination.limit.toString(),
        };
        if (user) params.user_id = user.user_id;
        if (filters.dateFrom) params.date_from = filters.dateFrom;
        if (filters.dateTo) params.date_to = filters.dateTo;
        if (filters.minAmount) params.min_amount = filters.minAmount;
        if (filters.maxAmount) params.max_amount = filters.maxAmount;
        if (selectedCurrency) params.currency = selectedCurrency;

        const response = await apiClient.get("/revenues", params);

        if (response.success) {
          const data = response.data;
          setRevenue({
            today: data.today || 0,
            month: data.month || 0,
            year: data.year || 0,
            lifetime: data.lifetime || 0,
          });
          setTransactions(data.transactions?.data || []);
          setPagination(data.pagination || pagination);
        }
      } catch (error) {
        console.error("Failed to fetch revenue:", error);
      } finally {
        setLoading(false);
      }
  };
  const fetchWallets = async (page = 1) => {
      try {
        const params: Record<string, string> = {
          page: page.toString(),
        };
        if (user) params.user_id = user.user_id;
  
        const response = await apiClient.getAllWalletsByusers(params);
  
        if (response.success && response.data) {
          const data = response.data;   
          setWallets(data.wallets);
        }
      } catch (error) {
        console.error('Error fetching wallets:', error);
      } finally {
        setLoading(false);
      }
  };
  useEffect(() => {
    fetchWallets();
  }, [user]);
  const cards = [
    {
      label: "Today",
      value: revenue.today,
      icon: <DollarSign className="h-6 w-6 text-blue-500" />,
      gradient: "from-blue-500/10 to-blue-500/5",
    },
    {
      label: "This Month",
      value: revenue.month,
      icon: <CalendarDays className="h-6 w-6 text-emerald-500" />,
      gradient: "from-emerald-500/10 to-emerald-500/5",
    },
    {
      label: "This Year",
      value: revenue.year,
      icon: <BarChart3 className="h-6 w-6 text-purple-500" />,
      gradient: "from-purple-500/10 to-purple-500/5",
    },
    {
      label: "Lifetime",
      value: revenue.lifetime,
      icon: <Infinity className="h-6 w-6 text-amber-500" />,
      gradient: "from-amber-500/10 to-amber-500/5",
    },
  ];
  const columns = [
    {
      key: 'txn_id',
      label: 'Transaction ID',
      sortable: true,
      render: (value: string, row: Transaction) => (
        <div className="space-y-1">
          <span className='className="font-mono text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 block transition-colors"'>{value || ''}</span>
          {row.token_id && (
            <span className="font-mono text-xs text-green-600 dark:text-green-400 block">Provider: {row.token_id}</span>
          )}
          {row.reference_id && (
            <span className="font-mono text-xs text-purple-600 dark:text-purple-400 block">Merchant: {row.reference_id}</span>
          )}
        </div>
      )
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
            <span className="px-2 py-1 font-semibold bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
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
  ];
  return (
    <div className="space-y-10">
        <div className='flex items-center justify-between'>
        <h1 className="text-3xl font-semibold text-gray-900 dark:text-white">
          Revenue Overview
        </h1>
        <select
          value={selectedCurrency || ''}
          onChange={(e) => {
            const currency = e.target.value;
            setSelectedCurrency(currency);
          }}
          className="w-75 sm:w-75  me-3 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {[...new Set(wallets.map(w => w.currency))].map(currency => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </select>
        </div>
      {/* Revenue Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {cards.map((card) => (
          <div
            key={card.label}
            className={`relative overflow-hidden bg-gradient-to-br ${card.gradient}
            backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50
            rounded-2xl shadow-sm hover:shadow-md transition-all duration-300
            hover:scale-[1.02] p-6 flex flex-col items-center justify-center`}
          >
            <div className="absolute top-3 right-3">{card.icon}</div>
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">
              {card.label}
            </span>
            {loading ? (
              <div className="animate-pulse h-7 w-28 bg-gray-300 dark:bg-gray-600 rounded"></div>
            ) : (
              <MoneyDisplay
                amount={card.value}
                currency={selectedCurrency}
                colorize
                className="text-2xl font-semibold"
              />
            )}
          </div>
        ))}
      </div>
      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date From
            </label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Date To
            </label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
      {/* Recent Transactions as Cards */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Transactions
        </h2>

        {loading ? (
          <div className="min-h-[200px] flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600"></div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="text-gray-500 dark:text-gray-400 text-center py-6">
            No transactions found.
          </div>
        ) : (
          <DataTable
            data={transactions}
            columns={columns}
            pagination={pagination}
            onPageChange={(page) => fetchRevenue(page)}
          />
        )}
      </div>
    </div>
  );
};

export default RevenuePage;
