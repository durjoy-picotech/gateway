import React, { createContext, useContext, useState, useEffect } from 'react';
import { PrecisionMode, Currency } from '../types/currency';
import { CurrencyFormatter } from '../utils/currency';
import { demoCurrencies } from '../data/currencyData';
import apiClient from '../services/api';
import { useAuth } from './AuthContext';

interface PrecisionContextType {
  precisionMode: PrecisionMode;
  togglePrecisionMode: () => void;
}

const PrecisionContext = createContext<PrecisionContextType | undefined>(undefined);

export const PrecisionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [precisionMode, setPrecisionMode] = useState<PrecisionMode>('DISPLAY');

  useEffect(() => {
    const initializeCurrencies = async () => {
      // Initialize with demo currencies first
      CurrencyFormatter.setCurrencies(demoCurrencies);
      CurrencyFormatter.setPrecisionMode(precisionMode);

      // Only fetch from API if authenticated
      if (user) {
        try {
          // Try to fetch currencies from API
          const response = await apiClient.getCurrencies();
          if (response.success && response.data && (response.data as any).currencies) {
            CurrencyFormatter.setCurrencies((response.data as any).currencies as Currency[]);
          }
        } catch (error) {
          // Keep demo currencies if API fails
          console.log('Using demo currencies due to API error');
        }
      }
    };

    initializeCurrencies();
  }, [precisionMode, user]);

  const togglePrecisionMode = () => {
    const newMode = precisionMode === 'DISPLAY' ? 'FULL' : 'DISPLAY';
    setPrecisionMode(newMode);
    CurrencyFormatter.setPrecisionMode(newMode);
  };

  return (
    <PrecisionContext.Provider value={{ precisionMode, togglePrecisionMode }}>
      {children}
    </PrecisionContext.Provider>
  );
};

export const usePrecision = () => {
  const context = useContext(PrecisionContext);
  if (context === undefined) {
    throw new Error('usePrecision must be used within a PrecisionProvider');
  }
  return context;
};