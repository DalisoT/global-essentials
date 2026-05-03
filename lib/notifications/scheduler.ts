interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  url: string;
  scheduledTime: Date;
}

export async function scheduleInstallmentReminders(
  installments: Array<{
    id: string;
    amount_due: number;
    due_date: string;
    client_name: string;
    product_name: string;
  }>
): Promise<void> {
  const now = new Date();
  const notifications: ScheduledNotification[] = [];

  for (const installment of installments) {
    const dueDate = new Date(installment.due_date);
    const clientName = installment.client_name;
    const amount = installment.amount_due;

    // 1 day before at 9:00 AM
    const oneDayBefore = new Date(dueDate);
    oneDayBefore.setDate(oneDayBefore.getDate() - 1);
    oneDayBefore.setHours(9, 0, 0, 0);

    if (oneDayBefore > now) {
      notifications.push({
        id: `${installment.id}-1d`,
        title: 'Payment Reminder',
        body: `Hi ${clientName}, payment of K${amount} is due tomorrow for ${installment.product_name}.`,
        url: `/debts?highlight=${installment.id}`,
        scheduledTime: oneDayBefore,
      });
    }

    // On due date at 9:00 AM
    const onDueDate = new Date(dueDate);
    onDueDate.setHours(9, 0, 0, 0);

    if (onDueDate > now) {
      notifications.push({
        id: `${installment.id}-due`,
        title: 'Payment Due Today',
        body: `Hi ${clientName}, payment of K${amount} is due today for ${installment.product_name}.`,
        url: `/debts?highlight=${installment.id}`,
        scheduledTime: onDueDate,
      });
    }

    // 3 days overdue at 9:00 AM
    const threeDaysOverdue = new Date(dueDate);
    threeDaysOverdue.setDate(threeDaysOverdue.getDate() + 3);
    threeDaysOverdue.setHours(9, 0, 0, 0);

    if (threeDaysOverdue > now) {
      notifications.push({
        id: `${installment.id}-3d`,
        title: 'Overdue Payment',
        body: `Hi ${clientName}, payment of K${amount} is 3 days overdue for ${installment.product_name}. Please arrange payment.`,
        url: `/debts?highlight=${installment.id}`,
        scheduledTime: threeDaysOverdue,
      });
    }
  }

  // Store scheduled notifications in localStorage
  // The service worker will check these and show notifications
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('ge-scheduled-notifications', JSON.stringify(notifications));
  }
}

export async function clearScheduledNotifications(): Promise<void> {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('ge-scheduled-notifications');
  }
}

export function getScheduledNotifications(): ScheduledNotification[] {
  if (typeof localStorage === 'undefined') return [];
  const stored = localStorage.getItem('ge-scheduled-notifications');
  return stored ? JSON.parse(stored) : [];
}