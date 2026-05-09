-- ============================================
-- UPDATE SHIPPING RATES - Effective 10 May 2026
-- TODAY CARGO – Sea Express Service (50 Days)
-- ============================================

-- Clear existing sea rates
DELETE FROM shipping_rates WHERE shipping_type IN ('sea_small_parcel', 'sea_cbm', 'sea_heavy');

-- Small Parcels (<0.1 CBM) — $3.9 per kg
INSERT INTO shipping_rates (shipping_type, carrier, transit_days, rate_type, rate, description, is_active)
VALUES ('sea_small_parcel', 'Sea Express VIP', 50, 'per_kg', 3.90, 'Small parcels under 0.1 CBM. Duty included.', true);

-- CBM Rates (volume-based pricing)
-- Tier 1: 0.1CBM+
INSERT INTO shipping_rates (shipping_type, carrier, transit_days, rate_type, rate, volume_min_cbm, volume_max_cbm, description, is_active)
VALUES ('sea_cbm', 'Sea Express VIP', 50, 'per_cbm', 379.00, 0.1, 0.999, 'General goods 0.1CBM+. Duty included.', true);

-- Tier 2: 1CBM+
INSERT INTO shipping_rates (shipping_type, carrier, transit_days, rate_type, rate, volume_min_cbm, volume_max_cbm, description, is_active)
VALUES ('sea_cbm', 'Sea Express VIP', 50, 'per_cbm', 369.00, 1.0, 4.999, 'General goods 1CBM+. Duty included.', true);

-- Tier 3: 5CBM+
INSERT INTO shipping_rates (shipping_type, carrier, transit_days, rate_type, rate, volume_min_cbm, volume_max_cbm, description, is_active)
VALUES ('sea_cbm', 'Sea Express VIP', 50, 'per_cbm', 365.00, 5.0, 9.999, 'General goods 5CBM+. Duty included.', true);

-- Tier 4: 10CBM+
INSERT INTO shipping_rates (shipping_type, carrier, transit_days, rate_type, rate, volume_min_cbm, volume_max_cbm, description, is_active)
VALUES ('sea_cbm', 'Sea Express VIP', 50, 'per_cbm', 359.00, 10.0, NULL, 'General goods 10CBM+. Duty included.', true);

-- Heavy Goods — $469 per ton
INSERT INTO shipping_rates (shipping_type, carrier, transit_days, rate_type, rate, description, is_active)
VALUES ('sea_heavy', 'Sea Express VIP', 50, 'per_ton', 469.00, 'Heavy goods per ton. Duty included. Brand products same price.', true);

-- Verify
SELECT shipping_type, rate_type, rate, volume_min_cbm, volume_max_cbm, description
FROM shipping_rates
WHERE shipping_type LIKE 'sea_%'
ORDER BY shipping_type, volume_min_cbm;
