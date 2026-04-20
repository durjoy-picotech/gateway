import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { AppSettingsProvider } from './contexts/AppSettingsContext'
import { PrecisionProvider } from './contexts/PrecisionContext';
import ProtectedRoute from './components/common/ProtectedRoute';
import LoginPage from './components/pages/LoginPage';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';
import Dashboard from './components/pages/Dashboard';
import TransactionsPage from './components/pages/TransactionsPage';
import TransactionDetailsPage from './components/pages/TransactionDetailsPage';
import PartnersPage from './components/pages/PartnersPage';
import AgentsPage from './components/pages/AgentsPage';
import MerchantsPage from './components/pages/MerchantsPage';
import ProvidersPage from './components/pages/ProvidersPage';
import ProviderDetailsPage from './components/pages/ProviderDetailsPage';
import CurrencyManagementPage from './components/pages/CurrencyManagementPage';
import SettlementsPage from './components/pages/SettlementsPage';
import SecurityPage from './components/pages/SecurityPage';
import SettingsPage from './components/pages/SettingsPage';
import NotificationsPage from './components/pages/NotificationsPage';
import NotificationDetailsPage from './components/pages/NotificationDetailsPage';
import PaymentSuccessPage from './components/pages/PaymentSuccessPage';
import WalletsManagementPage from './components/pages/WalletsManagementPage';
import WalletDetailsPage from './components/pages/WalletDetailsPage';
import UserWalletsPage from './components/pages/UserWalletsPage';
import TopUpPage from './components/pages/TopUpPage';
import HasPermissionRoute from './contexts/HasPermissionRoute';
import RevenuePage from './components/pages/RevenuePage';
import PayINPageList from './components/pages/PayINPageList';
import PayOutPageList from './components/pages/PayOutPageList';
import PayINRequestPage from './components/pages/PayINRequestPage';
import ExchangePage from './components/pages/ExchangePage';
import PartnerProvidersPage from './components/pages/PartnerProvidersPage';
import Transfer from './components/pages/Transfer';
import Request from './components/pages/Request';
import BankPage from './components/pages/BankPage';
const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const toggleMobileSidebar = () => {
    setIsMobileSidebarOpen(!isMobileSidebarOpen);
  };

  const closeMobileSidebar = () => {
    setIsMobileSidebarOpen(false);
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      <Navbar onMenuToggle={toggleMobileSidebar} />
      <div className="flex-1 flex overflow-hidden">
        {/* Mobile Sidebar - only render when open */}
        {isMobileSidebarOpen && (
          <Sidebar isOpen={true} onClose={closeMobileSidebar} />
        )}
        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <Sidebar />
        </div>
        <main className="flex-1 overflow-auto">
          <div className="p-4 lg:p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

const AppContent: React.FC = () => {
  const { user, loading } = useAuth();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public payment routes */}
      <Route path="/top-up" element={<TopUpPage />} />
      <Route path="/payment/:txnId/success" element={<PaymentSuccessPage />} />

      <Route
        path="/login"
        element={user ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['SUPER_ADMIN', 'PARTNER', 'AGENT', 'MERCHANT']}>
              <DashboardLayout>
                <Dashboard />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pay-in"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['SUPER_ADMIN', 'PARTNER', 'AGENT', 'MERCHANT']}>
              <DashboardLayout>
                <PayINPageList />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />

      {/* 2222222 */}
      <Route
        path="/transfer"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['SUPER_ADMIN', 'PARTNER', 'AGENT', 'MERCHANT']}>
              <DashboardLayout>
                <Transfer />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />


      <Route
        path="/request"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['SUPER_ADMIN', 'PARTNER', 'AGENT', 'MERCHANT']}>
              <DashboardLayout>
                <Request />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/bank"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['SUPER_ADMIN', 'PARTNER', 'AGENT', 'MERCHANT']}>
              <DashboardLayout>
                <BankPage />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />




      <Route
        path="/pay-out"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['SUPER_ADMIN', 'PARTNER', 'AGENT', 'MERCHANT']}>
              <DashboardLayout>
                <PayOutPageList />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/pay-in-request"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['PARTNER']}>
              <DashboardLayout>
                <PayINRequestPage />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/exchanges"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['SUPER_ADMIN', 'PARTNER', 'AGENT', 'MERCHANT']}>
              <DashboardLayout>
                <ExchangePage />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/partner-providers"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['PARTNER']}>
              <DashboardLayout>
                <PartnerProvidersPage />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/transactions"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['SUPER_ADMIN', 'PARTNER', 'AGENT', 'MERCHANT']}>
              <DashboardLayout>
                <TransactionsPage />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/transactions/:id"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['SUPER_ADMIN', 'PARTNER', 'AGENT', 'MERCHANT']}>
              <DashboardLayout>
                <TransactionDetailsPage />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/partners"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['SUPER_ADMIN']}>
              <DashboardLayout>
                <PartnersPage />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/agents"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['SUPER_ADMIN', 'PARTNER', 'AGENT']}>
              <DashboardLayout>
                <AgentsPage />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/merchants"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['SUPER_ADMIN', 'PARTNER', 'AGENT']}>
              <DashboardLayout>
                <MerchantsPage />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/providers"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['SUPER_ADMIN']}>
              <DashboardLayout>
                <ProvidersPage />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/providers/:providerId"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['SUPER_ADMIN']}>
              <DashboardLayout>
                <ProviderDetailsPage />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/currencies"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['SUPER_ADMIN']}>
              <DashboardLayout>
                <CurrencyManagementPage />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/wallets"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['PARTNER', 'AGENT', 'MERCHANT']}>
              <DashboardLayout>
                <UserWalletsPage />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/wallets"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['SUPER_ADMIN']}>
              <DashboardLayout>
                <WalletsManagementPage />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/wallets/:walletId"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['SUPER_ADMIN']}>
              <DashboardLayout>
                <WalletDetailsPage />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settlements"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['SUPER_ADMIN', 'PARTNER', 'AGENT', 'MERCHANT']}>
              <DashboardLayout>
                <SettlementsPage />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['SUPER_ADMIN', 'PARTNER', 'AGENT']}>
              <DashboardLayout>
                <RevenuePage />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/security"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['SUPER_ADMIN']}>
              <DashboardLayout>
                <SecurityPage />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['SUPER_ADMIN']}>
              <DashboardLayout>
                <NotificationsPage />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications/:id"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['SUPER_ADMIN']}>
              <DashboardLayout>
                <NotificationDetailsPage />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <HasPermissionRoute roles={['SUPER_ADMIN', 'PARTNER', 'AGENT', 'MERCHANT']}>
              <DashboardLayout>
                <SettingsPage />
              </DashboardLayout>
            </HasPermissionRoute>
          </ProtectedRoute>
        }
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

function App() {
  return (
    <ThemeProvider>
      <AppSettingsProvider>
        <AuthProvider>
          <PrecisionProvider>
            <AppContent />
          </PrecisionProvider>
        </AuthProvider>
        <ToastContainer
          position="top-right"
          autoClose={5000}
          hideProgressBar={false}
          newestOnTop={false}
          closeOnClick
          rtl={false}
          pauseOnFocusLoss
          draggable
          pauseOnHover
          theme="colored"
        />
      </AppSettingsProvider>
    </ThemeProvider>
  );
}

export default App;