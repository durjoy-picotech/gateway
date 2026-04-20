import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Server, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import DataTable from '../common/DataTable';
import { useNavigate } from 'react-router-dom';
import Modal from '../common/Modal';
import { apiClient } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { getGatewayFields } from '../../helpers/providerHelpers';
import ProviderAdjustmentModel from './ProviderAdjustmentModel';
// Debounce utility function
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

interface Provider {
  provider_id: string;
  partner_id?: string;
  name: string;
  alias: string;
  channel_name?: string;
  channel_route?: string;
  settlement?: string;
  supported_variants: string[];
  health_status: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  status: 'active' | 'inactive' | 'down';
  response_time: number;
  success_rate: number;
  fee_percentage?: number;
  fixed_amount?: number;
  currency_id?: number;
  type?: string;
  gateway?: string;
  gateway_info?: Record<string, string>;
  currency?: {
    id: number;
    code: string;
    name: string;
    symbol: string;
  };
  partner?: {
    partner_id: string;
    name: string;
  };
  created_at: string;
}


interface Currency {
  id: number;
  code: string;
  name: string;
  symbol: string;
  type: string;
  precision: number;
  enabled: boolean;
  exchange_rate?: number;
  last_updated?: string;
}

const ProvidersPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [currenciesCrypto, setCurrenciesCrypto] = useState<Currency[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    alias: '',
    channel_name: '',
    channel_route: '',
    settlement: 'T+0',
    supported_variants: [] as string[],
    health_status: 'HEALTHY' as Provider['health_status'],
    status: 'active' as Provider['status'],
    type: '',
    gateway: '',
    fee_percentage: '',
    fixed_amount: '',
    currency_id: '',
    // Gateway-specific fields
    gateway_info: {} as Record<string, string>
  });

  const isPartner = user?.role === 'PARTNER';
  const canCreateProvider = !isPartner || (isPartner && providers.length === 0);

  // Load providers and currencies on component mount
  useEffect(() => {
    loadProviders();
    loadCurrencies();
  }, []);

  const loadCurrencies = async () => {
    try {
      const response = await apiClient.getCurrencies();
      if (response.success && response.data) {
        const data = response.data as any;
        const currenciesData = data.currencies || [];
        setCurrencies(Array.isArray(currenciesData) ? currenciesData : []);
      }
    } catch (error) {
      console.error('Failed to load currencies:', error);
      setCurrencies([]);
    }
  };

  const loadProviders = async (search = '', isSearchOperation = false) => {
    try {
      if (isSearchOperation) {
        setSearchLoading(true);
      } else {
        setLoading(true);
      }

      const params: any = {};
      if (search) {
        params.search = search;
      }
      params.partner_id = user?.partner_id;

      const response = await apiClient.getProviders(params);

      if (response.success && response.data) {
        // API returns data in the format: { providers: [...], pagination: {...} }
        const data = response.data as any;
        const providersData = data.providers || [];
        const normalized = (Array.isArray(providersData) ? providersData : []).map((p: any) => ({
          ...p,
          gateway_info: typeof p?.gateway_info === 'string'
            ? (() => { try { return JSON.parse(p.gateway_info) || {}; } catch { return {}; } })()
            : (p?.gateway_info || {})
        }));
        setProviders(normalized);
      }
    } catch (error) {
      console.error('Failed to load providers:', error);
    } finally {
      if (isSearchOperation) {
        setSearchLoading(false);
      } else {
        setLoading(false);
      }
    }
  };

  // Debounced search function with shorter delay for better responsiveness
  const debouncedSearch = useCallback(
    debounce((searchTerm: string) => {
      loadProviders(searchTerm, true);
    }, 300),
    []
  );

  const handleSearch = (searchTerm: string) => {
    // Clear previous timeout and set loading immediately for better UX
    setSearchLoading(true);
    debouncedSearch(searchTerm);
  };

  const columns = [
    {
      key: 'name',
      label: 'Provider',
      sortable: true,
      render: (value: string, row: Provider) => (
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
            <Server className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{row.alias}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
              {value}
            </div>
          </div>
        </div>
      )
    },
    ...(user?.role === 'SUPER_ADMIN' ? [{
      key: 'partner',
      label: 'Partner',
      render: (_: any, row: Provider) => (
        <div className="text-sm">
          {row.partner ? (
            <span className="text-gray-900 dark:text-white">{row.partner.name}</span>
          ) : (
            <span className="text-gray-500 dark:text-gray-400">System</span>
          )}
        </div>
      )
    }] : []),
    {
      key: 'supported_variants',
      label: 'Supported Methods',
      render: (value: string[]) => (
        <div className="flex flex-wrap gap-1">
          {value.map(variant => (
            <span key={variant} className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
              {variant}
            </span>
          ))}
        </div>
      )
    },
    {
      key: 'status',
      label: 'Status',
      render: (value: string) => {
        const statusConfig = {
          active: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200' },
          inactive: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200' },
          down: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-200' }
        };
        const config = statusConfig[value as keyof typeof statusConfig];
        const Icon = config.icon;

        return (
          <div className={`flex items-center space-x-2 px-2 py-1 rounded-full ${config.bg}`}>
            <Icon className={`h-4 w-4 ${config.color}`} />
            <span className={`text-xs font-medium uppercase ${config.text}`}>{value}</span>
          </div>
        );
      }
    },
    {
      key: 'created_at',
      label: 'Added',
      sortable: true,
      render: (value: string) => new Date(value).toLocaleDateString()
    }
  ];

  const handleView = (provider: Provider) => {
    navigate(`/providers/${provider.provider_id}`);
  };

  const handleAdd = () => {
    setModalMode('add');
    setFormData({
      name: '',
      alias: '',
      channel_name: '',
      channel_route: '',
      settlement: 'T+0',
      supported_variants: [],
      health_status: 'HEALTHY',
      status: 'active',
      type: 'PAYIN',
      gateway: '',
      fee_percentage: '',
      fixed_amount: '',
      currency_id: '',
      gateway_info: {}
    });
    setShowModal(true);
  };

  const handleEdit = (provider: Provider) => {
    setModalMode('edit');
    setSelectedProvider(provider);

    setFormData({
      name: provider.name || '',
      alias: provider.alias,
      channel_name: provider.channel_name || '',
      channel_route: provider.channel_route || '',
      settlement: provider.settlement || 'T+0',
      supported_variants: provider.supported_variants,
      health_status: provider.health_status,
      status: provider.status,
      type: provider.type || 'PAYIN',
      gateway: provider.name || '',
      fee_percentage: provider.fee_percentage?.toString() || '',
      fixed_amount: provider.fixed_amount?.toString() || '',
      currency_id: provider.currency_id?.toString() || '',
      gateway_info: ((): Record<string, string> => {
        const raw = (provider as any)?.gateway_info;
        if (!raw) return {};
        if (typeof raw === 'string') {
          try { return JSON.parse(raw) || {}; } catch { return {}; }
        }
        return raw as Record<string, string>;
      })()
    });
    setShowModal(true);
  };

  const handleDelete = async (provider: Provider) => {
    if (confirm('Are you sure you want to delete this provider?')) {
      try {
        const response = await apiClient.deleteProvider(provider.provider_id);
        if (response.success) {
          await loadProviders(); // Reload providers after deletion
        } else {
          alert('Failed to delete provider');
        }
      } catch (error) {
        alert('Failed to delete provider');
        console.error('Failed to delete provider:', error);
      }
    }
  };

  const handleAdjustment = (provider: Provider) => {
    setModalMode('edit');
    setSelectedProvider(provider);

    setFormData({
      name: provider.name,
      alias: provider.alias,
      channel_name: provider.channel_name || '',
      channel_route: provider.channel_route || '',
      settlement: provider.settlement || 'T+0',
      supported_variants: provider.supported_variants,
      health_status: provider.health_status,
      status: provider.status,
      type: provider.type || 'PAYIN',
      gateway: provider.gateway || '',
      fee_percentage: provider.fee_percentage?.toString() || '',
      fixed_amount: provider.fixed_amount?.toString() || '',
      currency_id: provider.currency_id?.toString() || '',
      gateway_info: ((): Record<string, string> => {
        const raw = (provider as any)?.gateway_info;
        if (!raw) return {};
        if (typeof raw === 'string') {
          try { return JSON.parse(raw) || {}; } catch { return {}; }
        }
        return raw as Record<string, string>;
      })()
    });
    setShowAdjustmentModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const providerData: any = {
        name: formData.name,
        alias: formData.alias,
        supported_variants: formData.supported_variants,
        health_status: formData.health_status,
        channel_name: formData.channel_name,
        channel_route: formData.channel_route,
        settlement: formData.settlement,
        status: formData.status,
        type: formData.type,
        gateway: formData.gateway,
        gateway_info: formData.gateway_info,
        fee_percentage: formData.fee_percentage ? parseFloat(formData.fee_percentage) : undefined,
        fixed_amount: formData.fixed_amount ? parseFloat(formData.fixed_amount) : undefined,
        currency_id: formData.currency_id ? parseInt(formData.currency_id) : undefined
      };

      // Add partner_id for partner users
      if (isPartner && user?.partner_id) {
        providerData.partner_id = user.partner_id;
      }

      if (modalMode === 'add') {
        const response = await apiClient.createProvider(providerData);

        if (response.success) {
          await loadProviders(); // Reload providers after creation
        }
      } else if (selectedProvider) {
        const response = await apiClient.updateProvider(selectedProvider.provider_id, {
          name: formData.name,
          alias: formData.alias,
          supported_variants: formData.supported_variants,
          health_status: formData.health_status,
          channel_name: formData.channel_name,
          channel_route: formData.channel_route,
          settlement: formData.settlement,
          status: formData.status,
          type: formData.type,
          gateway: formData.gateway,
          gateway_info: formData.gateway_info,
          fee_percentage: formData.fee_percentage ? parseFloat(formData.fee_percentage) : undefined,
          fixed_amount: formData.fixed_amount ? parseFloat(formData.fixed_amount) : undefined,
          currency_id: formData.currency_id ? parseInt(formData.currency_id) : undefined
        });

        if (response.success) {
          await loadProviders(); // Reload providers after update
        }
      }

      setShowModal(false);
    } catch (error) {
      console.error('Failed to save provider:', error);
    }
  };

  const handleVariantChange = (variant: string, checked: boolean) => {
    if (checked) {
      setFormData({
        ...formData,
        supported_variants: [...formData.supported_variants, variant]
      });
    } else {
      setFormData({
        ...formData,
        supported_variants: formData.supported_variants.filter(v => v !== variant)
      });
    }
  };

  const handleGatewayConfigChange = (fieldName: string, value: string) => {
    setFormData({
      ...formData,
      gateway_info: {
        ...formData.gateway_info,
        [fieldName]: value
      }
    });
  };

  const handleGatewayChange = (gateway: string) => {
    setFormData({
      ...formData,
      gateway: gateway,
      name: gateway,
      gateway_info: {} // Reset gateway info when gateway changes
    });
  };

  const availableVariants = ['CARD', 'BANK', 'WALLET', 'CRYPTO'];

  useEffect(() => {
    if (formData.gateway == 'PG0005') {
      const filteredCurrencies = currencies.filter(c => c.type == 'crypto');
      setCurrenciesCrypto(filteredCurrencies);
    } else {
      setCurrenciesCrypto([]);
    }
  }, [currencies, formData]);

  const currencyList = formData.gateway !== 'PG0005' ? currencies : currenciesCrypto;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {isPartner ? 'My Bank Provider' : 'Payment Providers'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {isPartner
              ? 'Manage your offline bank provider configuration'
              : 'Manage payment service providers and their configurations'
            }
          </p>
        </div>
        {canCreateProvider && (
          <button
            onClick={handleAdd}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Provider</span>
          </button>
        )}
      </div>

      {/* Health Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {providers.filter(p => p.status === 'active').length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Active Providers</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-8 w-8 text-yellow-500" />
            <div>
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {providers.filter(p => p.status === 'inactive').length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Inactive Providers</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <XCircle className="h-8 w-8 text-red-500" />
            <div>
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {providers.filter(p => p.status === 'down').length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Down Providers</div>
            </div>
          </div>
        </div>
      </div>

      <DataTable
        data={providers}
        columns={columns}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={user?.role === 'SUPER_ADMIN' ? handleView : undefined}
        onAdjustment={handleAdjustment}
        searchPlaceholder="Search providers..."
        onSearch={handleSearch}
        enableAjaxSearch={true}
        loading={searchLoading}
        initialLoading={loading}
        onAddNew={handleAdd}
      />

      {/* Add/Edit Provider Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={modalMode === 'add' ? 'Add New Provider' : 'Edit Provider'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Provider Name
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Stripe"
              />
            </div> */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Gateway
              </label>
              <select
                value={formData.gateway}
                onChange={(e) => handleGatewayChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">--Select Gateway--</option>
                <option value="PG0001">PG0001</option>
                <option value="PG0002">PG0002</option>
                <option value="PG0003">PG0003</option>
                <option value="PG0004">PG0004</option>
                <option value="PG0005">PG0005</option>
                <option value="PG0006">PG0006</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Alias
              </label>
              <input
                type="text"
                required
                value={formData.alias}
                onChange={(e) => setFormData({ ...formData, alias: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., stripe_main"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as Provider['status'] })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="down">Down</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type
            </label>
            <select
              value={formData.type}
              required
              onChange={(e) => setFormData({ ...formData, type: e.target.value })}
              disabled={modalMode === 'edit'}
              className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${modalMode === 'edit'
                  ? 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
            >
              <option value="">Select Type</option>

              {['PG0001', 'PG0005', 'PG0004', 'PG0006'].includes(formData.gateway) && (
                <option value="PAYIN">PayIn</option>
              )}

              {['PG0002', 'PG0003', 'PG0004','PG0006'].includes(formData.gateway) && (
                <option value="PAYOUT">PayOut</option>
              )}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Channel Name
              </label>
              <input
                type="text"
                required
                value={formData.channel_name}
                onChange={(e) => setFormData({ ...formData, channel_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Stripe"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Channel Route
              </label>
              <input
                type="text"
                required
                value={formData.channel_route}
                onChange={(e) => setFormData({ ...formData, channel_route: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., stripe_main"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Settlement
            </label>
            <select
              value={formData.settlement}
              onChange={(e) => setFormData({ ...formData, settlement: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="T+0">T+0 (Today)</option>
              <option value="T+1">T+1 (Next Day)</option>
              <option value="T+2">T+2 (2 Days)</option>
              <option value="T+3">T+3 (3 Days)</option>
            </select>
          </div>
          {/* Gateway-specific configuration fields */}
          {formData.gateway !== 'PG0004' && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {getGatewayFields(formData.gateway).description}
                </h3>
                {/* <p className="text-sm text-gray-600 dark:text-gray-400">
                  Configure the specific settings for {formData.gateway} gateway
                </p> */}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {(getGatewayFields(formData.gateway).fields as any[]).map((field: any) => (
                  <div key={field.name}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      {field.label}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    {field.type === 'select' ? (
                      <select
                        value={formData.gateway_info[field.name] || ''}
                        onChange={(e) => handleGatewayConfigChange(field.name, e.target.value)}
                        required={field.required}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select {field.label}</option>
                        {field.options?.map((option: string) => (
                          <option key={option} value={option}>
                            {option.charAt(0).toUpperCase() + option.slice(1)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={field.type}
                        value={formData.gateway_info[field.name] || ''}
                        onChange={(e) => handleGatewayConfigChange(field.name, e.target.value)}
                        required={field.required}
                        placeholder={field.placeholder}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {formData.gateway == 'PG0004' && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
              <div className="mb-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {getGatewayFields(formData.gateway).description}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Configure the specific settings for {formData.gateway} gateway
                </p>
              </div>
              {(getGatewayFields(formData.gateway).fields as any[]).map((field: any) => (
                <div key={field.name}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {field.label}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  {field.type === 'select' ? (
                    <select
                      value={formData.gateway_info[field.name] || ''}
                      onChange={(e) => handleGatewayConfigChange(field.name, e.target.value)}
                      required={field.required}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select {field.label}</option>
                      {field.options?.map((option: string) => (
                        <option key={option} value={option}>
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={formData.gateway_info[field.name] || ''}
                      onChange={(e) => handleGatewayConfigChange(field.name, e.target.value)}
                      required={field.required}
                      placeholder={field.placeholder}
                      rows={4} // Adjust rows as needed
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <input
                      type={field.type}
                      value={formData.gateway_info[field.name] || ''}
                      onChange={(e) => handleGatewayConfigChange(field.name, e.target.value)}
                      required={field.required}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fee Percentage (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={formData.fee_percentage}
                onChange={(e) => setFormData({ ...formData, fee_percentage: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 2.5"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fixed Amount
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.fixed_amount}
                onChange={(e) => setFormData({ ...formData, fixed_amount: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., 1.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {formData.gateway === 'PG0005' ? 'Receiving Currency' : 'Currency'}
            </label>
            <select
              value={formData.currency_id}
              onChange={(e) => setFormData({ ...formData, currency_id: e.target.value })}
              disabled={modalMode === 'edit'}
              className={`w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${modalMode === 'edit'
                  ? 'bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
            >
              <option value="">Select Currency</option>
              {Array.isArray(currencyList) && currencyList.map(currency => (
                <option key={currency.id} value={currency.id}>
                  {currency.code} - {currency.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Supported Payment Methods
            </label>
            <div className="grid grid-cols-3 gap-3">
              {availableVariants.map(variant => (
                <label key={variant} className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={formData.supported_variants.includes(variant)}
                    onChange={(e) => handleVariantChange(variant, e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">{variant}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {modalMode === 'add' ? 'Add Provider' : 'Update Provider'}
            </button>
          </div>
        </form>
      </Modal>
      <ProviderAdjustmentModel
        isOpen={showAdjustmentModal}
        data={selectedProvider?.providerWallet}
        onUpdated={() => loadProviders()}
        onClose={() => setShowAdjustmentModal(false)}
      />
    </div>
  );
};

export default ProvidersPage;