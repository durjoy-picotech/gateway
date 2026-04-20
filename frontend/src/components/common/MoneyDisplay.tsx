import React from 'react';
import { formatCurrency } from '../../utils/currency';
import { useAuth } from '../../contexts/AuthContext';
import { usePrecision } from '../../contexts/PrecisionContext';

interface MoneyDisplayProps {
  amount: number;
  currency: string;
  className?: string;
  showSymbol?: boolean;
  showCode?: boolean;
  precision?: number;
  colorize?: boolean;
}

const MoneyDisplay: React.FC<MoneyDisplayProps> = ({
  amount,
  currency,
  className = '',
  showSymbol = true,
  showCode = false,
  precision,
  colorize = false
}) => {
  const { user } = useAuth();
  const { precisionMode } = usePrecision();

  // Convert amount to number if it's a string (from API)
  const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;

  // Handle invalid amounts
  if (isNaN(numericAmount)) {
    return (
      <span className={`font-medium text-gray-500 ${className}`}>
        Invalid Amount
      </span>
    );
  }

  // Handle missing currency
  if (!currency) {
    return (
      <span className={`font-medium text-gray-500 ${className}`}>
        {numericAmount.toFixed(2)}
      </span>
    );
  }

  // SUPER_ADMIN can see full precision, others see display precision
  const displayPrecision = precision ?? (
    user?.role === 'SUPER_ADMIN' && precisionMode === 'FULL' ? 6 : 2
  );

  const formatted = formatCurrency(numericAmount, currency, {
    precision: displayPrecision,
    showSymbol,
    showCode
  });

  const getColorClass = () => {
    if (!colorize) return '';
    if (numericAmount > 0) return 'text-green-600 dark:text-green-400';
    if (numericAmount < 0) return 'text-red-600 dark:text-red-400';
    return 'text-gray-600 dark:text-gray-400';
  };

  return (
    <span className={`font-medium ${getColorClass()} ${className}`}>
      {formatted}
      {user?.role === 'SUPER_ADMIN' && precisionMode === 'FULL' && (
        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
          (Raw: {numericAmount.toFixed(6)})
        </span>
      )}
    </span>
  );
};

export default MoneyDisplay;