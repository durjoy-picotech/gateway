import React, { useState } from "react";
import { apiClient } from "../../services/api";
// import { useAuth } from "../../contexts/AuthContext";
import Modal from "../common/Modal";

interface ProviderAdjustmentModelProps {
  isOpen: boolean;
  data: any;
  onClose: () => void;
  onUpdated?: () => void;
}

const ProviderAdjustmentModel: React.FC<ProviderAdjustmentModelProps> = ({
  isOpen,
  data,
  onClose,
  onUpdated,
}) => {
//   const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: "",
    amount: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data?.provider_id) return;

    setLoading(true);
    try {
      await apiClient.updateProviderAdjustment(data.provider_id, {
        type: formData.type,
        amount: formData.amount,
      });
    setFormData({ type: "", amount: "" }); 
      if (onUpdated) onUpdated();
      onClose();
    } catch (error) {
      console.error("Failed to save provider adjustment:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={() => {
      onClose();
      setFormData({ type: "", amount: "" }); // ✅ reset when manually closed
    }}  title="Provider Adjustment">
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <span className="text-gray-600 dark:text-gray-300">Saving...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Balance</label>
            <input
              type="number"
              name="balance"
              value={data?.balance ?? 0}
              placeholder="Enter Balance"
              disabled
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>


          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Adjustment Type</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Type</option>
              <option value="add">Add</option>
              <option value="subtract">Subtract</option>
            </select>
          </div>


          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
            <input
              type="number"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              placeholder="Enter amount"
              required
              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                setFormData({ type: "", amount: "" }); 
                }} 
              className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Save
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
};

export default ProviderAdjustmentModel;
