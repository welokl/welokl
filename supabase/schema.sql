-- ══════════════════════════════════════════════════════════
-- WELOKL DATABASE SCHEMA
-- Hyperlocal marketplace — every shop, delivered.
-- ══════════════════════════════════════════════════════════

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ── USERS ──
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','business','delivery','admin')),
  avatar_url TEXT,
  city TEXT DEFAULT 'Mumbai',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── CATEGORIES ──
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#f97316',
  sort_order INT DEFAULT 0
);

-- ── SHOPS ──
CREATE TABLE IF NOT EXISTS shops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES categories(id),
  category_name TEXT,
  address TEXT NOT NULL,
  area TEXT,
  city TEXT DEFAULT 'Mumbai',
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  phone TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_open BOOLEAN DEFAULT TRUE,
  opens_at TEXT DEFAULT '09:00',
  closes_at TEXT DEFAULT '22:00',
  delivery_enabled BOOLEAN DEFAULT TRUE,
  pickup_enabled BOOLEAN DEFAULT TRUE,
  min_order_amount INT DEFAULT 0,
  avg_delivery_time INT DEFAULT 30,
  rating DECIMAL(2,1) DEFAULT 4.5,
  total_orders INT DEFAULT 0,
  commission_percent DECIMAL(4,2) DEFAULT 15.0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── PRODUCTS ──
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price INT NOT NULL,
  original_price INT,
  image_url TEXT,
  category TEXT,
  is_available BOOLEAN DEFAULT TRUE,
  is_veg BOOLEAN,
  stock_count INT DEFAULT 999,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── ORDERS ──
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  customer_id UUID REFERENCES users(id),
  shop_id UUID REFERENCES shops(id),
  delivery_partner_id UUID REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'placed' CHECK (status IN ('placed','accepted','preparing','ready','picked_up','delivered','cancelled','rejected')),
  type TEXT NOT NULL DEFAULT 'delivery' CHECK (type IN ('delivery','pickup')),
  -- amounts
  subtotal INT NOT NULL,
  delivery_fee INT DEFAULT 0,
  platform_fee INT DEFAULT 5,
  discount INT DEFAULT 0,
  total_amount INT NOT NULL,
  -- payment
  payment_method TEXT NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod','upi')),
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending','paid','failed','refunded')),
  upi_transaction_id TEXT,
  -- delivery info
  delivery_address TEXT,
  delivery_lat DECIMAL(10,8),
  delivery_lng DECIMAL(11,8),
  delivery_instructions TEXT,
  -- timing
  estimated_delivery INT DEFAULT 30,
  accepted_at TIMESTAMPTZ,
  picked_up_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── ORDER ITEMS ──
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  product_image TEXT,
  quantity INT NOT NULL DEFAULT 1,
  price INT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── ORDER STATUS LOG ──
CREATE TABLE IF NOT EXISTS order_status_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  message TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── DELIVERY PARTNERS ──
CREATE TABLE IF NOT EXISTS delivery_partners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  is_online BOOLEAN DEFAULT FALSE,
  current_lat DECIMAL(10,8),
  current_lng DECIMAL(11,8),
  vehicle_type TEXT DEFAULT 'bike' CHECK (vehicle_type IN ('bike','cycle','scooter','car')),
  rating DECIMAL(2,1) DEFAULT 4.8,
  total_deliveries INT DEFAULT 0,
  today_deliveries INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── WALLETS ──
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance INT DEFAULT 0,
  total_earned INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── TRANSACTIONS ──
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID REFERENCES wallets(id) ON DELETE CASCADE,
  order_id UUID REFERENCES orders(id),
  amount INT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('credit','debit')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── REVIEWS ──
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID UNIQUE REFERENCES orders(id),
  customer_id UUID REFERENCES users(id),
  shop_id UUID REFERENCES shops(id),
  delivery_partner_id UUID REFERENCES users(id),
  shop_rating INT CHECK (shop_rating BETWEEN 1 AND 5),
  delivery_rating INT CHECK (delivery_rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ══════════════════════════════════════════════
-- FUNCTIONS & TRIGGERS
-- ══════════════════════════════════════════════

-- Auto-create wallet on user signup
CREATE OR REPLACE FUNCTION create_wallet_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO wallets (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_user_created_wallet ON users;
CREATE TRIGGER on_user_created_wallet
  AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION create_wallet_for_user();

-- Auto-create delivery_partner row
CREATE OR REPLACE FUNCTION create_delivery_partner_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'delivery' THEN
    INSERT INTO delivery_partners (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_delivery_user_created ON users;
CREATE TRIGGER on_delivery_user_created
  AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION create_delivery_partner_profile();

-- Generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'WLK' || TO_CHAR(NOW(), 'YYMMDDHH24MI') || UPPER(SUBSTR(NEW.id::TEXT, 1, 4));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_order_created ON orders;
CREATE TRIGGER on_order_created
  BEFORE INSERT ON orders FOR EACH ROW EXECUTE FUNCTION generate_order_number();

-- Update order updated_at
CREATE OR REPLACE FUNCTION update_order_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_order_updated ON orders;
CREATE TRIGGER on_order_updated
  BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_order_timestamp();

-- Haversine distance
CREATE OR REPLACE FUNCTION haversine(lat1 FLOAT, lng1 FLOAT, lat2 FLOAT, lng2 FLOAT)
RETURNS FLOAT AS $$
DECLARE
  r FLOAT := 6371;
  dlat FLOAT := RADIANS(lat2 - lat1);
  dlng FLOAT := RADIANS(lng2 - lng1);
  a FLOAT;
BEGIN
  a := SIN(dlat/2)^2 + COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * SIN(dlng/2)^2;
  RETURN r * 2 * ATAN2(SQRT(a), SQRT(1-a));
END;
$$ LANGUAGE plpgsql;

-- ══════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ══════════════════════════════════════════════

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- USERS policies
CREATE POLICY "users_own" ON users FOR ALL USING (auth.uid() = id);
CREATE POLICY "users_read_public" ON users FOR SELECT USING (true);

-- SHOPS policies
CREATE POLICY "shops_public_read" ON shops FOR SELECT USING (true);
CREATE POLICY "shops_owner_write" ON shops FOR ALL USING (auth.uid() = owner_id);

-- PRODUCTS policies
CREATE POLICY "products_public_read" ON products FOR SELECT USING (true);
CREATE POLICY "products_owner_write" ON products FOR ALL USING (
  auth.uid() = (SELECT owner_id FROM shops WHERE id = shop_id)
);

-- ORDERS policies
CREATE POLICY "orders_customer" ON orders FOR ALL USING (auth.uid() = customer_id);
CREATE POLICY "orders_shop_owner" ON orders FOR SELECT USING (
  auth.uid() = (SELECT owner_id FROM shops WHERE id = shop_id)
);
CREATE POLICY "orders_shop_update" ON orders FOR UPDATE USING (
  auth.uid() = (SELECT owner_id FROM shops WHERE id = shop_id)
);
CREATE POLICY "orders_delivery" ON orders FOR ALL USING (auth.uid() = delivery_partner_id);

-- ORDER ITEMS
CREATE POLICY "items_via_order" ON order_items FOR SELECT USING (
  auth.uid() = (SELECT customer_id FROM orders WHERE id = order_id)
  OR auth.uid() = (SELECT delivery_partner_id FROM orders WHERE id = order_id)
  OR auth.uid() = (SELECT owner_id FROM shops WHERE id = (SELECT shop_id FROM orders WHERE id = order_id))
);
CREATE POLICY "items_insert" ON order_items FOR INSERT WITH CHECK (true);

-- STATUS LOG
CREATE POLICY "log_read" ON order_status_log FOR SELECT USING (
  auth.uid() = (SELECT customer_id FROM orders WHERE id = order_id)
  OR auth.uid() = (SELECT delivery_partner_id FROM orders WHERE id = order_id)
  OR auth.uid() = (SELECT owner_id FROM shops WHERE id = (SELECT shop_id FROM orders WHERE id = order_id))
);
CREATE POLICY "log_insert" ON order_status_log FOR INSERT WITH CHECK (true);

-- DELIVERY PARTNERS
CREATE POLICY "dp_own" ON delivery_partners FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "dp_read" ON delivery_partners FOR SELECT USING (true);

-- WALLETS
CREATE POLICY "wallet_own" ON wallets FOR ALL USING (auth.uid() = user_id);

-- TRANSACTIONS
CREATE POLICY "tx_own" ON transactions FOR SELECT USING (
  auth.uid() = (SELECT user_id FROM wallets WHERE id = wallet_id)
);
CREATE POLICY "tx_insert" ON transactions FOR INSERT WITH CHECK (true);

-- REVIEWS
CREATE POLICY "reviews_read" ON reviews FOR SELECT USING (true);
CREATE POLICY "reviews_own" ON reviews FOR ALL USING (auth.uid() = customer_id);

-- CATEGORIES (public read only)
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_read" ON categories FOR SELECT USING (true);

-- ══════════════════════════════════════════════
-- DEFAULT DATA
-- ══════════════════════════════════════════════

INSERT INTO categories (name, icon, color, sort_order) VALUES
  ('Food & Restaurants', '🍔', '#ef4444', 1),
  ('Grocery', '🛒', '#22c55e', 2),
  ('Pharmacy & Health', '💊', '#3b82f6', 3),
  ('Electronics', '📱', '#8b5cf6', 4),
  ('Fashion', '👗', '#ec4899', 5),
  ('Stationery', '📚', '#f59e0b', 6),
  ('Hardware', '🔧', '#78716c', 7),
  ('Salon & Beauty', '💇', '#14b8a6', 8),
  ('Pet Supplies', '🐾', '#fb923c', 9),
  ('Flowers & Gifts', '🌸', '#f43f5e', 10)
ON CONFLICT DO NOTHING;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_status_log;
ALTER PUBLICATION supabase_realtime ADD TABLE delivery_partners;
