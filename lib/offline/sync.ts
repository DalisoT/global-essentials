import { saveOfflineSale, getPendingSales, markSaleSynced } from './db';
import type { OfflineSale } from './db';

export async function queueSale(saleData: {
  items: Array<{ product_id: string; quantity: number }>;
  client_id: string;
  payment_method: 'cash' | 'pay-slow';
  installment_duration?: number;
  installments?: Array<{ amount_due: number; due_date: string }>;
}): Promise<string> {
  const id = crypto.randomUUID();
  const sale: OfflineSale = {
    id,
    synced: false as unknown as number,
    created_at: new Date().toISOString(),
    data: saleData,
  };
  await saveOfflineSale(sale);
  return id;
}

export async function syncPendingSales(
  createSaleAction: (data: {
    items: Array<{ product_id: string; quantity: number }>;
    client_id: string;
    payment_method: 'cash' | 'pay-slow';
    installment_duration?: number;
    installments?: Array<{ amount_due: number; due_date: string }>;
  }) => Promise<{ error?: string | null }>
): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingSales();
  let synced = 0;
  let failed = 0;

  for (const sale of pending) {
    try {
      // Support both new multi-item format and legacy single-item format
      const saleData = sale.data;
      const actionData = {
        items: saleData.items ?? (saleData.product_id ? [{ product_id: saleData.product_id, quantity: 1 }] : []),
        client_id: saleData.client_id,
        payment_method: saleData.payment_method,
        installment_duration: saleData.installment_duration,
        installments: saleData.installments,
      };
      if (actionData.items.length === 0) {
        failed++;
        continue;
      }
      const result = await createSaleAction(actionData);
      if (result.error) {
        failed++;
      } else {
        await markSaleSynced(sale.id);
        synced++;
      }
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}

export async function getPendingCount(): Promise<number> {
  const pending = await getPendingSales();
  return pending.length;
}