'use client';

import { useState, useEffect, useCallback } from 'react';
import { requestNotificationPermission, getNotificationPermissionStatus } from '@/lib/notifications/permission';
import { scheduleInstallmentReminders } from '@/lib/notifications/scheduler';
import { toast } from 'sonner';

interface Installment {
  id: string;
  amount_due: number;
  due_date: string;
  client_name: string;
  product_name: string;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');
  const [isScheduling, setIsScheduling] = useState(false);

  useEffect(() => {
    setPermission(getNotificationPermissionStatus());
  }, []);

  const requestPermission = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setPermission(granted ? 'granted' : 'denied');
    if (granted) {
      toast.success('Notifications enabled!');
    } else {
      toast.error('Notification permission denied');
    }
    return granted;
  }, []);

  const scheduleReminders = useCallback(async (installments: Installment[]) => {
    if (permission !== 'granted') {
      toast.error('Enable notifications first');
      return;
    }
    setIsScheduling(true);
    try {
      await scheduleInstallmentReminders(installments);
      toast.success('Payment reminders scheduled');
    } catch {
      toast.error('Failed to schedule reminders');
    } finally {
      setIsScheduling(false);
    }
  }, [permission]);

  return {
    permission,
    requestPermission,
    scheduleReminders,
    isScheduling,
    isEnabled: permission === 'granted',
  };
}