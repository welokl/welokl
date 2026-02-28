export type Role = 'customer' | 'business' | 'delivery' | 'admin'

export type OrderStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'delivered'
  | 'cancelled'
  | 'rejected'

export type OrderType = 'delivery' | 'pickup'
export type PaymentMethod = 'cod' | 'upi'
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'

export interface User {
  id: string
  name: string
  email: string
  phone?: string
  role: Role
  avatar_url?: string
  city?: string
  created_at: string
}

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  sort_order: number
}

export interface Shop {
  id: string
  owner_id: string
  name: string
  description?: string
  category_id?: string
  category_name?: string
  address: string
  area?: string
  city?: string
  latitude?: number
  longitude?: number
  phone?: string
  image_url?: string
  is_active: boolean
  is_open: boolean
  opens_at?: string
  closes_at?: string
  delivery_enabled: boolean
  pickup_enabled: boolean
  min_order_amount?: number
  avg_delivery_time?: number
  rating?: number
  total_orders?: number
  commission_percent?: number
  created_at: string
  distance?: number
}

export interface Product {
  id: string
  shop_id: string
  name: string
  description?: string
  price: number
  original_price?: number
  image_url?: string
  category?: string
  is_available: boolean
  is_veg?: boolean
  stock_count?: number
  sort_order?: number
  created_at: string
}

export interface Order {
  id: string
  order_number: string
  customer_id: string
  shop_id: string
  delivery_partner_id?: string
  status: OrderStatus
  type: OrderType
  subtotal: number
  delivery_fee: number
  platform_fee: number
  discount: number
  total_amount: number
  payment_method: PaymentMethod
  payment_status: PaymentStatus
  upi_transaction_id?: string
  delivery_address?: string
  delivery_lat?: number
  delivery_lng?: number
  delivery_instructions?: string
  estimated_delivery?: number
  accepted_at?: string
  picked_up_at?: string
  delivered_at?: string
  created_at: string
  updated_at: string
  // Joined
  shop?: Shop
  customer?: User
  delivery_partner?: User
  items?: OrderItem[]
}

export interface OrderItem {
  id: string
  order_id: string
  product_id?: string
  product_name: string
  product_image?: string
  quantity: number
  price: number
}

export interface DeliveryPartner {
  id: string
  user_id: string
  is_online: boolean
  current_lat?: number
  current_lng?: number
  vehicle_type: string
  rating?: number
  total_deliveries?: number
  today_deliveries?: number
}

export interface Wallet {
  id: string
  user_id: string
  balance: number
  total_earned: number
}

export interface Transaction {
  id: string
  wallet_id: string
  order_id?: string
  amount: number
  type: 'credit' | 'debit'
  description?: string
  created_at: string
}

export interface CartItem {
  product: Product
  quantity: number
  shop_id: string
  shop_name: string
}

// Revenue calculations
export interface OrderFees {
  subtotal: number
  delivery_fee: number
  platform_fee: number
  total_amount: number
  commission_amount: number
  partner_payout: number
  platform_earnings: number
}

export const DELIVERY_FEE = 25
export const PLATFORM_FEE = 5
export const PARTNER_PAYOUT = 20
export const FREE_DELIVERY_THRESHOLD = 399

export function calculateFees(subtotal: number, commissionPercent: number = 15, type: OrderType = 'delivery'): OrderFees {
  const delivery_fee = type === 'pickup' ? 0 : (subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : DELIVERY_FEE)
  const platform_fee = PLATFORM_FEE
  const total_amount = subtotal + delivery_fee + platform_fee
  const commission_amount = Math.round(subtotal * commissionPercent / 100)
  const partner_payout = type === 'delivery' ? PARTNER_PAYOUT : 0
  const delivery_margin = delivery_fee - partner_payout
  const platform_earnings = commission_amount + delivery_margin + platform_fee

  return {
    subtotal,
    delivery_fee,
    platform_fee,
    total_amount,
    commission_amount,
    partner_payout,
    platform_earnings,
  }
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  placed: 'Order Placed',
  accepted: 'Accepted',
  preparing: 'Being Prepared',
  ready: 'Ready for Pickup',
  picked_up: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
}

export const ORDER_STATUS_ICONS: Record<OrderStatus, string> = {
  placed: '📋',
  accepted: '✅',
  preparing: '👨‍🍳',
  ready: '📦',
  picked_up: '🛵',
  delivered: '🎉',
  cancelled: '❌',
  rejected: '🚫',
}
