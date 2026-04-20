import { toast } from 'react-toastify';
import { User } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

interface LoginResponse {
  user: any;
  token: string;
  refresh_token: string;
  expires_in: number;
}

interface RefreshResponse {
  token: string;
  refresh_token: string;
  expires_in: number;
}

interface ProfileResponse extends User { }

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    // Load token from localStorage on initialization
    this.loadToken();
  }

  private loadToken() {
    const storedToken = localStorage.getItem('auth_token');
    if (storedToken) {
      this.token = storedToken;
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  reloadToken() {
    this.loadToken();
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, { ...options, headers, });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMessage = data.error?.message || data.message || 'An error occurred';
        const errorCode = data.error?.code || response.status.toString();
        // 1111111
        // const token = user?.token;

        // const apiClient = axios.create({
        //   baseURL: 'http://localhost:8000/api',
        //   headers: {
        //     Authorization: `Bearer ${token}`, // <-- THIS IS IMPORTANT
        //   },
        // });

        // Handle UNAUTHENTICATED error - redirect to login
        if (errorCode === 'UNAUTHENTICATED') {
          // Clear stored tokens
          this.setToken(null);
          localStorage.removeItem('refresh_token');

          // Redirect to login page
          window.location.href = '/login';
          return {
            success: false,
            error: {
              code: errorCode,
              message: errorMessage,
              details: data,
            },
          };
        }

        // Show toast for other API errors
        toast.error(`${errorMessage}`, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });

        return {
          success: false,
          error: {
            code: errorCode,
            message: errorMessage,
            details: data,
          },
        };
      }
      if (data.success == false && data.data.enforce_2fa) {
        localStorage.setItem('enforce_2fa', 'yes');
      } else {
        localStorage.setItem('enforce_2fa', 'no');
      }
      // Show success toast if there's a success message
      if (data.message) {
        toast.success(data.message, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      // Show toast for network errors
      toast.error('Unable to connect to the server. Please check your internet connection.', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });

      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Network error occurred',
          details: error,
        },
      };
    }
  }



  // Authentication methods
  async login(email: string, password: string, otp: string, rememberMe: boolean = false,): Promise<ApiResponse<LoginResponse>> {
    const response = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, remember_me: rememberMe, otp }),
    });

    if (response.success && response.data) {
      this.setToken(response.data.token);
      localStorage.setItem('refresh_token', response.data.refresh_token);
    }

    return response;
  }

  async refreshToken(): Promise<ApiResponse<RefreshResponse>> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) {
      return { success: false, error: { code: 'NO_REFRESH_TOKEN', message: 'No refresh token available' } };
    }

    const response = await this.request<RefreshResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (response.success && response.data) {
      this.setToken(response.data.token);
      localStorage.setItem('refresh_token', response.data.refresh_token);
    }

    return response;
  }

  async logout() {
    const response = await this.request('/auth/logout', {
      method: 'POST',
    });

    this.setToken(null);
    localStorage.removeItem('refresh_token');

    return response;
  }

  async getProfile(): Promise<ApiResponse<ProfileResponse>> {
    return this.request<ProfileResponse>('/auth/profile');
  }

  // API Key methods
  async getApiKey(merchantId?: string) {
    const endpoint = merchantId ? `/auth/api-key?merchant_id=${encodeURIComponent(merchantId)}` : '/auth/api-key';
    return this.get(endpoint);
  }

  async generateApiKey(merchantId?: string) {
    const endpoint = merchantId ? `/auth/api-key?merchant_id=${encodeURIComponent(merchantId)}` : '/auth/api-key';
    return this.post(endpoint);
  }

  // Transaction methods
  async getTransaction(id: string) {
    return this.get(`/transactions/${id}`);
  }


  // Provider Transaction methods
  async getProviderTransaction(params?: Record<string, any>) {
    return this.get('/provider/transaction', params);
  }

  // Generic CRUD methods
  async get<T>(endpoint: string, params?: Record<string, any>) {
    const url = params ? `${endpoint}?${new URLSearchParams(params)}` : endpoint;
    return this.request<T>(url);
  }

  async post<T>(endpoint: string, data?: any) {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put<T>(endpoint: string, data?: any) {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete<T>(endpoint: string) {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }

  // Merchant management methods
  async getMerchants(params?: Record<string, any>) {
    return this.get('/merchants', params);
  }

  async createMerchant(data: any) {
    return this.post('/merchants', data);
  }

  async updateMerchant(id: string, data: any) {
    return this.put(`/merchants/${id}`, data);
  }

  async deleteMerchant(id: string) {
    return this.delete(`/merchants/${id}`);
  }

  async updateMerchantStatus(id: string, status: string) {
    return this.put(`/merchants/${id}/status`, { status });
  }

  async getMerchantApiKey(merchantId: string) {
    return this.get(`/merchant/key?merchant_id=${encodeURIComponent(merchantId)}`);
  }

  // Partner management methods
  async getPartners(params?: Record<string, any>) {
    return this.get('/partners', params);
  }

  async getMyPartner() {
    return this.get('/partner/me');
  }

  async createPartner(data: any) {
    return this.post('/partners', data);
  }

  async updatePartner(id: string, data: any) {
    return this.put(`/partners/${id}`, data);
  }

  async deletePartner(id: string) {
    return this.delete(`/partners/${id}`);
  }

  // Partner provider methods
  async getMyProvider(params?: Record<string, any>) {
    return this.get('/partner/providers', params);
  }

  async upsertMyProvider(data: any) {
    return this.post('/partner/providers', data);
  }

  // Agent management methods
  async getAgents(params?: Record<string, any>) {
    return this.get('/agents', params);
  }

  async createAgent(data: any) {
    return this.post('/agents', data);
  }

  // Provider management methods
  async getProviders(params?: Record<string, any>) {
    return this.get('/providers', params);
  }

  async createProvider(data: any) {
    return this.post('/providers', data);
  }

  async updateProvider(id: string, data: any) {
    return this.put(`/providers/${id}`, data);
  }

  async deleteProvider(id: string) {
    return this.delete(`/providers/${id}`);
  }

  async getDashboard() {
    return this.get('/dashboard');
  }

  async exportAnalytics(params?: {
    format?: string;
    date_from?: string;
    date_to?: string;
    scope_type?: string;
    scope_id?: string;
  }) {
    return this.get('/analytics/export', params);
  }

  // Currency management methods
  async getCurrencies(params?: Record<string, any>) {
    return this.get('/currencies', params);
  }

  async createCurrency(data: any) {
    return this.post('/currencies', data);
  }

  async updateCurrency(code: string, data: any) {
    return this.put(`/currencies/${code}`, data);
  }

  async deleteCurrency(code: string) {
    return this.delete(`/currencies/${code}`);
  }


  // FX rates methods
  async getFxRates(params?: Record<string, any>) {
    return this.get('/fx/rates', params);
  }



  async refreshFxRates() {
    return this.post('/fx/rates/refresh');
  }

  async fetchExchangeRate(fromCurrency: string, toCurrency: string = 'USD') {
    // return this.get('/fx/fetch-rate', { from_currency: toCurrency, to_currency: fromCurrency });
    // 1111111
    return this.get('/fx/fetch-rate', { from_currency: fromCurrency, to_currency: toCurrency });
  }



  async convertCurrency(data: any) {
    return this.post('/fx/convert', data);
  }

  async updateFxRate(params: any) {
    return this.put(`/currency/fx/update`, params);
  }

  // 1111111
  // Settlement methods
  async createSettlement(data: any) {
    return this.post('/settlements', data);
  }




  async getSettlements(params?: Record<string, any>) {
    return this.get('/settlements', params);
  }

  async getSettlement(id: string) {
    return this.get(`/settlements/${id}`);
  }

  async updateSettlementStatus(id: string, status: string, failure_reason?: string) {
    return this.put(`/settlements/${id}/status`, { status, failure_reason });
  }



  // ================= TRANSFER METHODS =================

  async getTransfers(params?: Record<string, any>) {
    return this.get('/transfers', params);
  }

  async getTransfer(id: string) {
    return this.get(`/transfers/${id}`);
  }

  // async bankToBank(data: string) {
  //   return this.post(`/bank-to-bank/`, data);
  // }


  // async walletToMySelf(data: string) {
  //   return this.post(`/wallet-to-walletToMySelf`, data);
  // }

  async walletToMySelf(data: { from_wallet_id: string; to_wallet_id: string; amount: number; currency: string }) {
    return this.post('/wallet-to-walletToMySelf', data);
  }

  async bankToBank(data: { from_bank_id: string; to_bank_id: string; amount: number; currency: string }) {
    return this.post('/bank-to-bank', data);
  }


  async walletToBank(data: { wallet_id: string; bank_id: string; amount: number; currency: string }) {
    return this.post('/wallet-to-bank', data);
  }
  async createTransfer(data: {
    email: string;
    amount: number;
    currency: string;
  }) {
    return this.post('/transfers', data);
  }



  // ================= REQUEST METHODS =================

  async getRequests(params?: Record<string, any>) {
    return this.get('/requests', params);
  }

  async getRequest(id: string) {
    return this.get(`/requests/${id}`);
  }

  async acceptRequest(id: number) {
    return this.post(`/requests/${id}/accept`);
  }

  async rejectRequest(id: number) {
    return this.post(`/requests/${id}/reject`);
  }

  async createRequests(data: {
    email: string;
    amount: number;
    currency: string;
  }) {
    return this.post('/requests', data);
  }










  // ================= BANK METHODS =================

  // Get all banks
  async getBanks(params?: Record<string, any>) {
    return this.get('/banks', params);
  }

  // Create bank
  async bankstore(data: {
    bankName: string;
    currency: string;
    bankBranch: string;
    bankAccoutntHolder: string;
    bankAccount: string;
  }) {
    return this.post('/banks', data);
  }













  // Reports methods
  async getReports(params?: Record<string, any>) {
    return this.get('/reports', params);
  }

  async generateReport(data: any) {
    return this.post('/reports/generate', data);
  }

  async downloadReport(id: string) {
    const url = `${this.baseURL}/reports/${id}/download`;
    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return fetch(url, { headers });
  }





  // Security methods
  async getSecurityOverview() {
    return this.get('/security/overview');
  }

  async getSecurityEvents(params?: Record<string, any>) {
    return this.get('/security/events', params);
  }

  async generate2FA() {
    return this.post('/security/2fa/generate');
  }
  async enable2FA(params?: Record<string, any>) {
    return this.post('/security/2fa/enable', params);
  }

  async disable2FA() {
    return this.post('/security/2fa/disable');
  }
  async recoveryCodes(params?: Record<string, any>) {
    return this.post('/security/recovery-codes', params);
  }
  async getSecuritySettings() {
    return this.get('/security/settings');
  }

  async updateSecuritySetting(key: string, value: any) {
    return this.put(`/security/settings/${key}`, { value });
  }

  async updateRecoveryEmail(key: string, value: any) {
    return this.put(`/security/recover-email/${key}`, { value });
  }

  async updateSMTP(data: any) {
    return this.post('/smtp/settings', data);
  }
  async settings(params?: Record<string, any>) {
    return this.get('/settings', params);
  }
  async updateTemplate(data: any) {
    return this.post('/update/template', data);
  }

  // User settings methods
  async getUserSettings() {
    return this.get('/users/settings');
  }

  async getApplicationSettings() {
    return this.get('/application/settings');
  }

  async updateUserSettings(settings: any) {
    return this.put('/users/settings', { settings });
  }

  // Profile update
  async updateProfile(data: any) {
    return this.put('/auth/profile', data);
  }



  // Change this in your ApiClient class
  async updateAppSettings(formData: FormData): Promise<ApiResponse<any>> {
    const url = `${this.baseURL}/users/settings/app`;

    const headers: Record<string, string> = {};

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMessage = data.error?.message || data.message || 'An error occurred';
        const errorCode = data.error?.code || response.status.toString();

        // Handle UNAUTHENTICATED error
        if (errorCode === 'UNAUTHENTICATED') {
          this.setToken(null);
          localStorage.removeItem('refresh_token');
          window.location.href = '/login';
          return {
            success: false,
            error: {
              code: errorCode,
              message: errorMessage,
              details: data,
            },
          };
        }

        toast.error(errorMessage, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });

        return {
          success: false,
          error: {
            code: errorCode,
            message: errorMessage,
            details: data,
          },
        };
      }

      // Show success toast
      if (data.message) {
        toast.success(data.message, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
        });
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      toast.error('Error.', {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
      });

      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Network error occurred',
          details: error,
        },
      };
    }
  }
  // Change password
  async changePassword(data: { current_password: string; new_password: string }) {
    return this.put('/auth/change-password', data);
  }

  // Delete account
  async deleteAccount() {
    return this.delete('/auth/account');
  }

  // Notification methods
  async getNotifications(params?: {
    page?: number;
    limit?: number;
    read?: boolean;
    type?: string;
  }) {
    return this.get('/notifications', params);
  }

  async markNotificationAsRead(notificationId: string) {
    return this.put(`/notifications/${notificationId}/read`);
  }

  async markAllNotificationsAsRead() {
    return this.put('/notifications/read-all');
  }

  async deleteNotification(notificationId: string) {
    return this.delete(`/notifications/${notificationId}`);
  }

  // Wallet methods
  async getWalletBalance(params?: { currency?: string }) {
    return this.get('/wallet/balance', params);
  }

  async getWallets() {
    return this.get('/wallet/wallets');
  }

  async getAvailableCurrencies() {
    return this.get('/wallet/available-currencies');
  }

  async exchangeCurrency(data: {
    from_currency: string;
    to_currency: string;
    amount: number;
    notes?: string;
  }) {
    return this.post('/wallet/exchange', data);
  }

  async topupWallet(data: { currency: string; amount: number }) {
    return this.post('/wallet/topup', data);
  }

  // Admin wallet methods (SUPER_ADMIN only)
  async getAllWallets(params?: {
    user_id?: string;
    currency?: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    return this.get('/admin/wallets', params);
  }
  async getAllWalletsByusers(params?: {
    user_id?: string;
  }) {
    return this.get('/wallets-by-user', params);
  }
  async getWalletDetails(walletId: number, params?: {
    page?: number;
    limit?: number;
    date_from?: string;
    date_to?: string;
  }) {
    return this.get(`/admin/wallets/${walletId}`, params);
  }

  // Payment methods (public - no auth required)
  async getPaymentData(txnId: string) {
    // For payment endpoints, we don't need auth token
    const url = `${this.baseURL}/payment/${txnId}`;
    try {
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMessage = data.error?.message || data.message || 'An error occurred';
        toast.error(errorMessage);
        return {
          success: false,
          error: {
            code: data.error?.code || response.status.toString(),
            message: errorMessage,
            details: data,
          },
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      toast.error('Unable to connect to the server. Please check your internet connection.');
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Network error occurred',
          details: error,
        },
      };
    }
  }

  async processPayment(txnId: string, providerAlias: string) {
    // For payment endpoints, we don't need auth token
    const url = `${this.baseURL}/payment/${txnId}/process`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider_alias: providerAlias,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMessage = data.error?.message || data.message || 'An error occurred';
        toast.error(errorMessage);
        return {
          success: false,
          error: {
            code: data.error?.code || response.status.toString(),
            message: errorMessage,
            details: data,
          },
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      toast.error('Unable to connect to the server. Please check your internet connection.');
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Network error occurred',
          details: error,
        },
      };
    }
  }

  async createPayoutRequest(data: any) {
    return this.post('/payouts', data);
  }
  async getExchanges(params?: Record<string, any>) {
    return this.get('/exchanges', params);
  }
  async getPayoutRequests(params?: Record<string, any>) {
    return this.get('/payouts', params);
  }
  async updatePayoutRequest(id: string, status: string,) {
    return this.put(`/payouts/${id}`, { status });
  }

  async createPayoutRequestBykwikwire(data: any) {
    return this.post('/payouts/by/kwikwire', data);
  }
  async getPayoutKwikwires(params?: Record<string, any>) {
    return this.get('/payouts-kwikwire', params);
  }
  async updateKwikwiresPayoutRequest(id: string, status: string,) {
    return this.put(`/payouts-kwikwire/${id}`, { status });
  }

  async getMerchant(id: string) {
    return this.get(`/merchants/${id}`);
  }

  async topupRequest(data: { userId: string; currency: string; amount: number }) {
    return this.post('/top-up/request', data);
  }
  async topupProcess(params?: Record<string, any>) {
    return this.get(`/top-up/process`, params);
  }
  async topupPayNow(data: any) {
    return this.post('/top-up/payment', data);
  }
  async getTopUpRequests(params?: Record<string, any>) {
    return this.get('/top-up/request', params);
  }
  async getPartnerTopUpRequests(params?: Record<string, any>) {
    return this.get('/partner/top-up/request', params);
  }
  async updateTopUpRequest(id: string, status: string,) {
    return this.put(`/top-up/${id}`, { status });
  }

  async getPartner(id: string) {
    return this.get(`/partners/${id}`);
  }
  async getAgent(id: string) {
    return this.get(`/agents/${id}`);
  }

  async updateProviderAdjustment(id: string, params?: Record<string, any>) {
    return this.put(`/providers/${id}/adjustment`, params);
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
export default apiClient;


