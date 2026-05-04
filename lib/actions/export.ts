'use server';

import type { Sale, Expense, Installment } from '@/lib/supabase-types';

interface DebtWithRelations {
  amount_due: number;
  due_date: string;
  sale?: Sale & { product?: { name: string }; client?: { full_name: string } };
}

export function generateSalesCSV(sales: (Sale & { product?: { name: string }; client?: { full_name: string } })[]): string {
  const headers = ['Date', 'Product', 'Client', 'Amount', 'Payment Status', 'Payment Method'];
  const rows = sales.map((sale) => [
    new Date(sale.created_at).toLocaleDateString(),
    sale.product?.name || 'N/A',
    sale.client?.full_name || 'N/A',
    sale.total_amount.toFixed(2),
    sale.payment_status,
    sale.payment_method,
  ]);

  return [headers, ...rows].map((row) => row.join(',')).join('\n');
}

export function generateExpensesCSV(expenses: Expense[]): string {
  const headers = ['Date', 'Description', 'Category', 'Amount'];
  const rows = expenses.map((exp) => [
    new Date(exp.created_at).toLocaleDateString(),
    `"${exp.description}"`,
    exp.category,
    exp.amount.toFixed(2),
  ]);

  return [headers, ...rows].map((row) => row.join(',')).join('\n');
}

export function generateDebtsCSV(debts: DebtWithRelations[]): string {
  const headers = ['Client', 'Product', 'Amount Due', 'Due Date', 'Status'];
  const rows = debts.map((debt) => [
    debt.sale?.client?.full_name || 'N/A',
    debt.sale?.product?.name || 'N/A',
    debt.amount_due.toFixed(2),
    new Date(debt.due_date).toLocaleDateString(),
    isOverdue(debt.due_date) ? 'Overdue' : 'Upcoming',
  ]);

  return [headers, ...rows].map((row) => row.join(',')).join('\n');
}

function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date();
}