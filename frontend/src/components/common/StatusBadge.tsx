import React from 'react';

interface StatusBadgeProps {
  status: string;
  type?: 'default' | 'transaction' | 'kyb' | 'user';
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, type = 'default' }) => {
  const getStatusStyles = () => {
    const baseClasses = 'px-[10px] py-0 text-[11px] font-medium rounded-full';
    
    switch (type) {
      case 'transaction':
        switch (status.toUpperCase()) {
          case 'SUCCESS':
            return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`;
          case 'PENDING':
            return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200`;
          case 'FAILED':
            return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`;
          case 'CANCELLED':
            return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200`;
          default:
            return `${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200`;
        }
        
      case 'kyb':
        switch (status.toUpperCase()) {
          case 'APPROVED':
            return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`;
          case 'PENDING':
            return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200`;
          case 'REJECTED':
            return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`;
          default:
            return `${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200`;
        }
        
      case 'user':
        switch (status.toUpperCase()) {
          case 'ACTIVE':
            return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`;
          case 'INACTIVE':
            return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200`;
          case 'SUSPENDED':
            return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`;
          case 'PENDING_KYB':
            return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200`;
          default:
            return `${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200`;
        }
        
      default:
        switch (status.toUpperCase()) {
          case 'ACTIVE':
          case 'SUCCESS':
          case 'APPROVED':
            return `${baseClasses} bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200`;
          case 'INACTIVE':
          case 'CANCELLED':
            return `${baseClasses} bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200`;
          case 'SUSPENDED':
          case 'FAILED':
          case 'REJECTED':
            return `${baseClasses} bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200`;
          case 'PENDING':
          case 'PENDING_KYB':
            return `${baseClasses} bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200`;
          default:
            return `${baseClasses} bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200`;
        }
    }
  };

  return (
    <span className={getStatusStyles()}>
      {status.replace('_', ' ')}
    </span>
  );
};

export default StatusBadge;