import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Server } from 'lucide-react';
import MoneyDisplay from '../common/MoneyDisplay';
import StatusBadge from '../common/StatusBadge';
import DataTable from '../common/DataTable';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/api';

// Removed wallet balance overview; only transactions are shown here

const ProviderDetailsPage: React.FC = () => {
  const { providerId } = useParams<{ providerId: string }>();
  useAuth();

  // No balance section on this page currently
  const [txnLoading, setTxnLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [providerWallet, setProviderWallet] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, limit: localStorage.getItem('items_per_page') ?? 10, total: 0, pages: 0 });

  // Balance fetching removed

  // Provider transactions
  const fetchProviderTransactions = async (page = 1) => {
    try {
      setTxnLoading(true);
      const params: Record<string, any> = { page: page.toString(), limit: pagination.limit.toString() };
      if (providerId) params.provider_id = providerId;
      const res = await apiClient.getProviderTransaction(params);
      if (res.success && res.data) {
        const data: any = res.data as any;
        setProviderWallet(data.providerWallet || null);
        setTransactions(data.transactions || []);
        setPagination(data.pagination || pagination);
      }
    } finally {
      setTxnLoading(false);
    }
  };

  useEffect(() => {
    fetchProviderTransactions(1);
  }, [providerId]);

  const columns = [
    {
      key: 'txn_id',
      label: 'Transaction ID',
      sortable: true,
    },
    {
      key: 'amount',
      label: 'Amount',
      sortable: true,
      render: (value: number, row: any) => (
        <MoneyDisplay amount={value} currency={row.currency} colorize={true} />
      ),
    },
    {
      key: 'currency',
      label: 'Currency',
      sortable: true,
      render: (value: string) => (value || '').toUpperCase(),
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => <StatusBadge status={value} type="transaction" />,
    },
    {
      key: 'transaction_type',
      label: 'Type',
      sortable: true,
    },
    {
      key: 'provider_alias',
      label: 'Provider',
      sortable: true,
    },
    {
      key: 'created_at',
      label: 'Date',
      sortable: true,
      render: (value: string) => new Date(value).toLocaleString(),
    },
  ];

  // Removed provider info dummy rows

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Server className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Provider Details</h1>
            <p className="text-gray-600 dark:text-gray-400">Overview and wallet summary</p>
          </div>
        </div>
        <div className='flex items-center justify-between'> 
          {providerWallet && (
          <div className="flex items-center space-x-2">
            <p className="px-3 py-2 me-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700" >
              {providerWallet?.balance} {providerWallet?.currency}
            </p>
          </div>
          )}
          <div className="flex items-center space-x-2">
            <Link to="/providers" className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">Back to Providers</Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

        {/* Provider Transactions */}
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 md:col-span-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Provider Transactions</h2>
          <DataTable
            data={transactions}
            columns={columns}
            loading={txnLoading}
            pagination={pagination}
            onPageChange={(p) => fetchProviderTransactions(p)}
            searchPlaceholder="Search transactions..."
          />
        </div>
      </div>
    </div>
  );
};

export default ProviderDetailsPage;

