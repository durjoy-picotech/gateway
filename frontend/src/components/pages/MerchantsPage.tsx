import React, { useState, useEffect } from 'react';
import { Plus, Store } from 'lucide-react';
import DataTable from '../common/DataTable';
import Modal from '../common/Modal';
import StatusBadge from '../common/StatusBadge';
import { useAuth } from '../../contexts/AuthContext';
import { Merchant, Agent } from '../../types';
import { apiClient } from '../../services/api';
import { Currency } from '../../types/currency';
import Select from 'react-select';
interface Provider {
  provider_id: string;
  name: string;
  alias: string;
  channel_name?: string;
  supported_variants: string[];
  health_status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  response_time: number;
  success_rate: number;
  fee_percentage?: number;
  fixed_amount?: number;
  currency_id?: number;
  currency?: {
    id: number;
    code: string;
    name: string;
    symbol: string;
  };
  created_at: string;
  userProviderFee?: Array<{
    provider_id: string;
    agent_id: string;
    fee_percentage: number;
    fixed_amount: number;
    add_fee_percentage: number;
    add_fixed_amount: number;
  }>;
}

interface ProviderFee {
  provider_id: string;
  fee_percentage: number;
  fixed_amount: number;
  new_fee_percentage: number | string;
  new_fixed_amount: number | string;
}
const MerchantsPage: React.FC = () => {
  const { user } = useAuth();
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [agentProviders, setAgentProviders] = useState<Provider[]>([]);
  const [agentCurrencies, setAgentCurrencies] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    adFee: '',
    password: '',
    agent_id: '',
    status: 'ACTIVE' as Merchant['status'],
    default_currency: '',
    enabled_currencies: [] as string[],
    settlement_terms: 'T+1',
    kyb_status: 'PENDING' as Merchant['kyb_status'],
    enabled_providers: [] as string[],
  });
  const [providersFees, setProvidersFees] = useState<ProviderFee[]>([]);
  const filteredMerchants = merchants.filter(merchant => {
    if (user?.role === 'AGENT') {
      return merchant.agent_id === user.agent_id;
    }
    if (user?.role === 'PARTNER') {
      const agentIds = agents
        .filter(a => a.partner_id === user.partner_id)
        .map(a => a.agent_id);
      return agentIds.includes(merchant.agent_id);
    }
    return true; // SUPER_ADMIN sees all
  });
  useEffect(() => {
    if (!formData.agent_id) {
      setAgentCurrencies([]);
      setAgentProviders([]);
      return
    }; // nothing selected yet

    const agent = agents.find(a => a.agent_id === formData.agent_id);
    if (!agent) {
      setAgentCurrencies([]);
      setAgentProviders([]);
      return
    };


    // Filter providers that are enabled for this partner
    const newProviders = providers.filter(p =>
      (agent as any).enabled_providers?.includes(p.provider_id)
    );


    if (!newProviders.length) {
      setAgentProviders([]);
      return
    };

    if (!(agent as any).enabled_currencies) {
      setAgentCurrencies([]);
      return
    }

    const newCurrencies = currencies.filter(c =>
      (agent as any).enabled_currencies?.includes(c.code)
    );

    if (!newCurrencies.length) {
      setAgentCurrencies([]);
      return
    };
    setAgentProviders(newProviders);
    setAgentCurrencies(newCurrencies);
  }, [formData.agent_id, agents, providers, currencies]);

  useEffect(() => {
    const fetchAgent = async () => {
      if (user && user?.role == 'AGENT' && user.agent_id) {
        try {
          setLoading(true);
          const response = await apiClient.getAgent(user?.agent_id);
          if (response.success && response.data) {
            const agent = response.data as any;
            const newProviders = providers.filter(p =>
              agent.enabled_providers?.includes(p.provider_id)
            );

            if (!newProviders.length) {
              setAgentProviders([]);
              return
            };
            console.log(agent);

            if (!agent.enabled_currencies) {
              setAgentCurrencies([]);
              return
            }

            const newCurrencies = currencies.filter(c =>
              agent.enabled_currencies?.includes(c.code)
            );

            if (!newCurrencies.length) {
              setAgentCurrencies([]);
              return
            };
            console.log('dsadasd');
            console.log(newCurrencies);

            setAgentProviders(newProviders);
            setAgentCurrencies(newCurrencies);
            setFormData({
              ...formData,
              agent_id: agent.agent_id
            });
            // setAgent(response.data);
          }
        } catch (error) { console.error(error); }
        finally { setLoading(false); }
      }
    };
    fetchAgent();
  }, [user, providers, currencies]);

  const baseColumns = [
    {
      key: 'name',
      label: 'Merchant Name',
      sortable: true,
      render: (value: string, row: Merchant) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-lg flex items-center justify-center">
            <Store className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{value}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {(row as any).email}
            </div>
          </div>
        </div>
      )
    },

    {
      key: "adFee",
      label: "Ad Fee",
      render: (value: any, row: any) => (
        <span className="font-mono">
          {Number(value || 0).toFixed(2)} {row.currency}
        </span>
      ),
    },
    {
      key: 'default_currency',
      label: 'Currency',
      sortable: true,
      render: (value: string) => (
        <span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
          {value}
        </span>
      )
    },
    // {
    //   key: 'settlement_terms',
    //   label: 'Settlement',
    //   sortable: true,
    //   render: (value: string) => (
    //     <span className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
    //       {value}
    //     </span>
    //   )
    // },
    // {
    //   key: 'kyb_status',
    //   label: 'KYB Status',
    //   render: (value: string) => <StatusBadge status={value} type="kyb" />
    // },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => <StatusBadge status={value} type="user" />
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (value: string) => new Date(value).toLocaleDateString()
    }
  ];
  const columns = user?.role === 'AGENT'
    ? baseColumns.filter(col => col.key !== 'settlement_terms' && col.key !== 'kyb_status')
    : baseColumns;
  const options = agentProviders.map(p => ({
    value: p.provider_id,
    label: p.alias
  }));
  const handleAdd = () => {
    setModalMode('add');
    setFormData({
      name: '',
      email: '',
      adFee: '',
      password: '',
      agent_id: user?.agent_id || '',
      status: 'ACTIVE',
      default_currency: '',
      enabled_currencies: [],
      settlement_terms: 'T+1',
      kyb_status: 'PENDING',
      enabled_providers: [],
    });
    setShowModal(true);
  };

  const handleEdit = (merchant: Merchant) => {
    setModalMode('edit');
    setSelectedMerchant(merchant);
    setFormData({
      name: merchant.name,
      email: merchant.email, // Not shown in edit mode
      adFee: merchant.adFee, // Not shown in edit mode
      password: '', // Not shown in edit mode
      agent_id: merchant.agent_id,
      status: merchant.status,
      default_currency: merchant.default_currency,
      enabled_currencies: merchant.enabled_currencies,
      settlement_terms: merchant.settlement_terms,
      kyb_status: merchant.kyb_status,
      enabled_providers: (merchant as any).enabled_providers || [],
    });

    const matchedProviders = providers.filter(p =>
      ((merchant as any)?.enabled_providers ?? []).includes(p.provider_id)
    );

    const mergedFees = matchedProviders.map(p => {
      const userFee = (merchant as any).userProviderFee?.find(
        (uf: any) => uf.provider_id === p.provider_id
      );
      return {
        provider_id: p.provider_id,
        fee_percentage: userFee ? userFee.fee_percentage : p.fee_percentage ?? 0,
        fixed_amount: userFee ? userFee.fixed_amount : p.fixed_amount ?? 0,
        new_fee_percentage: userFee ? userFee.add_fee_percentage : 0,
        new_fixed_amount: userFee ? userFee.add_fixed_amount : 0
      };
    });

    setProvidersFees(mergedFees);
    setShowModal(true);
  };

  const handleDelete = async (merchant: Merchant) => {
    if (confirm('Are you sure you want to delete this merchant?')) {
      try {
        const response = await apiClient.deleteMerchant(merchant.merchant_id);
        if (response.success) {
          await fetchMerchants(); // Refetch merchants after successful deletion
        } else {
          alert('Failed to delete merchant');
        }
      } catch (error) {
        alert('Failed to delete merchant');
        console.error('Failed to delete merchant:', error);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const allData = {
      ...formData,
      providersFees,
    };

    try {
      setSubmitting(true);

      if (modalMode === 'add') {
        const response = await apiClient.createMerchant(allData);
        if (response.success) {
          await fetchMerchants(); // Refetch merchants after successful creation
        }
      } else if (selectedMerchant) {
        const response = await apiClient.updateMerchant(selectedMerchant.merchant_id, allData);
        if (response.success) {
          await fetchMerchants(); // Refetch merchants after successful update
        }
      }

      setShowModal(false);
    } catch (error) {
      console.error('Failed to save merchant:', error);
    } finally {
      setSubmitting(false);
      reset();
    }
  };

  const handleSelectChange = (selected: readonly { value: string; label: string }[] | null) => {

    const selectedIds = selected ? selected.map(s => s.value) : [];
    const matchedProviders = providers.filter(p => selectedIds.includes(p.provider_id));

    const allMatchedFees = matchedProviders.flatMap(provider =>
      provider.userProviderFee.filter(fee => fee.agent_id === formData.agent_id)
    );

    setProvidersFees(prevItems => {
      const flatMatched = Array.isArray(allMatchedFees)
        ? allMatchedFees.flat(Infinity)
        : [];


      const newItems = flatMatched.map((fee) => {
        const matchedProvider = matchedProviders.find(
          p => p.provider_id === fee.provider_id
        );
        return {
          id: `${fee.provider_id}`, // Unique key
          provider_id: fee.provider_id,
          provider_name: matchedProvider?.alias ?? matchedProvider?.name ?? "Unknown",
          fee_percentage: fee.new_fee_percentage ?? fee.new_fee_percentage ?? 0,
          fixed_amount: fee.new_fixed_amount ?? fee.new_fixed_amount ?? 0,
        };
      });

      const filteredPrevItems = (prevItems || []).filter(i =>
        selectedIds.includes(i.provider_id)
      );

      const existingIds = new Set(filteredPrevItems.map(i => i.provider_id));

      const itemsToAdd = newItems.filter(n => !existingIds.has(n.provider_id));

      return [...filteredPrevItems, ...itemsToAdd];
    });
    const providerCurrencyIds = matchedProviders.map(p => p.currency_id);

    const newCurrencies = currencies.filter(c =>
      providerCurrencyIds.includes(c.id)
    );
    const newCurrencyCodes = newCurrencies.map(c => c.code);
    // setFormData(prev => ({
    //   ...prev,
    //   enabled_providers: selectedIds,
    //   enabled_currencies: Array.from(
    //     new Set([
    //       ...(prev.enabled_currencies || []),
    //       ...newCurrencyCodes
    //     ])
    //   )
    // }));
    setFormData(prev => {
      const updatedCurrencies = (prev.enabled_currencies || []).filter(c =>
        newCurrencyCodes.includes(c)
      );

      const finalCurrencies = Array.from(new Set([...updatedCurrencies, ...newCurrencyCodes]));

      return {
        ...prev,
        enabled_providers: selectedIds,
        enabled_currencies: finalCurrencies
      };
    });
  };


  const availableAgents = user?.role === 'SUPER_ADMIN' ? agents :
    user?.role === 'PARTNER' ? agents.filter(a => a.partner_id === user.partner_id) :
      agents.filter(a => a.parent_agent_id === user?.agent_id);
  const reset = () => {
    setProvidersFees([]);
  }
  // Function to fetch merchants
  const fetchMerchants = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getMerchants();
      if (response.success && response.data) {
        setMerchants((response.data as any).merchants || []);
      }
    } catch (error) {
      console.error('Failed to fetch merchants:', error);
    } finally {
      setLoading(false);
    }
  };
  const fetchProviders = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getProviders({ limit: 50 });

      if (response.success && response.data) {
        const data = response.data as any;
        const providersData = data.providers || [];
        setProviders(Array.isArray(providersData) ? providersData : []);
      }
    } catch (error) {
      console.error('Failed to fetch Providers', error);
    } finally {
      setLoading(false);
    }
  };
  // Fetch merchants on component mount
  useEffect(() => {
    fetchMerchants();
    fetchCurrencies();
    fetchProviders();
  }, []);

  // Fetch agents on component mount
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        const response = await apiClient.getAgents();
        if (response.success && response.data) {
          setAgents((response.data as any).agents || []);
        }
      } catch (error) {
        console.error('Failed to fetch agents:', error);
      }
    };

    fetchAgents();
  }, []);

  const fetchCurrencies = async () => {
    setLoading(true);
    try {
      const response = await apiClient.getCurrencies({ limit: 50 });

      if (response.success && response.data && (response.data as any).currencies) {
        const currenciesData = (response.data as any).currencies;
        if (Array.isArray(currenciesData)) {
          const transformedCurrencies: Currency[] = currenciesData.map((currency: any) => ({
            id: currency.id,
            currency_id: currency.code,
            code: currency.code,
            name: currency.name,
            symbol: currency.symbol,
            type: currency.type,
            precision: currency.precision,
            enabled: currency.enabled,
            created_at: currency.last_updated || new Date().toISOString()
          }));
          setCurrencies(transformedCurrencies);
        }
      }
    } catch (error) {
      console.error('Failed to fetch currencies', error);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Merchants Management</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage merchant accounts and their configurations
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleAdd}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Merchant</span>
          </button>
        </div>
      </div>

      {/* KYB Status Summary */}
      {user?.role !== 'AGENT' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <Store className="h-8 w-8 text-blue-500" />
              <div>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {filteredMerchants.filter(m => m.status === 'ACTIVE').length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Active Merchants</div>
              </div>
            </div>
          </div>
        </div>
      )}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading merchants...</span>
        </div>
      ) : (
        <DataTable
          data={filteredMerchants}
          columns={columns}
          onEdit={handleEdit}
          onDelete={handleDelete}
          searchPlaceholder="Search merchants..."
        />
      )}

      {/* Add/Edit Merchant Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => (setShowModal(false), reset())}
        title={modalMode === 'add' ? 'Add New Merchant' : 'Edit Merchant'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Merchant Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter merchant name"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Email
              </label>
              <input
                type="email"
                required={modalMode === 'add'}
                readOnly={modalMode === 'edit'}
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${modalMode === 'edit' ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''
                  }`}
                placeholder="merchant@example.com"
              />
            </div>

            {modalMode === 'edit' && (
              <div>
                <label className=" text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Add Fee
                </label>
                <input
                  type="number"
                  // required={modalMode === 'add'}
                  // disabled={modalMode === 'edit'}
                  value={formData.adFee}
                  onChange={(e) => setFormData({ ...formData, adFee: e.target.value })}
                  className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${modalMode === 'edit' ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''
                    }`}
                  placeholder="Enter Fee"
                />
              </div>
            )}




            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Password
              </label>
              <input
                type="password"
                required={modalMode === 'add'}
                disabled={modalMode === 'edit'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${modalMode === 'edit' ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''
                  }`}
                placeholder={modalMode === 'add' ? 'Enter password' : 'Password hidden'}
                minLength={8}
              />
            </div>
          </div>

          {(user?.role === 'SUPER_ADMIN' || user?.role === 'PARTNER') && (
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Agent
                </label>
                <select
                  value={formData.agent_id}
                  onChange={(e) => setFormData({ ...formData, agent_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={!['SUPER_ADMIN', 'PARTNER'].includes(user?.role || '') || modalMode === 'edit'}
                >
                  <option value="">Select Agent</option>
                  {availableAgents.map(agent => (
                    <option key={agent.agent_id} value={agent.agent_id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Merchant['status'] })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
          </div>

          {agentProviders.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Enabled Providers
              </label>
              <Select
                isMulti
                options={options}
                value={options.filter(opt => formData.enabled_providers.includes(opt.value))}
                onChange={handleSelectChange}
              />
            </div>
          )}
          {providersFees.length > 0 && providersFees.map((item, index) => (
            <div
              key={item.provider_id}
              className=" mb-5 p-6 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm bg-white dark:bg-gray-900 transition hover:shadow-md"
            >
              <h4 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3">
                Fee for {providers.find(p => p.provider_id === item.provider_id)?.alias || 'Unknown Provider'}
              </h4>
              <div className="grid grid-cols-2 gap-6">
                {/* Fee Percentage Section */}
                <div>
                  <h4 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3">
                    Fee Percentage
                  </h4>
                  <div className="flex gap-3 items-center">

                    <input
                      type="text"
                      value={item.fee_percentage}
                      readOnly
                      className="w-1/2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 p-2 text-sm focus:ring-0 focus:outline-none cursor-not-allowed"
                    />

                    <input
                      type="number"
                      value={item.new_fee_percentage || ''}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setProvidersFees(prev =>
                          prev.map((p, i) =>
                            i === index ? { ...p, new_fee_percentage: newValue } : p
                          )
                        );
                      }}
                      placeholder="Enter New Fee Percentage"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Fixed Amount Section */}
                <div>
                  <h4 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3">
                    Fixed Amount
                  </h4>
                  <div className="flex gap-3 items-center">

                    <input
                      type="text"
                      value={item.fixed_amount}
                      readOnly
                      className="w-1/2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 p-2 text-sm focus:ring-0 focus:outline-none cursor-not-allowed"
                    />

                    <input
                      type="number"
                      value={item.new_fixed_amount || ''}
                      onChange={(e) => {
                        const newValue = e.target.value;
                        setProvidersFees(prev => prev.map((p, i) =>
                          i === index ? { ...p, new_fixed_amount: newValue } : p
                        ));
                      }}
                      placeholder="Enter New Fixed Fee"
                      className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Enabled Currencies
            </label>
            <div className="grid grid-cols-4 gap-3">
              {formData.enabled_currencies.length > 0 ? (
                formData.enabled_currencies.map(currency => (
                  <span
                    key={currency}
                    className="
                      flex items-center justify-center
                      px-2 py-1
                      rounded-full
                      bg-blue-50 text-blue-700
                      dark:bg-blue-900/40 dark:text-blue-300
                      border border-blue-200 dark:border-blue-700
                      text-sm font-medium
                      shadow-sm hover:shadow-md
                      transition-all duration-200
                      cursor-default select-none
                    "
                  >
                    {currency}
                  </span>
                ))
              ) : (
                <p className="col-span-full text-sm text-gray-500 dark:text-gray-400 italic">
                  No currencies enabled yet
                </p>
              )}
            </div>
          </div>
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => (setShowModal(false), reset())}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              {submitting && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              )}
              {modalMode === 'add' ? 'Add Merchant' : 'Update Merchant'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default MerchantsPage;






