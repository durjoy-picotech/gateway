import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthContextType, User } from '../types';
import apiClient from '../services/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);

  useEffect(() => {
    // Check for existing session
    const token = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('user');
    if (token && storedUser) {
      // Ensure API client has the token
      apiClient.setToken(token);
      // Set user from localStorage immediately for persistence
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (e) {
        console.error('Error parsing stored user:', e);
        localStorage.removeItem('user');
        localStorage.removeItem('auth_token');
        setUser(null);
        setLoading(false);
        return;
      }

      // Try to get updated user profile (but don't clear auth if it fails)
      apiClient.getProfile().then(response => {
        if (response.success && response.data) {
          // Backend returns user data directly in response.data, not response.data.user
          setUser(response.data);
          localStorage.setItem('user', JSON.stringify(response.data));
        } else {
          console.log('Profile API returned error, but keeping user logged in locally');
        }
      }).catch((error) => {
        console.error('Profile fetch error:', error);
        // Don't clear auth on network errors - user stays logged in
      }).finally(() => {
        setLoading(false);
      });
    } else {
      // No token or no stored user, clear everything
      localStorage.removeItem('user');
      localStorage.removeItem('auth_token');
      setUser(null);
      setLoading(false);
    }
  }, []);

  const login = async (email: string, password: string,otp: string) => {
    setLoginLoading(true);
    try {
      const response = await apiClient.login(email, password, otp);
      if (response.success && response.data) {
        if (response.data && response.data.two_factor_enabled) {
          return { data: response.data };
        }
        setUser(response.data.user);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        return;
      } else {
        throw new Error(response.error?.message || 'Login failed');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = async () => {
    try {
      await apiClient.logout();
    } catch (error) {
      // Even if logout fails, clear local state
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('user');
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, loginLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};