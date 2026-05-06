export type ShippingTypeId =
  | 'air_general_7days'
  | 'air_sensitive_14days'
  | 'sea_small_parcel'
  | 'sea_cbm'
  | 'sea_heavy';

export interface ShippingType {
  id: ShippingTypeId;
  name: string;
  carrier: string;
  transitDays: number;
  description: string;
  pricingModel: 'weight_tiered' | 'volume_cbm' | 'weight_flat';
}

export const SHIPPING_TYPES: ShippingType[] = [
  {
    id: 'air_general_7days',
    name: 'Air General 7D',
    carrier: 'Air Express',
    transitDays: 7,
    description: 'General goods. No batteries, liquid, magnetic.',
    pricingModel: 'weight_tiered',
  },
  {
    id: 'air_sensitive_14days',
    name: 'Air Sensitive 14D',
    carrier: 'Air Express',
    transitDays: 14,
    description: 'Electronics. Liquid, magnetic, powder allowed.',
    pricingModel: 'weight_tiered',
  },
  {
    id: 'sea_small_parcel',
    name: 'Sea Small <0.1CBM',
    carrier: 'Sea Express VIP',
    transitDays: 50,
    description: 'Small parcels under 0.1 CBM.',
    pricingModel: 'weight_flat',
  },
  {
    id: 'sea_cbm',
    name: 'Sea CBM 0.1+',
    carrier: 'Sea Express VIP',
    transitDays: 50,
    description: 'General goods. Volume-based pricing.',
    pricingModel: 'volume_cbm',
  },
  {
    id: 'sea_heavy',
    name: 'Sea Heavy',
    carrier: 'Sea Express VIP',
    transitDays: 50,
    description: 'Heavy goods per ton.',
    pricingModel: 'weight_flat',
  },
];

export function getShippingType(id: ShippingTypeId): ShippingType | undefined {
  return SHIPPING_TYPES.find(st => st.id === id);
}