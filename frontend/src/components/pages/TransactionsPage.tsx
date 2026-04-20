import React, { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import DataTable from '../common/DataTable';
import Modal from '../common/Modal';
import StatusBadge from '../common/StatusBadge';
import MoneyDisplay from '../common/MoneyDisplay';
import { useAuth } from '../../contexts/AuthContext';
import { Transaction } from '../../types';
import apiClient from '../../services/api';

const TransactionsPage: React.FC = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: localStorage.getItem('items_per_page') ?? 10,
    total: 0,
    pages: 0
  });
  const [filters, setFilters] = useState({
    status: '',
    type: '',
    dateFrom: '',
    dateTo: '',
    minAmount: '',
    maxAmount: '',
    userdata: user ?? null,
  });
  const [reports, setReports] = useState([]);
  const [allTxnIds, setAllTxnIds] = useState([]);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    fetchTransactions();
  }, [filters]);

  const fetchTransactions = async (page = 1, isPagination = false) => {
    try {
      if (!isPagination) setLoading(true);

      // Build query parameters from filters
      const params: Record<string, string> = {
        page: page ? page.toString() : pagination.page.toString(),
        limit: pagination.limit.toString()
      };

      if (filters.status) params.status = filters.status;
      if (filters.type) params.transaction_type = filters.type;
      if (filters.dateFrom) params.date_from = filters.dateFrom;
      if (filters.dateTo) params.date_to = filters.dateTo;
      if (filters.minAmount) params.min_amount = filters.minAmount;
      if (filters.maxAmount) params.max_amount = filters.maxAmount;

      const response = await apiClient.get('/transactions', params);
      if (response.success && response.data) {
        setTransactions((response.data as any).transactions || []);
        setPagination((response.data as any).pagination || pagination);
        setAllTxnIds((response.data as any).allTxnIds || [])
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
    }
  };

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
            <span 
                className={`px-[10px] py-0 text-[11px] font-semibold rounded 
                ${
                  row.transaction_type === 'PAY_IN'
                    ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                    : row.transaction_type === 'PAY_OUT'
                    ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                    : row.transaction_type === 'REFUND'
                    ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200'
                }`}
                >
              {row.transaction_type}
            </span>
          </div>
          {row.fee_type && (
          <div className="flex items-center space-x-1">
            <span className="font-medium text-gray-500 dark:text-gray-400">Fee For:</span>
            <span className="px-[10px] py-0 text-[11px] font-semibold rounded">
              {row.fee_type}
            </span>
          </div>
          )}
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
        }else{
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
    }
  ];

  const fetchReports = async () => {
    const response = await apiClient.getReports();
    if (response.success) {
      const data = response.data as any;
      setReports(data?.data || []);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const generateReport = async () => {
    setLoading(true);
    const txnIds = allTxnIds;
    const response = await apiClient.generateReport({
      type: 'transactions',
      parameters: { dateRange: '30d', currency: 'all',txn_ids: txnIds },
      format: 'PDF',
    });
    if (response.success) {
      fetchReports();
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transactions</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage and monitor payment transactions
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={generateReport}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>{loading ? 'Generating...' : 'Generate'}</span>
          </button>
          <button
            onClick={() => setOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <span>Reports</span>
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="SUCCESS">Success</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Type</option>
              <option value="ADJUSTMENT">Adjustment</option>
              <option value="PAY_IN">Pay In</option>
              <option value="PAY_OUT">Pay Out</option>
              <option value="REFUND">Refund</option>
            </select>
          </div>

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

      {/* Transactions Table */}
      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600 dark:text-gray-400">Loading transactions...</span>
          </div>
        </div>
      ) : (
        <DataTable
          data={transactions}
          columns={columns}
          pagination={pagination}
          onPageChange={(page) => fetchTransactions(page, true)}
          searchPlaceholder="Search transactions..."
        />
      )}

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Generated Reports"
        size="lg"
      >
        <div className="space-y-3">
          {reports && reports.length > 0 ? (
            reports
              .filter((r: any) => r.type === "transactions")
              .map((report: any) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {report.type} Report
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Generated {new Date(report.created_at).toLocaleString()}
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      const response = await apiClient.downloadReport(report.id);
                      if (response.ok) {
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = `report_${report.id}.${report.format.toLowerCase()}`;
                        document.body.appendChild(a);
                        a.click();
                        window.URL.revokeObjectURL(url);
                        document.body.removeChild(a);
                      } else {
                        alert("Failed to download report");
                      }
                    }}
                    className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                  >
                    Download
                  </button>
                </div>
              ))
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-4">
              No transaction reports found
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default TransactionsPage;