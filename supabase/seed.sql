-- ══════════════════════════════════════════════════════════
-- WELOKL SEED DATA
-- Run AFTER creating a business account at /auth/signup
-- ══════════════════════════════════════════════════════════

DO $$
DECLARE
  business_user_id UUID;
  food_cat UUID;
  grocery_cat UUID;
  pharma_cat UUID;
  elec_cat UUID;
  salon_cat UUID;
  shop1 UUID;
  shop2 UUID;
  shop3 UUID;
  shop4 UUID;
  shop5 UUID;
BEGIN
  -- Get first business user
  SELECT id INTO business_user_id FROM users WHERE role = 'business' LIMIT 1;
  
  IF business_user_id IS NULL THEN
    RAISE NOTICE 'Please create a business account first at /auth/signup';
    RETURN;
  END IF;

  -- Get category IDs
  SELECT id INTO food_cat FROM categories WHERE name ILIKE '%food%' LIMIT 1;
  SELECT id INTO grocery_cat FROM categories WHERE name ILIKE '%grocer%' LIMIT 1;
  SELECT id INTO pharma_cat FROM categories WHERE name ILIKE '%pharma%' LIMIT 1;
  SELECT id INTO elec_cat FROM categories WHERE name ILIKE '%electr%' LIMIT 1;
  SELECT id INTO salon_cat FROM categories WHERE name ILIKE '%salon%' LIMIT 1;

  -- ── SHOP 1: Raj's Kitchen ──
  INSERT INTO shops (owner_id, name, description, category_id, category_name, address, area, city, latitude, longitude, phone, delivery_enabled, pickup_enabled, avg_delivery_time, rating, min_order_amount)
  VALUES (business_user_id, 'Raj''s Kitchen', 'Authentic North Indian home-style cooking. From our family kitchen to your door.', food_cat, 'Food & Restaurants', 'Shop 4, Linking Road, Bandra West', 'Bandra', 'Mumbai', 19.0596, 72.8295, '9876543210', true, true, 25, 4.7, 149)
  ON CONFLICT DO NOTHING
  RETURNING id INTO shop1;

  IF shop1 IS NOT NULL THEN
    INSERT INTO products (shop_id, name, description, price, original_price, category, is_veg, sort_order) VALUES
    (shop1, 'Butter Chicken', 'Tender chicken in rich tomato-cream gravy', 220, 260, 'Main Course', false, 1),
    (shop1, 'Dal Makhani', 'Slow-cooked black lentils in buttery tomato gravy', 180, 210, 'Main Course', true, 2),
    (shop1, 'Paneer Tikka Masala', 'Cottage cheese in spicy masala', 210, 250, 'Main Course', true, 3),
    (shop1, 'Garlic Naan (2 pcs)', 'Freshly baked in tandoor', 60, 0, 'Breads', true, 4),
    (shop1, 'Steamed Rice', 'Basmati rice', 60, 0, 'Rice', true, 5),
    (shop1, 'Chicken Biryani', 'Hyderabadi dum biryani with raita', 280, 320, 'Biryani', false, 6),
    (shop1, 'Lassi (Sweet)', 'Thick creamy lassi', 80, 0, 'Drinks', true, 7),
    (shop1, 'Gulab Jamun (4 pcs)', 'Soft khoya balls in sugar syrup', 70, 0, 'Desserts', true, 8);
  END IF;

  -- ── SHOP 2: Daily Fresh Mart ──
  INSERT INTO shops (owner_id, name, description, category_id, category_name, address, area, city, latitude, longitude, phone, delivery_enabled, pickup_enabled, avg_delivery_time, rating, min_order_amount)
  VALUES (business_user_id, 'Daily Fresh Mart', 'Fresh vegetables, dairy, and daily essentials delivered in 20 minutes.', grocery_cat, 'Grocery', '12 SV Road, Andheri West', 'Andheri', 'Mumbai', 19.1136, 72.8382, '9876543211', true, true, 20, 4.5, 99)
  ON CONFLICT DO NOTHING
  RETURNING id INTO shop2;

  IF shop2 IS NOT NULL THEN
    INSERT INTO products (shop_id, name, description, price, original_price, category, is_veg, sort_order) VALUES
    (shop2, 'Amul Butter 500g', 'Pasteurised butter', 275, 295, 'Dairy', true, 1),
    (shop2, 'Tomatoes 1kg', 'Fresh farm tomatoes', 45, 60, 'Vegetables', true, 2),
    (shop2, 'Onions 2kg', 'Premium red onions', 80, 100, 'Vegetables', true, 3),
    (shop2, 'Aashirvaad Atta 5kg', 'Whole wheat flour', 289, 320, 'Staples', true, 4),
    (shop2, 'Fortune Sunflower Oil 1L', 'Refined sunflower oil', 135, 155, 'Oils', true, 5),
    (shop2, 'Amul Milk 1L', 'Full cream toned milk', 66, 0, 'Dairy', true, 6),
    (shop2, 'Eggs Tray (30)', 'Farm fresh white eggs', 210, 230, 'Dairy', false, 7),
    (shop2, 'Britannia Bread (400g)', 'Sandwich slice bread', 42, 48, 'Bakery', true, 8),
    (shop2, 'Potato 2kg', 'Washed and cleaned', 60, 80, 'Vegetables', true, 9);
  END IF;

  -- ── SHOP 3: MedPlus Health ──
  INSERT INTO shops (owner_id, name, description, category_id, category_name, address, area, city, latitude, longitude, phone, delivery_enabled, pickup_enabled, avg_delivery_time, rating, min_order_amount)
  VALUES (business_user_id, 'MedPlus Health Store', '24/7 pharmacy with medicines, vitamins, and healthcare products.', pharma_cat, 'Pharmacy & Health', '7 Juhu Tara Road, Juhu', 'Juhu', 'Mumbai', 19.1075, 72.8263, '9876543212', true, true, 15, 4.8, 0)
  ON CONFLICT DO NOTHING
  RETURNING id INTO shop3;

  IF shop3 IS NOT NULL THEN
    INSERT INTO products (shop_id, name, description, price, original_price, category, sort_order) VALUES
    (shop3, 'Crocin Advance (15 tabs)', 'Paracetamol 500mg for fever & pain', 42, 0, 'Pain Relief', 1),
    (shop3, 'Dettol Antiseptic 250ml', 'Multi-purpose antiseptic liquid', 120, 135, 'Hygiene', 2),
    (shop3, 'Vitamin C 1000mg (60 tabs)', 'Immune support supplement', 399, 450, 'Vitamins', 3),
    (shop3, 'Himalaya Face Wash 150ml', 'Neem & turmeric purifying wash', 130, 145, 'Skin Care', 4),
    (shop3, 'Azithral 500 (3 tabs)', 'Prescription antibiotic', 185, 0, 'Antibiotics', 5),
    (shop3, 'Flexon Tablet (10s)', 'Ibuprofen + paracetamol', 38, 0, 'Pain Relief', 6),
    (shop3, 'Savlon Sanitizer 500ml', 'Alcohol-based hand sanitizer', 89, 105, 'Hygiene', 7);
  END IF;

  -- ── SHOP 4: TechZone Electronics ──
  INSERT INTO shops (owner_id, name, description, category_id, category_name, address, area, city, latitude, longitude, phone, delivery_enabled, pickup_enabled, avg_delivery_time, rating, min_order_amount)
  VALUES (business_user_id, 'TechZone Electronics', 'Cables, chargers, accessories, and repairs. Open late.', elec_cat, 'Electronics', '45 Lamington Road, Grant Road', 'Grant Road', 'Mumbai', 18.9636, 72.8202, '9876543213', true, true, 40, 4.4, 299)
  ON CONFLICT DO NOTHING
  RETURNING id INTO shop4;

  IF shop4 IS NOT NULL THEN
    INSERT INTO products (shop_id, name, description, price, original_price, category, sort_order) VALUES
    (shop4, 'Type-C Charging Cable 1m', 'Fast charge 3A braided cable', 299, 499, 'Cables', 1),
    (shop4, '65W USB-C Charger', 'GaN fast charger, universal', 899, 1299, 'Chargers', 2),
    (shop4, 'Wireless Mouse', 'Bluetooth + USB-A, 1600 DPI', 699, 999, 'Peripherals', 3),
    (shop4, 'Screen Guard (Universal 6.5")', 'Anti-glare tempered glass', 149, 249, 'Accessories', 4),
    (shop4, 'Pen Drive 32GB', 'USB 3.0 high speed', 399, 549, 'Storage', 5),
    (shop4, 'Earphones with Mic', 'In-ear wired, 3.5mm jack', 249, 399, 'Audio', 6);
  END IF;

  -- ── SHOP 5: Glamour Salon ──
  INSERT INTO shops (owner_id, name, description, category_id, category_name, address, area, city, latitude, longitude, phone, delivery_enabled, pickup_enabled, avg_delivery_time, rating, min_order_amount)
  VALUES (business_user_id, 'Glamour Unisex Salon', 'Premium at-home salon services. Our professionals come to you.', salon_cat, 'Salon & Beauty', '22 Pali Hill, Bandra West', 'Bandra', 'Mumbai', 19.0545, 72.8362, '9876543214', true, false, 60, 4.9, 499)
  ON CONFLICT DO NOTHING
  RETURNING id INTO shop5;

  IF shop5 IS NOT NULL THEN
    INSERT INTO products (shop_id, name, description, price, original_price, category, sort_order) VALUES
    (shop5, 'Haircut (Men)', 'Precision cut + wash + blowdry', 399, 599, 'Hair', 1),
    (shop5, 'Haircut + Color (Women)', 'Cut, global color, blowdry', 1499, 2200, 'Hair', 2),
    (shop5, 'Bridal Makeup', 'Full professional bridal look', 4999, 7000, 'Makeup', 3),
    (shop5, 'Facial (Classic)', 'Deep cleanse + vitamin C facial', 799, 1200, 'Face', 4),
    (shop5, 'Manicure + Pedicure', 'Gel or classic', 799, 1100, 'Nails', 5),
    (shop5, 'Hair Spa', 'Deep conditioning + scalp massage', 999, 1499, 'Hair', 6);
  END IF;

  RAISE NOTICE 'Seed data created successfully!';
END $$;
