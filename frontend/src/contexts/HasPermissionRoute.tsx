import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import AccessDeniedPage from '../components/pages/AccessDeniedPage';
interface HasPermissionRouteProps {
  roles: string[]; // allowed roles
  children: React.ReactNode;
}

const HasPermissionRoute: React.FC<HasPermissionRouteProps> = ({ roles, children }) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const enforce_2fa = localStorage.getItem('enforce_2fa');

  useEffect(() => {
    if (!loading && user && user.two_factor_enabled === false && enforce_2fa === 'yes') {
      if (user.role === 'SUPER_ADMIN') {
        navigate('/security?tab=authentication', { replace: true });
      } else {
        navigate('/settings?tab=security', { replace: true });
      }
    }
  }, [user, loading, navigate,enforce_2fa]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Check if user has an allowed role
  if (user && !roles.includes(user.role)) {
    return <AccessDeniedPage />;
  }

  return <>{children}</>;
};

export default HasPermissionRoute;
