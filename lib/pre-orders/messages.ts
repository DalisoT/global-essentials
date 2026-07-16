/**
 * Pre-order WhatsApp message templates (Phase 11 / 11.9).
 *
 * Pure functions. Each template is a function of (order,
 * context) that returns the message body the shop owner will
 * send. The owner types it into their own WhatsApp — we never
 * auto-send in v1 (see 11.10 for the cron that just
 * pre-generates "you should send this update now" reminders).
 *
 * Templates are deliberately short and conversational. Long
 * marketing-speak converts worse than a direct "your boots
 * are in, here's what you owe" — we're not selling, we're
 * keeping a customer informed.
 */

import { formatK } from './pricing';
import type { PreOrder, PreOrderEventType } from '@/lib/supabase-types';

export const SHOP_NAME = 'Global Essentials';
export const SHOP_PHONE = '260980062299';

export type MessageTemplateId =
  | 'deposit_request'
  | 'deposit_thanks'
  | 'in_transit'
  | 'customs'
  | 'almost_there'
  | 'arrived'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'custom';

export interface MessageTemplate {
  id: MessageTemplateId;
  label: string;
  /** Short description shown in the picker. */
  description: string;
  /** Which pre-order status is the natural time to send this. */
  suggestedFor: PreOrder['status'][];
}

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: 'deposit_request',
    label: 'Ask for deposit',
    description: 'Send when the customer has registered but not paid yet',
    suggestedFor: ['pending'],
  },
  {
    id: 'deposit_thanks',
    label: 'Confirm deposit received',
    description: 'Send as soon as the deposit lands',
    suggestedFor: ['deposit_paid', 'arrived'],
  },
  {
    id: 'in_transit',
    label: 'Shipment in transit',
    description: 'Day ~14 after deposit — boots left the supplier',
    suggestedFor: ['deposit_paid'],
  },
  {
    id: 'customs',
    label: 'Clearing customs',
    description: 'Day ~30 — shipment is at the border',
    suggestedFor: ['deposit_paid'],
  },
  {
    id: 'almost_there',
    label: 'Almost there',
    description: 'Day ~45 — expected at the shop in a few days',
    suggestedFor: ['deposit_paid'],
  },
  {
    id: 'arrived',
    label: 'Stock arrived at shop',
    description: 'Customer can come in to pay balance + collect',
    suggestedFor: ['arrived'],
  },
  {
    id: 'completed',
    label: 'Thanks for collecting',
    description: 'Sent after the balance is paid and the boots are out the door',
    suggestedFor: ['completed'],
  },
  {
    id: 'cancelled',
    label: 'Cancellation notice',
    description: 'Sent when the order is cancelled (no refund)',
    suggestedFor: ['cancelled'],
  },
  {
    id: 'refunded',
    label: 'Refund confirmation',
    description: 'Sent when the deposit has been returned',
    suggestedFor: ['refunded'],
  },
  {
    id: 'custom',
    label: 'Custom message',
    description: 'Write your own — you edit the text before sending',
    suggestedFor: ['pending', 'deposit_paid', 'arrived', 'completed'],
  },
];

/** Build the message body for a given template. */
export function renderMessage(
  templateId: MessageTemplateId,
  order: Pick<
    PreOrder,
    | 'tracking_code'
    | 'customer_name'
    | 'deposit_amount'
    | 'balance_due'
    | 'unit_price'
    | 'expected_delivery_date'
    | 'shipping_mode'
  >,
  context: {
    /** Optional override for custom message. */
    customText?: string;
    /** Optional ETA override (e.g. "next Tuesday"). */
    eta?: string;
  } = {}
): string {
  const firstName = (order.customer_name ?? '').split(' ')[0] || 'there';
  const code = order.tracking_code ?? '—';
  const deposit = formatK(order.deposit_amount);
  const balance = formatK(order.balance_due);
  const total = formatK(order.unit_price);
  const eta = context.eta ?? prettyDate(order.expected_delivery_date);
  const mode = order.shipping_mode === 'air' ? 'air' : 'sea';

  switch (templateId) {
    case 'deposit_request':
      return (
        `Hi ${firstName}! This is ${SHOP_NAME}.\n\n` +
        `Your pre-order ${code} is registered. To lock it in, the deposit is ${deposit} ` +
        `(balance ${balance} on delivery).\n\n` +
        `Reply here and we'll send payment options. ` +
        `Or come in to the shop and we'll handle it in person.`
      );

    case 'deposit_thanks':
      return (
        `Hi ${firstName}! Deposit received for pre-order ${code} — thank you.\n\n` +
        `We've placed the order with the supplier. ` +
        `Expected to land at the shop around ${eta} (${mode} cargo). ` +
        `We'll text you as it gets closer.`
      );

    case 'in_transit':
      return (
        `Update on pre-order ${code}: your boots have left the supplier and are in transit. ` +
        `Still expecting them at the shop around ${eta} — we'll keep you posted.`
      );

    case 'customs':
      return (
        `Update on pre-order ${code}: the shipment is at customs / clearing. ` +
        `Usually takes about a week. Still on track for ${eta}.`
      );

    case 'almost_there':
      return (
        `Almost there! Pre-order ${code} should land at the shop in a few days. ` +
        `We'll text you the moment it arrives so you can come in for the balance (${balance}) and collect.`
      );

    case 'arrived':
      return (
        `Your pre-order ${code} is in! Come to the shop to pay the balance of ${balance} ` +
        `and collect your boots. Show this code at the counter: ${code}.`
      );

    case 'completed':
      return (
        `Thanks for collecting pre-order ${code}! Enjoy the boots. ` +
        `If anything's not right, message us here.`
      );

    case 'cancelled':
      return (
        `Hi ${firstName}, your pre-order ${code} has been cancelled. ` +
        `If you have any questions, message us here. ` +
        `Thanks for your interest — hope to see you again soon.`
      );

    case 'refunded':
      return (
        `Hi ${firstName}, your deposit of ${deposit} for pre-order ${code} ` +
        `has been refunded. If you don't see it in a day or two, message us here. ` +
        `Thanks for your patience.`
      );

    case 'custom':
      return context.customText ?? '';
  }
}

/** Lookup a template by id. */
export function getTemplate(id: MessageTemplateId): MessageTemplate {
  const t = MESSAGE_TEMPLATES.find((m) => m.id === id);
  if (!t) {
    return MESSAGE_TEMPLATES[MESSAGE_TEMPLATES.length - 1];
  }
  return t;
}

/** Map a pre_order_events.event_type to a likely message template. */
export function suggestedTemplateForEvent(
  eventType: PreOrderEventType
): MessageTemplateId | null {
  switch (eventType) {
    case 'created':
      return 'deposit_request';
    case 'deposit_paid':
      return 'deposit_thanks';
    case 'arrived':
      return 'arrived';
    case 'completed':
      return 'completed';
    case 'cancelled':
      return 'cancelled';
    case 'refunded':
      return 'refunded';
    default:
      return null;
  }
}

function prettyDate(dateStr: string): string {
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} ${months[m - 1]} ${y}`;
}
