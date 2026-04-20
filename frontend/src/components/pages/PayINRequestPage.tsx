
import React, { useState, useEffect } from "react";
import { apiClient } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import DataTable from "../common/DataTable";
import Modal from "../common/Modal";

const PayINRequestPage: React.FC = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [partnerRequests, setPartnerRequests] = useState<any[]>([]);

  const [selectedRequests, setSelectedRequests] = useState<any>(null);

  const [showModalPartner, setShowModalPartner] = useState(false);

  const [paginationPartner, setPaginationPartner] = useState({
    page: 1,
    limit: localStorage.getItem('items_per_page') ?? 10,
    total: 0,
    pages: 0,
  });
  const fetchPartnerRequests = async (page = 1) => {
    try {
      setLoading(true);
      const params = {
        page: page.toString(),
        limit: paginationPartner.limit.toString(),
        user_id: user.user_id,
      };
      const response = await apiClient.getPartnerTopUpRequests(params);
      if (response.success && response.data) {
        setPartnerRequests(response.data.topUpRequest || []);
        const p = response.data.pagination;
        setPaginationPartner({
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
        if (user.role === 'PARTNER') {
            fetchPartnerRequests();
        }
    }
  }, [user]);

  const handleEditPartner = (request: any) => {
    setSelectedRequests(request);
    setShowModalPartner(true);
  };

 const handleUpdatePartner = async (status: "approved" | "rejected" | "cancelled") => {
    try {
      setLoading(true);
      await apiClient.updateTopUpRequest(selectedRequests?.id, status);
      setSelectedRequests(null);
      setShowModalPartner(false);
      fetchPartnerRequests();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const columnsPartner = [
    ...(user?.role === 'PARTNER'
      ? [
        {
          key: "user_name",
          label: "Name",
          render: (_: string, row: any) => (
            <>
              <span className="block text-xs text-gray-500 uppercase dark:text-gray-400">
                {row.user?.role}
              </span>
              <span className="block text-sm text-gray-900 dark:text-white">{row.user?.name}</span>
              <span className="block text-sm text-gray-700 dark:text-gray-300">{row.user?.email}</span>
            </>
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
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Pay-In Request</h1>
        </div>
      </div>
      <div className="mt-5 bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading...</span>
          </div>
        ) : (
          <DataTable
            data={partnerRequests}
            columns={columnsPartner}
            onView={user?.role === "PARTNER" ? handleEditPartner : undefined}
            pagination={paginationPartner}
            onPageChange={(page) => fetchPartnerRequests(page)}
            searchPlaceholder="Search top-up request..."
          />
        )}
        <Modal
          isOpen={showModalPartner}
          onClose={() => setShowModalPartner(false)}
          title="Payout Request Details"
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

            {selectedRequests?.transaction_id && (
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">TXN ID</span>
                  <span className="text-gray-900 dark:text-white font-medium">{selectedRequests?.transaction_id}</span>
                </div>
              </div>
            )}

            {selectedRequests?.status === 'pending' && (
              <>
                {user?.role !== 'SUPER_ADMIN' && (
                  <div className="flex justify-end mt-4">
                    <button
                      type="button"
                      onClick={() => handleUpdatePartner('approved')}
                      disabled={loading}
                      className="px-5 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {loading ? "Approving..." : "Approve"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUpdatePartner('rejected')}
                      disabled={loading}
                      className="ml-4 px-5 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                    >
                      {loading ? "Rejecting..." : "Reject"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </Modal>
      </div>
    </div>
  );
};

export default PayINRequestPage;
