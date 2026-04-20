import React, { useState, useEffect } from 'react';
import { User, Bell, Palette, Globe, Shield, Key, Copy, Mail, CheckCircle, AlertTriangle, Mailbox } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { apiClient } from '../../services/api';
import Modal from '../common/Modal';
import { useLocation } from 'react-router-dom';
const SettingsPage: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<any>({});
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const [newSettings, setNewSettings] = useState([]);
  const [emailTemplates, setEmailTemplates] = useState([]);
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('tab')) {
      setActiveTab(searchParams.get('tab') || 'profile');
    }
  }, [location.search]);
  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    fee: user?.fee || 0,
    timezone: user?.timezone || 'UTC'
  });
  const [smtpForm, setSmtpForm] = useState({
    mail_name: '',
    mail_from: '',
    // fee: '',
    mail_host: '',
    mail_port: '',
    mail_username: '',
    mail_password: '',
    mail_encryption: 'tls'
  });
  const [activetemplateTab, setTemplateActiveTab] = useState("transaction");
  const [templateForm, setTemplateForm] = useState({
    transaction: { subject: "", body: "" },
    settlement: { subject: "", body: "" },
    security: { subject: "", body: "" },
  });
  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  });

  // Notifications state
  const [notifications, setNotifications] = useState({
    transaction_alerts: false,
    settlement_notifications: false,
    security_alerts: false,
  });

  // Appearance state
  const [appearance, setAppearance] = useState({
    sidebar_position: 'left',
    table_density: 'comfortable',
    items_per_page: '25',
    show_animations: true,
    fee: user?.fee || 0
  });

  // Localization state
  const [localization, setLocalization] = useState({
    language: 'en',
    region: 'US',
    number_format: '1,234.56',
    currency_display: 'symbol',
    date_format: 'MM/DD/YYYY',
    time_format: '12'
  });

  // Partner data

  // API Key state
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiLoading, setApiLoading] = useState<boolean>(false);
  const [copying, setCopying] = useState<boolean>(false);
  const merchantId = (user as any)?.merchant_id as string | undefined;
  // Replace your current appSettings state with this:
  const [appSettings, setAppSettings] = useState({
    appName: '',
    appLogo: null as File | null,
    fabIcon: null as File | null
  });

  // Add this useEffect to prevent undefined values
  useEffect(() => {
    if (appSettings.appName === undefined) {
      setAppSettings(prev => ({ ...prev, appName: '' }));
    }
  }, [appSettings.appName]);
  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await apiClient.getUserSettings();
      if (response.success && response.data) {
        const data = response.data as { settings: any };
        const userSettings = data.settings || {};
        setSettings(userSettings);
        if (userSettings.appSettings) {
          const appNameValue = userSettings.appSettings.app_name || '';
          setAppSettings(prev => ({
            ...prev,
            appName: appNameValue
          }));
        }
        setNotifications(prev => ({ ...prev, ...userSettings.notifications }));
        setAppearance(prev => ({ ...prev, ...userSettings.appearance }));
        setLocalization(prev => ({ ...prev, ...userSettings.localization }));
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }

  };

  // Load API key when API tab becomes active
  useEffect(() => {
    const fetchApiKeyIfNeeded = async () => {
      if (activeTab !== 'api') return;
      try {
        if (user?.role === 'MERCHANT' && merchantId) {
          setApiLoading(true);
          const res = await apiClient.getMerchantApiKey(merchantId);
          if (res.success && res.data) {
            const data = res.data as any;
            setApiKey((data.api_key as string) || null);
          } else {
            setApiKey(null);
          }
        } else {
          setApiKey(null);
        }
      } catch (_e) {
        setApiKey(null);
      } finally {
        setApiLoading(false);
      }
    };
    fetchApiKeyIfNeeded();
  }, [activeTab]);

  const handleGenerateApiKey = async () => {
    try {
      setApiLoading(true);
      if (user?.role === 'MERCHANT' && merchantId) {
        const res = await apiClient.generateApiKey(merchantId);
        if (res.success && res.data) {
          const data = res.data as any;
          setApiKey((data.api_key as string) || null);
        }
      }
    } catch (_e) {
      // toast handled in api client
    } finally {
      setApiLoading(false);
    }
  };

  const handleCopyApiKey = async () => {
    if (!apiKey) return;
    try {
      setCopying(true);
      await navigator.clipboard.writeText(apiKey);
      // Show success message
      const { toast } = await import('react-toastify');
      toast.success('API key copied to clipboard!', {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });
    } finally {
      setCopying(false);
    }
  };

  const saveSettings = async (category: string, data: any) => {
    try {
      setLoading(true);
      const updatedSettings = {
        ...settings,
        [category]: data
      };
      const response = await apiClient.updateUserSettings(updatedSettings);
      if (response.success) {
        setSettings(updatedSettings);
      }
    } catch (error) {
      // Error toast is handled by api.ts
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      await apiClient.updateProfile(profileForm);
    } catch (error) {
      // Error toast is handled by api.ts
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // if (passwordForm.new_password !== passwordForm.confirm_password) {
    //   // Password mismatch will be handled by showing an error state or validation message
    //   return;
    // }
    try {
      setLoading(true);
      const response = await apiClient.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password
      });
      if (response.success) {
        setPasswordForm({ current_password: '', new_password: '', confirm_password: '' });
      }
    } catch (error) {
      // Error toast is handled by api.ts
    } finally {
      setLoading(false);
    }
  };

  const handleNotificationChange = (key: string, value: boolean) => {
    const updated = { ...notifications, [key]: value };
    setNotifications(updated);
    saveSettings('notifications', updated);
  };

  const handleAppearanceChange = (key: string, value: any) => {
    const updated = { ...appearance, [key]: value };
    setAppearance(updated);
    if (key == 'items_per_page') {
      localStorage.setItem('items_per_page', value);
    }
    saveSettings('appearance', updated);
  };


  const handleAppearancefeeChange = (key: string, value: any) => {
    const updated = { ...appearance, [key]: value };
    setAppearance(updated);
    if (key == 'fee') {
      localStorage.setItem('fee', value);
    }
    saveSettings('appearance', updated);
  };

  const handleLocalizationChange = (key: string, value: any) => {
    const updated = { ...localization, [key]: value };
    setLocalization(updated);
    saveSettings('localization', updated);
  };

  const handleAppSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // ADDED validation
    if (!appSettings.appName?.trim()) {
      const { toast } = await import('react-toastify');
      toast.error('App name is required');
      return;
    }

    try {
      setLoading(true);

      const formData = new FormData();
      formData.append('app_name', appSettings.appName.trim());

      if (appSettings.appLogo) {
        formData.append('app_logo', appSettings.appLogo);
      }

      if (appSettings.fabIcon) {
        formData.append('favicon', appSettings.fabIcon);
      }

      const response = await apiClient.updateAppSettings(formData);


    } catch (error: any) {
      console.error('Failed to update application settings:', error);
    } finally {
      setLoading(false);
    }
  };


  const settingsTabs = [
    { id: 'profile', label: 'Profile', icon: User },
    ...(user?.role === 'MERCHANT' ? [{ id: 'api', label: 'Api', icon: Key }] : []),

    ...(user?.role !== 'MERCHANT' && user?.role !== 'AGENT' && user?.role !== 'PARTNER'
      ? [
        //  { id: 'applicationSettings', label: 'App Settings', icon: AppWindow  },
        { id: 'notifications', label: 'Notifications', icon: Bell },
        { id: 'appearance', label: 'Appearance', icon: Palette },
        { id: 'localization', label: 'Localization', icon: Globe },
        { id: 'smtp', label: 'SMTP', icon: Mailbox },
        { id: 'emailTemplate', label: 'Email Template', icon: Mail },
      ]
      : []),
    ...((user?.role !== 'SUPER_ADMIN')
      ? [
        { id: 'security', label: 'Security', icon: Shield },
      ]
      : []),
  ];

  const handleEnable2FA = async () => {
    try {
      const response = await apiClient.generate2FA();

      if (response?.success) {
        const data = response?.data
        setQrData({
          qrCodeUrl: data.qr_code_url,
          secret: data.secret
        });
        setShowQrModal(true);
      } else {
        console.error("2FA generation failed:", response);
      }
    } catch (err) {
      console.error("Error generating 2FA:", err);
    }
  };

  const handleEnable = async () => {
    const response = await apiClient.enable2FA({ otp });
    if (response.success) {
      const storedUser = JSON.parse(localStorage.getItem('user'));

      const updatedUser = { ...storedUser, two_factor_enabled: true };

      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
    setOtp('');
    setQrData(null);
    setShowQrModal(false);
  };

  const handleDisable2FA = async () => {
    const response = await apiClient.disable2FA();
    if (response.success) {
      const storedUser = JSON.parse(localStorage.getItem('user'));

      const updatedUser = { ...storedUser, two_factor_enabled: false };

      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };
  const handleUpdateRecoveryEmail = async (key: string, value: any) => {
    const response = await apiClient.updateRecoveryEmail(key, value);
  };

  const handleGenerateRecoveryCodes = async () => {
    const response = await apiClient.recoveryCodes({ otp });
    if (response.success) {
      const data = response.data
      if (data.recovery_codes) {
        setRecoveryCodes(data.recovery_codes);
        setShowRecoveryModal(true);
      }
    }
  };
  useEffect(() => {
    if (user && user?.recovery_email) {
      setEmail(user.recovery_email);
    }
  }, [user]);
  useEffect(() => {
    const loadNewSettings = async () => {
      try {
        const response = await apiClient.settings();
        if (response.success && response.data) {
          const data = response.data.settings;
          const emailTemplates = response.data.emailTemplates;
          setNewSettings(data);
          setEmailTemplates(emailTemplates);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    loadNewSettings();
  }, [user]);
  useEffect(() => {
    setSmtpForm({
      mail_name: getSettingByName('mail_name') ?? '',
      mail_from: getSettingByName('mail_from') ?? '',
      // fee: getSettingByName('fee') ?? '',
      mail_host: getSettingByName('mail_host') ?? '',
      mail_port: getSettingByName('mail_port') ?? '',
      mail_username: getSettingByName('mail_username') ?? '',
      mail_password: getSettingByName('mail_password') ?? '',
      mail_encryption: getSettingByName('mail_encryption') ?? 'tls'
    });
  }, [user, newSettings])
  useEffect(() => {
    if (!emailTemplates || emailTemplates.length === 0) return;

    const formatted = {
      transaction: { subject: "", body: "" },
      settlement: { subject: "", body: "" },
      security: { subject: "", body: "" },
    };

    emailTemplates.forEach((tpl) => {
      formatted[tpl.type] = {
        subject: tpl.subject || "",
        body: tpl.body || "",
      };
    });

    setTemplateForm(formatted);
  }, [user, emailTemplates]);
  function getSettingByName(name) {
    const item = newSettings.find(setting => setting.name === name);
    return item ? item.value : '';
  }
  const handleSMTPSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const response = await apiClient.updateSMTP(smtpForm);
  };
  const handleTemplateChange = (tab, field, value) => {
    setTemplateForm((prev) => ({
      ...prev,
      [tab]: { ...prev[tab], [field]: value },
    }));
  };

  const handleTemplateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = templateForm[activetemplateTab];
    const payload = {
      type: activetemplateTab,
      ...value,
    };
    const response = await apiClient.updateTemplate(payload);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'applicationSettings':
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Application Settings
              </h3>

              <form onSubmit={handleAppSettingsSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* App Name */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      App Name *
                    </label>
                    <input
                      type="text"
                      value={appSettings.appName || ''}
                      onChange={(e) => setAppSettings(prev => ({
                        ...prev,
                        appName: e.target.value
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter your application name"
                      required
                    />
                  </div>

                  {/* App Logo */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      App Logo
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 2 * 1024 * 1024) {
                            alert('App logo must be less than 2MB');
                            return;
                          }
                          setAppSettings(prev => ({
                            ...prev,
                            appLogo: file
                          }));
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      (Max: 2MB)
                    </p>
                  </div>

                  {/* Favicon */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Favicon
                    </label>
                    <input
                      type="file"
                      accept="image/*,.ico"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          if (file.size > 1 * 1024 * 1024) {
                            alert('Favicon must be less than 1MB');
                            return;
                          }
                          setAppSettings(prev => ({
                            ...prev,
                            fabIcon: file
                          }));
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900 dark:file:text-blue-300"
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      (Max: 1MB)
                    </p>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {loading ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </span>
                    ) : (
                      'Save Application Settings'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      case 'profile':
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Profile Information</h3>
              <form onSubmit={handleProfileSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={profileForm.email}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>


                  {/* <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Transfer Fee (%)
                    </label>
                    <input
                      type="number"
                      value={profileForm.fee || 2} // default 2%
                      onChange={(e) =>
                        setProfileForm(prev => ({ ...prev, fee: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div> */}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Timezone
                    </label>
                    <select
                      value={profileForm.timezone}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, timezone: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="UTC">UTC</option>
                      <option value="America/New_York">America/New_York</option>
                      <option value="America/Los_Angeles">America/Los_Angeles</option>
                      <option value="America/Chicago">America/Chicago</option>
                      <option value="Europe/London">Europe/London</option>
                      <option value="Asia/Tokyo">Asia/Tokyo</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Change Password</h3>
              <form onSubmit={handlePasswordSubmit}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={passwordForm.current_password}
                      onChange={(e) => setPasswordForm(prev => ({ ...prev, current_password: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={passwordForm.new_password}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={passwordForm.confirm_password}
                        onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Updating...' : 'Update Password'}
                  </button>
                </div>
              </form>
            </div>

          </div>
        );

      case 'smtp':
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">SMTP Settings</h3>
              <form onSubmit={handleSMTPSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Mail Name
                    </label>
                    <input
                      type="text"
                      value={smtpForm.mail_name}
                      onChange={(e) => setSmtpForm(prev => ({ ...prev, mail_name: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Mail From
                    </label>
                    <input
                      type="email"
                      value={smtpForm.mail_from}
                      onChange={(e) => setSmtpForm(prev => ({ ...prev, mail_from: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>


                  {/* <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Transfer Fee (%)
                    </label>
                    <input
                      type="number"
                      value={smtpForm.fee || 2} // default 2%
                      onChange={(e) =>
                        setSmtpForm(prev => ({ ...prev, transfer_fee: e.target.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div> */}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Mail Host
                    </label>
                    <input
                      type="text"
                      value={smtpForm.mail_host}
                      onChange={(e) => setSmtpForm(prev => ({ ...prev, mail_host: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Mail Port
                    </label>
                    <input
                      type="number"
                      value={smtpForm.mail_port}
                      onChange={(e) => setSmtpForm(prev => ({ ...prev, mail_port: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Mail Username
                    </label>
                    <input
                      type="text"
                      value={smtpForm.mail_username}
                      onChange={(e) => setSmtpForm(prev => ({ ...prev, mail_username: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Mail Password
                    </label>
                    <input
                      type="password"
                      value={smtpForm.mail_password}
                      onChange={(e) => setSmtpForm(prev => ({ ...prev, mail_password: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Mail Encryption
                    </label>
                    <select
                      value={smtpForm.mail_encryption}
                      onChange={(e) => setSmtpForm(prev => ({ ...prev, mail_encryption: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="tls">TLS</option>
                      <option value="ssl">SSL</option>
                    </select>
                  </div>
                </div>

                <div className="mt-6">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );

      case 'emailTemplate':
        return (
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Email Templates
            </h3>

            <div className="flex gap-6">
              {/* ====== Left: Tabs ====== */}
              <div className="flex flex-col w-1/4 border-r border-gray-300 dark:border-gray-700 pr-4">
                {["transaction", "settlement", "security"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setTemplateActiveTab(tab)}
                    className={`px-4 py-2 text-sm font-medium capitalize text-left mb-2 rounded-lg ${activetemplateTab === tab
                      ? "bg-blue-100 dark:bg-blue-800 text-gray-300"
                      : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                      }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* ====== Right: Tab Content ====== */}
              <div className="w-3/4">
                <form onSubmit={handleTemplateSubmit}>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Subject
                    </label>
                    <textarea
                      rows="2"
                      placeholder="Enter email subject"
                      value={templateForm[activetemplateTab]?.subject || ""}
                      onChange={(e) =>
                        handleTemplateChange(activetemplateTab, "subject", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    ></textarea>

                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mt-3 mb-1">
                      Body
                    </label>
                    <textarea
                      rows="5"
                      placeholder="Enter email body"
                      value={templateForm[activetemplateTab]?.body || ""}
                      onChange={(e) =>
                        handleTemplateChange(activetemplateTab, "body", e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    ></textarea>
                  </div>
                  {activetemplateTab === 'transaction' && (
                    <>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        user_name = User Name
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        status = Status
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        data = Date
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        type = Type
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        amount = Amount
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        currency = Currency
                      </div>
                    </>
                  )}

                  {activetemplateTab === 'settlement' && (
                    <>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        amount = Amount
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        currency = Currency
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        status = Status
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        data = Date
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        type = Type
                      </div>
                    </>
                  )}

                  {activetemplateTab === 'security' && (
                    <>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        user_name = User Name
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        about = About
                      </div>
                    </>
                  )}

                  <div className="mt-6">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Save Template
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        );


      case 'api':
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">API</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Use this key to authenticate server-to-server requests.</p>

              {apiLoading ? (
                <div className="text-sm text-gray-500 dark:text-gray-400">Loading...</div>
              ) : apiKey ? (
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    readOnly
                    value={apiKey}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <button
                    onClick={handleCopyApiKey}
                    disabled={copying}
                    className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                  >
                    <Copy className="h-4 w-4" />
                    {copying ? 'Copying...' : 'Copy'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">No API key found</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Generate a new API key for your account.</div>
                  </div>
                  <button
                    onClick={handleGenerateApiKey}
                    disabled={apiLoading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {apiLoading ? 'Generating...' : 'Generate API Key'}
                  </button>
                </div>
              )}
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Email Notifications</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Transaction Alerts</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Get notified about transaction status changes</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifications.transaction_alerts}
                      onChange={(e) => handleNotificationChange('transaction_alerts', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Settlement Notifications</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Receive updates about settlement processing</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifications.settlement_notifications}
                      onChange={(e) => handleNotificationChange('settlement_notifications', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Security Alerts</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Important security-related notifications</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifications.security_alerts}
                      onChange={(e) => handleNotificationChange('security_alerts', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>



                {/* <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Marketing Updates</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Product updates and feature announcements</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifications.marketing_updates}
                      onChange={(e) => handleNotificationChange('marketing_updates', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div> */}
              </div>
            </div>

            {/* <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Push Notifications</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Browser Notifications</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Show notifications in your browser</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifications.browser_notifications}
                      onChange={(e) => handleNotificationChange('browser_notifications', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Sound Notifications</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Play sound for important alerts</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifications.sound_notifications}
                      onChange={(e) => handleNotificationChange('sound_notifications', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div> */}

          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Theme Settings</h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Dark Mode</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Switch between light and dark themes</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={theme === 'dark'}
                      onChange={toggleTheme}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>



                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Transfer Fee (%)
                  </label>
                  <input
                    type="number"
                    value={appearance.fee}
                    // onChange={(e) =>
                    //   setAppearance(prev => ({
                    //     ...prev,
                    //     fee: Number(e.target.value)
                    //   }))
                    // }
                    onChange={(e) => handleAppearancefeeChange('fee', e.target.value)}
                    className="w-full px-3 py-2 border ..."
                  />
                </div>



                {/* <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Sidebar Position
                  </label>
                  <select
                    value={appearance.sidebar_position}
                    onChange={(e) => handleAppearanceChange('sidebar_position', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Table Density
                  </label>
                  <select
                    value={appearance.table_density}
                    onChange={(e) => handleAppearanceChange('table_density', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="comfortable">Comfortable</option>
                    <option value="compact">Compact</option>
                    <option value="spacious">Spacious</option>
                  </select>
                </div> */}

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Items per page
                    </label>
                    <select
                      value={appearance.items_per_page}
                      onChange={(e) => handleAppearanceChange('items_per_page', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="10">10</option>
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </div>
                </div>


              </div>

            </div>

            {/* <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Display Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Items per page
                  </label>
                  <select
                    value={appearance.items_per_page}
                    onChange={(e) => handleAppearanceChange('items_per_page', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="10">10</option>
                    <option value="25">25</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Show animations</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Enable smooth transitions and animations</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={appearance.show_animations}
                      onChange={(e) => handleAppearanceChange('show_animations', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div> */}


          </div>
        );

      case 'localization':
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Language & Region</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Language
                  </label>
                  <select
                    value={localization.language}
                    onChange={(e) => handleLocalizationChange('language', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                    <option value="ja">Japanese</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Region
                  </label>
                  <select
                    value={localization.region}
                    onChange={(e) => handleLocalizationChange('region', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="US">United States</option>
                    <option value="GB">United Kingdom</option>
                    <option value="CA">Canada</option>
                    <option value="AU">Australia</option>
                    <option value="DE">Germany</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Number & Currency Format</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Number Format
                  </label>
                  <select
                    value={localization.number_format}
                    onChange={(e) => handleLocalizationChange('number_format', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="1,234.56">1,234.56</option>
                    <option value="1.234,56">1.234,56</option>
                    <option value="1 234.56">1 234.56</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Currency Display
                  </label>
                  <select
                    value={localization.currency_display}
                    onChange={(e) => handleLocalizationChange('currency_display', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="symbol">Symbol ($1,234.56)</option>
                    <option value="code">Code (USD 1,234.56)</option>
                    <option value="name">Name (1,234.56 US Dollars)</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Date & Time Format</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date Format
                  </label>
                  <select
                    value={localization.date_format}
                    onChange={(e) => handleLocalizationChange('date_format', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Time Format
                  </label>
                  <select
                    value={localization.time_format}
                    onChange={(e) => handleLocalizationChange('time_format', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="12">12-hour (3:30 PM)</option>
                    <option value="24">24-hour (15:30)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Two-Factor Authentication</h3>
              <div className="space-y-4">
                <div className={`flex items-center justify-between p-4 rounded-lg ${user?.two_factor_enabled
                  ? 'bg-green-50 dark:bg-green-900/20'
                  : 'bg-gray-50 dark:bg-gray-900/20'
                  }`}>
                  <div className="flex items-center space-x-3">
                    {user?.two_factor_enabled ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-500" />
                    )}
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {user?.two_factor_enabled ? '2FA Enabled' : '2FA Disabled'}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {user?.two_factor_enabled ? 'Using authenticator app' : 'Not configured'}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={user?.two_factor_enabled ? handleDisable2FA : handleEnable2FA}
                    className={`px-3 py-1 text-sm rounded ${user?.two_factor_enabled
                      ? 'border border-red-300 text-red-600 hover:bg-red-50'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                  >
                    {user?.two_factor_enabled ? 'Disable' : 'Enable'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Backup Codes</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Generate backup codes for account recovery
                    </p>
                    <button onClick={handleGenerateRecoveryCodes} className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                      Generate Codes
                    </button>
                  </div>

                  <div className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Recovery Email</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                      Set up recovery email for 2FA reset
                    </p>
                    <button onClick={() => setIsRecoveryOpen(true)} className="px-3 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700">
                      Configure
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );


      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your account settings and preferences
          </p>
        </div>
      </div>

      {/* Settings Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8 overflow-x-auto sm:overflow-x-visible scrollbar-hide">
          {settingsTabs.map((tab) => {
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

      <Modal isOpen={isRecoveryOpen} onClose={() => setIsRecoveryOpen(false)} title="Set Recovery Email">
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          required
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 mb-4 border border-gray-300 dark:border-gray-600 rounded text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <div className="flex justify-end space-x-2">
          <button
            className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white rounded hover:bg-gray-400"
            onClick={() => setIsRecoveryOpen(false)}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            onClick={(e) => handleUpdateRecoveryEmail('recovery_email', email)}
          >
            Save
          </button>
        </div>
      </Modal>
      {showQrModal && qrData && (
        <Modal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          title="Scan this QR Code"
        >
          <div className="text-center">
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(
                qrData.qrCodeUrl
              )}&size=200x200`}
              alt="2FA QR Code"
              className="mx-auto mb-3"
            />

            <p className="text-sm text-gray-600 mb-2">
              Secret Key: <strong>{qrData.secret}</strong>
            </p>
            <p className="text-xs text-gray-400 mb-4">
              Add this key to your authenticator app (like Google Authenticator).
            </p>

            {/* OTP Input Section */}
            <div className="mt-4">
              <input
                type="text"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="border rounded-lg px-3 py-2 w-40 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="000000"
              />

              <button
                onClick={handleEnable}
                className="ml-3 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Verify OTP
              </button>
            </div>
          </div>
        </Modal>
      )}
      <Modal
        isOpen={showRecoveryModal}
        onClose={() => setShowRecoveryModal(false)}
        title="Your Recovery Codes"
      >
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm">
            Save these codes in a secure place. You can use them if you ever lose access
            to your authenticator app.
          </p>

          <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 shadow-inner mb-6">
            <div className="grid grid-cols-1 gap-2">
              {recoveryCodes.map((code, index) => (
                <div
                  key={index}
                  className="font-mono tracking-widest text-base text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-900 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  {code}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-center space-x-3">
            <button
              onClick={() => {
                const content = recoveryCodes.join('\n');
                const blob = new Blob([content], { type: 'text/plain' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'recovery_codes.txt';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
              }}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 focus:ring-2 focus:ring-green-400 focus:outline-none transition-all"
            >
              Download Codes
            </button>

            <button
              onClick={() => setShowRecoveryModal(false)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-400 focus:outline-none transition-all"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SettingsPage;