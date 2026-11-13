export type UserRole = 'super_admin' | 'restaurant_owner';
export type OrderStatus = 'new' | 'preparing' | 'ready' | 'completed' | 'cancelled';
export type FulfillmentType = 'pickup' | 'dine_in' | 'delivery';

export interface HomepageSectionConfig {
  key: 'hero' | 'offers' | 'banners' | 'categories' | 'bestsellers' | 'featured' | 'menu' | 'story' | 'gallery' | 'contact';
  label: string;
  visible: boolean;
  sort_order: number;
}

export interface StoryHighlight {
  title: string;
  subtitle: string;
}

export interface OpeningHourItem {
  days: string;
  hours: string;
  is_open: boolean;
}

export interface SocialLinks {
  instagram?: string;
  tiktok?: string;
  snapchat?: string;
  x?: string;
}

export interface Restaurant {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  owner_email?: string;
  owner_id?: string | null;
  logo_url: string;
  hero_image_url: string;
  hero_badge: string;
  hero_title: string;
  hero_subtitle: string;
  hero_primary_cta: string;
  hero_secondary_cta: string;
  story_badge: string;
  story_title: string;
  story_content: string;
  story_image_url: string;
  story_highlights: StoryHighlight[];
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  bg_color: string;
  surface_color: string;
  heading_font: string;
  body_font: string;
  theme_mode: 'dark' | 'light';
  whatsapp_number: string;
  phone: string;
  address: string;
  city: string;
  google_maps_url: string;
  opening_hours: OpeningHourItem[];
  social_links: SocialLinks;
  homepage_sections: HomepageSectionConfig[];
  internal_orders_enabled: boolean;
  delivery_fee: number;
  visits_count: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  restaurant_id?: string | null;
  created_at?: string;
}

export interface Banner {
  id: string;
  restaurant_id: string;
  title: string;
  subtitle: string;
  badge_text: string;
  button_text: string;
  button_link: string;
  image_url: string;
  sort_order: number;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
}

export interface Offer {
  id: string;
  restaurant_id: string;
  title: string;
  description: string;
  badge_text: string;
  original_price: number;
  offer_price: number;
  coupon_code?: string;
  image_url: string;
  starts_at: string;
  ends_at: string;
  is_active: boolean;
  sort_order: number;
}

export interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  slug: string;
  description: string;
  image_url: string;
  sort_order: number;
  is_visible: boolean;
}

export interface ProductSize {
  id: string;
  name: string;
  price_delta: number;
}

export interface ProductAddon {
  id: string;
  name: string;
  price: number;
}

export interface Product {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string;
  price: number;
  compare_at_price?: number | null;
  calories?: number;
  prep_time_minutes?: number;
  image_url: string;
  is_available: boolean;
  is_visible: boolean;
  is_bestseller: boolean;
  is_featured: boolean;
  is_new: boolean;
  sizes: ProductSize[];
  addons: ProductAddon[];
  views_count: number;
  orders_count: number;
  sort_order: number;
}

export interface GalleryImage {
  id: string;
  restaurant_id: string;
  title: string;
  caption: string;
  image_url: string;
  sort_order: number;
  is_visible: boolean;
}

export interface CartItem {
  cartItemId: string;
  product: Product;
  selectedSize?: ProductSize;
  selectedAddons: ProductAddon[];
  quantity: number;
  unitPrice: number;
  notes?: string;
}

export interface Order {
  id: string;
  restaurant_id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  fulfillment_type: FulfillmentType;
  customer_address?: string;
  notes?: string;
  items: {
    product_id: string;
    product_name: string;
    size_name?: string;
    addons: string[];
    quantity: number;
    unit_price: number;
    notes?: string;
  }[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: OrderStatus;
  sent_via_whatsapp: boolean;
  created_at: string;
}

export interface TenantBundle {
  restaurant: Restaurant;
  banners: Banner[];
  offers: Offer[];
  categories: Category[];
  products: Product[];
  gallery: GalleryImage[];
  orders: Order[];
}
