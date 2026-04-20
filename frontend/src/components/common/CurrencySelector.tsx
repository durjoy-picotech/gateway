import React from 'react';
import { demoCurrencies } from '../../data/currencyData';
import { Currency } from '../../types/currency';

interface CurrencySelectorProps {
  value: string;
  onChange: (currency: string) => void;
  enabledCurrencies?: string[];
  className?: string;
  placeholder?: string;
  showType?: boolean;
}

const CurrencySelector: React.FC<CurrencySelectorProps> = ({
  value,
  onChange,
  enabledCurrencies,
  className = '',
  placeholder = 'Select currency',
  showType = false
}) => {
  const availableCurrencies = demoCurrencies.filter(currency => 
    currency.enabled && 
    (!enabledCurrencies || enabledCurrencies.includes(currency.code))
  );

  const groupedCurrencies = availableCurrencies.reduce((groups, currency) => {
    const type = currency.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(currency);
    return groups;
  }, {} as Record<string, Currency[]>);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`}
    >
      <option value="">{placeholder}</option>
      {Object.entries(groupedCurrencies).map(([type, currencies]) => (
        <optgroup key={type} label={type.charAt(0).toUpperCase() + type.slice(1)}>
          {currencies.map(currency => (
            <option key={currency.code} value={currency.code}>
              {currency.symbol} {currency.code} - {currency.name}
              {showType && ` (${currency.type})`}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
};

export default CurrencySelector;