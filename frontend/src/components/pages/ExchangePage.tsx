
import React, { useState, useEffect } from "react";
import { apiClient } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import DataTable from "../common/DataTable";
import { ArrowRightLeft } from 'lucide-react';
import ExchangeModal from "./ExchangeModal";
const ExchangePage: React.FC = () => {
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [exchange, setExchange] = useState<any[]>([]);
  const [showExchangeModal, setShowExchangeModal] = useState(false);
  const [wallets, setWallets] = useState([]);

  const [paginationPayout, setPaginationPayout] = useState({
    page: 1,
    limit: localStorage.getItem('items_per_page') ?? 10,
    total: 0,
    pages: 0,
  });
  // === Fetch payout requests ===
  const fetchExchange = async (page = 1) => {
    try {
      setLoading(true);
      const params = {
        page: page.toString(),
        limit: paginationPayout.limit.toString(),
        user_id: user.user_id,
      };
      const response = await apiClient.getExchanges(params);

      if (response.success && response.data) {
        setExchange(response.data.transactions || []);
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
      fetchExchange();
    }
  }, [user]);

  const columns = [
    ...(user?.role === "SUPER_ADMIN"
      ? [
        {
          key: "user",
          label: "User",
          render: (_: string, row: any) => (
            <span className="text-sm text-gray-900 dark:text-white">
              {row.user || "N/A"}
            </span>
          ),
        },
      ]
      : []),

    {
      key: "transaction_id",
      label: "Transaction ID",
      render: (value: string) => (
        <span className="text-sm text-gray-900 dark:text-white font-mono">
          {value}
        </span>
      ),
    },
    {
      key: "from_amount",
      label: "Amount Details",
      render: (_: number, row: any) => (
        <span className="font-mono text-sm text-gray-900 dark:text-white">
          From: <b>{row.from_currency} {parseFloat(row.from_amount).toFixed(2)}</b>
          <br />
          To: <b>{row.to_currency} {parseFloat(row.to_amount).toFixed(2)}</b>
          <br />
          Fee: <b>{row.from_currency} {parseFloat(row.fee).toFixed(2)}</b>
        </span>
      ),
    },
    {
      key: "exchange_rate",
      label: "Rate Details",
      render: (_: any, row: any) => (
        <span className="text-sm text-gray-900 dark:text-white">
          Exchange Rate: <b>{row.exchange_rate}</b>
          <br />
          Markup Rate: <b>{row.markup_rate}</b>
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (value: string) => (
        <span
          className={`px-2 py-1 text-xs font-medium rounded ${value === "PENDING"
              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
              : value === "COMPLETED"
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
      label: "Created",
      render: (value: string) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {new Date(value).toLocaleString()}
        </span>
      ),
    },
    {
      key: "notes",
      label: "Notes",
      render: (value: string | null) => (
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {value || "-"}
        </span>
      ),
    },
  ];
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
        const data = response.data;
        setWallets(data.wallets);
      }
    } catch (error) {
      console.error('Error fetching wallets:', error);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Exchanges</h1>
        </div>
        {wallets.length >= 2 && user?.role !== 'SUPER_ADMIN' && (
          <button
            onClick={() => setShowExchangeModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <ArrowRightLeft className="h-4 w-4" />
            <span>Exchange</span>
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
            data={exchange}
            columns={columns}
            pagination={paginationPayout}
            onPageChange={(page) => fetchExchange(page)}
            searchPlaceholder="Search Exchanges..."
          />
        )}
      </div>
      <ExchangeModal
        isOpen={showExchangeModal}
        onClose={() => setShowExchangeModal(false)}
        onSubmit={() => fetchExchange()}
      />
    </div>
  );
};

export default ExchangePage;







