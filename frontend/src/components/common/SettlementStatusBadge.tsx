import React from 'react';
import { Clock, CheckCircle, AlertTriangle, XCircle, Loader } from 'lucide-react';

interface SettlementStatusBadgeProps {
  status: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const SettlementStatusBadge: React.FC<SettlementStatusBadgeProps> = ({ 
  status, 
  showIcon = true, 
  size = 'md' 
}) => {
  const getStatusConfig = () => {
    switch (status.toUpperCase()) {
      case 'COMPLETED':
        return {
          icon: CheckCircle,
          bg: 'bg-green-100 dark:bg-green-900',
          text: 'text-green-800 dark:text-green-200',
          iconColor: 'text-green-500'
        };
      case 'PROCESSING':
        return {
          icon: Loader,
          bg: 'bg-blue-100 dark:bg-blue-900',
          text: 'text-blue-800 dark:text-blue-200',
          iconColor: 'text-blue-500'
        };
      case 'PENDING':
        return {
          icon: Clock,
          bg: 'bg-yellow-100 dark:bg-yellow-900',
          text: 'text-yellow-800 dark:text-yellow-200',
          iconColor: 'text-yellow-500'
        };
      case 'FAILED':
        return {
          icon: XCircle,
          bg: 'bg-red-100 dark:bg-red-900',
          text: 'text-red-800 dark:text-red-200',
          iconColor: 'text-red-500'
        };
      case 'CANCELLED':
        return {
          icon: XCircle,
          bg: 'bg-gray-100 dark:bg-gray-900',
          text: 'text-gray-800 dark:text-gray-200',
          iconColor: 'text-gray-500'
        };
      default:
        return {
          icon: AlertTriangle,
          bg: 'bg-gray-100 dark:bg-gray-900',
          text: 'text-gray-800 dark:text-gray-200',
          iconColor: 'text-gray-500'
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  return (
    <span className={`inline-flex items-center space-x-1 font-medium rounded-full ${config.bg} ${config.text} ${sizeClasses[size]}`}>
      {showIcon && <Icon className={`${iconSizes[size]} ${config.iconColor}`} />}
      <span>{status.replace('_', ' ')}</span>
    </span>
  );
};

export default SettlementStatusBadge;