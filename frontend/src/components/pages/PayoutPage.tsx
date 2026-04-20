

import React, { useState, useEffect } from "react";
import { apiClient } from "../../services/api";
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../common/Modal';
import { getProviderInputs } from '../../helpers/providerHelpers';
interface PayoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: () => void;
}

const PayoutModal: React.FC<PayoutModalProps> = ({ isOpen, onClose,onSubmit }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currencies, setCurrencies] = useState([]);
  const [merchant, setMerchant] = useState<any>(null);
  const [providers, setProviders] = useState<any[]>([]);
  const [merchantProvider, setMerchantProvider] = useState<any>(null);
  const [partner, setPartner] = useState<any>(null);
  const [agent, setAgent] = useState<any>(null);
  const [partnerProviders, setPartnerProviders] = useState<any[]>([]);
  const [activeGateway, setActiveGateway] = useState(null);
  const [inputs, setInputs] = useState<any[]>([]);
  const [form, setForm] = useState<any>({
    user_id: user.user_id ?? "",
    gateway: "",
    provider_id: "",
    amount: "",
    method: "",
    account_number: "",
    currency: "",
    country: "",
    note: "",
    cardType: "",
    cardNumber: "",
    expireDate: "",
    cardName: "",
    phone: "",
    email: "",
    comment: "",
  });
  const [totalFee, setTotalFee] = useState(0);
  const [merchantPercentageFee, setMerchantPercentageFee] = useState(0);
  const [merchantFixedFee, setMerchantFixedFee] = useState(0);
  const [balance, setBalance] = useState('');
  const [error, setError] = useState("");
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, files } = e.target as any;

    if (name === "currency") {
      if (value) {
        const currency = currencies.find((c) => c.currency === value);
        setBalance(currency.balance);
      }
    }
    if (name === "amount") {
      const gatewayInfo = activeGateway.gateway_info || {};
      const max = Number(gatewayInfo.max);
      const min = Number(gatewayInfo.min);

      let errorMsg = "";

      if (value > balance) {
        errorMsg = `Amount should be lower or equal than ${balance}`;
      }

      else if (max && value > max) {
        errorMsg = `Max amount is ${max}`;
      } 
      else if (min && value < min) {
        errorMsg = `Min amount is ${min}`;
      }

      setError(errorMsg);
    }
    if (name === "attachment") {
      setForm((prev: any) => ({ ...prev, attachment: files[0] }));
    } else {
      setForm((prev: any) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);

      await apiClient.createPayoutRequest(form);
      if (onSubmit) onSubmit();
      setForm({
        user_id: user.user_id ?? "",
        gateway: "",
        provider_id: "",
        amount: "",
        method: "",
        account_number: "",
        currency: "",
        country: "",
        note: "",
        cardType: "",
        cardNumber: "",
        expireDate: "",
        cardName: "",
        phone: "",
        email: "",
        comment: "",
        attachment: null,
      });
      setActiveGateway(null);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch data
  useEffect(() => { fetchMerchants(), fetchPartners(), fetchAgent(); }, [user]);
  useEffect(() => { fetchProviders(); fetchCurrencies(); }, [isOpen,onSubmit]);

  useEffect(() => {
    if (!providers.length) return;
    if (merchant && merchant.enabled_providers && merchant.enabled_providers.length) {
      const provider = providers.find(p => merchant.enabled_providers.includes(p.provider_id) && p.type == 'PAYOUT');
      setMerchantProvider(provider);
      // setForm((prev: any) => ({ ...prev, 'gateway': provider?.gateway,'provider_id': provider.provider_id }));
    } else if (partner && partner.enabled_providers && partner.enabled_providers.length) {
      const matchedProviders = providers.filter(p =>
        partner.enabled_providers.includes(p.provider_id) && p.type === 'PAYOUT'
      );
      setPartnerProviders(matchedProviders);
    } else if (agent && agent.enabled_providers && agent.enabled_providers.length) {
      const matchedProviders = providers.filter(p =>
        agent.enabled_providers.includes(p.provider_id) && p.type === 'PAYOUT'
      );
      setPartnerProviders(matchedProviders);
    }
  }, [merchant, partner, agent, providers]);


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

  const fetchCurrencies = async () => {
    try {
      setLoading(true);
      // const response = await apiClient.getCurrencies({ limit: 50 });
      const response = await apiClient.getWallets();
      if (response.success && response.data) setCurrencies(response.data.wallets || []);
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
  // Get dynamic inputs for current provider
  useEffect(() => {
    if (merchantProvider) {
      const filteredCurrencies = currencies.filter(
        (c) => c.currency === merchantProvider.currency.code
      );
      const inputs = merchantProvider ? getProviderInputs(merchantProvider.gateway, merchantProvider.type, { ...form, currencies: filteredCurrencies }) : [];
      setForm({
        ...form,
        gateway: merchantProvider.gateway,
        provider_id: merchantProvider.provider_id
      });
      setInputs(inputs);

      const merchantFee = merchantProvider.userProviderFee.find(f => f.user_type === "MERCHANT" && f.merchant_id === user.merchant_id);
      setMerchantPercentageFee(merchantFee.new_fee_percentage);
      setMerchantFixedFee(merchantFee.new_fixed_amount);
    }
  }, [merchantProvider, currencies]);

  useEffect(() => {
    if (merchantFixedFee || merchantPercentageFee && form.amount) {
      const total = (form.amount * parseFloat(merchantPercentageFee) / 100) + parseFloat(merchantFixedFee);
      setTotalFee(total);
    }
  }, [form.amount,merchantFixedFee,merchantPercentageFee,]);
  // Auto-select first provider as default for PARTNER/AGENT

  useEffect(() => {
    if (!activeGateway && partnerProviders.length > 0 && currencies.length > 0) {
      const defaultProvider = partnerProviders[0];
      setActiveGateway(defaultProvider);

      // Filter currencies to only the one matching provider's currency code
      const filteredCurrencies = currencies.filter(
        (c) => c.currency === defaultProvider.currency.code
      );

      setForm(prev => ({
        ...prev,
        gateway: defaultProvider.gateway,
        provider_id: defaultProvider.provider_id,
      }));

      const defaultInputs = getProviderInputs(
        defaultProvider.gateway,
        defaultProvider.type,
        { ...form, currencies: filteredCurrencies } // pass only filtered currencies
      );
      setInputs(defaultInputs);

      // Apply fee config depending on role
      const providerFee = defaultProvider.userProviderFee.find(f =>
        (user?.role === "AGENT" && f.user_type === "AGENT" && f.agent_id === user.agent_id) ||
        (user?.role === "PARTNER" && f.user_type === "PARTNER" && f.partner_id === user.partner_id)
      );

      if (providerFee) {
        setMerchantPercentageFee(providerFee.new_fee_percentage);
        setMerchantFixedFee(providerFee.new_fixed_amount);
      }
    }
  }, [partnerProviders, user, currencies]);


  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Payout Request">
      <div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <span className="text-gray-600 dark:text-gray-300">Loading...</span>
          </div>
        ) : (
          <>
            {/* MERCHANT form */}
            {user?.role === 'MERCHANT' && (
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {inputs.map((input: any) => (
                    <div key={input.name}>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{input.label}</label>
                      {input.type === "textarea" ? (
                        <textarea
                          name={input.name}
                          value={form[input.name] || ""}
                          onChange={handleChange}
                          rows={3}
                          placeholder={input.placeholder}
                          className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      ) : input.type === "select" ? (
                        <select
                          name={input.name}
                          value={form[input.name] || ""}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">{input.placeholder}</option>
                          {input.options?.map((opt: any) => (
                            <option key={opt.currency} value={opt.currency}>{opt.currency} ({opt.available_balance})</option>
                          ))}
                        </select>
                      ) : input.type === "file" ? (
                        <input type="file" name={input.name} onChange={handleChange} className="w-full" />
                      ) : (
                        <input
                          type={input.type}
                          name={input.name}
                          value={form[input.name] || ""}
                          onChange={handleChange}
                          placeholder={input.placeholder}
                          disabled={input.disabled || false}
                          className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                      {input.name=='amount' && totalFee > 0 && form.amount > 0 && (
                      <div className="mb-4 flex items-center py-1">
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300  mr-2">
                          Payout Fee: 
                          <span className="text-lg font-semibold text-blue-600 dark:text-blue-400 ml-2">
                            {totalFee}
                          </span>
                        </div>

                        ||
                        
                        <div className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-2">
                          You will get: 
                          <span className="text-lg font-semibold text-blue-600 dark:text-blue-400 ml-2">
                            {form.amount - totalFee}
                          </span>
                        </div>
                        
                      </div>
                    )}

                    </div>
                  ))}
                  <button type="submit" disabled={loading || error} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                    Submit
                  </button>
                </form>
              </div>
            )}

            {/* PARTNER/AGENT Tabs */}
            {(user?.role === 'PARTNER' || user?.role === 'AGENT') && (
              <div className="mt-4">
                <div className="flex border-b border-gray-200">
                  {partnerProviders.map((provider) => (
                    <button
                      key={provider.provider_id}
                      className={`px-5 py-2 text-sm font-semibold rounded-t-md transition-all
                        ${
                          activeGateway?.provider_id === provider.provider_id
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                      onClick={() => {
                        setActiveGateway(provider);
                        setForm({ ...form, gateway: provider?.gateway, provider_id: provider.provider_id });

                        // Filter currencies to only the one matching provider.currency.code
                        const filteredCurrencies = currencies.filter(
                          (c) => c.currency === provider.currency.code
                        );

                        const newInputs = getProviderInputs(provider?.gateway, provider.type, { ...form, currencies: filteredCurrencies });

                        // Set fees based on role
                        if (user?.role === 'AGENT') {
                          const providerFee = provider.userProviderFee.find(f => f.user_type === "AGENT" && f.agent_id === user.agent_id);
                          if (providerFee) {
                            setMerchantPercentageFee(providerFee.new_fee_percentage);
                            setMerchantFixedFee(providerFee.new_fixed_amount);
                          }
                        } else if(user?.role === 'PARTNER') {
                          const providerFee = provider.userProviderFee.find(f => f.user_type === "PARTNER" && f.partner_id === user.partner_id);
                          if (providerFee) {
                            setMerchantPercentageFee(providerFee.new_fee_percentage);
                            setMerchantFixedFee(providerFee.new_fixed_amount);
                          }
                        }

                        setInputs(newInputs);
                      }}
                    >
                      {provider.alias}
                    </button>
                  ))}
                </div>

                {activeGateway && (
                  <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 mt-4">
                    <form onSubmit={handleSubmit} className="space-y-4">
                      {inputs.map((input: any) => (
                        <div key={input.name}>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{input.label}</label>
                          {input.type === "textarea" ? (
                            <textarea
                              name={input.name}
                              value={form[input.name] || ""}
                              onChange={handleChange}
                              rows={3}
                              placeholder={input.placeholder}
                              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          ) : input.type === "select" ? (
                            <select
                              name={input.name}
                              value={form[input.name] || ""}
                              onChange={handleChange}
                              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">{input.placeholder}</option>
                              {input.options?.map((opt: any) => (
                                <option key={opt.currency} value={opt.currency}>{opt.currency} ({opt.available_balance})</option>
                              ))}
                            </select>
                          ) : input.type === "file" ? (
                            <input type="file" name={input.name} onChange={handleChange} className="w-full" />
                          ) : (
                            <input
                              type={input.type}
                              name={input.name}
                              value={form[input.name] || ""}
                              onChange={handleChange}
                              placeholder={input.placeholder}
                              disabled={input.disabled || false}
                              className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          )}

                          {input.name=='amount'&& (
                            <div className="mb-4 flex items-center py-1">
                              {!error && totalFee > 0 && form.amount > 0 && (
                                <>
                                <div className="text-sm font-medium text-gray-700 dark:text-gray-300  mr-2">
                                  Payout Fee: 
                                  <span className="text-lg font-semibold text-blue-600 dark:text-blue-400 ml-2">
                                    {totalFee.toFixed(2)}
                                  </span>
                                </div>

                                ||
                                
                                <div className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-2">
                                  You will get: 
                                  <span className="text-lg font-semibold text-blue-600 dark:text-blue-400 ml-2">
                                    {(form.amount - totalFee).toFixed(2)}
                                  </span>
                                </div>
                              </>
                              )}
                              {error && (
                                <span className="text-red-600 font-medium">
                                    {error}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                      <button type="submit" disabled={loading || error} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50">
                        Submit
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default PayoutModal;
