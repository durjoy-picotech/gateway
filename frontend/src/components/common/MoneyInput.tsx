import React, { useState, useEffect } from 'react';
import { parseMoneyInput, formatCurrency } from '../../utils/currency';
import CurrencySelector from './CurrencySelector';

interface MoneyInputProps {
  amount: number;
  currency: string;
  onAmountChange: (amount: number) => void;
  onCurrencyChange: (currency: string) => void;
  enabledCurrencies?: string[];
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  showCurrencySelector?: boolean;
}

const MoneyInput: React.FC<MoneyInputProps> = ({
  amount,
  currency,
  onAmountChange,
  onCurrencyChange,
  enabledCurrencies,
  className = '',
  placeholder = '0.00',
  disabled = false,
  showCurrencySelector = true
}) => {
  const [inputValue, setInputValue] = useState(amount.toString());
  const [isValid, setIsValid] = useState(true);

  useEffect(() => {
    setInputValue(amount.toString());
  }, [amount]);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);

    try {
      const parsed = parseMoneyInput(value, currency);
      setIsValid(true);
      onAmountChange(parsed);
    } catch (error) {
      setIsValid(false);
    }
  };

  const handleBlur = () => {
    if (isValid && amount) {
      const formatted = formatCurrency(amount, currency, { showSymbol: false });
      setInputValue(formatted);
    }
  };

  return (
    <div className={`flex space-x-2 ${className}`}>
      <div className="flex-1">
        <input
          type="text"
          value={inputValue}
          onChange={handleAmountChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 ${
            isValid 
              ? 'border-gray-300 dark:border-gray-600' 
              : 'border-red-300 dark:border-red-600'
          }`}
        />
        {!isValid && (
          <p className="text-red-500 text-xs mt-1">Invalid amount format</p>
        )}
      </div>
      
      {showCurrencySelector && (
        <div className="w-32">
          <CurrencySelector
            value={currency}
            onChange={onCurrencyChange}
            enabledCurrencies={enabledCurrencies}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
};

export default MoneyInput;