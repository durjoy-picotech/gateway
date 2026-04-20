import React, { useState, useEffect } from 'react';
import { Plus, Users } from 'lucide-react';
import { toast } from 'react-toastify';
import DataTable from '../common/DataTable';
import Modal from '../common/Modal';
import StatusBadge from '../common/StatusBadge';
import { useAuth } from '../../contexts/AuthContext';
import { Agent, Partner } from '../../types';
import apiClient from '../../services/api';
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
}
const AgentsPage: React.FC = () => {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  // const [showSettlementModal, setShowSettlementModal] = useState(false);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [partnerProviders, setPartnerProviders] = useState<Provider[]>([]);
  const [partnerCurrencies, setPartnerCurrencies] = useState<Currency[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: localStorage.getItem('items_per_page') ?? 10,
    total: 0,
    pages: 0
  });
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    adFee: '',
    password: '',
    partner_id: '',
    parent_agent_id: '',
    enabled_providers: [],
    status: 'ACTIVE' as Agent['status'],
    allowed_sub_agents: true,
    default_currency: '',
    enabled_currencies: [],
  });
  const [providersFees, setProvidersFees] = useState([
  ]);
  const [agent, setAgent] = useState<any>(null);
  useEffect(() => {
    if (!formData.partner_id) {
      setPartnerCurrencies([]);
      setPartnerProviders([]);
      return
    }; // nothing selected yet

    const partner = partners.find(p => p.partner_id === formData.partner_id);
    if (!partner) {
      setPartnerCurrencies([]);
      setPartnerProviders([]);
      return
    };

    // Filter providers that are enabled for this partner
    const newProviders = providers.filter(p =>
      partner.enabled_providers.includes(p.provider_id)
    );

    if (!newProviders.length) {
      setPartnerProviders([]);
      return
    };

    const newCurrencies = currencies.filter(c =>
      partner.enabled_currencies.includes(c.code)
    );

    if (!newCurrencies.length) {
      setPartnerCurrencies([]);
      return
    };

    setPartnerProviders(newProviders);
    setPartnerCurrencies(newCurrencies);
  }, [formData.partner_id, partners, providers, currencies]);
  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      if (!formData.parent_agent_id) {
        setPartnerCurrencies([]);
        setPartnerProviders([]);
        return
      }; // nothing selected yet

      const agent = agents.find(p => p.agent_id === formData.parent_agent_id);

      if (!agent) {
        setPartnerCurrencies([]);
        setPartnerProviders([]);
        return
      };

      // Filter providers that are enabled for this partner
      const newProviders = providers.filter(p =>
        agent.enabled_providers.includes(p.provider_id)
      );

      if (!newProviders.length) {
        setPartnerProviders([]);
        return
      };

      const newCurrencies = currencies.filter(c =>
        agent.enabled_currencies.includes(c.code)
      );

      if (!newCurrencies.length) {
        setPartnerCurrencies([]);
        return
      };

      setPartnerProviders(newProviders);
      setPartnerCurrencies(newCurrencies);
    }

  }, [formData.parent_agent_id, agents, providers, currencies]);
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
    if (user?.role === 'AGENT') {
      fetchAgent();
    }
  }, [user]);
  useEffect(() => {
    if (user?.role === 'AGENT') {
      if (!agent || !agent.agent_id) {
        setPartnerCurrencies([]);
        setPartnerProviders([]);
        return
      };

      const newProviders = providers.filter(p =>
        agent.enabled_providers.includes(p.provider_id)
      );

      if (!newProviders.length) {
        setPartnerProviders([]);
        return
      };

      const newCurrencies = currencies.filter(c =>
        agent.enabled_currencies.includes(c.code)
      );

      if (!newCurrencies.length) {
        setPartnerCurrencies([]);
        return
      };

      setPartnerProviders(newProviders);
      setPartnerCurrencies(newCurrencies);
    }
  }, [agent, providers, currencies]);
  // Fetch agents and partners on component mount
  useEffect(() => {
    fetchAgents();
    fetchPartners();
    fetchCurrencies();
    fetchProviders();
  }, []);

  const fetchAgents = async (page = 1, isPagination = false) => {
    try {
      if (!isPagination) setLoading(true);
      setError(null);
      const response = await apiClient.get<{ agents: Agent[], pagination: any }>('/agents', {
        params: { page, limit: 10 }
      });
      if (response.success && response.data) {
        setAgents(response.data.agents);
        if (response.data.pagination) {
          setPagination(response.data.pagination);
        }
      } else {
        setError('Failed to fetch agents');
      }
    } catch (err) {
      setError('Failed to fetch agents');
      console.error('Error fetching agents:', err);
    } finally {
      if (!isPagination) setLoading(false);
    }
  };

  const fetchPartners = async () => {
    try {
      const response = await apiClient.get<{ partners: Partner[] }>('/partners');
      if (response.success && response.data) {
        setPartners(response.data.partners);
      }
    } catch (err) {
      console.error('Error fetching partners:', err);
    }
  };
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
  const filteredAgents = agents.filter(agent => {
    if (user?.role === 'PARTNER') {
      return agent.partner_id === user.partner_id;
    }
    return true; // SUPER_ADMIN sees all
  });

  const columns = [
    {
      key: 'name',
      label: 'Agent Name',
      sortable: true,
      render: (value: string, row: Agent) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-lg flex items-center justify-center">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{value}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {row.email}<small className="ml-2 ">(<b>{row.parent_agent_id ? 'Sub-Agent' : 'Primary Agent'}</b>)</small>
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
    // {
    //   key: 'partner_id',
    //   label: 'Partner',
    //   sortable: true,
    //   render: (value: string) => {
    //     const partner = partners.find(p => p.partner_id === value);
    //     return (
    //       <div className="">
    //         {/* <Building className="h-4 w-4 text-gray-400" /> */}
    //         <span>{partner?.name || value}</span>
    //         <br/>
    //         <div>{partner?.email || value}</div>
    //       </div>
    //     );
    //   }
    // },
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
    {
      key: 'allowed_sub_agents',
      label: 'Sub-Agents',
      render: (value: boolean) => (
        <StatusBadge status={value ? 'ALLOWED' : 'NOT_ALLOWED'} />
      )
    },
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
  const options = partnerProviders.map(p => ({
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
      partner_id: user?.partner_id || '',
      parent_agent_id: '',
      status: 'ACTIVE',
      allowed_sub_agents: true,
      default_currency: '',
      enabled_providers: [],
      enabled_currencies: [],
    });
    setShowModal(true);
  };

  const handleEdit = (agent: Agent) => {
    setModalMode('edit');
    setSelectedAgent(agent);
    setFormData({
      name: agent.name,
      email: agent.email, // Not shown in edit mode
      adFee: agent.adFee ?? '',
      password: '', // Not shown in edit mode
      partner_id: agent.partner_id,
      parent_agent_id: agent.parent_agent_id || '',
      status: agent.status,
      allowed_sub_agents: agent.allowed_sub_agents,
      default_currency: agent.default_currency,
      enabled_providers: agent.enabled_providers || [],
      enabled_currencies: agent.enabled_currencies || [],
    });
    const matchedProviders = providers.filter(p =>
      (agent?.enabled_providers ?? []).includes(p.provider_id)
    );


    // const allMatchedFees = matchedProviders.flatMap(provider =>
    //   provider.userProviderFee.filter(fee => fee.partner_id === agent.partner_id)
    // );


    const mergedFees = matchedProviders.map(p => {
      const userFee = agent.userProviderFee?.find(
        uf => uf.provider_id === p.provider_id
      );
      return {
        provider_id: p.provider_id,
        provider_name: p.alias,
        fee_percentage: userFee ? userFee.fee_percentage : p.fee_percentage ?? 0,
        fixed_amount: userFee ? userFee.fixed_amount : p.fixed_amount ?? 0,
        new_fee_percentage: userFee ? userFee.add_fee_percentage : 0,
        new_fixed_amount: userFee ? userFee.add_fixed_amount : 0
      };
    });

    setProvidersFees(mergedFees);
    setShowModal(true);
  };

  const handleDelete = async (agent: Agent) => {
    if (confirm('Are you sure you want to delete this agent?')) {
      try {
        const response = await apiClient.delete(`/agents/${agent.agent_id}`);
        if (response.success) {
          toast.success('Agent deleted successfully!', {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
          });
          // Re-fetch agents to ensure we have the latest data
          await fetchAgents();
        } else {
          alert('Failed to delete agent');
        }
      } catch (err) {
        alert('Failed to delete agent');
        console.error('Error deleting agent:', err);
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
      if (modalMode === 'add') {
        const response = await apiClient.post<Agent>('/agents', {
          ...allData,
          parent_agent_id: formData.parent_agent_id || null
        });
        if (response.success && response.data) {
          await fetchAgents();
        } else {
          return;
        }
      } else if (selectedAgent) {
        const response = await apiClient.put<Agent>(`/agents/${selectedAgent.agent_id}`, {
          ...allData,
          parent_agent_id: formData.parent_agent_id || null
        });
        if (response.success && response.data) {
          await fetchAgents();
        } else {
          return;
        }
      }

      setShowModal(false);
    } catch (err) {
      console.error(`Error ${modalMode === 'add' ? 'creating' : 'updating'} agent:`, err);
    } finally {
      reset();
    }
  };

  const handleSelectChange = (selected: { value: string; label: string }[] | null) => {
    const selectedIds = selected ? selected.map(s => s.value) : [];
    const matchedProviders = providers.filter(p => selectedIds.includes(p.provider_id));

    let allMatchedFees = matchedProviders.flatMap(provider =>
      provider.userProviderFee.filter(fee => fee.partner_id === formData.partner_id)
    );

    if (agent && agent.agent_id) {
      allMatchedFees = matchedProviders.flatMap(provider =>
        provider.userProviderFee.filter(fee => fee.agent_id === agent.agent_id)
      );
    }
    if (formData.parent_agent_id) {
      allMatchedFees = matchedProviders.flatMap(provider =>
        provider.userProviderFee.filter(fee => fee.agent_id === formData.parent_agent_id)
      );
    }
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

  const availablePartners = user?.role === 'SUPER_ADMIN' ? partners :
    partners.filter(p => p.partner_id === user?.partner_id);
  const reset = () => {
    setProvidersFees([]);
  }
  const availableParentAgents = agents.filter(a =>
    a.allowed_sub_agents &&
    a.partner_id === formData.partner_id &&
    a.agent_id !== selectedAgent?.agent_id
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading agents...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500 dark:text-red-400">
          Error: {error}
          <button
            onClick={() => fetchAgents()}
            className="ml-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agents Management</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage agents and sub-agents in your network
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleAdd}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Agent</span>
          </button>
        </div>
      </div>

      <DataTable
        data={filteredAgents}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchPlaceholder="Search agents..."
        pagination={pagination}
        onPageChange={(page) => fetchAgents(page, true)}
      />

      {/* Add/Edit Agent Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => (setShowModal(false), reset())}
        title={modalMode === 'add' ? 'Add New Agent' : 'Edit Agent'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Agent Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter agent name"
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
                placeholder="agent@example.com"
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
                  // readOnly={modalMode === 'edit'}
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

          {user?.role == 'PARTNER' || user?.role == 'SUPER_ADMIN' && (
            <div className={`grid ${modalMode === 'add' ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
              {user?.role == 'SUPER_ADMIN' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Partner
                  </label>
                  <select
                    value={formData.partner_id}
                    onChange={(e) => setFormData({ ...formData, partner_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={user?.role !== 'SUPER_ADMIN' || modalMode === 'edit'}
                  >
                    <option value="">Select Partner</option>
                    {availablePartners.map(partner => (
                      <option key={partner.partner_id} value={partner.partner_id}>
                        {partner.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {modalMode === 'add' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Parent Agent (Optional)
                  </label>
                  <select
                    value={formData.parent_agent_id}
                    onChange={(e) => setFormData({ ...formData, parent_agent_id: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">No Parent (Primary Agent)</option>
                    {availableParentAgents.map(agent => (
                      <option key={agent.agent_id} value={agent.agent_id}>
                        {agent.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4">
            {/* <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Default Currency
              </label>
              <select
                value={formData.default_currency}
                // onChange={(e) => setFormData({ ...formData, default_currency: e.target.value })}
                required
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    default_currency: e.target.value,
                    enabled_currencies: Array.from(
                      new Set([...formData.enabled_currencies, e.target.value])
                    ),
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
              <option value="">Select Default Currency</option>
              {partnerCurrencies.length > 0 && partnerCurrencies.map(currency => (
                <option key={currency.code} value={currency.code}>
                  {currency.code}
                </option>
              ))}
              </select>
            </div> */}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Agent['status'] })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
          </div>
          {partnerProviders.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Enabled Provider
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
              className="mb-5 p-6 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm bg-white dark:bg-gray-900 transition hover:shadow-md"
            >
              <h4 className="text-base font-semibold text-gray-800 dark:text-gray-100 mb-3">
                Fee for {item?.provider_name}
              </h4>
              <div className="grid grid-cols-2 gap-6">
                {/* Fee Percentage Section */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-100 mb-3">
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
                  <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-100 mb-3">
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
              {/* {partnerCurrencies.length > 0 && partnerCurrencies.map(currency => (
                <label key={currency.code} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.enabled_currencies.includes(currency.code)}
                    onChange={(e) => handleCurrencyChange(currency.code, e.target.checked)}
                    disabled={currency.code === formData.default_currency}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{currency.code}</span>
                </label>
              ))} */}
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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {modalMode === 'add' ? 'Add Agent' : 'Update Agent'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default AgentsPage;