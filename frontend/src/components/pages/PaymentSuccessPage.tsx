import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { apiClient } from '../../services/api';

interface Transaction {
  txn_id: string;
  status: string;
  message?: string;
  transaction_type?: string;
}

const PaymentSuccessPage: React.FC = () => {
  const { txnId } = useParams<{ txnId: string }>();
  const navigate = useNavigate();
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!txnId) {
      navigate('/');
      return;
    }

    const fetchTransaction = async () => {
      try {
        const result = await apiClient.getPaymentData(txnId);
        if (result.success) {
          setTransaction({
            txn_id: txnId,
            status: 'SUCCESS',
            transaction_type: result.data.transaction_type,
            message: result.data.transaction_type === 'TOP_UP' ? 'Wallet topup completed successfully' : 'Payment completed successfully'
          });
        } else {
          setTransaction({
            txn_id: txnId,
            status: 'SUCCESS',
            message: 'Transaction completed successfully'
          });
        }
      } catch {
        setTransaction({
          txn_id: txnId,
          status: 'SUCCESS',
          message: 'Transaction completed successfully'
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTransaction();
  }, [txnId, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-green-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-4">
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-green-800 mb-2">
            {transaction?.transaction_type === 'TOP_UP' ? 'Topup Successful!' : 'Payment Successful!'}
          </h1>
          <p className="text-gray-600 mb-6">{transaction?.message}</p>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Transaction ID:</span>
            <span className="font-mono text-sm text-gray-800">{transaction?.txn_id}</span>
          </div>
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-500 mb-4">
            {transaction?.transaction_type === 'TOP_UP' ? 'You will be redirected to your wallets shortly.' : 'You will be redirected back to the merchant shortly.'}
          </p>
          <button
            onClick={() => navigate(transaction?.transaction_type === 'TOP_UP' ? '/wallets' : '/')}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            {transaction?.transaction_type === 'TOP_UP' ? 'Return to Wallets' : 'Return to Dashboard'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentSuccessPage;