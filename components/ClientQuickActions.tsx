'use client';

import { cn } from '@/lib/utils';
import { getWhatsAppLink } from '@/lib/utils';
import { Phone, MessageCircle, Mail, X } from 'lucide-react';

interface ClientQuickActionsProps {
  client: { full_name: string; phone_number?: string | null } | null | undefined;
  saleId?: string;
  saleAmount?: number;
  onClose: () => void;
}

export function ClientQuickActions({ client, saleId, saleAmount, onClose }: ClientQuickActionsProps) {
  const phone = client?.phone_number;
  if (!phone) return null;

  const message = saleAmount
    ? `Hi ${client.full_name}, regarding your transaction of K${saleAmount.toFixed(2)} at Global Essentials.`
    : `Hi ${client.full_name}, from Global Essentials.`;

  const waLink = getWhatsAppLink(phone, message);
  const telLink = `tel:${phone.replace(/\D/g, '')}`;
  const smsLink = `sms:${phone.replace(/\D/g, '')}?body=${encodeURIComponent(message)}`;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
        <div className="bg-tactical-slate rounded-t-3xl border-t border-white/10 p-6 space-y-6 max-w-lg mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-lg">{client?.full_name}</p>
              <p className="text-sm text-white/40">{phone}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick actions */}
          <div className="grid grid-cols-3 gap-3">
            {/* Call */}
            <a
              href={telLink}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-tactical-neon/10 border border-tactical-neon/20 text-tactical-neon hover:bg-tactical-neon/20 transition-colors"
            >
              <Phone className="w-6 h-6" />
              <span className="text-xs font-bold uppercase">Call</span>
            </a>

            {/* WhatsApp */}
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-colors"
            >
              <MessageCircle className="w-6 h-6" />
              <span className="text-xs font-bold uppercase">WhatsApp</span>
            </a>

            {/* SMS */}
            <a
              href={smsLink}
              className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-tactical-blue/10 border border-tactical-blue/20 text-tactical-blue hover:bg-tactical-blue/20 transition-colors"
            >
              <Mail className="w-6 h-6" />
              <span className="text-xs font-bold uppercase">SMS</span>
            </a>
          </div>

          <p className="text-xs text-white/30 text-center">
            Quick contact options for {client?.full_name}
          </p>
        </div>
      </div>
    </>
  );
}