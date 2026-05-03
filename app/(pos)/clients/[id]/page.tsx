'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getClientHistory } from '@/lib/actions/clients';
import { formatCurrency, getWhatsAppLink } from '@/lib/utils';
import { PaymentTimeline } from '@/components/PaymentTimeline';
import { User, Phone, ArrowLeft, MessageCircle, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [history, setHistory] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const clientId = params.id as string;
    if (!clientId) return;

    getClientHistory(clientId).then(({ data, error }) => {
      if (error) {
        toast.error(error);
        router.push('/ledger');
        return;
      }
      setHistory(data);
      setIsLoading(false);
    });
  }, [params.id, router]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-white/40">Loading client history...</div>
      </div>
    );
  }

  if (!history) return null;

  const { client, timeline, totalDebt, totalPaid, onTimePayments, latePayments } = history;
  const riskLevel = latePayments > onTimePayments ? 'high' : onTimePayments > latePayments * 2 ? 'low' : 'medium';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <div>
          <h1 className="text-2xl font-black uppercase tracking-tighter">CLIENT</h1>
          <p className="text-white/60 text-sm uppercase tracking-wider">Payment History</p>
        </div>
      </div>

      {/* Client Info */}
      <div className="card-tactical">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-tactical-blue/20 flex items-center justify-center">
            <User className="w-8 h-8 text-tactical-blue" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{client.full_name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Phone className="w-4 h-4 text-white/40" />
              <a
                href={`tel:${client.phone_number}`}
                className="text-sm text-white/60 hover:text-tactical-blue"
              >
                {client.phone_number}
              </a>
            </div>
          </div>
          <a
            href={getWhatsAppLink(client.phone_number, `Hi ${client.full_name}, regarding your account...`)}
            target="_blank"
            rel="noopener noreferrer"
            className="p-3 rounded-xl bg-tactical-neon/10 hover:bg-tactical-neon/20 text-tactical-neon transition-colors"
          >
            <MessageCircle className="w-6 h-6" />
          </a>
        </div>
      </div>

      {/* Risk Badge */}
      <div
        className={cn(
          'card-tactical flex items-center gap-3',
          riskLevel === 'high' && 'border-tactical-red bg-tactical-red/5',
          riskLevel === 'medium' && 'border-tactical-orange bg-tactical-orange/5',
          riskLevel === 'low' && 'border-tactical-neon bg-tactical-neon/5'
        )}
      >
        <AlertTriangle
          className={cn(
            'w-6 h-6',
            riskLevel === 'high' && 'text-tactical-red',
            riskLevel === 'medium' && 'text-tactical-orange',
            riskLevel === 'low' && 'text-tactical-neon'
          )}
        />
        <div>
          <p className="font-bold uppercase">Risk Level: {riskLevel}</p>
          <p className="text-xs text-white/60">
            {onTimePayments} on-time, {latePayments} late payments
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="card-tactical">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-tactical-neon" />
            <span className="text-xs font-bold uppercase tracking-wider text-white/60">
              Total Paid
            </span>
          </div>
          <p className="text-2xl font-black text-tactical-neon">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="card-tactical">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-tactical-orange" />
            <span className="text-xs font-bold uppercase tracking-wider text-white/60">
              Outstanding
            </span>
          </div>
          <p className="text-2xl font-black text-tactical-orange">{formatCurrency(totalDebt)}</p>
        </div>
      </div>

      {/* Timeline */}
      <div>
        <h3 className="text-sm font-bold uppercase tracking-wider text-white/60 mb-4">
          Payment Timeline
        </h3>
        <PaymentTimeline events={timeline} runningBalance={totalDebt} />
      </div>
    </div>
  );
}