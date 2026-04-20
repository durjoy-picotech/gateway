import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '../services/api';

interface AppSettings {
  app_name?: string;
  app_logo?: string;
  favicon?: string;
  [key: string]: any;
}

interface AppSettingsContextType {
  appSettings: AppSettings;
  refreshAppSettings: () => Promise<void>;
}

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export const AppSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [appSettings, setAppSettings] = useState<AppSettings>({});

const fetchApplicationData = async () => {
  try {
    const response = await apiClient.getApplicationSettings();
    const settingsArray = response?.data?.settings ?? []; // use response.data.settings
    const firstSetting = settingsArray[0] ?? {};
    const appSettingsData = firstSetting?.settings?.appSettings ?? {};
    setAppSettings(appSettingsData);
  } catch (error) {
    console.error('Failed to fetch Application Settings:', error);
  }
};



  useEffect(() => {
    fetchApplicationData();
  }, []);

  return (
    <AppSettingsContext.Provider value={{ appSettings, refreshAppSettings: fetchApplicationData }}>
      {children}
    </AppSettingsContext.Provider>
  );
};

export const useAppSettings = (): AppSettingsContextType => {
  const context = useContext(AppSettingsContext);
  if (!context) throw new Error('useAppSettings must be used within an AppSettingsProvider');
  return context;
};
