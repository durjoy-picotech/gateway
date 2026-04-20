import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { apiClient } from '../../services/api';

interface Transaction {
    txn_id: string;
    amount: number;
    currency: string;
    channel_type?: string;
    transaction_type?: string;
}

interface Provider {
    gateway: string;
    name: string;
}

interface PaymentData {
    transaction: Transaction;
    providers: Provider[];
}

const TopUpPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
    const [selectedProvider, setSelectedProvider] = useState<string>('');
    const [offlineTxnId, setOfflineTxnId] = useState<string>('');
    const [currency, setCurrency] = useState<string>('');
    const [amount, setAmount] = useState<string>('');
    const [userId, setUserId] = useState<string>('');
    const location = useLocation();
    useEffect(() => {
        const searchParams = new URLSearchParams(location.search);
        setCurrency(searchParams.get('currency') || '');
        setAmount(searchParams.get('amount') || '');
        setUserId(searchParams.get('userId') || '');

    }, [location.search]);

    useEffect(() => {
        if (userId && currency && amount) {
            fetchPaymentData();
        }
    }, [location.search, currency, amount, userId]);
    const fetchPaymentData = async () => {
        try {
            const params: Record<string, string> = {
                page: 10,
            };

            if (currency) params.currency = currency;
            if (amount) params.amount = amount;
            if (userId) params.userId = userId;

            const result = await apiClient.topupProcess(params);
            if (result.success) {
                setPaymentData(result.data);
            } else {
                toast.error(result.error?.message || 'Failed to load payment data');
            }
        } catch {
            toast.error('Failed to load payment data');
        } finally {
            setLoading(false);
        }
    };

    const handlePayment = async () => {
        if (!selectedProvider) {
            toast.error('Please select a payment method');
            return;
        }
        console.log(selectedProvider);
        console.log(selected);


        setProcessing(true);
        try {

            const url = '/wallets';
            const payload: any = {
                gateway: selectedProvider,
                amount: paymentData?.transaction.amount || 0,
                user_id: paymentData?.transaction.userId || userId,
                currency: paymentData?.transaction.currency || currency,
                url: `${window.location.origin}${url}`,
            };

            // Include txn_id for offline payments
            if (selected?.gateway === 'OFFLINE') {
                payload.txn_id = offlineTxnId;
            }
            const result = await apiClient.topupPayNow(payload);
            if (result.success) {
                console.log(result);

                if (result.data.PayURL) {
                    window.location.href = result.data.PayURL;
                    return;
                }
                // window.location.href = `/payment/${result.data.txn_id}/success`;
            } else {
                toast.error(result.error?.message || 'Failed to process payment');
            }
        } catch {
            toast.error('Failed to process payment');
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!paymentData) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-red-600 mb-4">Payment Error</h1>
                    <p className="text-gray-600">Unable to load payment information.</p>
                </div>
            </div>
        );
    }

    const selected = paymentData?.providers.find(p => p.provider_id === selectedProvider);

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-900">
                        {paymentData?.providers && paymentData.providers.length > 0 ? 'Topup Your Wallet' : 'Complete Your Payment'}
                    </h1>
                    <p className="text-gray-600 mt-2">
                        {paymentData?.providers && paymentData.providers.length > 0 ? 'Choose your preferred payment provider' : 'Choose your preferred payment method'}
                    </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <div className="flex justify-between items-center">
                        <span className="text-gray-600">Amount:</span>
                        <span className="text-xl font-bold text-gray-900">
                            {paymentData.transaction.amount.toFixed(2)} {paymentData.transaction.currency}
                        </span>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Payment Method
                        </label>
                        <div className="space-y-2">
                            {paymentData.providers.map((provider) => (
                                <label key={provider.provider_id} className="flex items-center">
                                    <input
                                        type="radio"
                                        name="provider"
                                        value={provider.provider_id}
                                        checked={selectedProvider === provider.provider_id}
                                        onChange={(e) => setSelectedProvider(e.target.value)}
                                        disabled={processing}
                                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                                    />
                                    <span className="ml-2 text-sm text-gray-900">{provider.alias}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600">Fee:</span>
                            <span className="text-xl font-bold text-gray-900">

                                {(
                                    ((paymentData.transaction.amount * (selected?.fee_percentage || 0)) / 100) +
                                    (selected?.fixed_amount || 0)
                                ).toFixed(2)}

                                {paymentData.transaction.currency}
                            </span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-gray-600">Total:</span>
                            <span className="text-xl font-bold text-gray-900">

                                {(
                                    (paymentData.transaction.amount +
                                        ((paymentData.transaction.amount * (selected?.fee_percentage || 0)) / 100) +
                                        (selected?.fixed_amount || 0))
                                    // * (paymentData?.exchangeRate || 0)
                                ).toFixed(2)}

                                {paymentData.transaction.currency}
                            </span>
                        </div>
                    </div>


                    <div>
                        {selected?.gateway === 'OFFLINE' && (
                            <div>
                                {selected?.gateway_info && (
                                    <div className="border p-2 rounded mb-2 bg-gray-50">
                                        {JSON.parse(selected.gateway_info).details}
                                    </div>
                                )}
                                <input
                                    type="text"
                                    name="txn_id"
                                    value={offlineTxnId}
                                    onChange={(e) => setOfflineTxnId(e.target.value)}
                                    placeholder="Enter Transaction ID"
                                    className="w-full border p-2 rounded"
                                />
                            </div>
                        )}
                    </div>
                    <button
                        onClick={handlePayment}
                        disabled={!selectedProvider || processing}
                        className="w-full bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                        {processing ? (
                            <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Processing...
                            </>
                        ) : (
                            'Proceed to Payment'
                        )}
                    </button>
                </div>
                <div className="mt-6 text-center">
                    <p className="text-sm text-gray-500">Secure payment powered by our gateway</p>
                </div>
            </div>
        </div>
    );
};

export default TopUpPage;