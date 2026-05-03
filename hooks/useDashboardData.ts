'use client';

import { useEffect, useState } from 'react';
import { getDashboardStats } from '@/lib/actions/dashboard';

interface DashboardData {
  groundTruth: number;
  inPipeline: number;
  lowStockProducts: Array<{ id: string; name: string; stock_level: number }>;
  recentSales: Array<{
    id: string;
    total_amount: number;
    created_at: string;
    product: { name: string };
    client: { full_name: string };
  }>;
  upcomingInstallments: Array<{
    id: string;
    amount_due: number;
    due_date: string;
  }>;
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const result = await getDashboardStats();
        if (result.error) {
          setError(result.error);
        } else {
          setData(result.data as DashboardData);
        }
      } catch (e) {
        setError('Failed to load dashboard data');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  return { data, isLoading, error };
}