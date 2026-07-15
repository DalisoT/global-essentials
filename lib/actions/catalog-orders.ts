'use server';

import { createServerSupabaseClient } from '@/lib/supabase-server';
import type { OrderWithItems } from '@/lib/supabase-types';

export async function createOrder({
  customerName,
  customerPhone,
  customerEmail,
  items,
  shippingCost,
  shippingMethod,
  shippingAddress,
  shippingCity,
  shippingProvince,
  shippingPostalCode,
  notes,
}: {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  items: Array<{ productId: string; name: string; price: number; quantity: number }>;
  shippingCost: number;
  shippingMethod: string;
  shippingAddress: string;
  shippingCity: string;
  shippingProvince: string;
  shippingPostalCode?: string;
  notes?: string;
}): Promise<{ data: OrderWithItems | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();

  // Validate products exist and have stock
  const productIds = items.map((i) => i.productId);
  const { data: products } = await supabase
    .from('products')
    .select('id, name, stock_level')
    .in('id', productIds);

  if (!products || products.length !== items.length) {
    return { data: null, error: 'Some products not found' };
  }

  // Check stock for each item
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) return { data: null, error: `Product not found: ${item.productId}` };
    if (product.stock_level < item.quantity) {
      return { data: null, error: `Insufficient stock for ${item.name}. Available: ${product.stock_level}` };
    }
  }

  const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const total = subtotal + shippingCost;

  // Generate order number (GE-YYYY-NNNNN)
  const year = new Date().getFullYear();
  const { data: lastOrder } = await supabase
    .from('orders')
    .select('order_number')
    .like('order_number', `GE-${year}-%`)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  let seqNum = 1;
  if (lastOrder?.order_number) {
    const lastSeq = parseInt(lastOrder.order_number.split('-').pop() || '0', 10);
    seqNum = lastSeq + 1;
  }
  const orderNumber = `GE-${year}-${String(seqNum).padStart(5, '0')}`;

  // Create order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert([
      {
        order_number: orderNumber,
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail || null,
        subtotal,
        shipping_cost: shippingCost,
        total,
        shipping_method: shippingMethod,
        shipping_address_line: shippingAddress,
        shipping_city: shippingCity,
        shipping_province: shippingProvince,
        shipping_postal_code: shippingPostalCode || null,
        notes: notes || null,
        status: 'pending',
      },
    ])
    .select()
    .single();

  if (orderError || !order) {
    return { data: null, error: orderError?.message || 'Failed to create order' };
  }

  // Create order items
  const orderItems = items.map((item) => ({
    order_id: order.id,
    product_id: item.productId,
    product_name: item.name,
    quantity: item.quantity,
    unit_price: item.price,
    total_price: item.price * item.quantity,
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

  if (itemsError) {
    // Rollback: delete the order
    await supabase.from('orders').delete().eq('id', order.id);
    return { data: null, error: 'Failed to create order items' };
  }

  // Decrement stock for each product
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (product) {
      await supabase
        .from('products')
        .update({ stock_level: product.stock_level - item.quantity })
        .eq('id', item.productId);
    }
  }

  return { data: { ...order, items: orderItems }, error: null };
}

export async function getOrderById(orderId: string): Promise<{ data: OrderWithItems | null; error: string | null }> {
  const supabase = await createServerSupabaseClient();

  const { data: order, error } = await supabase.from('orders').select('*').eq('id', orderId).single();

  if (error || !order) {
    return { data: null, error: 'Order not found' };
  }

  const { data: items } = await supabase.from('order_items').select('*').eq('order_id', orderId);

  return { data: { ...order, items: items || [] }, error: null };
}

export async function getOrders(status?: string): Promise<{ data: OrderWithItems[]; error: string | null }> {
  const supabase = await createServerSupabaseClient();

  let query = supabase.from('orders').select('*').order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;

  if (error) return { data: [], error: error?.message || null };

  // Fetch items for each order
  const ordersWithItems: OrderWithItems[] = await Promise.all(
    (data || []).map(async (order) => {
      const { data: items } = await supabase.from('order_items').select('*').eq('order_id', order.id);
      return { ...order, items: items || [] };
    })
  );

  return { data: ordersWithItems, error: null };
}

export async function updateOrderStatus(
  orderId: string,
  status: OrderWithItems['status']
): Promise<{ error: string | null }> {
  const supabase = await createServerSupabaseClient();

  // Fetch order items before updating status (for stock restoration on cancel)
  const { data: items } = await supabase
    .from('order_items')
    .select('product_id, quantity')
    .eq('order_id', orderId);

  // Build update payload
  const updates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === 'cancelled') {
    updates.cancelled_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', orderId);

  if (error) return { error: error.message };

  // Restore stock if cancelling
  if (status === 'cancelled' && items) {
    for (const item of items) {
      const { data: product } = await supabase
        .from('products')
        .select('stock_level')
        .eq('id', item.product_id)
        .single();

      if (product) {
        await supabase
          .from('products')
          .update({ stock_level: product.stock_level + item.quantity })
          .eq('id', item.product_id);
      }
    }
  }

  return { error: null };
}

/**
 * Set the shipping tracking number for an order. Separate from
 * updateOrderStatus because it's a different concern (the courier
 * number, not the workflow state). The action also auto-advances
 * the order to 'shipped' if it's currently in a pre-ship state,
 * since you usually have a tracking number because the order went
 * out the door.
 */
export async function setOrderTracking(
  orderId: string,
  tracking: string
): Promise<{ error: string | null }> {
  const trimmed = tracking.trim();
  if (!trimmed) return { error: 'Tracking number is required' };
  if (trimmed.length > 200) {
    return { error: 'Tracking number is too long (max 200 chars)' };
  }
  const supabase = await createServerSupabaseClient();

  // Fetch current status so we can decide whether to advance.
  const { data: current } = await supabase
    .from('orders')
    .select('status')
    .eq('id', orderId)
    .maybeSingle();
  const status = (current as { status: string } | null)?.status;

  const updates: Record<string, unknown> = {
    shipping_tracking: trimmed,
    updated_at: new Date().toISOString(),
  };
  // If the order is still pre-shipped and we just got a tracking
  // number, advance to 'shipped'. Don't downgrade if it's later.
  if (status && (status === 'pending' || status === 'confirmed' || status === 'processing')) {
    updates.status = 'shipped';
  }

  const { error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', orderId);

  if (error) return { error: error.message };
  return { error: null };
}