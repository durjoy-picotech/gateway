import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Wallet, TrendingUp, TrendingDown, RefreshCw, Eye, Calendar, DollarSign } from 'lucide-react';
import DataTable from '../common/DataTable';
import StatusBadge from '../common/StatusBadge';
import MoneyDisplay from '../common/MoneyDisplay';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/api';

interface WalletData {
  id: number;
  user: {
    user_id: string;
    name: string;
    email: string;
    role: string;
  };
  currency: string;
  balance: number;
  held_balance: number;
  available_balance: number;
  status: string;
  created_at: string;
  updated_at: string;
}

interface TransactionData {
  transaction_id: string;
  type: 'DEBIT' | 'CREDIT' | 'INTERNAL';
  amount: number;
  currency: string;
  counterparty_currency: string;
  counterparty_amount: number;
  exchange_rate: number;
  markup_rate: number | null;
  fee: number;
  status: string;
  notes: string | null;
  processed_at: string | null;
  created_at: string;
}

interface WalletDetailsResponse {
  wallet: WalletData;
  ledger: {
    transactions: TransactionData[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

const WalletDetailsPage: React.FC = () => {
  const { walletId } = useParams<{ walletId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<TransactionData[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: localStorage.getItem('items_per_page') ?? 10,
    total: 0,
    pages: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [dateFilter, setDateFilter] = useState({
    date_from: '',
    date_to: ''
  });

  // Check if user is SUPER_ADMIN
  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN') {
      navigate('/dashboard');
      return;
    }
  }, [user, navigate]);

  // Fetch wallet details
  useEffect(() => {
    if (walletId && user?.role === 'SUPER_ADMIN') {
      fetchWalletDetails();
    }
  }, [walletId, user]);

  const fetchWalletDetails = async (page = 1, filters: any = {}) => {
    if (!walletId) return;

    try {
      setSearchLoading(true);
      const params = {
        page,
        limit: 50,
        ...filters
      };

      const response = await apiClient.getWalletDetails(walletId, params);

      if (response.success && response.data) {
        const data = response.data as WalletDetailsResponse;
        setWalletData(data.wallet);
        setTransactions(data.ledger.transactions);
        setPagination(data.ledger.pagination);
      }
    } catch (error) {
      console.error('Error fetching wallet details:', error);
    } finally {
      setLoading(false);
      setSearchLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    fetchWalletDetails(newPage, dateFilter);
  };

  const handleDateFilterChange = () => {
    fetchWalletDetails(1, dateFilter);
  };

  const handleClearFilters = () => {
    setDateFilter({ date_from: '', date_to: '' });
    fetchWalletDetails(1, {});
  };

  // Transaction columns
  const transactionColumns = [
    {
      key: 'created_at',
      label: 'Date',
      sortable: true,
      render: (value: string) => new Date(value).toLocaleString()
    },
    {
      key: 'transaction_id',
      label: 'Transaction ID',
      render: (value: string) => (
        <span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
          {value}
        </span>
      )
    },
    {
      key: 'type',
      label: 'Type',
      render: (value: string) => {
        const isDebit = value === 'DEBIT';
        const isCredit = value === 'CREDIT';
        const Icon = isDebit ? TrendingDown : isCredit ? TrendingUp : RefreshCw;

        return (
          <div className="flex items-center space-x-2">
            <Icon className={`h-4 w-4 ${isDebit ? 'text-red-500' : isCredit ? 'text-green-500' : 'text-blue-500'}`} />
            <span className={`font-medium ${isDebit ? 'text-red-600 dark:text-red-400' : isCredit ? 'text-green-600 dark:text-green-400' : 'text-blue-600 dark:text-blue-400'}`}>
              {value}
            </span>
          </div>
        );
      }
    },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      render: (value: number, row: TransactionData) => (
        <div className="text-right">
          <MoneyDisplay
            amount={Math.abs(value)}
            currency={row.currency}
            className={value < 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}
          />
        </div>
      )
    },
    {
      key: 'counterparty_amount',
      label: 'Counterparty',
      render: (value: number, row: TransactionData) => (
        <div className="text-right">
          <MoneyDisplay
            amount={value}
            currency={row.counterparty_currency}
            className="text-gray-600 dark:text-gray-400"
          />
        </div>
      )
    },
    {
      key: 'exchange_rate',
      label: 'Exchange Rate',
      render: (value: number) => (
        <span className="font-mono text-sm">
          {value.toFixed(6)}
        </span>
      )
    },
    {
      key: 'markup_rate',
      label: 'Markup',
      render: (value: number | null) => value ? (
        <span className="text-sm text-orange-600 dark:text-orange-400">
          {value.toFixed(4)}%
        </span>
      ) : (
        <span className="text-gray-400">-</span>
      )
    },
    {
      key: 'fee',
      label: 'Fee',
      render: (value: number) => value > 0 ? (
        <MoneyDisplay
          amount={value}
          currency={walletData?.currency || 'USD'}
          className="text-red-600 dark:text-red-400"
        />
      ) : (
        <span className="text-gray-400">-</span>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => <StatusBadge status={value} />
    },
    {
      key: 'notes',
      label: 'Notes',
      render: (value: string | null) => value ? (
        <div className="max-w-xs truncate" title={value}>
          {value}
        </div>
      ) : (
        <span className="text-gray-400">-</span>
      )
    }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading wallet details...</span>
      </div>
    );
  }

  if (!walletData) {
    return (
      <div className="text-center py-12">
        <Wallet className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Wallet Not Found</h3>
        <p className="text-gray-600 dark:text-gray-400">The requested wallet could not be found.</p>
        <button
          onClick={() => navigate('/admin/wallets')}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Back to Wallets
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/admin/wallets')}
            className="flex items-center space-x-2 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Wallets</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Wallet Details</h1>
            <p className="text-gray-600 dark:text-gray-400">
              {walletData.user.name} ({walletData.user.email}) - {walletData.currency} Wallet
            </p>
          </div>
        </div>
      </div>

      {/* Wallet Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Wallet className="h-8 w-8 text-blue-500" />
            <div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                <MoneyDisplay amount={walletData.balance} currency={walletData.currency} showSymbol={false} />
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Balance</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <DollarSign className="h-8 w-8 text-green-500" />
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                <MoneyDisplay amount={walletData.available_balance} currency={walletData.currency} showSymbol={false} />
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Available Balance</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Eye className="h-8 w-8 text-orange-500" />
            <div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                <MoneyDisplay amount={walletData.held_balance} currency={walletData.currency} showSymbol={false} />
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Held Balance</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Calendar className="h-8 w-8 text-purple-500" />
            <div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {transactions.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Transactions</div>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet Info */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Wallet Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Wallet ID</label>
            <p className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded mt-1">
              {walletData.id}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Currency</label>
            <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
              {walletData.currency}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
            <div className="mt-1">
              <StatusBadge status={walletData.status} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Created</label>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {new Date(walletData.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Transaction Filters</h3>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              From Date
            </label>
            <input
              type="date"
              value={dateFilter.date_from}
              onChange={(e) => setDateFilter(prev => ({ ...prev, date_from: e.target.value }))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              To Date
            </label>
            <input
              type="date"
              value={dateFilter.date_to}
              onChange={(e) => setDateFilter(prev => ({ ...prev, date_to: e.target.value }))}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={handleDateFilterChange}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Apply Filters
          </button>
          <button
            onClick={handleClearFilters}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Transaction Ledger */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Transaction Ledger</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Complete history of wallet transactions
          </p>
        </div>

        <DataTable
          data={transactions}
          columns={transactionColumns}
          loading={searchLoading}
          pagination={pagination}
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  );
};

export default WalletDetailsPage;