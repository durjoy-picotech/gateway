import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home, Building2, UserCheck, CreditCard,
  Settings, Shield, Wallet, FileText, Rotate3DIcon,
  ChevronRight, Layers, Coins, WalletCards, X, CircleDollarSign
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  roles: Array<'SUPER_ADMIN' | 'PARTNER' | 'AGENT' | 'MERCHANT'>;
}

const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <Home className="h-5 w-5" />,
    roles: ['SUPER_ADMIN', 'PARTNER', 'AGENT', 'MERCHANT']
  },
  {
    id: 'wallets',
    label: 'My Wallets',
    icon: <Wallet className="h-5 w-5" />,
    roles: ['PARTNER', 'AGENT', 'MERCHANT']
  },


  // 2222222
  {
    id: 'transfer',
    label: 'Transfer ',
    icon: <Wallet className="h-5 w-5" />,
    roles: ['SUPER_ADMIN', 'PARTNER', 'AGENT', 'MERCHANT']
  },


  {
    id: 'request',
    label: 'Request ',
    icon: <Wallet className="h-5 w-5" />,
    roles: ['SUPER_ADMIN', 'PARTNER', 'AGENT', 'MERCHANT']
  },


  {
    id: 'bank',
    label: 'Bank',
    icon: <Wallet className="h-5 w-5" />,
    roles: ['SUPER_ADMIN', 'PARTNER', 'AGENT', 'MERCHANT']
  },



  {
    id: 'transactions',
    label: 'Transactions',
    icon: <CreditCard className="h-5 w-5" />,
    roles: ['SUPER_ADMIN', 'PARTNER', 'AGENT', 'MERCHANT']
  },

  {
    id: 'pay-in',
    label: 'Pay-In',
    icon: <CircleDollarSign className="h-5 w-5" />,
    roles: ['SUPER_ADMIN', 'PARTNER', 'AGENT', 'MERCHANT']
  },
  {
    id: 'pay-out',
    label: 'Pay-Out',
    icon: <WalletCards className="h-5 w-5" />,
    roles: ['SUPER_ADMIN', 'PARTNER', 'AGENT', 'MERCHANT']
  },
  {
    id: 'pay-in-request',
    label: 'Request',
    icon: <CreditCard className="h-5 w-5" />,
    roles: ['PARTNER']
  },
  {
    id: 'exchanges',
    label: 'Exchanges',
    icon: <Rotate3DIcon className="h-5 w-5" />,
    roles: ['SUPER_ADMIN', 'PARTNER', 'AGENT', 'MERCHANT']
  },
  {
    id: 'partner-providers',
    label: 'Offline Bank',
    icon: <Layers className="h-5 w-5" />,
    roles: ['PARTNER']
  },
  {
    id: 'partners',
    label: 'Partners',
    icon: <Building2 className="h-5 w-5" />,
    roles: ['SUPER_ADMIN']
  },
  {
    id: 'agents',
    label: 'Agents',
    icon: <UserCheck className="h-5 w-5" />,
    roles: ['SUPER_ADMIN', 'PARTNER', 'AGENT']
  },
  {
    id: 'merchants',
    label: 'Merchants',
    icon: <Wallet className="h-5 w-5" />,
    roles: ['SUPER_ADMIN', 'PARTNER', 'AGENT']
  },

  {
    id: 'providers',
    label: 'Providers',
    icon: <Layers className="h-5 w-5" />,
    roles: ['SUPER_ADMIN']
  },
  {
    id: 'currencies',
    label: 'Currencies',
    icon: <Coins className="h-5 w-5" />,
    roles: ['SUPER_ADMIN']
  },
  {
    id: 'admin/wallets',
    label: 'Wallet Management',
    icon: <Wallet className="h-5 w-5" />,
    roles: ['SUPER_ADMIN']
  },
  {
    id: 'settlements',
    label: 'Settlements',
    icon: <Wallet className="h-5 w-5" />,
    roles: ['SUPER_ADMIN', 'PARTNER', 'AGENT', 'MERCHANT']
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: <FileText className="h-5 w-5" />,
    roles: ['SUPER_ADMIN', 'PARTNER', 'AGENT']
  },
  {
    id: 'security',
    label: 'Security',
    icon: <Shield className="h-5 w-5" />,
    roles: ['SUPER_ADMIN']
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <Settings className="h-5 w-5" />,
    roles: ['SUPER_ADMIN', 'PARTNER', 'AGENT', 'MERCHANT']
  }
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen = false, onClose }) => {
  const { user } = useAuth();
  const location = useLocation();

  const visibleMenuItems = menuItems.filter(item =>
    user && item.roles.includes(user.role)
  );

  const getActiveSection = () => {
    const path = location.pathname;
    if (path === '/dashboard' || path === '/') return 'dashboard';
    if (path.startsWith('/admin/wallets')) return 'admin/wallets';
    if (path === '/wallets') return 'wallets';
    return path.substring(1); // Remove leading slash to get section name
  };

  const activeSection = getActiveSection();

  const handleLinkClick = () => {
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 h-full transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Mobile Header */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white">Payment Gateway Platform</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="p-6 overflow-y-scroll h-[550px] scrollbar-hide">
          <nav className="space-y-1">
            {visibleMenuItems.map((item) => (
              <Link
                key={item.id}
                to={item.id === 'dashboard' ? '/dashboard' : `/${item.id}`}
                onClick={handleLinkClick}
                className={`
                  w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200
                  ${activeSection === item.id
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border-r-2 border-blue-500'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }
                `}
              >
                <div className="flex items-center space-x-3">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {activeSection === item.id && (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </>
  );
};

export default Sidebar;