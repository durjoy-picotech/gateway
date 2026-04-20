import React from "react";
import { ShieldAlert, ArrowLeft, Home } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AccessDeniedPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 px-6">
      <div className="bg-white dark:bg-gray-800 shadow-2xl rounded-2xl p-10 max-w-md text-center border border-gray-200 dark:border-gray-700">
        <div className="flex justify-center mb-6">
          <div className="bg-red-100 dark:bg-red-900/40 p-4 rounded-full">
            <ShieldAlert className="text-red-500 dark:text-red-400 w-12 h-12" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          Access Denied
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          You don’t have permission to view this page.
          <br />
          Please contact your administrator if you think this is a mistake.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-all"
          >
            <ArrowLeft size={18} /> Go Back
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg shadow transition-all"
          >
            <Home size={18} /> Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default AccessDeniedPage;
