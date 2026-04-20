import React, { useState, useEffect } from 'react';
import { Shield, Key, AlertTriangle, CheckCircle, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/api';
import Modal from '../common/Modal';
import { useLocation } from 'react-router-dom';
const SecurityPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [securityOverview, setSecurityOverview] = useState<any>(null);
  const [securityEvents, setSecurityEvents] = useState<any[]>([]);
  const [securitySettings, setSecuritySettings] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrData, setQrData] = useState(null);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState([]);
  const location = useLocation();
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
      if (searchParams.get('tab')) {
      setActiveTab(searchParams.get('tab') || 'overview');
    }
  }, [location.search]);
  useEffect(() => {
    fetchSecurityData();
  }, []);

  const fetchSecurityData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch security overview
      const overviewResponse = await apiClient.getSecurityOverview();
      if (overviewResponse.success) {
        setSecurityOverview(overviewResponse.data);
      }

      // Fetch security settings
      const settingsResponse = await apiClient.getSecuritySettings();
      if (settingsResponse.success) {
        setSecuritySettings(settingsResponse.data);
      }

      // Fetch recent security events
      const eventsResponse = await apiClient.getSecurityEvents({ per_page: 10 });
      if (eventsResponse.success) {
        setSecurityEvents((eventsResponse.data as any)?.data || []);
      }

    } catch (err) {
      setError('Failed to load security data');
      console.error('Error fetching security data:', err);
    } finally {
      setLoading(false);
    }
  };

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
    } else if (response.success) {
      fetchSecurityData(); 
    } else {
      console.error("2FA generation failed:", response);
    }
  } catch (err) {
    console.error("Error generating 2FA:", err);
  }
};

  const handleEnable = async () => {
    const response = await apiClient.enable2FA({otp});
    if (response.success) {
      fetchSecurityData();
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

  const handleUpdateSecuritySetting = async (key: string, value: any) => {
    const response = await apiClient.updateSecuritySetting(key, value);
    if (response.success) {
      fetchSecurityData(); // Refresh data
    }
  };

  const handleUpdateRecoveryEmail = async (key: string, value: any) => {
    const response = await apiClient.updateRecoveryEmail(key, value);
    if (response.success) {
      fetchSecurityData(); // Refresh data
    }
  };

  const handleGenerateRecoveryCodes = async () => {
    const response = await apiClient.recoveryCodes({otp});
    if (response.success) {
      const data = response.data
      if(data.recovery_codes){
        setRecoveryCodes(data.recovery_codes);
        setShowRecoveryModal(true);
      }
    }
  };


  const securityTabs = [
    { id: 'overview', label: 'Security Overview', icon: Shield },
    { id: 'authentication', label: 'Authentication', icon: Key },
    { id: 'settings', label: 'Security Settings', icon: Settings }
  ];
  useEffect(() => {
    if (user && user?.recovery_email) {
      setEmail(user.recovery_email);
    }
  }, [user]);
  const renderTabContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
          <div className="text-red-800 dark:text-red-400">{error}</div>
        </div>
      );
    }

    switch (activeTab) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* Security Score */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Security Score</h3>
                <div className="flex items-center space-x-2">
                  <div className="w-16 h-16 relative">
                    <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeDasharray={`${securityOverview?.security_score || 0}, 100`}
                        className="text-green-500"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-lg font-bold text-green-600 dark:text-green-400">
                        {securityOverview?.security_score || 0}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-green-600 dark:text-green-400 capitalize">
                      {securityOverview?.security_status || 'Unknown'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Security Level</div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-3">
                  {user?.two_factor_enabled ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  )}
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {user?.two_factor_enabled ? '2FA Enabled' : '2FA Disabled'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Multi-factor authentication</div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">SSL/TLS Active</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Encrypted connections</div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Rate Limiting</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Needs configuration</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Security Events */}
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Recent Security Events</h3>
              <div className="space-y-3">
                {securityEvents.length > 0 ? securityEvents.map((event: any, index: number) => (
                  <div key={index} className={`flex items-center space-x-3 p-3 rounded-lg ${
                    event.severity === 'error' ? 'bg-red-50 dark:bg-red-900/20' :
                    event.severity === 'warning' ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                    'bg-green-50 dark:bg-green-900/20'
                  }`}>
                    {event.severity === 'error' ? <AlertTriangle className="h-5 w-5 text-red-500" /> :
                     event.severity === 'warning' ? <AlertTriangle className="h-5 w-5 text-yellow-500" /> :
                     <CheckCircle className="h-5 w-5 text-green-500" />}
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {event.description}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {event.user_id ? `User: ${event.user_id}` : 'System'} • {new Date(event.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-4 text-gray-500 dark:text-gray-400">
                    No recent security events
                  </div>
                )}
              </div>
            </div>
          </div>
        );

      case 'authentication':
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Two-Factor Authentication</h3>
              <div className="space-y-4">
                <div className={`flex items-center justify-between p-4 rounded-lg ${
                  user?.two_factor_enabled
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
                    className={`px-3 py-1 text-sm rounded ${
                      user?.two_factor_enabled
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

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Password Policy</h3>
              <div className="space-y-3">
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Minimum 8 characters</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Contains uppercase and lowercase letters</span>
                </div>
                <div className="flex items-center space-x-3">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Contains numbers and special characters</span>
                </div>
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Password expiry: 90 days</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Security Policies</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Enforce 2FA for all users</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Require two-factor authentication</div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={securitySettings?.enforce_2fa?.value === 'true'}
                      onChange={(e) => handleUpdateSecuritySetting('enforce_2fa', e.target.checked.toString())}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Session timeout</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Auto-logout after inactivity</div>
                  </div>
                  <select
                    value={securitySettings?.session_timeout?.value || '30'}
                    onChange={(e) => handleUpdateSecuritySetting('session_timeout', e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="15">15 minutes</option>
                    <option value="30">30 minutes</option>
                    <option value="60">1 hour</option>
                    <option value="240">4 hours</option>
                  </select>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">Failed login lockout</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">Lock account after failed attempts</div>
                  </div>
                  <select
                    value={securitySettings?.failed_login_lockout?.value || '5'}
                    onChange={(e) => handleUpdateSecuritySetting('failed_login_lockout', e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="3">3 attempts</option>
                    <option value="5">5 attempts</option>
                    <option value="10">10 attempts</option>
                  </select>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Security Center</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage security settings and monitor platform security
          </p>
        </div>
      </div>

      {/* Security Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {securityTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
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

      {/* Tab Content */}
      {renderTabContent()}
    </div>
  );
};

export default SecurityPage;