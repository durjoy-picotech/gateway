
import React, { useState, useEffect } from "react";
import { apiClient } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import DataTable from "../common/DataTable";
import Modal from "../common/Modal";
import { DollarSign } from 'lucide-react';
import PayoutModal from "./PayoutPage";
const PayOutPageList: React.FC = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [requestPayouts, setRequestPayouts] = useState<any[]>([]);

  const [selectedRequest, setSelectedRequest] = useState<any>(null);

  const [showModalPayout, setShowModalPayout] = useState(false);
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [hasPayout, setHasPayout] = useState(false);
  const [partner, setPartner] = useState<any>(null);
  const [agent, setAgent] = useState<any>(null);
  const [merchant, setMerchant] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);

  const [paginationPayout, setPaginationPayout] = useState({
    page: 1,
    limit: localStorage.getItem('items_per_page') ?? 10,
    total: 0,
    pages: 0,
  });

  const fetchRequestPayouts = async (page = 1) => {
    try {
      setLoading(true);
      const params = {
        page: page.toString(),
        limit: paginationPayout.limit.toString(),
        user_id: user.user_id,
      };
      const response = await apiClient.getPayoutRequests(params);
      if (response.success && response.data) {
        setRequestPayouts(response.data.payouts || []);
        const p = response.data.pagination;
        setPaginationPayout({
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
      fetchRequestPayouts();
    }
  }, [user]);

  // === Actions ===
  const handleUpdatePayout = async (status: "approved" | "rejected") => {
    try {
      setLoading(true);
      await apiClient.updatePayoutRequest(selectedRequest?.id, status);
      setSelectedRequest(null);
      setShowModalPayout(false);
      fetchRequestPayouts();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditPayout = (request: any) => {
    setSelectedRequest(request);
    setShowModalPayout(true);
  };

  const columnsPayout = [
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
          Requested Amount: <b>{row.currency} {parseFloat(value).toFixed(2)}</b>
          <br />
          Fee Amount: <b>{row.currency} {row.fee_amount}</b>
          <br />
          Payable Amount: <b>{row.currency} {parseFloat(value - row.fee_amount).toFixed(2)}</b>
        </span>
      ),
    },
    {
      key: "gateway",
      label: "Gateway",
      render: (value: number, row: any) => (
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
      const providerPayout = providers.find(p => merchant.enabled_providers.includes(p.provider_id) && p.type === 'PAYOUT');
      if (providerPayout) {
        setHasPayout(true);
      }
    } else if (partner && partner.enabled_providers && partner.enabled_providers.length) {
      const providersPayout = providers.filter(p =>
        partner.enabled_providers.includes(p.provider_id) && p.type === 'PAYOUT'
      );
      if (providersPayout && providersPayout.length > 0) {
        setHasPayout(true);
      }
    } else if (agent && agent.enabled_providers && agent.enabled_providers.length) {
      const providersPayout = providers.filter(p =>
        agent.enabled_providers.includes(p.provider_id) && p.type === 'PAYOUT'
      );
      if (providersPayout && providersPayout.length > 0) {
        setHasPayout(true);
      }
    }
  }, [merchant, partner, agent, providers]);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pay Out</h1>
        </div>
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
      <div className="mt-5 bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading...</span>
          </div>
        ) : (
          <DataTable
            data={requestPayouts}
            columns={columnsPayout}
            onView={user?.role === "SUPER_ADMIN" ? handleEditPayout : undefined}
            pagination={paginationPayout}
            onPageChange={(page) => fetchRequestPayouts(page)}
            searchPlaceholder="Search payout request..."
          />
        )}

        <Modal
          isOpen={showModalPayout}
          onClose={() => setShowModalPayout(false)}
          title="Payout Request Details"
        >
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm text-gray-600">Amount</h4>

                  <div>
                    <span className="text-sm text-gray-500 mr-2">Requested Amount:</span> <span className="text-dark-600 dark:text-gray-300">{selectedRequest.currency} {parseFloat(selectedRequest.amount).toFixed(2)}</span>
                    <br />
                    <span className="text-sm text-gray-500 mr-2">Fee Amount:</span> <span className="text-dark-600 dark:text-gray-300">{selectedRequest.currency} {parseFloat(selectedRequest.fee_amount).toFixed(2)}</span>
                    <br />
                    <span className="text-sm text-gray-500 mr-2">Payable Amount:</span> <span className="text-dark-600 dark:text-gray-300">{selectedRequest.currency} {parseFloat(selectedRequest.amount - selectedRequest.fee_amount).toFixed(2)}</span>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm text-gray-500">Status</h4>
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${selectedRequest.status === "pending"
                      ? "bg-yellow-100 text-yellow-800"
                      : selectedRequest.status === "approved"
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                      }`}
                  >
                    {selectedRequest.status.charAt(0).toUpperCase() +
                      selectedRequest.status.slice(1)}
                  </span>
                </div>
              </div>

              {selectedRequest.others && (
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <h4 className="text-sm text-gray-500 mb-2">Additional Details</h4>
                  {(() => {
                    try {
                      const othersData = JSON.parse(selectedRequest.others);
                      return (
                        <div className="space-y-2">
                          {Object.entries(othersData).map(([key, value]) => (
                            <div key={key} className="flex justify-between">
                              <span className="text-gray-500">{key}</span>
                              <span className="text-dark-500 dark:text-gray-300 font-medium ">
                                {String(value)}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    } catch {
                      return (
                        <p className="text-sm italic text-gray-500">
                          Invalid data format
                        </p>
                      );
                    }
                  })()}
                </div>
              )}

              {selectedRequest.status === "pending" && (
                <div className="flex justify-end space-x-3 mt-4">
                  <button
                    onClick={() => handleUpdatePayout("approved")}
                    disabled={loading}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleUpdatePayout("rejected")}
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          )}
        </Modal>
        <PayoutModal
          isOpen={showPayoutModal}
          onClose={() => setShowPayoutModal(false)}
          onSubmit={() => fetchRequestPayouts()}
        />
      </div>
    </div>
  );
};

export default PayOutPageList;
