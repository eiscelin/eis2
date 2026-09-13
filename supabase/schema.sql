-- Chookee Inasal Franchise Management System — Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS & ROLES
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT,
  email TEXT,
  contact_number TEXT,
  role TEXT NOT NULL DEFAULT 'franchisee' CHECK (role IN ('admin','franchisee','production','dispatch')),
  franchise_id UUID,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','inactive','pending')),
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- FRANCHISES
-- ============================================
CREATE TABLE IF NOT EXISTS franchises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  franchise_code TEXT UNIQUE NOT NULL,
  franchise_name TEXT NOT NULL,
  owner_name TEXT,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  city TEXT,
  province TEXT,
  region TEXT,
  business_status TEXT DEFAULT 'active' CHECK (business_status IN ('active','inactive','suspended','pending')),
  opening_date DATE,
  contract_start DATE,
  contract_end DATE,
  franchise_fee NUMERIC(12,2) DEFAULT 0,
  royalty_rate NUMERIC(5,2) DEFAULT 5.00,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- PRODUCTS / SUPPLIES
-- ============================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'Other',
  unit TEXT DEFAULT 'pcs',
  current_stock INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  max_stock INTEGER DEFAULT 0,
  unit_price NUMERIC(12,2) DEFAULT 0,
  available_for_ordering BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','archived')),
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INVENTORY (per franchise)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  franchise_id UUID REFERENCES franchises(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  current_qty INTEGER DEFAULT 0,
  reserved_qty INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 0,
  max_stock INTEGER DEFAULT 0,
  last_received TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(franchise_id, product_id)
);

-- ============================================
-- INVENTORY TRANSACTIONS
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  franchise_id UUID REFERENCES franchises(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('RECEIPT','ADJUSTMENT','TRANSFER','WASTE','DAMAGED','RETURN','SALE')),
  quantity INTEGER NOT NULL DEFAULT 0,
  previous_stock INTEGER DEFAULT 0,
  new_stock INTEGER DEFAULT 0,
  reference_order_id UUID,
  user_id UUID REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ORDERS
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  franchise_id UUID REFERENCES franchises(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'draft' CHECK (status IN (
    'draft','submitted','pending_approval','approved','rejected',
    'in_production','production_completed','ready_for_dispatch',
    'preparing_dispatch','dispatched','in_transit','delivered',
    'received','cancelled','issue_reported'
  )),
  total_items INTEGER DEFAULT 0,
  total_qty INTEGER DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  requested_delivery_date DATE,
  notes TEXT,
  rejection_reason TEXT,
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ORDER ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT,
  sku TEXT,
  category TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  unit_price NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) DEFAULT 0,
  production_status TEXT DEFAULT 'pending',
  dispatch_qty INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- PRODUCTION TASKS
-- ============================================
CREATE TABLE IF NOT EXISTS production_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  production_number TEXT UNIQUE NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES franchises(id),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','paused','issue_reported')),
  assigned_to UUID REFERENCES users(id),
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  start_time TIMESTAMPTZ,
  completion_time TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- PRODUCTION ITEMS
-- ============================================
CREATE TABLE IF NOT EXISTS production_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  production_task_id UUID REFERENCES production_tasks(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT,
  required_qty INTEGER NOT NULL,
  produced_qty INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- PRODUCTION ISSUES
-- ============================================
CREATE TABLE IF NOT EXISTS production_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  production_task_id UUID REFERENCES production_tasks(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id),
  issue_type TEXT NOT NULL CHECK (issue_type IN ('insufficient_materials','equipment_problem','quantity_shortage','damaged_materials','quality_issue','production_delay','other')),
  description TEXT,
  qty_affected INTEGER DEFAULT 0,
  severity TEXT DEFAULT 'normal' CHECK (severity IN ('low','normal','high','critical')),
  photo_url TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','resolved','closed')),
  reported_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- DISPATCHES
-- ============================================
CREATE TABLE IF NOT EXISTS dispatches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispatch_number TEXT UNIQUE NOT NULL,
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES franchises(id),
  delivery_address TEXT,
  driver_name TEXT,
  driver_contact TEXT,
  vehicle TEXT,
  scheduled_date DATE,
  scheduled_time TEXT,
  num_packages INTEGER DEFAULT 1,
  special_instructions TEXT,
  dispatch_notes TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','preparing','dispatched','in_transit','arrived','delivered','failed','cancelled')),
  proof_of_delivery TEXT,
  recipient_name TEXT,
  delivered_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- DELIVERY ISSUES
-- ============================================
CREATE TABLE IF NOT EXISTS delivery_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  dispatch_id UUID REFERENCES dispatches(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id),
  issue_type TEXT NOT NULL CHECK (issue_type IN ('wrong_address','damaged_goods','shortage','delay','vehicle_breakdown','other')),
  description TEXT,
  severity TEXT DEFAULT 'normal' CHECK (severity IN ('low','normal','high','critical')),
  photo_url TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','resolved','closed')),
  reported_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ANNOUNCEMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  content TEXT,
  category TEXT DEFAULT 'general',
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal','important','urgent')),
  target_audience TEXT DEFAULT 'all' CHECK (target_audience IN ('all','franchise','production','dispatch','admin','specific')),
  target_franchise_id UUID REFERENCES franchises(id),
  is_active BOOLEAN DEFAULT true,
  publish_date TIMESTAMPTZ DEFAULT now(),
  expiration_date TIMESTAMPTZ,
  attachment_url TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- NOTIFICATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info',
  is_read BOOLEAN DEFAULT false,
  reference_id UUID,
  reference_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- AUDIT LOGS
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  user_name TEXT,
  role TEXT,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  previous_value TEXT,
  new_value TEXT,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SYSTEM SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- ORDER TIMELINE
-- ============================================
CREATE TABLE IF NOT EXISTS order_timeline (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  description TEXT,
  user_id UUID REFERENCES users(id),
  user_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_franchise ON users(franchise_id);
CREATE INDEX IF NOT EXISTS idx_orders_franchise ON orders(franchise_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_franchise ON inventory(franchise_id);
CREATE INDEX IF NOT EXISTS idx_production_tasks_order ON production_tasks(order_id);
CREATE INDEX IF NOT EXISTS idx_production_tasks_status ON production_tasks(status);
CREATE INDEX IF NOT EXISTS idx_dispatches_order ON dispatches(order_id);
CREATE INDEX IF NOT EXISTS idx_dispatches_status ON dispatches(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_active ON announcements(is_active);

-- Enable RLS (Row Level Security)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE franchises ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_timeline ENABLE ROW LEVEL SECURITY;

-- Permissive policies for anon key (app handles auth in frontend)
-- In production, tighten these policies based on authenticated users
CREATE POLICY "allow_all_users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_franchises" ON franchises FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_inventory" ON inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_inv_trans" ON inventory_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_order_items" ON order_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_prod_tasks" ON production_tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_prod_items" ON production_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_prod_issues" ON production_issues FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_dispatches" ON dispatches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_deliv_issues" ON delivery_issues FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_announcements" ON announcements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_notifications" ON notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_audit_logs" ON audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_settings" ON system_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_timeline" ON order_timeline FOR ALL USING (true) WITH CHECK (true);
