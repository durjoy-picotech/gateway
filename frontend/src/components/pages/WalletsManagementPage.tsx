import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wallet, RefreshCw, DollarSign, Users, TrendingUp } from 'lucide-react';
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

interface WalletsResponse {
  wallets: WalletData[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

const WalletsManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: localStorage.getItem('items_per_page') ?? 10,
    total: 0,
    pages: 0
  });
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [filters, setFilters] = useState({
    user_id: '',
    currency: '',
    status: ''
  });
  const [selectedCurrency, setSelectedCurrency] = useState('USD');
  // Check if user is SUPER_ADMIN
  useEffect(() => {
    if (user && user.role !== 'SUPER_ADMIN') {
      navigate('/dashboard');
      return;
    }
  }, [user, navigate]);

  // Fetch wallets
  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      fetchWallets();
    }
  }, [user]);

  const fetchWallets = async (page = 1, searchFilters: any = {}) => {
    try {
      setSearchLoading(true);
      const params = {
        page,
        limit: 50,
        ...searchFilters
      };

      const response = await apiClient.getAllWallets(params);

      if (response.success && response.data) {
        const data = response.data as WalletsResponse;        
        setWallets(data.wallets);
        setPagination(data.pagination);
      }
    } catch (error) {
      console.error('Error fetching wallets:', error);
    } finally {
      setLoading(false);
      setSearchLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    fetchWallets(newPage, filters);
  };

  const handleViewWallet = (wallet: WalletData) => {
    navigate(`/admin/wallets/${wallet.id}`);
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleApplyFilters = () => {
    fetchWallets(1, filters);
  };

  const handleClearFilters = () => {
    setFilters({ user_id: '', currency: '', status: '' });
    fetchWallets(1, {});
  };

  // Wallet columns
  const walletColumns = [
    {
      key: 'user',
      label: 'User',
      sortable: true,
      render: (value: any) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">{value.name}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">{value.email}</div>
          <div className="text-xs text-blue-600 dark:text-blue-400 uppercase">{value.role}</div>
        </div>
      )
    },
    {
      key: 'currency',
      label: 'Currency',
      sortable: true,
      render: (value: string) => (
        <span className="font-mono font-medium bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
          {value}
        </span>
      )
    },
    {
      key: 'balance',
      label: 'Total Balance',
      sortable: true,
      render: (value: number, row: WalletData) => (
        <MoneyDisplay
          amount={value}
          currency={row.currency}
          className="font-medium"
        />
      )
    },
    {
      key: 'available_balance',
      label: 'Available Balance',
      sortable: true,
      render: (value: number, row: WalletData) => (
        <MoneyDisplay
          amount={value}
          currency={row.currency}
          className="text-green-600 dark:text-green-400"
        />
      )
    },
    {
      key: 'held_balance',
      label: 'Held Balance',
      sortable: true,
      render: (value: number, row: WalletData) => (
        <MoneyDisplay
          amount={value}
          currency={row.currency}
          className="text-orange-600 dark:text-orange-400"
        />
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => <StatusBadge status={value} />
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (value: string) => new Date(value).toLocaleDateString()
    }
  ];

  // Calculate summary stats
  const totalWallets = wallets.length;
  const activeWallets = wallets.filter(w => w.status === 'ACTIVE').length;
  const uniqueCurrencies = new Set(wallets.map(w => w.currency)).size;
  const uniqueUsers = new Set(wallets.map(w => w.user.user_id)).size;
  
  const filteredWallets = selectedCurrency
    ? wallets.filter(w => w.currency === selectedCurrency)
    : wallets;

  // Total balance & available balance
  const totalBalance = filteredWallets.reduce((sum, w) => sum + w.balance, 0);
  const totalAvailable = filteredWallets.reduce((sum, w) => sum + w.available_balance, 0);
  const totalHeld = filteredWallets.reduce((sum, w) => sum + w.held_balance, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-600 dark:text-gray-400">Loading wallets...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Wallet Management</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage and monitor all user wallets across the system
          </p>
        </div>
        <div className='flex items-center justify-between'>
        <select
          value={selectedCurrency || ''}
          onChange={(e) => {
            const currency = e.target.value;
            setSelectedCurrency(currency);
          }}
          className="w-75 sm:w-full  me-3 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {[...new Set(wallets.map(w => w.currency))].map(currency => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Wallet className="h-8 w-8 text-blue-500" />
            <div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {totalWallets}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Wallets</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Users className="h-8 w-8 text-green-500" />
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {uniqueUsers}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Unique Users</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <TrendingUp className="h-8 w-8 text-purple-500" />
            <div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {uniqueCurrencies}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Currencies</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <DollarSign className="h-8 w-8 text-orange-500" />
            <div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {activeWallets}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Active Wallets</div>
            </div>
          </div>
        </div>
      </div>

      {/* Balance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-md font-medium text-gray-900 dark:text-white mb-2">Total Balance</h3>
          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
           {selectedCurrency} {totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Across all wallets
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-md font-medium text-gray-900 dark:text-white mb-2">Available Balance</h3>
          <div className="text-lg font-bold text-green-600 dark:text-green-400">
            {selectedCurrency} {totalAvailable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Ready for transactions
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <h3 className="text-md font-medium text-gray-900 dark:text-white mb-2">Held Balance</h3> 
          <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
            {selectedCurrency} {totalHeld.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Temporarily reserved
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              User ID
            </label>
            <input
              type="text"
              value={filters.user_id}
              onChange={(e) => handleFilterChange('user_id', e.target.value)}
              placeholder="Search by user ID..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Currency
            </label>
            <input
              type="text"
              value={filters.currency}
              onChange={(e) => handleFilterChange('currency', e.target.value)}
              placeholder="e.g., USD, EUR..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="FROZEN">Frozen</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
          </div>
          <div className="flex items-end space-x-2">
            <button
              onClick={handleApplyFilters}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Apply
            </button>
            <button
              onClick={handleClearFilters}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Wallets Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">All Wallets</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Complete overview of all user wallets in the system
          </p>
        </div>

        <DataTable
          data={wallets}
          columns={walletColumns}
          onView={handleViewWallet}
          loading={searchLoading}
          pagination={pagination}
          onPageChange={handlePageChange}
          searchPlaceholder="Search wallets..."
        />
      </div>
    </div>
  );
};

export default WalletsManagementPage;