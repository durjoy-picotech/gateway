import React, { useState, useEffect } from 'react';
import { Plus, Coins, TrendingUp, RefreshCw } from 'lucide-react';
import DataTable from '../common/DataTable';
import Modal from '../common/Modal';
import StatusBadge from '../common/StatusBadge';
import MoneyDisplay from '../common/MoneyDisplay';
import { useAuth } from '../../contexts/AuthContext';
import { Currency, FxSnapshot } from '../../types/currency';
import apiClient from '../../services/api';

const CurrencyManagementPage: React.FC = () => {
  const { user } = useAuth();

  // Don't render anything if not authenticated
  if (!user) {
    return null;
  }

  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [fxSnapshots, setFxSnapshots] = useState<FxSnapshot[]>([]);
  const [activeTab, setActiveTab] = useState('currencies');
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [pagination, setPagination] = useState({
    page: 1,
    limit: localStorage.getItem('items_per_page') ?? 10,
    total: 0,
    pages: 0
  });
  const [filters, setFilters] = useState({
    type: '',
    enabled: '',
    search: ''
  });

  // Fetch data from API
  useEffect(() => {
    fetchCurrencies();
    fetchFxRates();
  }, [filters]);

  const fetchCurrencies = async (page = 1, isPagination = false) => {
    try {
      if (!isPagination) setLoading(true);

      // Build query parameters from filters
      const params: Record<string, string> = {
        page: page.toString(),
        limit: pagination.limit.toString()
      };

      if (filters.type) params.type = filters.type;
      if (filters.enabled) params.enabled = filters.enabled;
      if (filters.search) params.search = filters.search;

      const response = await apiClient.getCurrencies(params);
      if (response.success && response.data && (response.data as any).currencies) {
        const currenciesData = (response.data as any).currencies;
        if (Array.isArray(currenciesData)) {
          const transformedCurrencies: Currency[] = currenciesData.map((currency: any) => ({
            currency_id: currency.code,
            code: currency.code,
            name: currency.name,
            symbol: currency.symbol,
            type: currency.type,
            precision: currency.precision,
            enabled: currency.enabled,
            exchange_rate: currency.exchange_rate,
            created_at: currency.last_updated || new Date().toISOString()
          }));
          setCurrencies(transformedCurrencies);
          setPagination((response.data as any).pagination || pagination);
        }
      }
    } catch (error) {
      console.error('Error fetching currencies:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFxRates = async (page = 1, isPagination = false) => {
    try {
      if (!isPagination) setLoading(true);

      const params: Record<string, string> = {
        page: page.toString(),
        limit: pagination.limit.toString()
      };

  

      const fxResponse = await apiClient.getFxRates(params);
      if (fxResponse.success && fxResponse.data && (fxResponse.data as any).fx_rates) {
        const fxRatesData = (fxResponse.data as any).fx_rates;
        const paginationData = (fxResponse.data as any).pagination;

        setFxSnapshots(fxRatesData);
        setPagination(paginationData);
      }
    } catch (error) {
      console.error('Error fetching FX rates:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'currencies', label: 'Currency', icon: Coins },
    { id: 'fx', label: 'FX Rates', icon: TrendingUp },
  ];

  // Currency Columns
  const currencyColumns = [
    {
      key: 'code',
      label: 'Currency',
      sortable: true,
      render: (value: string, row: Currency) => (
        <div className="flex items-center space-x-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${row.type === 'fiat' ? 'bg-blue-500' : 'bg-orange-500'
            }`}>
            {row.symbol}
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-white">{value}</div>
            <div className="text-sm text-gray-500 dark:text-gray-400">{row.name}</div>
          </div>
        </div>
      )
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      render: (value: string) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${value === 'fiat'
          ? 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
          : 'bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200'
          }`}>
          {value.toUpperCase()}
        </span>
      )
    },
    {
      key: 'precision',
      label: 'Precision',
      sortable: true,
      render: (value: number) => (
        <span className="font-mono text-sm">{value} decimals</span>
      )
    },
    {
      key: 'enabled',
      label: 'Status',
      render: (value: boolean) => <StatusBadge status={value ? 'ENABLED' : 'DISABLED'} />
    },
    {
      key: 'created_at',
      label: 'Created',
      sortable: true,
      render: (value: string) => new Date(value).toLocaleDateString()
    }
  ];


  // FX Columns
  const fxColumns = [
    {
      key: 'from_currency',
      label: 'Currency Pair',
      render: (value: string, row: FxSnapshot) => (
        <span className="font-mono font-medium">
          {value}/{row.to_currency}
        </span>
      )
    },
    {
      key: 'final_rate',
      label: 'Rate',
      sortable: true,
      render: (value: number, row: FxSnapshot) => (
        <MoneyDisplay
          amount={value}
          currency={row.to_currency}
          precision={6}
          showSymbol={false}
        />
      )
    },
    {
      key: 'markup_bps',
      label: 'Markup',
      sortable: true,
      render: (value: number) => (
        <span className="text-sm">{value} %</span>
      )
    },
    {
      key: 'created_at',
      label: 'Updated',
      sortable: true,
      render: (value: string) => new Date(value).toLocaleString()
    }
  ];

  const handleAdd = (type: string) => {
    setModalMode('add');
    setSelectedItem(null);
    // Initialize form data based on tab
    if (type === 'currencies') {
      setFormData({
        code: '',
        name: '',
        symbol: '',
        type: 'fiat',
        precision: 2,
        exchange_rate: ''
      });
    }
    setShowModal(true);
  };

  const handleEdit = (item: any) => {
    setModalMode('edit');
    setSelectedItem(item);
    // Initialize form data with existing item data
    if (activeTab === 'currencies') {
      setFormData({
        code: item.code || '',
        name: item.name || '',
        symbol: item.symbol || '',
        type: item.type || 'fiat',
        precision: item.precision || 2,
        exchange_rate: item.exchange_rate || ''
      });
    } else if (activeTab === 'fx') {
      setFormData({
        final_rate: item.final_rate || 0,
        markup_bps: item.markup_bps || 0,
        exchange_rate: item.raw_rate || 0
      });
    }
    setShowModal(true);
  };

  const handleDelete = async (item: any) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      if (activeTab === 'currencies') {
        const response = await apiClient.deleteCurrency(item.code);
        if (response.success) {
          // Refresh currencies data
          await handleSearch('', 'currencies');
        }
      }
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (activeTab === 'currencies') {
        if (modalMode === 'add') {
          const response = await apiClient.createCurrency(formData);
          if (response.success) {
            // Refresh currencies data
            await handleSearch('', 'currencies');
          }
        } else if (modalMode === 'edit' && selectedItem) {
          const response = await apiClient.updateCurrency(selectedItem.code, formData);
          if (response.success) {
            // Refresh currencies data
            await handleSearch('', 'currencies');
          }
        }
      } else if (activeTab === 'fx') {
        if (modalMode === 'edit' && selectedItem) {
          const response = await apiClient.updateFxRate({
            bps: formData.markup_bps,
            from_currency: selectedItem.from_currency,
            to_currency: selectedItem.to_currency
          });
          if (response.success) {
            // Refresh FX rates data
            await fetchFxRates();
          }
        }
      }

      handleModalClose();
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleFormChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleModalClose = () => {
    setShowModal(false);
    setFormData({});
    setSubmitting(false);
  };

  const handleSyncFxRates = async () => {
    try {
      await fetchFxRates();
    } catch (error) {
      console.error('Error syncing FX rates:', error);
    }
  };

  const handleFetchExchangeRate = async (currencyCode: string) => {
    if (!currencyCode || currencyCode.length !== 3) return;

    try {
      const response = await apiClient.fetchExchangeRate(currencyCode.toUpperCase());
      if (response.success && response.data) {
        const rate = (response.data as any).exchange_rate;
        handleFormChange('exchange_rate', rate);
      }
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
    }
  };

  const handleSearch = async (searchTerm: string, tab: string) => {
    if (tab === 'currencies') {
      setFilters({ ...filters, search: searchTerm });
    }
  };

  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
          <span className="ml-2 text-gray-600 dark:text-gray-400">Loading...</span>
        </div>
      );
    }

    switch (activeTab) {
      case 'currencies':
        return (
          <DataTable
            data={currencies}
            columns={currencyColumns}
            pagination={pagination}
            onPageChange={(page) => fetchCurrencies(page, true)}
            onEdit={user?.role === 'SUPER_ADMIN' ? handleEdit : undefined}
            onDelete={user?.role === 'SUPER_ADMIN' ? handleDelete : undefined}
            searchPlaceholder="Search currencies..."
            enableAjaxSearch={true}
            onSearch={(searchTerm) => handleSearch(searchTerm, 'currencies')}
            loading={loading}
          />
        );


      case 'fx':
        return (
          <DataTable
            data={fxSnapshots}
            columns={fxColumns}
            pagination={pagination}
            onPageChange={(page) => fetchFxRates(page, true)}
            onEdit={handleEdit}
            searchPlaceholder="Search FX rates..."
            loading={loading}
          />
        );

      default:
        return null;
    }
  };

  const canAddCurrency = user?.role === 'SUPER_ADMIN';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Currency Management</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage currencies and exchange rates
          </p>
        </div>
        {(activeTab === 'currencies' && canAddCurrency) && (
          <button
            onClick={() => handleAdd(activeTab)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Currency</span>
          </button>
        )}
        {activeTab === 'fx' && (
          <button
            onClick={handleSyncFxRates}
            className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="hidden sm:inline">Sync Rates</span>
          </button>
        )}
      </div>

      {/* Currency Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <Coins className="h-8 w-8 text-blue-500" />
            <div>
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {currencies.filter(c => c.enabled).length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Active Currencies</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">F</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {currencies.filter(c => c.type === 'fiat' && c.enabled).length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Fiat Currencies</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-bold">C</span>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {currencies.filter(c => c.type === 'crypto' && c.enabled).length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">Crypto Currencies</div>
            </div>
          </div>
        </div>

      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type
            </label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="fiat">Fiat</option>
              <option value="crypto">Crypto</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              value={filters.enabled}
              onChange={(e) => setFilters({ ...filters, enabled: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="1">Enabled</option>
              <option value="0">Disabled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Search
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              placeholder="Search currencies..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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

      {/* Modal for Add/Edit */}
      <Modal
        isOpen={showModal}
        onClose={handleModalClose}
        title={`${modalMode === 'add' ? 'Add' : 'Edit'} ${activeTab === 'currencies' ? 'Currency' : 'FX Rate'}`}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {activeTab === 'currencies' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Currency Code
                  </label>
                  <input
                    type="text"
                    placeholder="USD"
                    value={formData.code || ''}
                    onChange={(e) => handleFormChange('code', e.target.value.toUpperCase())}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Symbol
                  </label>
                  <input
                    type="text"
                    placeholder="$"
                    value={formData.symbol || ''}
                    onChange={(e) => handleFormChange('symbol', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Currency Name
                </label>
                <input
                  type="text"
                  placeholder="US Dollar"
                  value={formData.name || ''}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Type
                  </label>
                  <select
                    value={formData.type || 'fiat'}
                    onChange={(e) => handleFormChange('type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="fiat">Fiat</option>
                    <option value="crypto">Crypto</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Precision
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="18"
                    placeholder="2"
                    value={formData.precision || 2}
                    onChange={(e) => handleFormChange('precision', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Exchange Rate (vs USD)
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="1.000000"
                    value={formData.exchange_rate || ''}
                    onChange={(e) => handleFormChange('exchange_rate', parseFloat(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => handleFetchExchangeRate(formData.code)}
                    disabled={!formData.code || formData.code.length !== 3}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Fetch Rate
                  </button>
                </div>
              </div>
            </>
          )}

          {activeTab === 'fx' && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Markup (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData.markup_bps || ''}
                    onChange={(e) => {
                      const finalRate = parseFloat(formData.exchange_rate) - (parseFloat(formData.exchange_rate) * (parseFloat(e.target.value) / 100));
                      handleFormChange('final_rate', finalRate);
                      handleFormChange('markup_bps', parseInt(e.target.value))
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Final Rate
                  </label>
                  <input
                    type="number"
                    step="0.000001"
                    placeholder="ex: 1.234567"
                    value={formData.final_rate || ''}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    readOnly
                  />
                </div>

              </div>
            </>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={handleModalClose}
              disabled={submitting}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center"
            >
              {submitting && <RefreshCw className="h-4 w-4 animate-spin mr-2" />}
              {modalMode === 'add' ? 'Add' : 'Update'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default CurrencyManagementPage;