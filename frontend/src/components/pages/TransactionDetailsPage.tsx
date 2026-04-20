import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, RefreshCw, AlertCircle, Copy, Check } from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import MoneyDisplay from '../common/MoneyDisplay';
import SettlementStatusBadge from '../common/SettlementStatusBadge';
import { Transaction } from '../../types';
import apiClient from '../../services/api';

const TransactionDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchTransactionDetails(id);
    }
  }, [id]);

  const fetchTransactionDetails = async (txnId: string) => {
    try {
      setLoading(true);
      const response = await apiClient.getTransaction(txnId);
      if (response.success && response.data) {
        setTransaction(response.data as Transaction);
      }
    } catch (error) {
      console.error('Failed to fetch transaction details:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Loading transaction details...</span>
      </div>
    );
  }

  if (!transaction) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96">
        <AlertCircle className="h-16 w-16 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Transaction Not Found</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">The transaction you're looking for doesn't exist or has been removed.</p>
        <button
          onClick={() => navigate('/transactions')}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Transactions</span>
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
            onClick={() => navigate('/transactions')}
            className="flex items-center space-x-2 px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Transactions</span>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Transaction Details</h1>
            <p className="text-gray-600 dark:text-gray-400">Complete information about this transaction</p>
          </div>
        </div>
        <button
          onClick={() => id && fetchTransactionDetails(id)}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Transaction Overview Card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Transaction ID</label>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-sm text-blue-600 dark:text-blue-400">{transaction.txn_id}</span>
              <button
                onClick={() => copyToClipboard(transaction.txn_id, 'txn_id')}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
              >
                {copiedId === 'txn_id' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-gray-400" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Amount</label>
            <MoneyDisplay amount={transaction.amount} currency={transaction.currency} className="text-lg font-semibold" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
            <StatusBadge status={transaction.status} type="transaction" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Type</label>
            <span className="px-2 py-1 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
              {transaction.transaction_type}
            </span>
          </div>
        </div>
      </div>

      {/* Detailed Information */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transaction Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Transaction Information</h3>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Merchant ID</label>
                <span className="font-mono text-sm">{transaction.merchant_id}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Channel Type</label>
                <span className="text-sm">{transaction.channel_type}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Provider</label>
                <span className="text-sm">{transaction.provider_alias}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">FX Rate</label>
                <span className="text-sm">{transaction.fx_rate}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Created At</label>
                <span className="text-sm">{new Date(transaction.created_at).toLocaleString()}</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Completed At</label>
                <span className="text-sm">{transaction.completed_at ? new Date(transaction.completed_at).toLocaleString() : 'N/A'}</span>
              </div>
            </div>

            {transaction.customer_email && (
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Customer Email</label>
                <span className="text-sm">{transaction.customer_email}</span>
              </div>
            )}

            {transaction.token_id && (
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Token ID</label>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-sm text-green-600 dark:text-green-400">{transaction.token_id}</span>
                  <button
                    onClick={() => copyToClipboard(transaction.token_id!, 'token_id')}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    {copiedId === 'token_id' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-gray-400" />}
                  </button>
                </div>
              </div>
            )}

            {transaction.reference_id && (
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Reference ID</label>
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-sm text-purple-600 dark:text-purple-400">{transaction.reference_id}</span>
                  <button
                    onClick={() => copyToClipboard(transaction.reference_id!, 'reference_id')}
                    className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                  >
                    {copiedId === 'reference_id' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-gray-400" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Settlement Information */}
      {transaction.settlement_status && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Settlement Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Settlement Status</label>
              <SettlementStatusBadge status={transaction.settlement_status} />
            </div>
            {transaction.expected_settlement_date && (
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Expected Date</label>
                <span className="text-sm">{new Date(transaction.expected_settlement_date).toLocaleDateString()}</span>
              </div>
            )}
            {transaction.actual_settlement_date && (
              <div>
                <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Actual Date</label>
                <span className="text-sm text-green-600 dark:text-green-400">{new Date(transaction.actual_settlement_date).toLocaleDateString()}</span>
              </div>
            )}
          </div>
          {transaction.settlement_id && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Settlement ID</label>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-sm text-purple-600 dark:text-purple-400">{transaction.settlement_id}</span>
                <button
                  onClick={() => copyToClipboard(transaction.settlement_id!, 'settlement_id')}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  {copiedId === 'settlement_id' ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-gray-400" />}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error State */}
      {transaction.status === 'FAILED' && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            <div>
              <h4 className="text-sm font-medium text-red-800 dark:text-red-200">Transaction Failed</h4>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                This transaction could not be completed. Please check the details above for more information.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TransactionDetailsPage;