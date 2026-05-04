import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CURRENCY_LOCALE, CURRENCY_SYMBOL, LOW_STOCK_THRESHOLD, MIN_INSTALLMENT_MONTHS, MAX_INSTALLMENT_MONTHS } from './config';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number): string {
  return CURRENCY_SYMBOL + new Intl.NumberFormat(CURRENCY_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function formatDateShort(date: string | Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export function isOverdue(dueDate: string): boolean {
  return new Date(dueDate) < new Date();
}

export function getWhatsAppLink(phone: string, message: string): string {
  const formattedPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
}

export function getInventoryAlertThreshold(): number {
  return LOW_STOCK_THRESHOLD;
}

export function calculateInstallmentAmount(
  totalAmount: number,
  duration: number
): { upfront: number; monthly: number } {
  const upfront = Math.ceil(totalAmount / duration);
  const monthly = Math.floor(totalAmount / duration);
  return { upfront, monthly };
}
