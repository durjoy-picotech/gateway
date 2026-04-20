import React, { useState, useEffect } from "react";
import { apiClient } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import Modal from "../common/Modal";
import { RefreshCw } from "lucide-react";

interface PayInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PayInModal: React.FC<PayInModalProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState("");
  const [wallets, setWallets] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && user) {
      fetchWallets();
    }
  }, [isOpen, user]);

  const fetchWallets = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getWallets();

      if (response.success && response.data) {
        setWallets(response.data.wallets || []);
      }
    } catch (error) {
      console.error("Error fetching wallets:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTopup = async () => {
    if (!selectedCurrency || !topupAmount) return;

    setSubmitting(true);
    try {
      const response = await opupRequest({
        currency: selectedCurrency,
        amount: parseFloat(topupAmount),
        userId: user?.user_id,
      });

      if (response.success && response.data) {
         const { currency,amount } = response.data;
        window.location.href = `/top-up?currency=${currency}&amount=${amount}&userId=${user?.user_id}`;
      } else {
        console.error("Invalid response from topupRequest:", response);
      }
    } catch (error) {
      console.error("Error initiating topup:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setSelectedCurrency("");
    setTopupAmount("");
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="space-y-4">
        {/* Currency Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Select Currency
          </label>
          {loading ? (
            <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              Loading wallets...
            </div>
          ) : (
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
                focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Choose a currency...</option>
              {wallets.map((wallet) => (
                <option key={wallet.id} value={wallet.currency}>
                  {wallet.currency} (Balance:{" "}
                  {parseFloat(wallet.available_balance).toFixed(2)})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Top-up Amount
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={topupAmount}
            onChange={(e) => setTopupAmount(e.target.value)}
            placeholder="Enter amount..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
              bg-white dark:bg-gray-700 text-gray-900 dark:text-white 
              focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={handleCancel}
            disabled={submitting}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 
              text-gray-700 dark:text-gray-300 rounded-lg 
              hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors 
              disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            onClick={handleTopup}
            disabled={submitting || !selectedCurrency || !topupAmount}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg 
              hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center"
          >
            {submitting && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
            Proceed to Checkout
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default PayInModal;
