
import React, { useState, useEffect } from "react";
import { apiClient } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import DataTable from "../common/DataTable";
import Modal from "../common/Modal";
import { DollarSign } from 'lucide-react';
import PayInModal from "./PayInModal";
const PayINPageList: React.FC = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<any[]>([]);

  const [selectedRequests, setSelectedRequests] = useState<any>(null);
  const [showTopupModal, setShowTopupModal] = useState(false);
  const [hasPayIn, setHasPayIn] = useState(false);
  const [partner, setPartner] = useState<any>(null);
  const [agent, setAgent] = useState<any>(null);
  const [merchant, setMerchant] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: localStorage.getItem('items_per_page') ?? 10,
    total: 0,
    pages: 0,
  });

  // === Fetch top-up requests ===
  const fetchRequests = async (page = 1) => {
    try {
      setLoading(true);
      const params = {
        page: page.toString(),
        limit: pagination.limit.toString(),
        user_id: user.user_id,
      };
      const response = await apiClient.getTopUpRequests(params);
      if (response.success && response.data) {
        setRequests(response.data.topUpRequest || []);
        const p = response.data.pagination;
        setPagination({
          page: p.page,
          limit: p.limit,
          total: p.total,
          pages: p.last_page,
        });
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (user) {
      fetchRequests();
    }
  }, [user]);

  const handleUpdate = async (status: "approved" | "rejected" | "cancelled") => {
    try {
      setLoading(true);
      await apiClient.updateTopUpRequest(selectedRequests?.id, status);
      setSelectedRequests(null);
      setShowModal(false);
      fetchRequests();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };


  const handleEdit = (request: any) => {
    setSelectedRequests(request);
    setShowModal(true);
  };


  const columns = [
    ...(user?.role === "SUPER_ADMIN"
      ? [
        {
          key: "user_name",
          label: "Name",
          render: (_: string, row: any) => (
            <span className="text-sm text-gray-900 dark:text-white">
              {row.user?.name}
            </span>
          ),
        },
      ]
      : []),
    {
      key: "amount",
      label: "Amount",
      render: (value: number, row: any) => (
        <span className="font-mono text-sm text-gray-900 dark:text-white">
          Topup Amount: {parseFloat(value).toFixed(2)}{row.currency}
          <br />
          Fee: {parseFloat(row.total_amount - value).toFixed(2)}{row.currency}
          <br />
          Total Amount: {parseFloat(row.total_amount).toFixed(2)}{row.currency}
          <span></span>
        </span>
      ),
    },
    {
      key: "provider_gateway",
      label: "Provider Gateway",
      render: (_: any, row: any) => (
        <span className="font-mono text-sm text-gray-900 dark:text-white">
          {row.provider?.alias || "N/A"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (value: string) => (
        <span
          className={`px-2 py-1 text-xs font-medium rounded ${value === "pending"
            ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
            : value === "approved"
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
            }`}
        >
          {value.charAt(0).toUpperCase() + value.slice(1)}
        </span>
      ),
    },
    {
      key: "created_at",
      label: "Date",
      render: (value: string) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {new Date(value).toLocaleString()}
        </span>
      ),
    },
  ];

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
      const providerPayIn = providers.find(p => merchant.enabled_providers.includes(p.provider_id) && p.type === 'PAYIN');
      if (providerPayIn) {
        setHasPayIn(true);
      }
    } else if (partner && partner.enabled_providers && partner.enabled_providers.length) {
      const providersPayIn = providers.filter(p =>
        partner.enabled_providers.includes(p.provider_id) && p.type === 'PAYIN'
      );
      if (providersPayIn && providersPayIn.length > 0) {
        setHasPayIn(true);
      }
    } else if (agent && agent.enabled_providers && agent.enabled_providers.length) {
      const providersPayIn = providers.filter(p =>
        agent.enabled_providers.includes(p.provider_id) && p.type === 'PAYIN'
      );
      if (providersPayIn && providersPayIn.length > 0) {
        setHasPayIn(true);
      }
    }
  }, [merchant, partner, agent, providers]);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pay-In</h1>
        </div>
        {hasPayIn && (
          <button
            onClick={() => setShowTopupModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <DollarSign className="h-4 w-4" />
            <span>Pay In</span>
          </button>
        )}
      </div>
      <div className="mt-5 bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading...</span>
          </div>
        ) : (
          <DataTable
            data={requests}
            columns={columns}
            onView={handleEdit}
            pagination={pagination}
            onPageChange={(page) => fetchRequests(page)}
            searchPlaceholder="Search top-up request..."
          />
        )}
        <Modal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          title="Top-up Request Details"
        >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Amount Section */}
          <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Amount Details</h4>
            <div className="space-y-1 text-gray-900 dark:text-white">
              <p className="text-base">
                <span className="text-gray-500 dark:text-gray-400">Amount:</span>{' '}
                <b>{parseFloat(selectedRequests?.amount).toFixed(2)} {selectedRequests?.currency}</b>
              </p>
              <p className="text-base">
                <span className="text-gray-500 dark:text-gray-400">Fee:</span>{' '}
                <b>{parseFloat(selectedRequests?.total_amount - selectedRequests?.amount).toFixed(2)} {selectedRequests?.currency}</b>
              </p>
              <p className="text-base border-t border-gray-200 dark:border-gray-700 pt-2">
                <span className="text-gray-500 dark:text-gray-400">Total:</span>{' '}
                <b>{parseFloat(selectedRequests?.total_amount).toFixed(2)} {selectedRequests?.currency}</b>
              </p>
            </div>
          </div>

          {/* Status Section */}
          <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Status</h4>
            <span
              className={`px-3 py-1.5 text-xs font-semibold rounded-full inline-block
                ${selectedRequests?.status === 'pending'
                  ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  : selectedRequests?.status === 'approved'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                }`}
            >
              {selectedRequests?.status.charAt(0).toUpperCase() + selectedRequests?.status.slice(1)}
            </span>
          </div>

          {/* Currency */}
          <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Currency</h4>
            <p className="text-gray-900 dark:text-white text-base">{selectedRequests?.currency}</p>
          </div>

          {/* Gateway */}
          <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Gateway</h4>
            <p className="text-gray-900 dark:text-white text-base">
              {selectedRequests?.provider?.alias ?? 'N/A'}
            </p>
          </div>
        </div>

        {/* Transaction ID */}
        {selectedRequests?.transaction_id && (
          <div className="bg-gray-50 dark:bg-gray-800 p-5 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex justify-between items-center">
              <span className="text-gray-500 dark:text-gray-400">Transaction ID</span>
              <span className="text-gray-900 dark:text-white font-medium">
                {selectedRequests?.transaction_id}
              </span>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        {selectedRequests?.status === 'pending' && (
          <div className="flex justify-end mt-4 space-x-4">
            {user?.role === 'SUPER_ADMIN' ? (
              <>
                <button
                  type="button"
                  onClick={() => handleUpdate('approved')}
                  disabled={loading}
                  className="px-6 py-2.5 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Approving...' : 'Approve'}
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdate('rejected')}
                  disabled={loading}
                  className="px-6 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'Rejecting...' : 'Reject'}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => handleUpdate('cancelled')}
                disabled={loading}
                className="px-6 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Canceling...' : 'Cancel Request'}
              </button>
            )}
          </div>
        )}
      </div>
        </Modal>
        <PayInModal
          isOpen={showTopupModal}
          onClose={() => setShowTopupModal(false)}
        />
      </div>
    </div>
  );
};

export default PayINPageList;
