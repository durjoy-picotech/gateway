import React, { useState, useEffect } from 'react';
import { Plus, Globe } from 'lucide-react';
import DataTable from '../common/DataTable';
import Modal from '../common/Modal';
import StatusBadge from '../common/StatusBadge';
import { Partner } from '../../data/demoData';
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
const PartnersPage: React.FC = () => {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    adFee: '',
    password: '',
    domain_branding: '',
    default_currency: '',
    enabled_currencies: [],
    enabled_providers: [],
    kyc_policy: true,
    can_create_own_bank: false,
    status: 'ACTIVE' as Partner['status']
  });
  const [providersFees, setProvidersFees] = useState([
  ]);
  // Fetch partners on component mount
  useEffect(() => {
    fetchCurrencies()
    fetchPartners();
    fetchProviders();
  }, []);

  const fetchPartners = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<{ partners: Partner[] }>('/partners');
      if (response.success && response.data) {
        setPartners(response.data.partners);
      } else {
        setError('Failed to fetch partners');
      }
    } catch (err) {
      setError('Failed to fetch partners');
      console.error('Error fetching partners:', err);
    } finally {
      setLoading(false);
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
  const columns = [
    {
      key: 'name',
      label: 'Partner Name',
      sortable: true,
      render: (value: string, row: Partner) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">
              {value.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{value}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
              <Globe className="h-3 w-3 mr-1" />
              {row.email}
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
      label: 'Default Currency',
      sortable: true,
      render: (value: string) => (
        <span className="font-mono text-sm bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
          {value}
        </span>
      )
    },
    {
      key: 'enabled_currencies',
      label: 'Enabled Currencies',
      render: (value: string[]) => (
        <div className="flex flex-wrap gap-1">
          {value.map(currency => (
            <span key={currency} className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
              {currency}
            </span>
          ))}
        </div>
      )
    },
    // {
    //   key: 'kyc_policy',
    //   label: 'KYC Required',
    //   render: (value: boolean) => (
    //     <StatusBadge status={value ? 'ENABLED' : 'DISABLED'} />
    //   )
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
  const options = providers.map(p => ({
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
      domain_branding: '',
      default_currency: '',
      enabled_currencies: [],
      enabled_providers: [],
      kyc_policy: true,
      can_create_own_bank: false,
      status: 'ACTIVE'
    });
    setShowModal(true);
    setProvidersFees([]);
  };


  const handleEdit = (partner: Partner) => {

    setModalMode('edit');
    setSelectedPartner(partner);
    setFormData({
      name: partner.name,
      email: partner.email, // Not shown in edit mode
      adFee: partner.adFee ?? '', // Not shown in edit mode
      password: '', // Not shown in edit mode
      domain_branding: partner.domain_branding,
      default_currency: partner.default_currency,
      enabled_currencies: partner.enabled_currencies,
      enabled_providers: partner.enabled_providers || [],
      kyc_policy: partner.kyc_policy,
      can_create_own_bank: partner.can_create_own_bank,
      status: partner.status
    });
    const matchedProviders = providers.filter(p =>
      (partner?.enabled_providers ?? []).includes(p.provider_id)
    );

    const mergedFees = matchedProviders.map(p => {
      const userFee = partner.userProviderFee?.find(
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

  const handleDelete = async (partner: Partner) => {
    if (confirm('Are you sure you want to delete this partner?')) {
      try {
        const response = await apiClient.delete(`/partners/${partner.partner_id}`);
        if (response.success) {
          setPartners(partners.filter(p => p.partner_id !== partner.partner_id));
        } else {
          alert('Failed to delete partner');
        }
      } catch (err) {
        alert('Failed to delete partner');
        console.error('Error deleting partner:', err);
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
        const response = await apiClient.post<Partner>('/partners', allData);
        if (response.success) {
          await fetchPartners(); // Re-fetch partners after successful creation
        } else {
          alert('Failed to create partner');
          return;
        }
      } else if (selectedPartner) {
        const response = await apiClient.put<Partner>(`/partners/${selectedPartner.partner_id}`, allData);
        if (response.success) {
          await fetchPartners(); // Re-fetch partners after successful update
        } else {
          alert('Failed to update partner');
          return;
        }
      }

      setShowModal(false);
    } catch (err) {
      alert(`Failed to ${modalMode === 'add' ? 'create' : 'update'} partner`);
      console.error(`Error ${modalMode === 'add' ? 'creating' : 'updating'} partner:`, err);
    } finally {
      reset();
    }
  };


  const handleSelectChange = (selected: { value: string; label: string }[] | null) => {
    const selectedIds = selected ? selected.map(s => s.value) : [];
    const matchedProviders = providers.filter(p => selectedIds.includes(p.provider_id));
    setProvidersFees(prevItems => {
      const flatMatched = Array.isArray(matchedProviders)
        ? matchedProviders.flat(Infinity)
        : [];

      const newItems = flatMatched.map(p => ({
        provider_id: p.provider_id,
        provider_name: p.alias,
        fee_percentage: p.fee_percentage ?? p.feePercentage ?? 0,
        fixed_amount: p.fixed_amount ?? p.fixedAmount ?? 0,
      }));

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
    const oldEnabledCurrencies = formData.enabled_currencies;
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
  const reset = () => {
    setProvidersFees([]);
  }
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500 dark:text-gray-400">Loading partners...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500 dark:text-red-400">
          Error: {error}
          <button
            onClick={fetchPartners}
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Partners Management</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage partner organizations and their configurations
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={handleAdd}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Partner</span>
          </button>
        </div>
      </div>

      <DataTable
        data={partners}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchPlaceholder="Search partners..."
      />

      {/* Add/Edit Partner Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => (setShowModal(false), reset())}
        title={modalMode === 'add' ? 'Add New Partner' : 'Edit Partner'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Partner Name
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter partner name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Domain Branding
              </label>
              <input
                type="text"
                required
                value={formData.domain_branding}
                onChange={(e) => setFormData({ ...formData, domain_branding: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="example.com"
              />
            </div>
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
                placeholder="partner@example.com"
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


            {/* 
            {modalMode === 'edit' && (
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Add Fee
                </label>
                <input
                  type="number"
                  value={formData.adFee}
                  onChange={(e) => setFormData({ ...formData, adFee: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter Fee"
                />
              </div>
            )} */}

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

          <div className="grid grid-cols-1 gap-4">
            {/* <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Default Currency
              </label>
              <select
                value={formData.default_currency}
                required
                // onChange={(e) => setFormData({ ...formData, default_currency: e.target.value })}
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
                {currencies.length > 0 && currencies.map(currency => (
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
                onChange={(e) => setFormData({ ...formData, status: e.target.value as Partner['status'] })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
          </div>

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
            <div className="grid grid-cols-6 gap-3">
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
          <div className="flex items-center">
            <input
              type="checkbox"
              id="can_create_own_bank"
              checked={formData.can_create_own_bank}
              onChange={(e) => setFormData({ ...formData, can_create_own_bank: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="can_create_own_bank" className="ml-2 block text-sm text-gray-900 dark:text-white">
              Can Create Own Bank
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
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
              {modalMode === 'add' ? 'Add Partner' : 'Update Partner'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PartnersPage;