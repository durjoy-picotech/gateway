import React from 'react';
import {
  TrendingUp,
  Users,
  CreditCard,
  DollarSign,
} from 'lucide-react';

interface Stat {
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down';
}

interface DashboardStatsTwoProps {
  stats: Stat[];
}
import { useAuth } from '../../contexts/AuthContext';

const DashboardStatsTwo: React.FC<DashboardStatsTwoProps> = ({ stats }) => {
    const { user } = useAuth();
  
  const getIconForTitle = (title: string) => {
    if (title.includes('Revenue') || title.includes('Commission') || title.includes('Order Value')) {
      return <DollarSign className="h-6 w-6 text-green-600" />;
    }
    if (title.includes('Partners') || title.includes('Agents') || title.includes('Merchants')) {
      return <Users className="h-6 w-6 text-blue-600" />;
    }
    if (title.includes('Transactions') || title.includes('Orders')) {
      return <CreditCard className="h-6 w-6 text-purple-600" />;
    }
    if (title.includes('Success Rate')) {
      return <TrendingUp className="h-6 w-6 text-emerald-600" />;
    }
    return <TrendingUp className="h-6 w-6 text-gray-600" />;
  };
  const filteredStats = user?.role === 'AGENT'
    ? stats.filter((stat) => !stat.title.includes('Success Rate'))
    : stats;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-6 mb-8">
      {filteredStats.map((stat, index) => (
        <div key={index} className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                {stat.title}
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stat.value}
              </p>
            </div>
            <div className="flex-shrink-0">
              {getIconForTitle(stat.title)}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DashboardStatsTwo;