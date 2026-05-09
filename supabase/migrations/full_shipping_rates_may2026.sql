-- ============================================
-- FULL SHIPPING RATES MIGRATION - May 2026
-- TODAY CARGO – All Services
-- ============================================

-- Clear ALL existing rates
DELETE FROM shipping_rates;

-- ─────────────────────────────────────────────
-- AIR SERVICES (placeholder — update if needed)
-- ─────────────────────────────────────────────
INSERT INTO shipping_rates (shipping_type, carrier, transit_days, rate_type, tier_min_kg, tier_max_kg, rate, description, is_active)
VALUES
  ('air_general_7days', 'Air Express', 7, 'per_kg', 0.01, 9.99, 13.90, 'Air General 7D. No batteries, liquid, magnetic.', true),
  ('air_general_7days', 'Air Express', 7, 'per_kg', 10, NULL, 11.90, 'Air General 7D 10kg+. No batteries, liquid, magnetic.', true),
  ('air_sensitive_14days', 'Air Express', 14, 'per_kg', 0.01, 9.99, 15.90, 'Air Sensitive 14D. Electronics, liquid, magnetic allowed.', true),
  ('air_sensitive_14days', 'Air Express', 14, 'per_kg', 10, NULL, 13.90, 'Air Sensitive 14D 10kg+. Electronics, liquid, magnetic allowed.', true);

-- ─────────────────────────────────────────────
-- SEA SMALL PARCEL (<0.1 CBM) — $3.90/kg
-- ─────────────────────────────────────────────
INSERT INTO shipping_rates (shipping_type, carrier, transit_days, rate_type, tier_min_kg, tier_max_kg, rate, description, is_active)
VALUES ('sea_small_parcel', 'Sea Express VIP', 50, 'per_kg', 0.01, NULL, 3.90, 'Sea Small <0.1CBM. Duty included. 50 days.', true);

-- ─────────────────────────────────────────────
-- SEA CBM (General goods, 50 days VIP)
-- NEW tiered volume-based pricing
-- ─────────────────────────────────────────────
-- Tier 1: 0.1 CBM to 0.999 CBM
INSERT INTO shipping_rates (shipping_type, carrier, transit_days, rate_type, rate, volume_min_cbm, volume_max_cbm, description, is_active)
VALUES ('sea_cbm', 'Sea Express VIP', 50, 'per_cbm', 379.00, 0.1, 0.999, 'Sea CBM 0.1-0.999CBM. General goods. Duty included.', true);

-- Tier 2: 1.0 CBM to 4.999 CBM
INSERT INTO shipping_rates (shipping_type, carrier, transit_days, rate_type, rate, volume_min_cbm, volume_max_cbm, description, is_active)
VALUES ('sea_cbm', 'Sea Express VIP', 50, 'per_cbm', 369.00, 1.0, 4.999, 'Sea CBM 1-4.999CBM. General goods. Duty included.', true);

-- Tier 3: 5.0 CBM to 9.999 CBM
INSERT INTO shipping_rates (shipping_type, carrier, transit_days, rate_type, rate, volume_min_cbm, volume_max_cbm, description, is_active)
VALUES ('sea_cbm', 'Sea Express VIP', 50, 'per_cbm', 365.00, 5.0, 9.999, 'Sea CBM 5-9.999CBM. General goods. Duty included.', true);

-- Tier 4: 10.0 CBM+
INSERT INTO shipping_rates (shipping_type, carrier, transit_days, rate_type, rate, volume_min_cbm, volume_max_cbm, description, is_active)
VALUES ('sea_cbm', 'Sea Express VIP', 50, 'per_cbm', 359.00, 10.0, NULL, 'Sea CBM 10CBM+. General goods. Duty included.', true);

-- ─────────────────────────────────────────────
-- SEA HEAVY (per ton) — $469/ton
-- ─────────────────────────────────────────────
INSERT INTO shipping_rates (shipping_type, carrier, transit_days, rate_type, rate, description, is_active)
VALUES ('sea_heavy', 'Sea Express VIP', 50, 'per_ton', 469.00, 'Sea Heavy. Per ton. Duty included. Brand products same price.', true);

-- ─────────────────────────────────────────────
-- Verify all rates
-- ─────────────────────────────────────────────
SELECT
  shipping_type,
  rate_type,
  rate,
  tier_min_kg,
  tier_max_kg,
  volume_min_cbm,
  volume_max_cbm,
  description
FROM shipping_rates
ORDER BY shipping_type, volume_min_cbm NULLS LAST, tier_min_kg;