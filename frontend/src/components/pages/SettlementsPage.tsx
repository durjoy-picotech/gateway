import React, { useState, useEffect } from 'react';
import { Clock, DollarSign, TrendingUp, AlertTriangle, CheckCircle, TractorIcon, Currency } from 'lucide-react';
import DataTable from '../common/DataTable';
import Modal from '../common/Modal';
import SettlementStatusBadge from '../common/SettlementStatusBadge';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/api';
import { Settlement } from '../types/settlements';
import { calculateSettlementMetrics } from '../../utils/settlements';

// import axios from 'axios';
const SettlementsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('settlements');
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettlementModalEdit, setShowSettlementModalEdit] = useState(false);

  // 1111111111
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    total_amount: '',
    currency: 'USD'
  });
  const [isloading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(3);
  // Time
  const [currentTime, setCurrentTime] = useState(new Date());

  // Pagination states for each tab
  const [settlementsPagination, setSettlementsPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });
  const [settlementFormData, setSettlementFormData] = useState({
    id: '',
    amount: '',
    currency: 'USD',
    status: 'PENDING',
    details: '',
    settlement_date: new Date().toISOString().split('T')[0]
  });


  // Time
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Load data from API
  useEffect(() => {
    loadData();
  }, []);
  const loadData = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {
        partner_id: user.partner_id ?? '',
        merchant_id: user.merchant_id ?? '',
        agent_id: user.agent_id ?? '',
      };
      // Load settlements
      const settlementsResponse = await apiClient.getSettlements(params);
      if (settlementsResponse.success && settlementsResponse.data) {
        setSettlements((settlementsResponse.data as any).settlements || []);
      }

    } catch (error) {
      console.error('Error loading settlement data:', error);
    } finally {
      setLoading(false);
    }
  };
  const tabs = [
    { id: 'settlements', label: 'Settlements', icon: DollarSign },
  ];



  // Settlement Columns
  const settlementColumns = [
    {
      key: 'settlement_reference',
      label: 'Settlement Reference',
      sortable: true,
      render: (value: string, row: Settlement) => (
        <div>
          <div className="font-mono text-sm text-blue-600 dark:text-blue-400">{value}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">{row.settlement_id}</div>
        </div>
      )
    },
    {
      key: 'merchant_id',
      label: 'Users',
      sortable: true,
      render: (_value: string, row: Settlement) => (
        <div>
          {row.users ? (
            <>
              <div className="font-medium">{row.users.name}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{row.users.email}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400"><b>Type</b>: {row.users.type}</div>
            </>
          ) : (
            <span className="text-gray-400 italic">N/A</span>
          )}
        </div>
      ),
    },
    {
      key: 'net_amount',
      label: 'Amount',
      sortable: true,
      render: (value: number, row: Settlement) => (
        <>
          {row.transaction_type === 'PAYIN' ? (
            <span className="font-mono text-sm text-gray-900 dark:text-white">
              TopUp Amount: <b>{(value - row.fee_amount).toFixed(2)} {row.currency}</b>
              <br />
              Fee: <b>{parseFloat(row.fee_amount).toFixed(2)} {row.currency}</b>
              <br />
              Total Amount: <b>{parseFloat(row.total_amount).toFixed(2)} {row.currency}</b>
            </span>
          ) : (
            <span className="font-mono text-sm text-gray-900 dark:text-white">
              Requested Amount: <b>{parseFloat(value).toFixed(2)} {row.currency}</b>
              <br />
              Fee Amount: <b>{parseFloat(row.fee_amount).toFixed(2)} {row.currency}</b>
              <br />
              Payable Amount: <b>{(value - row.fee_amount).toFixed(2)} {row.currency}</b>
            </span>
          )}
        </>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => <SettlementStatusBadge status={value} size='sm' />
    },
    {
      key: 'created_at',
      label: 'Details',
      sortable: true,
      render: (value: number, row: Settlement) => (
        <>
          {row.settlement_type}
          <div>
            {row.transaction_type}
          </div>
          {new Date(value).toLocaleDateString()}
        </>
      )
    }
  ];

  const filteredSettlements = settlements.filter(settlement => {
    if (user?.role === 'MERCHANT') {
      return settlement.merchant_id === user.merchant_id;
    }
    if (user?.role === 'AGENT') {
      // Filter by agent's merchants
      return true; // Simplified for demo
    }
    if (user?.role === 'PARTNER') {
      // Filter by partner's merchants
      return true; // Simplified for demo
    }
    return true; // SUPER_ADMIN sees all
  });

  // 1111111111
  const handleCreateSettlement = async () => {
    setIsLoading(true);
    // Time
    setCountdown(3);

    // Time
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);


    setTimeout(async () => {
      try {
        // const user = JSON.parse(localStorage.getItem('user'));
        const response = await apiClient.createSettlement({
          total_amount: Number(createFormData.total_amount),
          currency: createFormData.currency,
          transaction_type: 'PAYOUT'
          // user_type: user.role,
          // user_id: user.user_id
        });


        if (response.success) {
          console.log('Settlement created:', response.data);
          setShowCreateModal(false);
          loadData();
        }



      } catch (error) {
        console.error('Create Settlement Error:', error);
      } finally {
        setIsLoading(false);
        // Time
        setCountdown(3);
      }
    }, 3000);



  };






  const handleEditSettlement = (item: any) => {
    console.log(item);

    setSettlementFormData({
      id: item.settlement_id,
      amount: item.net_amount,
      currency: item.currency,
      details: item.details,
      status: item.status,
      fee_amount: item.fee_amount,
      settlement_type: item.settlement_type,
      transaction_type: item.transaction_type,
      settlement_date: item.settlement_date
    });
    setShowSettlementModalEdit(true);
  };



  const renderTabContent = () => {
    switch (activeTab) {
      case 'settlements':
        const settlementsStartIndex = (settlementsPagination.page - 1) * settlementsPagination.limit;
        const settlementsEndIndex = settlementsStartIndex + settlementsPagination.limit;
        const settlementsCurrentData = filteredSettlements.slice(settlementsStartIndex, settlementsEndIndex);
        return (
          <DataTable
            data={settlementsCurrentData}
            columns={settlementColumns}
            onView={user?.role == 'SUPER_ADMIN' ? handleEditSettlement : undefined}
            searchPlaceholder="Search settlements..."
            pagination={settlementsPagination}
            onPageChange={(page) => setSettlementsPagination({ ...settlementsPagination, page })}
          />
        );
      default:
        return null;
    }
  };

  const handleSettlementStatusUpdate = async (status: 'COMPLETED' | 'CANCELLED') => {
    try {
      setLoading(true);
      await apiClient.updateSettlementStatus(settlementFormData?.id, status);
      setShowSettlementModalEdit(false);
      loadData();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };


  const metrics = calculateSettlementMetrics(filteredSettlements);
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settlements Management</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage settlement policies, monitor batches, and track performance
          </p>
        </div>
        {/* Time */}
        <div className="text-lg font-mono bg-black text-green-400 px-4 py-2 rounded-lg shadow">
          {currentTime.toLocaleTimeString()}
        </div>
      </div>







      {/* // 1111111111 */}

      {user?.role === 'MERCHANT' && (
        <div className="flex justify-end pt-4">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Create Settlement
          </button>
        </div>
      )}







      {/* Settlement Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {metrics.completed}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Completed</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Clock className="h-8 w-8 text-yellow-500" />
            <div>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {metrics.pending + metrics.processing}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">In Progress</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-8 w-8 text-red-500" />
            <div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {metrics.failed}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Failed</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <TrendingUp className="h-8 w-8 text-blue-500" />
            <div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {metrics.successRate.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Success Rate</div>
            </div>
          </div>
        </div>
      </div>




      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Content */}
      {renderTabContent()}

      <Modal
        isOpen={showSettlementModalEdit}
        onClose={() => setShowSettlementModalEdit(false)}
        title="Settlement Details"
        size="md"
      >
        {settlementFormData && (
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type
                </label>
                <p className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white">
                  {settlementFormData.transaction_type}
                </p>
              </div>

              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Settlement Type
                </label>
                <p className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white">
                  {settlementFormData.settlement_type}
                </p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Settlement AmountAmount
              </label>
              <p className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white">
                {settlementFormData.amount}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Currency
              </label>
              <p className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white">
                {settlementFormData.currency}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Details
              </label>
              <p className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white whitespace-pre-line">
                {settlementFormData.transaction_type === 'PAYIN' ? (
                  <span className="font-mono text-sm text-gray-900 dark:text-white">
                    TopUp Amount: <b>{(settlementFormData.amount - settlementFormData.fee_amount).toFixed(2)} {settlementFormData.currency}</b>
                    <br />
                    Fee: <b>{parseFloat(settlementFormData.fee_amount).toFixed(2)} {settlementFormData.currency}</b>
                    <br />
                    Total Amount: <b>{parseFloat(settlementFormData.amount).toFixed(2)} {settlementFormData.currency}</b>
                  </span>
                ) : (
                  <span className="font-mono text-sm text-gray-900 dark:text-white">
                    Requested Amount: <b>{parseFloat(settlementFormData.amount).toFixed(2)} {settlementFormData.currency}</b>
                    <br />
                    Fee Amount: <b>{parseFloat(settlementFormData.fee_amount).toFixed(2)} {settlementFormData.currency}</b>
                    <br />
                    Payable Amount: <b>{(settlementFormData.amount - settlementFormData.fee_amount).toFixed(2)} {settlementFormData.currency}</b>
                  </span>
                )}
              </p>
            </div>

            {settlementFormData.status === "PENDING" && (
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleSettlementStatusUpdate("CANCELLED")}
                  className="px-4 py-2 border border-transparent text-white rounded-lg bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Processing..." : "Cancelled"}
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleSettlementStatusUpdate("COMPLETED")}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Processing..." : "Completed"}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>


      {/* 1111111111 */}

      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Create Settlement"
        size="md"
      >
        <div className="space-y-4 ">

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium mb-1">
              total_amount
            </label>
            <input
              type="number"
              value={createFormData.total_amount}
              onChange={(e) =>
                setCreateFormData({
                  ...createFormData,
                  total_amount: e.target.value
                })
              }
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Enter total_amount"
            />
          </div>


          {/* Currency */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Currency
            </label>
            <select
              value={createFormData.currency}
              onChange={(e) =>
                setCreateFormData({
                  ...createFormData,
                  currency: e.target.value
                })
              }
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="USD">USD</option>
              <option value="BDT">BDT</option>
              <option value="INR">INR</option>
            </select>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleCreateSettlement}
              disabled={isloading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              {isloading ? `Processing ${countdown}...` : "Submit"}
            </button>
          </div>

        </div>
      </Modal>


    </div>
  );
};

export default SettlementsPage;