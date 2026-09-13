-- Seed Data for Chookee Inasal Franchise Management System
-- Run AFTER schema.sql

-- ============================================
-- FRANCHISES
-- ============================================
INSERT INTO franchises (franchise_code, franchise_name, owner_name, contact_person, phone, email, address, city, province, region, business_status, opening_date, contract_start, contract_end, franchise_fee, royalty_rate)
VALUES
  ('FR-000001', 'Chookee Inasal - Cebu City', 'Maria Santos', 'Maria Santos', '0917-123-4567', 'cebu@chookeeinasal.com', '123 Osmena Blvd', 'Cebu City', 'Cebu', 'Region VII', 'active', '2024-01-15', '2024-01-15', '2029-01-15', 500000, 5.00),
  ('FR-000002', 'Chookee Inasal - Mandaue', 'John Dela Cruz', 'John Dela Cruz', '0917-234-5678', 'mandaue@chookeeinasal.com', '456 A.S. Fortuna St', 'Mandaue City', 'Cebu', 'Region VII', 'active', '2024-03-20', '2024-03-20', '2029-03-20', 500000, 5.00),
  ('FR-000003', 'Chookee Inasal - Lapu-Lapu', 'Anna Garcia', 'Anna Garcia', '0917-345-6789', 'lapulapu@chookeeinasal.com', '789 M.L. Quezon Ave', 'Lapu-Lapu City', 'Cebu', 'Region VII', 'active', '2024-06-10', '2024-06-10', '2029-06-10', 500000, 5.00)
ON CONFLICT (franchise_code) DO NOTHING;

-- ============================================
-- USERS
-- ============================================
INSERT INTO users (username, password, full_name, email, contact_number, role, franchise_id, status)
VALUES
  ('admin', 'admin123', 'System Administrator', 'admin@chookeeinasal.com', '0917-000-0000', 'admin', NULL, 'active'),
  ('franchise1', 'franchise123', 'Maria Santos', 'cebu@chookeeinasal.com', '0917-123-4567', 'franchisee', (SELECT id FROM franchises WHERE franchise_code='FR-000001'), 'active'),
  ('franchise2', 'franchise123', 'John Dela Cruz', 'mandaue@chookeeinasal.com', '0917-234-5678', 'franchisee', (SELECT id FROM franchises WHERE franchise_code='FR-000002'), 'active'),
  ('franchise3', 'franchise123', 'Anna Garcia', 'lapulapu@chookeeinasal.com', '0917-345-6789', 'franchisee', (SELECT id FROM franchises WHERE franchise_code='FR-000003'), 'active'),
  ('prod1', 'prod123', 'Carlos Reyes', 'prod1@chookeeinasal.com', '0917-111-1111', 'production', NULL, 'active'),
  ('prod2', 'prod123', 'Elena Torres', 'prod2@chookeeinasal.com', '0917-222-2222', 'production', NULL, 'active'),
  ('dispatch1', 'dispatch123', 'Roberto Lim', 'dispatch1@chookeeinasal.com', '0917-333-3333', 'dispatch', NULL, 'active'),
  ('dispatch2', 'dispatch123', 'Patricia Uy', 'dispatch2@chookeeinasal.com', '0917-444-4444', 'dispatch', NULL, 'active')
ON CONFLICT (username) DO NOTHING;

-- ============================================
-- PRODUCTS
-- ============================================
INSERT INTO products (sku, name, description, category, unit, current_stock, min_stock, max_stock, unit_price, available_for_ordering, status)
VALUES
  ('CHK-001', 'Chicken Inasal (Whole)', 'Marinated grilled chicken', 'Chicken', 'pcs', 500, 100, 1000, 120.00, true, 'active'),
  ('CHK-002', 'Chicken Inasal (Half)', 'Half marinated grilled chicken', 'Chicken', 'pcs', 800, 200, 1500, 65.00, true, 'active'),
  ('CHK-003', 'Chicken Wings', 'Marinated chicken wings', 'Chicken', 'kg', 300, 50, 600, 180.00, true, 'active'),
  ('MRD-001', 'Inasal Marinade (Original)', 'Signature inasal marinade', 'Marinades', 'bottle', 200, 50, 500, 85.00, true, 'active'),
  ('MRD-002', 'Inasal Marinade (Spicy)', 'Spicy variant marinade', 'Marinades', 'bottle', 150, 40, 400, 90.00, true, 'active'),
  ('SRC-001', 'Chicken Oil Sauce', 'Authentic chicken oil', 'Sauces', 'bottle', 300, 60, 600, 45.00, true, 'active'),
  ('SRC-002', 'Soy Garlic Sauce', 'Soy garlic dipping sauce', 'Sauces', 'bottle', 250, 50, 500, 55.00, true, 'active'),
  ('RIC-001', 'Plain Rice', 'Steamed white rice', 'Rice', 'sack', 100, 20, 300, 2200.00, true, 'active'),
  ('VEG-001', 'Atsara (Pickle)', 'Papaya pickle side dish', 'Vegetables', 'container', 150, 30, 300, 35.00, true, 'active'),
  ('PCK-001', 'Takeout Box (Large)', 'Large takeout container', 'Packaging', 'pcs', 2000, 500, 5000, 3.50, true, 'active'),
  ('PCK-002', 'Takeout Box (Small)', 'Small takeout container', 'Packaging', 'pcs', 3000, 500, 8000, 2.00, true, 'active'),
  ('PCK-003', 'Bamboo Skewers', 'Bamboo BBQ skewers', 'Packaging', 'pack', 500, 100, 1000, 25.00, true, 'active'),
  ('BVG-001', 'Coke 1.5L', 'Coca-Cola 1.5 liter', 'Beverages', 'bottle', 200, 50, 500, 55.00, true, 'active'),
  ('CND-001', 'Calamansi Dip', 'Calamansi dipping sauce', 'Condiments', 'cup', 400, 100, 800, 12.00, true, 'active'),
  ('CLN-001', 'Food Grade Cleaner', 'Sanitizing cleaner', 'Cleaning Supplies', 'bottle', 100, 20, 300, 150.00, true, 'active')
ON CONFLICT (sku) DO NOTHING;

-- ============================================
-- INVENTORY (for each franchise)
-- ============================================
INSERT INTO inventory (franchise_id, product_id, current_qty, reserved_qty, min_stock, max_stock)
SELECT f.id, p.id,
  CASE
    WHEN p.sku IN ('CHK-001','CHK-002') THEN 80
    WHEN p.sku = 'RIC-001' THEN 15
    WHEN p.sku IN ('PCK-001','PCK-002') THEN 500
    ELSE 40
  END,
  0,
  CASE
    WHEN p.sku IN ('CHK-001','CHK-002') THEN 30
    WHEN p.sku = 'RIC-001' THEN 10
    ELSE 15
  END,
  CASE
    WHEN p.sku IN ('CHK-001','CHK-002') THEN 200
    WHEN p.sku = 'RIC-001' THEN 50
    ELSE 100
  END
FROM franchises f
CROSS JOIN products p
WHERE f.franchise_code IN ('FR-000001','FR-000002','FR-000003')
  AND p.sku IN ('CHK-001','CHK-002','CHK-003','MRD-001','SRC-001','RIC-001','PCK-001','PCK-002','BVG-001')
ON CONFLICT (franchise_id, product_id) DO NOTHING;

-- Set some low-stock items for FR-000001
UPDATE inventory SET current_qty = 5 WHERE franchise_id = (SELECT id FROM franchises WHERE franchise_code='FR-000001') AND product_id = (SELECT id FROM products WHERE sku='RIC-001');

-- ============================================
-- SAMPLE ORDERS
-- ============================================
INSERT INTO orders (order_number, franchise_id, status, total_items, total_qty, total_amount, requested_delivery_date, created_by, created_at, updated_at)
VALUES
  ('ORD-20260910-00001', (SELECT id FROM franchises WHERE franchise_code='FR-000001'), 'received', 3, 95, 12550.00, '2026-09-12', (SELECT id FROM users WHERE username='franchise1'), '2026-09-10 08:00:00+08', '2026-09-12 10:00:00+08'),
  ('ORD-20260911-00002', (SELECT id FROM franchises WHERE franchise_code='FR-000002'), 'in_production', 2, 60, 7200.00, '2026-09-14', (SELECT id FROM users WHERE username='franchise2'), '2026-09-11 09:30:00+08', '2026-09-12 11:00:00+08'),
  ('ORD-20260912-00003', (SELECT id FROM franchises WHERE franchise_code='FR-000003'), 'pending_approval', 4, 120, 18900.00, '2026-09-15', (SELECT id FROM users WHERE username='franchise3'), '2026-09-12 14:00:00+08', '2026-09-12 14:00:00+08'),
  ('ORD-20260913-00004', (SELECT id FROM franchises WHERE franchise_code='FR-000001'), 'ready_for_dispatch', 2, 50, 6000.00, '2026-09-14', (SELECT id FROM users WHERE username='franchise1'), '2026-09-13 07:00:00+08', '2026-09-13 09:00:00+08')
ON CONFLICT (order_number) DO NOTHING;

-- ============================================
-- ORDER ITEMS
-- ============================================
INSERT INTO order_items (order_id, product_id, product_name, sku, category, quantity, unit, unit_price, total, production_status)
SELECT o.id, p.id, p.name, p.sku, p.category,
  CASE
    WHEN p.sku = 'CHK-001' THEN 50
    WHEN p.sku = 'CHK-002' THEN 30
    WHEN p.sku = 'RIC-001' THEN 15
    WHEN p.sku = 'MRD-001' THEN 10
    WHEN p.sku = 'PCK-001' THEN 200
    WHEN p.sku = 'SRC-001' THEN 20
    WHEN p.sku = 'BVG-001' THEN 30
    ELSE 10
  END,
  p.unit, p.unit_price,
  CASE
    WHEN p.sku = 'CHK-001' THEN 50 * p.unit_price
    WHEN p.sku = 'CHK-002' THEN 30 * p.unit_price
    WHEN p.sku = 'RIC-001' THEN 15 * p.unit_price
    WHEN p.sku = 'MRD-001' THEN 10 * p.unit_price
    WHEN p.sku = 'PCK-001' THEN 200 * p.unit_price
    WHEN p.sku = 'SRC-001' THEN 20 * p.unit_price
    WHEN p.sku = 'BVG-001' THEN 30 * p.unit_price
    ELSE 10 * p.unit_price
  END,
  CASE
    WHEN o.status = 'received' THEN 'completed'
    WHEN o.status = 'in_production' THEN 'in_progress'
    WHEN o.status = 'ready_for_dispatch' THEN 'completed'
    ELSE 'pending'
  END
FROM orders o
CROSS JOIN products p
WHERE o.order_number = 'ORD-20260910-00001' AND p.sku IN ('CHK-001','RIC-001','PCK-001')
   OR o.order_number = 'ORD-20260911-00002' AND p.sku IN ('CHK-002','MRD-001')
   OR o.order_number = 'ORD-20260912-00003' AND p.sku IN ('CHK-001','RIC-001','SRC-001','BVG-001')
   OR o.order_number = 'ORD-20260913-00004' AND p.sku IN ('CHK-002','PCK-001')
ON CONFLICT DO NOTHING;

-- ============================================
-- PRODUCTION TASKS
-- ============================================
INSERT INTO production_tasks (production_number, order_id, franchise_id, status, priority, start_time, completion_time)
SELECT 'PRD-20260911-00001', o.id, o.franchise_id, 'completed', 'normal', '2026-09-11 10:00:00+08', '2026-09-12 11:00:00+08'
FROM orders o WHERE o.order_number = 'ORD-20260910-00001'
ON CONFLICT DO NOTHING;

INSERT INTO production_tasks (production_number, order_id, franchise_id, status, priority, start_time)
SELECT 'PRD-20260912-00002', o.id, o.franchise_id, 'in_progress', 'high', '2026-09-12 11:00:00+08'
FROM orders o WHERE o.order_number = 'ORD-20260911-00002'
ON CONFLICT DO NOTHING;

INSERT INTO production_tasks (production_number, order_id, franchise_id, status, priority, completion_time)
SELECT 'PRD-20260913-00003', o.id, o.franchise_id, 'completed', 'normal', '2026-09-13 09:00:00+08'
FROM orders o WHERE o.order_number = 'ORD-20260913-00004'
ON CONFLICT DO NOTHING;

-- ============================================
-- DISPATCHES
-- ============================================
INSERT INTO dispatches (dispatch_number, order_id, franchise_id, delivery_address, driver_name, driver_contact, vehicle, scheduled_date, scheduled_time, num_packages, status, delivered_at, created_by)
SELECT 'DSP-20260912-00001', o.id, o.franchise_id, '123 Osmena Blvd, Cebu City', 'Roberto Lim', '0917-333-3333', 'Van - CEB 4567', '2026-09-12', '08:00', 5, 'delivered', '2026-09-12 10:00:00+08', (SELECT id FROM users WHERE username='dispatch1')
FROM orders o WHERE o.order_number = 'ORD-20260910-00001'
ON CONFLICT DO NOTHING;

-- ============================================
-- ANNOUNCEMENTS
-- ============================================
INSERT INTO announcements (title, content, category, priority, target_audience, is_active, publish_date, created_by)
VALUES
  ('New Marinade Formula Available', 'We have updated our Inasal Marinade formula. Please place orders for the new batch.', 'product', 'important', 'all', true, now(), (SELECT id FROM users WHERE username='admin')),
  ('Monthly Inventory Check', 'All franchises are required to conduct inventory check by end of September.', 'operations', 'normal', 'franchise', true, now(), (SELECT id FROM users WHERE username='admin')),
  ('System Maintenance Notice', 'The system will undergo maintenance on Sept 15, 2026 from 2AM-4AM.', 'system', 'urgent', 'all', true, now(), (SELECT id FROM users WHERE username='admin'))
ON CONFLICT DO NOTHING;

-- ============================================
-- NOTIFICATIONS
-- ============================================
INSERT INTO notifications (user_id, title, message, type, is_read, reference_type)
SELECT id, 'New Order Submitted', 'Order ORD-20260912-00003 requires your approval', 'order', false, 'order'
FROM users WHERE role = 'admin'
ON CONFLICT DO NOTHING;

INSERT INTO notifications (user_id, title, message, type, is_read, reference_type)
SELECT id, 'Order Approved', 'Your order ORD-20260911-00002 is now in production', 'order', false, 'order'
FROM users WHERE username = 'franchise2'
ON CONFLICT DO NOTHING;

-- ============================================
-- ORDER TIMELINE
-- ============================================
INSERT INTO order_timeline (order_id, event, description, user_name, created_at)
SELECT o.id, 'Order Submitted', 'Order submitted by franchise', 'franchise1', '2026-09-10 08:00:00+08'
FROM orders o WHERE o.order_number = 'ORD-20260910-00001'
ON CONFLICT DO NOTHING;

INSERT INTO order_timeline (order_id, event, description, user_name, created_at)
SELECT o.id, 'Order Approved', 'Order approved by admin', 'admin', '2026-09-10 09:00:00+08'
FROM orders o WHERE o.order_number = 'ORD-20260910-00001'
ON CONFLICT DO NOTHING;

INSERT INTO order_timeline (order_id, event, description, user_name, created_at)
SELECT o.id, 'Production Started', 'Production started by Carlos Reyes', 'prod1', '2026-09-11 10:00:00+08'
FROM orders o WHERE o.order_number = 'ORD-20260910-00001'
ON CONFLICT DO NOTHING;

INSERT INTO order_timeline (order_id, event, description, user_name, created_at)
SELECT o.id, 'Production Completed', 'Production completed', 'prod1', '2026-09-12 11:00:00+08'
FROM orders o WHERE o.order_number = 'ORD-20260910-00001'
ON CONFLICT DO NOTHING;

INSERT INTO order_timeline (order_id, event, description, user_name, created_at)
SELECT o.id, 'Dispatched', 'Order dispatched via DSP-20260912-00001', 'dispatch1', '2026-09-12 08:00:00+08'
FROM orders o WHERE o.order_number = 'ORD-20260910-00001'
ON CONFLICT DO NOTHING;

INSERT INTO order_timeline (order_id, event, description, user_name, created_at)
SELECT o.id, 'Delivered', 'Order delivered to franchise', 'dispatch1', '2026-09-12 10:00:00+08'
FROM orders o WHERE o.order_number = 'ORD-20260910-00001'
ON CONFLICT DO NOTHING;

INSERT INTO order_timeline (order_id, event, description, user_name, created_at)
SELECT o.id, 'Received', 'Order received and confirmed by franchise', 'franchise1', '2026-09-12 10:30:00+08'
FROM orders o WHERE o.order_number = 'ORD-20260910-00001'
ON CONFLICT DO NOTHING;

-- ============================================
-- AUDIT LOGS
-- ============================================
INSERT INTO audit_logs (user_id, user_name, role, action, entity, entity_id, details, created_at)
SELECT id, 'admin', 'admin', 'LOGIN', 'system', NULL, 'Admin logged in', '2026-09-13 08:00:00+08'
FROM users WHERE username='admin'
ON CONFLICT DO NOTHING;

INSERT INTO audit_logs (user_id, user_name, role, action, entity, entity_id, details, created_at)
SELECT id, 'admin', 'admin', 'APPROVE_ORDER', 'order', 'ORD-20260910-00001', 'Approved order ORD-20260910-00001', '2026-09-10 09:00:00+08'
FROM users WHERE username='admin'
ON CONFLICT DO NOTHING;

INSERT INTO audit_logs (user_id, user_name, role, action, entity, entity_id, details, created_at)
SELECT id, 'prod1', 'production', 'START_PRODUCTION', 'production_task', 'PRD-20260911-00001', 'Started production for ORD-20260910-00001', '2026-09-11 10:00:00+08'
FROM users WHERE username='prod1'
ON CONFLICT DO NOTHING;

-- ============================================
-- SYSTEM SETTINGS
-- ============================================
INSERT INTO system_settings (key, value, description) VALUES
  ('order_prefix', 'ORD', 'Order number prefix'),
  ('dispatch_prefix', 'DSP', 'Dispatch number prefix'),
  ('production_prefix', 'PRD', 'Production number prefix'),
  ('franchise_prefix', 'FR', 'Franchise code prefix'),
  ('low_stock_threshold', '10', 'Default low stock threshold percentage')
ON CONFLICT (key) DO NOTHING;
