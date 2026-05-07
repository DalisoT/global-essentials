'use client';

import { cn } from '@/lib/utils';
import { getWhatsAppLink } from '@/lib/utils';
import { Phone, MessageCircle, Mail, X, Pencil } from 'lucide-react';
import { useState } from 'react';
import { updateClient } from '@/lib/actions/clients';
import { toast } from 'sonner';

interface ClientQuickActionsProps {
  client: { id: string; full_name: string; phone_number?: string | null } | null | undefined;
  saleId?: string;
  saleAmount?: number;
  onClose: () => void;
  onUpdated?: () => void;
}

export function ClientQuickActions({ client, saleId, saleAmount, onClose, onUpdated }: ClientQuickActionsProps) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(client?.full_name || '');
  const [editPhone, setEditPhone] = useState(client?.phone_number || '');
  const [saving, setSaving] = useState(false);

  let phone = client?.phone_number;
  if (!phone) return null;

  // Normalize to Zambia format +260...
  const digits = phone.replace(/\D/g, '');
  const localNumber = digits.startsWith('0') ? digits.slice(1) : digits;
  const fullNumber = `+260${localNumber}`;

  const message = saleAmount
    ? `Hi ${client?.full_name}, regarding your transaction of K${saleAmount.toFixed(2)} at Global Essentials.`
    : `Hi ${client?.full_name}, from Global Essentials.`;

  const waLink = getWhatsAppLink(fullNumber, message);
  const telLink = `tel:${fullNumber}`;
  const smsLink = `sms:${fullNumber}?body=${encodeURIComponent(message)}`;

  const handleSave = async () => {
    if (!client?.id || !editName.trim()) return;
    setSaving(true);
    const { error } = await updateClient(client.id, {
      full_name: editName.trim(),
      phone_number: editPhone.trim() || null,
    });
    setSaving(false);
    if (error) {
      toast.error('Failed to update client');
    } else {
      toast.success('Client updated');
      setEditing(false);
      onUpdated?.();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-slide-up">
        <div className="bg-tactical-slate rounded-t-3xl border-t border-white/10 p-6 space-y-5 max-w-lg mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-lg">{client?.full_name}</p>
              <p className="text-sm text-white/40">{fullNumber}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(!editing)}
                className={cn(
                  'p-2 rounded-xl transition-colors',
                  editing ? 'bg-tactical-blue text-white' : 'bg-white/5 hover:bg-white/10 text-white/60'
                )}
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/60"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Edit form */}
          {editing && (
            <div className="space-y-3 p-4 bg-white/5 rounded-2xl border border-white/10">
              <p className="text-xs font-bold uppercase tracking-wider text-white/60">Edit Client</p>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full h-11 px-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-tactical-blue"
                />
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Phone</label>
                <input
                  type="text"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="07XXXXXXXX"
                  className="w-full h-11 px-3 bg-white/10 border border-white/20 rounded-xl text-white focus:outline-none focus:border-tactical-blue"
                />
              </div>
              <button
                onClick={handleSave}
                disabled={saving || !editName.trim()}
                className="w-full btn-tactical h-11 text-sm disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          {/* Quick actions */}
          {!editing && (
            <>
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
            </>
          )}
        </div>
      </div>
    </>
  );
}