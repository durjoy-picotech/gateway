import React, { useState, useEffect } from "react";
import { apiClient } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import Modal from "../common/Modal";
import { RefreshCw } from "lucide-react";

interface ExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: () => void;
}

interface Wallet {
  id: string | number;
  currency: string;
  available_balance: number;
}

const ExchangeModal: React.FC<ExchangeModalProps> = ({ isOpen, onClose, onSubmit }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [exchangeRate, setExchangeRate] = useState<number | null>(null);
  const [calculatedAmount, setCalculatedAmount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [exchangeData, setExchangeData] = useState({
    from_currency: "",
    to_currency: "",
    amount: "",
    notes: "",
  });

  useEffect(() => {
    if (isOpen && user) {
      fetchWallets();
    }
  }, [isOpen, user]);

  const fetchWallets = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getWallets();
      if (response.success && response.data?.wallets) {
        setWallets(response.data.wallets);
      } else {
        setWallets([]);
      }
    } catch (error) {
      console.error("Error fetching wallets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleExchangeChange = async (field: string, value: string) => {
    setExchangeData((prev) => ({ ...prev, [field]: value }));

    // Trigger rate preview when relevant fields change
    if (["from_currency", "to_currency", "amount"].includes(field)) {
      const fromCurrency =
        field === "from_currency" ? value : exchangeData.from_currency;
      const toCurrency =
        field === "to_currency" ? value : exchangeData.to_currency;
      const amount =
        field === "amount"
          ? parseFloat(value)
          : parseFloat(exchangeData.amount || "0");

      if (
        fromCurrency &&
        toCurrency &&
        amount > 0 &&
        fromCurrency !== toCurrency
      ) {
        try {
          const response = await apiClient.convertCurrency({
            amount,
            from_currency: fromCurrency,
            to_currency: toCurrency,
          });

          if (response.success && response.data) {
            setExchangeRate(response.data.exchange_rate);
            setCalculatedAmount(response.data.converted_amount);
          } else {
            setExchangeRate(null);
            setCalculatedAmount(null);
          }
        } catch (error) {
          console.error("Error fetching exchange rate:", error);
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
    if (
      !exchangeData.from_currency ||
      !exchangeData.to_currency ||
      !exchangeData.amount
    )
      return;

    setSubmitting(true);
    try {
      const response = await apiClient.exchangeCurrency({
        from_currency: exchangeData.from_currency,
        to_currency: exchangeData.to_currency,
        amount: parseFloat(exchangeData.amount),
        notes: exchangeData.notes,
      });
      if (response.success) {
        await fetchWallets(); // Refresh wallets after success
        if (onSubmit) onSubmit();
        handleCancel(); // Reset form and close modal
      }
    } catch (error) {
      console.error("Error exchanging currency:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setExchangeData({
      from_currency: "",
      to_currency: "",
      amount: "",
      notes: "",
    });
    setExchangeRate(null);
    setCalculatedAmount(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Exchange Currency  ">
      <div className="space-y-4">
        {/* Currency selection */}
        <div className="grid grid-cols-2 gap-4">
          {/* From currency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              From Currency
            </label>
            {loading ? (
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                Loading wallets...
              </div>
            ) : (
              <select
                value={exchangeData.from_currency}
                onChange={(e) =>
                  handleExchangeChange("from_currency", e.target.value)
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                  bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
                  focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select currency...</option>
                {wallets.map((wallet) => (
                  <option key={wallet.id} value={wallet.currency}>
                    {wallet.currency} (Available:{" "}
                    {wallet.available_balance.toFixed(2)})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* To currency */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              To Currency
            </label>
            <select
              value={exchangeData.to_currency}
              onChange={(e) =>
                handleExchangeChange("to_currency", e.target.value)
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
                focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select currency...</option>
              {wallets
                .filter((w) => w.currency !== exchangeData.from_currency)
                .map((wallet) => (
                  <option key={wallet.id} value={wallet.currency}>
                    {wallet.currency}
                  </option>
                ))}
            </select>
          </div>
        </div>

        {/* Amount input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Amount to Exchange
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={exchangeData.amount}
            onChange={(e) => handleExchangeChange("amount", e.target.value)}
            placeholder="Enter amount..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
              bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Exchange rate preview */}
        {exchangeRate && calculatedAmount && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <div className="text-sm text-blue-800 dark:text-blue-200">
              <div className="flex justify-between">
                <span>Exchange Rate:</span>
                <span>{exchangeRate.toFixed(6)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>You will receive:</span>
                <span>
                  {calculatedAmount.toFixed(2)} {exchangeData.to_currency}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes (Optional)
          </label>
          <textarea
            value={exchangeData.notes}
            onChange={(e) => handleExchangeChange("notes", e.target.value)}
            placeholder="Add notes for this exchange..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
              bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
              focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 
              text-gray-700 dark:text-gray-300 rounded-lg 
              hover:bg-gray-50 dark:hover:bg-gray-700 
              transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExchange}
            disabled={
              submitting ||
              !exchangeData.from_currency ||
              !exchangeData.to_currency ||
              !exchangeData.amount
            }
            className="px-4 py-2 bg-green-600 text-white rounded-lg 
              hover:bg-green-700 transition-colors 
              disabled:opacity-50 flex items-center"
          >
            {submitting && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
            Exchange Currency
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default ExchangeModal;
