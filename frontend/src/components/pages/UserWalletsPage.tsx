import React, { useState, useEffect } from 'react';
import { Wallet, RefreshCw, TrendingUp, TrendingDown, ArrowRightLeft, DollarSign } from 'lucide-react';
import DataTable from '../common/DataTable';
import Modal from '../common/Modal';
import StatusBadge from '../common/StatusBadge';
import MoneyDisplay from '../common/MoneyDisplay';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/api';
import PayoutModal from './PayoutPage';
interface WalletData {
  id: number;
  currency: string;
  balance: number;
  held_balance: number;
  available_balance: number;
  status: string;
  created_at: string;
  last_updated: string;
}

interface WalletsResponse {
  user_id: string;
  role: string;
  wallets: WalletData[];
}

const UserWalletsPage: React.FC = () => {
  const { user } = useAuth();
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [topupAmount, setTopupAmount] = useState('');
  const [exchangeData, setExchangeData] = useState({
    from_currency: '',
    to_currency: '',
    amount: '',
    notes: ''
  });
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [calculatedAmount, setCalculatedAmount] = useState<number | null>(null);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [partner, setPartner] = useState<any>(null);
  const [agent, setAgent] = useState<any>(null);
  const [merchant, setMerchant] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [hasPayout, setHasPayout] = useState(false);
  const [hasPayIn, setHasPayIn] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletData | null>(null);
  // Fetch user's wallets
  useEffect(() => {
    if (user) {
      fetchWallets();
    }
  }, [user]);

  const fetchWallets = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getWallets();

      if (response.success && response.data) {
        const data = response.data as WalletsResponse;
        setWallets(data.wallets);
      }
    } catch (error) {
      console.error('Error fetching wallets:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleExchangeChange = async (field: string, value: string) => {
    setExchangeData(prev => ({ ...prev, [field]: value }));

    // Calculate exchange rate preview
    if (field === 'from_currency' || field === 'to_currency' || field === 'amount') {
      const fromWallet = wallets.find(w => w.currency === (field === 'from_currency' ? value : exchangeData.from_currency));
      const toWallet = wallets.find(w => w.currency === (field === 'to_currency' ? value : exchangeData.to_currency));
      const amount = field === 'amount' ? parseFloat(value) : parseFloat(exchangeData.amount);
      const fromCurrency = field === 'from_currency' ? value : exchangeData.from_currency;
      const toCurrency = field === 'to_currency' ? value : exchangeData.to_currency;

      if (fromWallet && toWallet && amount > 0 && fromCurrency && toCurrency) {
        try {
          const response = await apiClient.convertCurrency({
            amount: amount,
            from_currency: fromCurrency,
            to_currency: toCurrency
          });

          if (response.success && response.data) {
            setExchangeRate((response.data as any).exchange_rate);
            setCalculatedAmount((response.data as any).converted_amount);
          } else {
            setExchangeRate(null);
            setCalculatedAmount(null);
          }
        } catch (error) {
          console.error('Error fetching exchange rate:', error);
          setExchangeRate(null);
          setCalculatedAmount(null);
        }
      } else {
        setExchangeRate(null);
        setCalculatedAmount(null);
      }
    }
  };

  const handleExchange = async () => {
    if (!exchangeData.from_currency || !exchangeData.to_currency || !exchangeData.amount) return;

    setSubmitting(true);
    try {
      const response = await apiClient.exchangeCurrency({
        from_currency: exchangeData.from_currency,
        to_currency: exchangeData.to_currency,
        amount: parseFloat(exchangeData.amount),
        notes: exchangeData.notes
      });

      if (response.success) {
        // Refresh wallets
        await fetchWallets();
        setShowExchangeModal(false);
        setExchangeData({ from_currency: '', to_currency: '', amount: '', notes: '' });
        setExchangeRate(null);
        setCalculatedAmount(null);
      }
    } catch (error) {
      console.error('Error exchanging currency:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleTopup = async () => {
    if (!selectedCurrency || !topupAmount) return;

    setSubmitting(true);
    try {
      const response = await apiClient.topupRequest({
        currency: selectedCurrency,
        amount: parseFloat(topupAmount),
        userId: user?.user_id
      });

      if (response.success) {
        // Navigate to checkout page
        const { currency,amount } = response.data;
        window.location.href = `/top-up?currency=${currency}&amount=${amount}&userId=${user?.user_id}`;
      }
    } catch (error) {
      console.error('Error initiating topup:', error);
    } finally {
      setSubmitting(false);
    }
  };

  // Wallet columns
  const walletColumns = [
    {
      key: 'currency',
      label: 'Currency',
      sortable: true,
      render: (value: string) => (
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
            <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">
              {value.slice(0, 2)}
            </span>
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{value}</div>
          </div>
        </div>
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
  const totalBalance = selectedWallet 
    ? selectedWallet.balance 
    : wallets.length > 0 
      ? wallets[0].balance 
      : 0;

  const totalAvailable = selectedWallet 
    ? selectedWallet.available_balance 
    : wallets.length > 0 
      ? wallets[0].available_balance 
      : 0;


  useEffect(() => { fetchMerchants(), fetchPartners(), fetchAgent(); }, [user]);
  useEffect(() => { fetchProviders(); }, []);
    const fetchMerchants = async () => {
      if (user?.role == 'MERCHANT') {
        try {
          setLoading(true);
          const response = await apiClient.getMerchant(user?.merchant_id);
          if (response.success && response.data) setMerchant(response.data);
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
      }
    };
  
    const fetchProviders = async () => {
      try {
        setLoading(true);
        const response = await apiClient.getProviders({ limit: 50 });
        if (response.success && response.data) setProviders(response.data.providers || []);
      } catch (error) { console.error(error); }
      finally { setLoading(false); }
    };
  
    const fetchPartners = async () => {
      if (user?.role == 'PARTNER') {
        try {
          setLoading(true);
          const response = await apiClient.getPartner(user?.partner_id);
          if (response.success && response.data) setPartner(response.data);
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
      }
    };
  
    const fetchAgent = async () => {
      if (user?.role == 'AGENT') {
        try {
          setLoading(true);
          const response = await apiClient.getAgent(user?.agent_id);
          if (response.success && response.data) setAgent(response.data);
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
      }
    };

      useEffect(() => {
        if (!providers.length) return;
        if (merchant && merchant.enabled_providers && merchant.enabled_providers.length) {
          const providerPayout = providers.find(p => merchant.enabled_providers.includes(p.provider_id) && p.type === 'PAYOUT');
          const providerPayIn = providers.find(p => merchant.enabled_providers.includes(p.provider_id) && p.type === 'PAYIN');
          if (providerPayout) {
            setHasPayout(true);
          }
          if (providerPayIn) {
            setHasPayIn(true);
          }
        } else if (partner && partner.enabled_providers && partner.enabled_providers.length) {
          const providersPayout = providers.filter(p =>
            partner.enabled_providers.includes(p.provider_id) && p.type === 'PAYOUT'
          );
          const providersPayIn = providers.filter(p =>
            partner.enabled_providers.includes(p.provider_id) && p.type === 'PAYIN'
          );
          if (providersPayout && providersPayout.length > 0) {
            setHasPayout(true);
          }
          if (providersPayIn && providersPayIn.length > 0) {
            setHasPayIn(true);
          }
        } else if (agent && agent.enabled_providers && agent.enabled_providers.length) {
          const providersPayout = providers.filter(p =>
            agent.enabled_providers.includes(p.provider_id) && p.type === 'PAYOUT'
          );
          const providersPayIn = providers.filter(p =>
            agent.enabled_providers.includes(p.provider_id) && p.type === 'PAYIN'
          );
          if (providersPayout && providersPayout.length > 0) {
            setHasPayout(true);
          }
          if (providersPayIn && providersPayIn.length > 0) {
            setHasPayIn(true);
          }
        }
      }, [merchant, partner, agent, providers]);
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Wallets</h1>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Manage your multi-currency wallets and exchange funds
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={fetchWallets}
            className="flex items-center space-x-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Refresh</span>
          </button>
          {wallets.length >= 2 && (
            <button
              onClick={() => setShowExchangeModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <ArrowRightLeft className="h-4 w-4" />
              <span>Exchange</span>
            </button>
          )}
          {hasPayIn && (
          <button
            onClick={() => setShowTopupModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <DollarSign className="h-4 w-4" />
            <span>Pay In</span>
          </button>
          )}
          {hasPayout && (
          <button
            onClick={() => setShowPayoutModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            <DollarSign className="h-4 w-4" />
            <span>Payout</span>
          </button>
          )}

        </div>
      </div>

      {/* Summary Cards */}
      <div className="flex items-center justify-end">
        <select
            value={selectedWallet?.currency || ''}
            onChange={(e) => {
              const wallet = wallets.find(w => w.currency === e.target.value) || null;
              setSelectedWallet(wallet);
            }}
            className="w-25 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {wallets.map(wallet => (
              <option key={wallet.id} value={wallet.currency}>
                {wallet.currency}
              </option>
            ))}
        </select>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <TrendingUp className="h-8 w-8 text-green-500" />
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {activeWallets}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Active Wallets</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <DollarSign className="h-8 w-8 text-purple-500" />
            <div>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Total Balance</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <TrendingDown className="h-8 w-8 text-orange-500" />
            <div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {totalAvailable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Available Balance</div>
            </div>
          </div>
        </div>
      </div>

      {/* Wallets Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">Your Wallets</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Manage your multi-currency wallets
          </p>
        </div>

        <DataTable
          data={wallets}
          columns={walletColumns}
          loading={loading}
          searchPlaceholder="Search wallets..."
        />
      </div>

      {/* Exchange Modal */}
      <Modal
        isOpen={showExchangeModal}
        onClose={() => {
          setShowExchangeModal(false);
          setExchangeData({ from_currency: '', to_currency: '', amount: '', notes: '' });
          setExchangeRate(null);
          setCalculatedAmount(null);
        }}
        title="Exchange Currency"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                From Currency
              </label>
              <select
                value={exchangeData.from_currency}
                onChange={(e) => handleExchangeChange('from_currency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select currency...</option>
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.currency}>
                    {wallet.currency} (Available: {wallet.available_balance.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                To Currency
              </label>
              <select
                value={exchangeData.to_currency}
                onChange={(e) => handleExchangeChange('to_currency', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select currency...</option>
                {wallets.filter(w => w.currency !== exchangeData.from_currency).map((wallet) => (
                  <option key={wallet.id} value={wallet.currency}>
                    {wallet.currency}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Amount to Exchange
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={exchangeData.amount}
              onChange={(e) => handleExchangeChange('amount', e.target.value)}
              placeholder="Enter amount..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {exchangeRate && calculatedAmount && (
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <div className="flex justify-between">
                  <span>Exchange Rate:</span>
                  <span>{exchangeRate.toFixed(6)}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>You will receive:</span>
                  <span>{calculatedAmount.toFixed(2)} {exchangeData.to_currency}</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={exchangeData.notes}
              onChange={(e) => handleExchangeChange('notes', e.target.value)}
              placeholder="Add notes for this exchange..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowExchangeModal(false);
                setExchangeData({ from_currency: '', to_currency: '', amount: '', notes: '' });
                setExchangeRate(null);
                setCalculatedAmount(null);
              }}
              disabled={submitting}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleExchange}
              disabled={submitting || !exchangeData.from_currency || !exchangeData.to_currency || !exchangeData.amount}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {submitting && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
              Exchange Currency
            </button>
          </div>
        </div>
      </Modal>

      {/* Topup Modal */}
      <Modal
        isOpen={showTopupModal}
        onClose={() => {
          setShowTopupModal(false);
          setSelectedCurrency('');
          setTopupAmount('');
        }}
        title="Topup Wallet"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Select Currency
            </label>
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Choose a currency...</option>
              {wallets.map((wallet) => (
                <option key={wallet.id} value={wallet.currency}>
                  {wallet.currency} (Balance: {wallet.available_balance.toFixed(2)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Topup Amount
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={topupAmount}
              onChange={(e) => setTopupAmount(e.target.value)}
              placeholder="Enter amount..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowTopupModal(false);
                setSelectedCurrency('');
                setTopupAmount('');
              }}
              disabled={submitting}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleTopup}
              disabled={submitting || !selectedCurrency || !topupAmount}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {submitting && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
              Proceed to Checkout
            </button>
          </div>
        </div>
      </Modal>
      <PayoutModal
        isOpen={showPayoutModal}
        onClose={() => setShowPayoutModal(false)}
      />
    </div>
  );
};

export default UserWalletsPage;






















// import React, { useEffect, useState } from "react";
// import DataTable from "../common/DataTable";
// import Modal from "../common/Modal";
// import { toast } from "react-toastify";
// import { useAuth } from "../../contexts/AuthContext";
// import apiClient from "../../services/api";

// const TransferPage: React.FC = () => {
//     const { user } = useAuth();

//     const [transfers, setTransfers] = useState<any[]>([]);
//     const [loading, setLoading] = useState(true);
//     const [wallets, setWallets] = useState<any[]>([]);
//     const [banks, setBanks] = useState<any[]>([]);

//     const [showTransferModal, setShowTransferModal] = useState(false);

//     const [transferType, setTransferType] = useState("wallet_to_wallet");

//     const [formData, setFormData] = useState({
//         email: "",
//         amount: "",
//         currency: "",
//     });

//     const [transferData, setTransferData] = useState<any>({
//         amount: "",
//         currency: "",
//         bank_id: "",
//         from_bank_id: "",
//         to_bank_id: "",
//         from_wallet_id: "",
//         to_wallet_id: "",
//     });

//     const [selectedWalletId, setSelectedWalletId] = useState("");

//     useEffect(() => {
//         loadTransfers();
//         loadBanks();
//         loadWallets();
//     }, []);

//     const loadTransfers = async () => {
//         try {
//             setLoading(true);
//             const response = await apiClient.getTransfers();

//             if (response.success) {
//                 setTransfers(response.data || []);
//             }
//         } catch (error) {
//             console.error(error);
//         } finally {
//             setLoading(false);
//         }
//     };

//     const loadBanks = async () => {
//         try {
//             const res = await apiClient.getBanks();

//             if (res.success) setBanks(Array.isArray(res.data) ? res.data : []);
//         } catch (err) {
//             console.error(err);
//             setBanks([]);
//         }
//     };

//     const loadWallets = async () => {
//         try {
//             const res = await apiClient.getWallets();
//             // console.log(res);
//             if (res.success) setWallets(Array.isArray(res.data.wallets) ? res.data.wallets : []);
//         } catch (err) {
//             console.error(err);
//             setWallets([]);
//         }
//     };

//     const handleTransfer = async () => {
//         try {
//             let res;
//             if (transferType === "wallet_to_wallet") {

//                 if (!formData.email || !formData.amount) {
//                     toast.error("Fill in all fields!");
//                     return;
//                 }
//                 res = await apiClient.createTransfer({
//                     email: formData.email,
//                     amount: Number(formData.amount),
//                     currency: formData.currency,
//                 });
//             }

//             if (transferType === "wallet_to_bank") {

//                 if (!selectedWalletId || !transferData.bank_id || !transferData.amount) {
//                     toast.error("Select wallet, bank and enter amount!");
//                     return;
//                 }
//                 res = await apiClient.walletToBank({
//                     wallet_id: selectedWalletId,
//                     bank_id: transferData.bank_id,
//                     amount: Number(transferData.amount),
//                     currency: transferData.currency,
//                 });
//             }



//             if (transferType === "bank_to_bank") {
//                 if (!transferData.from_bank_id || !transferData.to_bank_id || !transferData.amount) {
//                     toast.error("Select both banks and enter amount!");
//                     return;
//                 }
//                 res = await apiClient.bankToBank({
//                     from_bank_id: transferData.from_bank_id,
//                     to_bank_id: transferData.to_bank_id,
//                     amount: Number(transferData.amount),
//                     currency: transferData.currency,
//                 });
//             }

//             if (transferType === "wallet_to_walletToMySelf") {
//                 if (!transferData.from_wallet_id || !transferData.to_wallet_id || !transferData.amount) {
//                     toast.error("Select both wallets and enter amount!");
//                     return;
//                 }
//                 res = await apiClient.walletToMySelf({
//                     from_wallet_id: transferData.from_wallet_id,
//                     to_wallet_id: transferData.to_wallet_id,
//                     amount: Number(transferData.amount),
//                     currency: transferData.currency,
//                 });
//             }

//             if (res?.success) {
//                 toast.success("Transfer successful!");
//                 setShowTransferModal(false);
//                 await loadTransfers();
//                 setFormData({ email: "", amount: "", currency: "" });
//                 setTransferData({
//                     amount: "",
//                     currency: "",
//                     bank_id: "",
//                     from_bank_id: "",
//                     to_bank_id: "",
//                     from_wallet_id: "",
//                     to_wallet_id: "",
//                 });
//                 setSelectedWalletId("");
//             }
//         } catch (err) {
//             console.error(err);
//             toast.error("Transfer failed!");
//         }
//     };

//     const transferColumns = [
//         {
//             key: "sender",
//             label: "Sender",
//             render: (_: any, row: any) => (
//                 <div>
//                     <div>{row.sender?.name}</div>
//                     <div className="text-xs">{row.sender?.email}</div>
//                 </div>
//             ),
//         },
//         {
//             key: "receiver",
//             label: "Receiver",
//             render: (_: any, row: any) => (
//                 <div>
//                     <div>{row.receiver?.name}</div>
//                     <div className="text-xs">{row.receiver?.email}</div>
//                 </div>
//             ),
//         },
//         {
//             key: "amount",
//             label: "Amount",
//             render: (value: any, row: any) => (
//                 <span>
//                     {Number(value || 0).toFixed(2)} {row.currency}
//                 </span>
//             ),
//         },
//         {
//             key: "created_at",
//             label: "Date",
//             render: (value: string) => new Date(value).toLocaleDateString(),
//         },
//     ];

//     return (
//         <div className="space-y-6">
//             <div className="flex justify-between items-center">
//                 <h1 className="text-2xl font-bold text-white">Transfer Management</h1>
//                 <button
//                     onClick={() => setShowTransferModal(true)}
//                     className="px-4 py-2 bg-blue-600 text-white rounded-lg"
//                 >
//                     New Transfer
//                 </button>
//             </div>

//             <DataTable
//                 data={transfers}
//                 columns={transferColumns}
//                 loading={loading} />

//             <Modal isOpen={showTransferModal} onClose={() => setShowTransferModal(false)} title="Transfer">
//                 <div className="space-y-3">
//                     {/* TRANSFER TYPE */}
//                     <select
//                         value={transferType}
//                         onChange={(e) => setTransferType(e.target.value)}
//                         className="w-full px-3 py-2 border rounded-lg"
//                     >
//                         <option value="wallet_to_wallet">Wallet → Wallet</option>
//                         <option value="wallet_to_bank">Wallet → Bank</option>
//                         <option value="bank_to_bank">Bank → Bank</option>
//                         <option value="wallet_to_walletToMySelf">Wallet → walletToMySelf</option>
//                     </select>

//                     {/* WALLET → WALLET */}
//                     {transferType === "wallet_to_wallet" && (
//                         <>
//                             <input
//                                 type="email"
//                                 placeholder="Receiver Email"
//                                 value={formData.email}
//                                 onChange={(e) => setFormData({ ...formData, email: e.target.value })}
//                                 className="w-full px-3 py-2 border rounded-lg"
//                             />
//                             <input
//                                 type="number"
//                                 placeholder="Amount"
//                                 value={formData.amount}
//                                 onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
//                                 className="w-full px-3 py-2 border rounded-lg"
//                             />
//                             <select
//                                 value={formData.currency}
//                                 onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
//                                 className="w-full px-3 py-2 border rounded-lg"
//                             >
//                                 <option value="USD">USD</option>
//                                 <option value="BDT">BDT</option>
//                                 <option value="INR">INR</option>
//                             </select>
//                         </>
//                     )}

//                     {/* WALLET → BANK */}
//                     {transferType === "wallet_to_bank" && (
//                         <>
//                             <select
//                                 value={selectedWalletId}
//                                 onChange={(e) => setSelectedWalletId(e.target.value)}
//                                 className="w-full px-3 py-2 border rounded-lg"
//                             >
//                                 <option value="">Select Wallet</option>
//                                 {Array.isArray(wallets) &&
//                                     wallets.map((w) => (
//                                         <option key={w.id} value={w.id}>
//                                             {w.name} (Available: {w.available_balance.toFixed(2)} {w.currency})
//                                         </option>
//                                     ))}
//                             </select>

//                             {/* {selectedWalletId && (
//                                 <div className="text-sm text-gray-500 mt-1">
//                                     Available Balance:{" "}
//                                     {wallets.find((w) => w.id === selectedWalletId)?.available_balance.toFixed(2)}{" "}
//                                     {wallets.find((w) => w.id === selectedWalletId)?.currency}
//                                 </div>
//                             )} */}

//                             <select
//                                 value={transferData.bank_id}
//                                 onChange={(e) => setTransferData({ ...transferData, bank_id: e.target.value })}
//                                 className="w-full px-3 py-2 border rounded-lg"
//                             >
//                                 <option value="">Select Bank</option>
//                                 {Array.isArray(banks) &&
//                                     banks.map((b) => (
//                                         <option key={b.id} value={b.id}>
//                                             {b.bankAccount}
//                                         </option>
//                                     ))}
//                             </select>

//                             <input
//                                 type="number"
//                                 placeholder="Amount"
//                                 value={transferData.amount}
//                                 onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
//                                 className="w-full px-3 py-2 border rounded-lg"
//                             />
//                         </>
//                     )}

//                     {/* BANK → BANK */}
//                     {transferType === "bank_to_bank" && (
//                         <>
//                             <select
//                                 value={transferData.from_bank_id}
//                                 onChange={(e) => setTransferData({ ...transferData, from_bank_id: e.target.value })}
//                                 className="w-full px-3 py-2 border rounded-lg"
//                             >
//                                 <option value="">From Bank</option>
//                                 {Array.isArray(banks) &&
//                                     banks.map((b) => (
//                                         <option key={b.id} value={b.id}>
//                                             {b.bankAccount}
//                                         </option>
//                                     ))}
//                             </select>

//                             <select
//                                 value={transferData.to_bank_id}
//                                 onChange={(e) => setTransferData({ ...transferData, to_bank_id: e.target.value })}
//                                 className="w-full px-3 py-2 border rounded-lg"
//                             >
//                                 <option value="">To Bank</option>
//                                 {Array.isArray(banks) &&
//                                     banks.map((b) => (
//                                         <option key={b.id} value={b.id}>
//                                             {b.bankAccount}
//                                         </option>
//                                     ))}
//                             </select>

//                             <input
//                                 type="number"
//                                 placeholder="Amount"
//                                 value={transferData.amount}
//                                 onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
//                                 className="w-full px-3 py-2 border rounded-lg"
//                             />
//                         </>
//                     )}

//                     {/* WALLET → WALLET TO MYSELF */}
//                     {transferType === "wallet_to_walletToMySelf" && (
//                         <>
//                             <select
//                                 value={transferData.from_wallet_id}
//                                 onChange={(e) => setTransferData({ ...transferData, from_wallet_id: e.target.value })}
//                                 className="w-full px-3 py-2 border rounded-lg"
//                             >
//                                 <option value="">From Wallet</option>
//                                 {Array.isArray(wallets) &&
//                                     wallets.map((w) => (
//                                         <option key={w.id} value={w.id}>
//                                             {w.name} (Available: {w.available_balance.toFixed(2)} {w.currency})
//                                         </option>
//                                     ))}
//                             </select>

//                             {/* {transferData.from_wallet_id && (
//                                 <div className="text-sm text-gray-500 mt-1">
//                                     Available Balance:{" "}
//                                     {wallets.find((w) => w.id === transferData.from_wallet_id)?.available_balance.toFixed(2)}{" "}
//                                     {wallets.find((w) => w.id === transferData.from_wallet_id)?.currency}
//                                 </div>
//                             )} */}

//                             <select
//                                 value={transferData.to_wallet_id}
//                                 onChange={(e) => setTransferData({ ...transferData, to_wallet_id: e.target.value })}
//                                 className="w-full px-3 py-2 border rounded-lg"
//                             >
//                                 <option value="">To Wallet</option>
//                                 {Array.isArray(wallets) &&
//                                     wallets.map((w) => (
//                                         <option key={w.id} value={w.id}>
//                                             {w.name} (Available: {w.available_balance.toFixed(2)} {w.currency})
//                                         </option>
//                                     ))}
//                             </select>

//                             <input
//                                 type="number"
//                                 placeholder="Amount"
//                                 value={transferData.amount}
//                                 onChange={(e) => setTransferData({ ...transferData, amount: e.target.value })}
//                                 className="w-full px-3 py-2 border rounded-lg"
//                             />
//                         </>
//                     )}

//                     <button
//                         onClick={handleTransfer}
//                         className="px-4 py-2 bg-green-600 text-white rounded-lg w-full"
//                     >
//                         Submit
//                     </button>
//                 </div>
//             </Modal>

//         </div>
//     );
// };

// export default TransferPage;














// import React, { useEffect, useState } from "react";
// import DataTable from "../common/DataTable";
// import Modal from "../common/Modal";
// import { toast } from "react-toastify";
// import { useAuth } from "../../contexts/AuthContext";
// import apiClient from "../../services/api";

// const TransferPage: React.FC = () => {
//     const { user } = useAuth();

//     const [transfers, setTransfers] = useState<any[]>([]);
//     const [loading, setLoading] = useState(true);

//     const [showTransferModal, setShowTransferModal] = useState(false);
//     const [banks, setBanks] = useState<any[]>([]);

//     const [transferType, setTransferType] = useState("wallet_to_wallet");

//     const [formData, setFormData] = useState({
//         email: "",
//         amount: "",
//         currency: "USD",
//     });

//     const [transferData, setTransferData] = useState<any>({
//         amount: "",
//         currency: "BDT",
//         bank_id: "",
//         from_bank_id: "",
//         to_bank_id: "",
//     });

//     const [selectedWalletId, setSelectedWalletId] = useState(""); // Wallet → Bank

//     useEffect(() => {
//         loadTransfers();
//         loadBanks();
//     }, []);

//     const loadTransfers = async () => {
//         try {
//             setLoading(true);
//             const response = await apiClient.getTransfers();
//             if (response.success) {
//                 setTransfers(response.data || []);
//             }
//         } catch (error) {
//             console.error(error);
//         } finally {
//             setLoading(false);
//         }
//     };

//     const loadBanks = async () => {
//         try {
//             const res = await apiClient.getBanks();
//             if (res.success) {
//                 setBanks(res.data || []);
//             }
//         } catch (err) {
//             console.error(err);
//         }
//     };

//     const handleTransfer = async () => {
//         try {
//             let res;

//             if (transferType === "wallet_to_wallet") {
//                 if (!formData.email || !formData.amount) {
//                     toast.error("Fill in all fields!");
//                     return;
//                 }
//                 res = await apiClient.createTransfer({
//                     email: formData.email,
//                     amount: Number(formData.amount),
//                     currency: formData.currency,
//                 });
//             }

//             if (transferType === "wallet_to_bank") {
//                 if (!selectedWalletId || !transferData.bank_id || !transferData.amount) {
//                     toast.error("Select wallet, bank and enter amount!");
//                     return;
//                 }
//                 res = await apiClient.walletToBank({
//                     wallet_id: selectedWalletId,
//                     bank_id: transferData.bank_id,
//                     amount: Number(transferData.amount),
//                     currency: transferData.currency,
//                 });
//             }

//             if (transferType === "bank_to_bank") {
//                 if (!transferData.from_bank_id || !transferData.to_bank_id || !transferData.amount) {
//                     toast.error("Select both banks and enter amount!");
//                     return;
//                 }
//                 res = await apiClient.bankToBank ({
//                     from_bank_id: transferData.from_bank_id,
//                     to_bank_id: transferData.to_bank_id,
//                     amount: Number(transferData.amount),
//                     currency: transferData.currency,
//                 });
//             }

//             if (res?.success) {
//                 toast.success("Transfer successful!");
//                 setShowTransferModal(false);
//                 await loadBanks();

//                 loadTransfers();
//                 setFormData({ email: "", amount: "", currency: "USD" });
//                 setTransferData({ amount: "", currency: "BDT", bank_id: "", from_bank_id: "", to_bank_id: "" });
//             }


 
//         } catch (err) {
//             console.error(err);
//             toast.error("Transfer failed!");
//         }
//     };

//     const transferColumns = [
//         {
//             key: "sender",
//             label: "Sender",
//             render: (_: any, row: any) => (
//                 <div>
//                     <div>{row.sender?.name}</div>
//                     <div className="text-xs">{row.sender?.email}</div>
//                 </div>
//             ),
//         },
//         {
//             key: "receiver",
//             label: "Receiver",
//             render: (_: any, row: any) => (
//                 <div>
//                     <div>{row.receiver?.name}</div>
//                     <div className="text-xs">{row.receiver?.email}</div>
//                 </div>
//             ),
//         },
//         {
//             key: "amount",
//             label: "Amount",
//             render: (value: any, row: any) => (
//                 <span>
//                     {Number(value || 0).toFixed(2)} {row.currency}
//                 </span>
//             ),
//         },
//         {
//             key: "created_at",
//             label: "Date",
//             render: (value: string) => new Date(value).toLocaleDateString(),
//         },
//     ];

//     return (
//         <div className="space-y-6">
//             <div className="flex justify-between items-center">
//                 <h1 className="text-2xl font-bold text-white">Transfer Management</h1>
//                 <button
//                     onClick={() => setShowTransferModal(true)}
//                     className="px-4 py-2 bg-blue-600 text-white rounded-lg"
//                 >
//                     New Transfer
//                 </button>
//             </div>

//             <DataTable data={transfers} columns={transferColumns} loading={loading} />

//             <Modal
//                 isOpen={showTransferModal}
//                 onClose={() => setShowTransferModal(false)}
//                 title="Transfer"
//             >
//                 <div className="space-y-3">
//                     {/* TYPE */}
//                     <select
//                         value={transferType}
//                         onChange={(e) => setTransferType(e.target.value)}
//                         className="w-full px-3 py-2 border rounded-lg"
//                     >
//                         <option value="wallet_to_wallet">Wallet → Wallet</option>
//                         <option value="wallet_to_bank">Wallet → Bank</option>
//                         <option value="bank_to_bank">Bank → Bank</option>
//                     </select>

//                     {/* AMOUNT */}
//                     <input
//                         type="number"
//                         placeholder="Amount"
//                         value={transferData.amount || formData.amount}
//                         onChange={(e) => {
//                             setFormData({ ...formData, amount: e.target.value });
//                             setTransferData({ ...transferData, amount: e.target.value });
//                         }}
//                         className="w-full px-3 py-2 border rounded-lg"
//                     />

//                     {/* CURRENCY */}
//                     <select
//                         value={transferData.currency || formData.currency}
//                         onChange={(e) => {
//                             setFormData({ ...formData, currency: e.target.value });
//                             setTransferData({ ...transferData, currency: e.target.value });
//                         }}
//                         className="w-full px-3 py-2 border rounded-lg"
//                     >
//                         <option value="USD">USD</option>
//                         <option value="BDT">BDT</option>
//                         <option value="INR">INR</option>
//                     </select>

//                     {/* WALLET TO WALLET */}
//                     {transferType === "wallet_to_wallet" && (
//                         <input
//                             type="email"
//                             placeholder="Receiver Email"
//                             value={formData.email}
//                             onChange={(e) =>
//                                 setFormData({ ...formData, email: e.target.value })
//                             }
//                             className="w-full px-3 py-2 border rounded-lg"
//                         />
//                     )}

//                     {/* WALLET TO BANK */}
//                     {transferType === "wallet_to_bank" && (
//                         <>
//                             <select
//                                 value={selectedWalletId}
//                                 onChange={(e) => setSelectedWalletId(e.target.value)}
//                                 className="w-full px-3 py-2 border rounded-lg"
//                             >
//                                 <option value="">Select Wallet</option>
//                                 <option value="main_wallet_id">Main Wallet</option>
//                             </select>

//                             <select
//                                 value={transferData.bank_id}
//                                 onChange={(e) =>
//                                     setTransferData({ ...transferData, bank_id: e.target.value })
//                                 }
//                                 className="w-full px-3 py-2 border rounded-lg"
//                             >
//                                 <option value="">Select Bank</option>
//                                 {banks.map((bank) => (
//                                     <option key={bank.id} value={bank.id}>
//                                         {bank.bankAccoutntHolder} - {bank.bankAccount}
//                                     </option>
//                                 ))}
//                             </select>
//                         </>
//                     )}

//                     {/* BANK TO BANK */}
//                     {transferType === "bank_to_bank" && (
//                         <>
//                             <select
//                                 value={transferData.from_bank_id}
//                                 onChange={(e) =>
//                                     setTransferData({ ...transferData, from_bank_id: e.target.value })
//                                 }
//                                 className="w-full px-3 py-2 border rounded-lg"
//                             >
//                                 <option value="">Select From Bank</option>
//                                 {banks.map((b) => (
//                                     <option key={b.id} value={b.id}>{b.bankAccount}</option>
//                                 ))}
//                             </select>

//                             <select
//                                 value={transferData.to_bank_id}
//                                 onChange={(e) =>
//                                     setTransferData({ ...transferData, to_bank_id: e.target.value })
//                                 }
//                                 className="w-full px-3 py-2 border rounded-lg"
//                             >
//                                 <option value="">Select To Bank</option>
//                                 {banks.map((b) => (
//                                     <option key={b.id} value={b.id}>{b.bankAccount}</option>
//                                 ))}
//                             </select>
//                         </>
//                     )}

//                     <button
//                         onClick={handleTransfer}
//                         className="px-4 py-2 bg-green-600 text-white rounded-lg w-full"
//                     >
//                         Submit
//                     </button>
//                 </div>
//             </Modal>
//         </div>
//     );
// };

// export default TransferPage;