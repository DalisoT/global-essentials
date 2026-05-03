'use client';

import { CheckCircle, Clock, ShoppingCart } from 'lucide-react';
import { formatCurrency, formatDate, isOverdue } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface TimelineEvent {
  id: string;
  type: 'sale' | 'payment';
  date: string;
  productName?: string;
  amount: number;
  isPaid?: boolean;
  dueDate?: string;
}

interface PaymentTimelineProps {
  events: TimelineEvent[];
  runningBalance?: number;
}

function getBalanceLabel(balance: number): string {
  if (balance > 0) return ' owed';
  if (balance < 0) return ' credit';
  return '';
}

function getBalanceColor(balance: number): string {
  if (balance > 0) return 'text-tactical-orange';
  if (balance < 0) return 'text-tactical-neon';
  return 'text-white/60';
}

export function PaymentTimeline({ events, runningBalance = 0 }: PaymentTimelineProps) {
  let balance = runningBalance;

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-white/10" />

      <div className="space-y-4">
        {events.map((event) => {
          const isSale = event.type === 'sale';
          const eventOverdue = event.dueDate && isOverdue(event.dueDate);

          if (!isSale) {
            balance = event.isPaid ? balance - event.amount : balance + event.amount;
          }

          const eventDate = formatDate(event.date);
          const eventDueDate = event.dueDate ? formatDate(event.dueDate) : null;
          const overdueDays = event.dueDate && eventOverdue && !event.isPaid
            ? Math.ceil((Date.now() - new Date(event.dueDate).getTime()) / (1000 * 60 * 60 * 24))
            : 0;

          return (
            <div key={event.id} className="relative flex items-start gap-4">
              {/* Icon */}
              <div
                className={cn(
                  'relative z-10 w-12 h-12 rounded-full flex items-center justify-center',
                  isSale
                    ? 'bg-tactical-blue/20 border-2 border-tactical-blue'
                    : event.isPaid
                    ? 'bg-tactical-neon/20 border-2 border-tactical-neon'
                    : eventOverdue
                    ? 'bg-tactical-red/20 border-2 border-tactical-red'
                    : 'bg-tactical-orange/20 border-2 border-tactical-orange'
                )}
              >
                {isSale ? (
                  <ShoppingCart className="w-5 h-5 text-tactical-blue" />
                ) : event.isPaid ? (
                  <CheckCircle className="w-5 h-5 text-tactical-neon" />
                ) : (
                  <Clock className={cn('w-5 h-5', eventOverdue ? 'text-tactical-red' : 'text-tactical-orange')} />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 pt-1">
                <div className="flex items-center justify-between">
                  <p className="font-bold text-white">
                    {isSale
                      ? `Purchased: ${event.productName}`
                      : event.isPaid
                      ? 'Payment Received'
                      : eventOverdue
                      ? 'Payment Overdue'
                      : 'Installment Due'}
                  </p>
                  <span
                    className={cn(
                      'text-sm font-semibold',
                      isSale
                        ? 'text-white'
                        : event.isPaid
                        ? 'text-tactical-neon'
                        : eventOverdue
                        ? 'text-tactical-red'
                        : 'text-tactical-orange'
                    )}
                  >
                    {formatCurrency(event.amount)}
                  </span>
                </div>
                <p className="text-xs text-white/40 mt-1">{eventDate}</p>
                {!isSale && eventDueDate && (
                  <p className="text-xs text-white/30 mt-0.5">
                    Due: {eventDueDate}
                    {event.isPaid
                      ? ' • Paid'
                      : eventOverdue
                      ? ` • Overdue by ${overdueDays} days`
                      : ' • Pending'}
                  </p>
                )}
                {!isSale && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xs text-white/40">Balance:</span>
                    <span className={cn('text-sm font-bold', getBalanceColor(balance))}>
                      {formatCurrency(Math.abs(balance))}
                      {getBalanceLabel(balance)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}