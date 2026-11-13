'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
  TenantBundle,
  Product,
  ProductSize,
  ProductAddon,
  Offer,
  CartItem,
  FulfillmentType,
} from '@/types/database';
import { createClient } from '@/lib/supabase/client';

interface Props {
  initialBundle: TenantBundle;
}

/**
 * التحقق من أن العرض أو البانر يقع ضمن فترة الصلاحية الزمنية المحددة (starts_at <= الآن <= ends_at)
 */
export function isWithinDateWindow(startsAt?: string | null, endsAt?: string | null): boolean {
  const now = Date.now();
  if (startsAt) {
    const startMs = Date.parse(startsAt);
    if (!Number.isNaN(startMs) && now < startMs) return false;
  }
  if (endsAt) {
    // إذا كان التاريخ بصيغة YYYY-MM-DD نعتبره سارياً حتى نهاية اليوم 23:59:59
    const normalizedEnd = endsAt.length === 10 ? `${endsAt}T23:59:59` : endsAt;
    const endMs = Date.parse(normalizedEnd);
    if (!Number.isNaN(endMs) && now > endMs) return false;
  }
  return true;
}

export default function RestaurantStorefront({ initialBundle }: Props) {
  const { restaurant, banners, offers, categories, products, gallery } = initialBundle;
  const cartStorageKey = `restosaas_cart_${restaurant.slug}`;

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [menuFilter, setMenuFilter] = useState<'all' | 'bestseller' | 'new' | 'featured'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeBannerIdx, setActiveBannerIdx] = useState<number>(0);

  // Product Customization Modal
  const [modalProduct, setModalProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<ProductSize | undefined>(undefined);
  const [selectedAddons, setSelectedAddons] = useState<ProductAddon[]>([]);
  const [itemQuantity, setItemQuantity] = useState<number>(1);
  const [itemNotes, setItemNotes] = useState<string>('');

  // Shopping Cart Drawer (Persisted in localStorage)
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartHydrated, setCartHydrated] = useState<boolean>(false);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('pickup');
  const [customerAddress, setCustomerAddress] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState<string>('');
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [isSubmittingOrder, setIsSubmittingOrder] = useState<boolean>(false);
  const [orderSuccessToast, setOrderSuccessToast] = useState<string | null>(null);

  // استرجاع سلة المشتريات المحفوظة من localStorage عند تحميل الصفحة
  useEffect(() => {
    try {
      const savedCart = localStorage.getItem(cartStorageKey);
      if (savedCart) {
        const parsed = JSON.parse(savedCart);
        if (Array.isArray(parsed)) {
          setCart(parsed);
        }
      }
      const savedCustomer = localStorage.getItem('restosaas_customer_info');
      if (savedCustomer) {
        const c = JSON.parse(savedCustomer);
        if (c.name) setCustomerName(c.name);
        if (c.phone) setCustomerPhone(c.phone);
        if (c.address) setCustomerAddress(c.address);
      }
    } catch {
      // ignore storage errors
    } finally {
      setCartHydrated(true);
    }
  }, [cartStorageKey]);

  // حفظ السلة تلقائياً عند أي تعديل
  useEffect(() => {
    if (!cartHydrated) return;
    try {
      localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    } catch {
      // ignore storage errors
    }
  }, [cart, cartHydrated, cartStorageKey]);

  // فلترة البانرات والعروض حسب التفعيل وتاريخ البداية والنهاية
  const validBanners = useMemo(
    () =>
      (banners || [])
        .filter((b) => b.is_active && isWithinDateWindow(b.starts_at, b.ends_at))
        .sort((a, b) => a.sort_order - b.sort_order),
    [banners]
  );

  const validOffers = useMemo(
    () =>
      (offers || [])
        .filter((o) => o.is_active && isWithinDateWindow(o.starts_at, o.ends_at))
        .sort((a, b) => a.sort_order - b.sort_order),
    [offers]
  );

  const visibleCategories = useMemo(
    () => (categories || []).filter((c) => c.is_visible).sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  );

  const openProductModal = async (product: Product) => {
    setModalProduct(product);
    setSelectedSize(product.sizes?.[0] || undefined);
    setSelectedAddons([]);
    setItemQuantity(1);
    setItemNotes('');

    const supabase = createClient();
    if (supabase) {
      try {
        const viewKey = `restosaas_prod_view_${product.id}`;
        const lastViewTs = Number(sessionStorage.getItem(viewKey) || '0');
        if (Date.now() - lastViewTs > 30000) {
          sessionStorage.setItem(viewKey, String(Date.now()));
          await supabase.rpc('increment_product_view', { prod_id: product.id });
        }
      } catch {
        await supabase.rpc('increment_product_view', { prod_id: product.id });
      }
    }
  };

  const toggleAddon = (addon: ProductAddon) => {
    setSelectedAddons((prev) =>
      prev.some((a) => a.id === addon.id)
        ? prev.filter((a) => a.id !== addon.id)
        : [...prev, addon]
    );
  };

  const currentModalUnitPrice = useMemo(() => {
    if (!modalProduct) return 0;
    const base = Number(modalProduct.price) || 0;
    const sizeDelta = selectedSize ? Number(selectedSize.price_delta) : 0;
    const addonsSum = selectedAddons.reduce((acc, a) => acc + Number(a.price), 0);
    return Math.max(0, base + sizeDelta + addonsSum);
  }, [modalProduct, selectedSize, selectedAddons]);

  const handleAddToCart = () => {
    if (!modalProduct) return;
    const newItem: CartItem = {
      cartItemId: `${modalProduct.id}-${selectedSize?.id || 'std'}-${selectedAddons.map((a) => a.id).join(',')}-${Date.now()}`,
      product: modalProduct,
      selectedSize,
      selectedAddons,
      quantity: itemQuantity,
      unitPrice: currentModalUnitPrice,
      notes: itemNotes.trim() || undefined,
    };
    setCart((prev) => [...prev, newItem]);
    setModalProduct(null);
    setIsCartOpen(true);
  };

  const handleAddOfferToCart = (offer: Offer) => {
    const offerProduct: Product = {
      id: offer.id,
      restaurant_id: restaurant.id,
      category_id: visibleCategories[0]?.id || 'offer',
      name: `عرض: ${offer.title}`,
      description: offer.description,
      price: Number(offer.offer_price),
      compare_at_price: Number(offer.original_price),
      image_url: offer.image_url,
      is_available: true,
      is_visible: true,
      is_bestseller: true,
      is_featured: true,
      is_new: false,
      sizes: [],
      addons: [],
      views_count: 1,
      orders_count: 1,
      sort_order: 1,
    };

    const newItem: CartItem = {
      cartItemId: `offer-${offer.id}-${Date.now()}`,
      product: offerProduct,
      selectedSize: { id: 'offer-pack', name: 'باقة العرض الكاملة', price_delta: 0 },
      selectedAddons: [],
      quantity: 1,
      unitPrice: Number(offer.offer_price),
      notes: offer.coupon_code ? `كود العرض: ${offer.coupon_code}` : undefined,
    };

    setCart((prev) => [...prev, newItem]);
    setIsCartOpen(true);
    setOrderSuccessToast(`تمت إضافة «${offer.title}» إلى سلة الطلبات!`);
    setTimeout(() => setOrderSuccessToast(null), 3500);
  };

  const updateCartQty = (cartItemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.cartItemId === cartItemId
            ? { ...item, quantity: item.quantity + delta }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeCartItem = (cartItemId: string) => {
    setCart((prev) => prev.filter((item) => item.cartItemId !== cartItemId));
  };

  const cartSubtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart]
  );

  const deliveryFee = fulfillmentType === 'delivery' ? Number(restaurant.delivery_fee || 15) : 0;
  const cartTotal = cartSubtotal + deliveryFee;

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.is_visible) return false;
      if (selectedCategory !== 'all' && p.category_id !== selectedCategory) return false;
      if (menuFilter === 'bestseller' && !p.is_bestseller) return false;
      if (menuFilter === 'new' && !p.is_new) return false;
      if (menuFilter === 'featured' && !p.is_featured) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q);
      }
      return true;
    });
  }, [products, selectedCategory, menuFilter, searchQuery]);

  const handleWhatsAppCheckout = async () => {
    setCheckoutError(null);
    if (cart.length === 0) {
      setCheckoutError('سلة المشتريات فارغة.');
      return;
    }

    const cleanName = customerName.trim();
    const cleanPhone = customerPhone.replace(/[^0-9+]/g, '');

    if (cleanName.length < 2) {
      setCheckoutError('اسم العميل حقل إجباري (يرجى إدخال الاسم الكامل، حرفين على الأقل) قبل إرسال الطلب.');
      return;
    }

    if (cleanPhone.length < 9) {
      setCheckoutError('الرجاء إدخال رقم جوال صحيح مكون من 9 أرقام على الأقل (مثال: 0551234567).');
      return;
    }

    if (fulfillmentType === 'delivery' && customerAddress.trim().length < 5) {
      setCheckoutError('الرجاء إدخال عنوان التوصيل بالتفصيل (الحي والشارع).');
      return;
    }

    try {
      localStorage.setItem(
        'restosaas_customer_info',
        JSON.stringify({ name: cleanName, phone: cleanPhone, address: customerAddress.trim() })
      );
    } catch {
      // ignore storage errors
    }

    setIsSubmittingOrder(true);

    const fulfillmentAr =
      fulfillmentType === 'pickup'
        ? 'استلام من الفرع'
        : fulfillmentType === 'dine_in'
        ? 'محلي داخل المطعم'
        : 'توصيل للموقع';

    // إرسال المعرفات والكميات والخيارات للخادم ليقوم الخادم بحساب الأسعار والإجمالي وتوليد رقم الطلب الذري (ORD-YYYYMMDD-001)
    const orderPayload = {
      restaurant_id: restaurant.id,
      customer_name: cleanName,
      customer_phone: cleanPhone,
      fulfillment_type: fulfillmentType,
      customer_address: customerAddress.trim(),
      notes: orderNotes.trim(),
      items: cart.map((item) => ({
        product_id: item.product.id,
        size_name: item.selectedSize?.name,
        addons: item.selectedAddons.map((a) => a.name),
        quantity: item.quantity,
        notes: item.notes,
      })),
    };

    let serverOrder: {
      order_number: string;
      customer_name: string;
      customer_phone: string;
      customer_address?: string;
      notes?: string;
      items: {
        product_name: string;
        size_name?: string;
        addons: string[];
        quantity: number;
        unit_price: number;
        line_total?: number;
        notes?: string;
      }[];
      subtotal: number;
      delivery_fee: number;
      total: number;
      whatsapp_number?: string;
    } | null = null;

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });
      const data = await res.json();
      if (!res.ok || !data.order?.order_number) {
        setCheckoutError(data.error || 'تعذر إنشاء الطلب وحفظه في الخادم. يرجى المحاولة مرة أخرى.');
        setIsSubmittingOrder(false);
        return;
      }
      serverOrder = data.order;
    } catch {
      setCheckoutError('تعذر الاتصال بالخادم لتأكيد الطلب وتوليد رقم الطلب الرسمي. لا يمكن إرسال الطلب قبل حفظه.');
      setIsSubmittingOrder(false);
      return;
    } finally {
      setIsSubmittingOrder(false);
    }

    if (!serverOrder || !serverOrder.order_number || !/^ORD-\d{8}-\d{3,}$/.test(serverOrder.order_number)) {
      setCheckoutError('لم يتم استلام رقم طلب صالح من الخادم.');
      return;
    }

    const lines: string[] = [
      `*طلب جديد — ${restaurant.name}*`,
      `*رقم الطلب:* *${serverOrder.order_number}*`,
      `────────────────────`,
      `*اسم العميل:* ${serverOrder.customer_name}`,
      `*رقم الجوال:* ${serverOrder.customer_phone}`,
      `*نوع الطلب:* ${fulfillmentAr}`,
    ];
    if (fulfillmentType === 'delivery' && serverOrder.customer_address) {
      lines.push(`*عنوان التوصيل:* ${serverOrder.customer_address}`);
    }
    lines.push(`────────────────────`);
    lines.push(`*الأصناف المطلوبة (بالأسعار المعتمدة):*`);
    serverOrder.items.forEach((item, idx) => {
      const itemTotal = item.line_total ?? item.unit_price * item.quantity;
      lines.push(
        `${idx + 1}. *${item.product_name}* (×${item.quantity} × ${item.unit_price} ر.س) — *${itemTotal} ر.س*`
      );
      if (item.size_name) lines.push(`   • الحجم: ${item.size_name}`);
      if (item.addons && item.addons.length > 0) {
        lines.push(`   • الإضافات: ${item.addons.join('، ')}`);
      }
      if (item.notes) lines.push(`   • ملاحظة الصنف: ${item.notes}`);
    });
    lines.push(`────────────────────`);
    lines.push(`*المجموع الفرعي:* ${serverOrder.subtotal} ر.س`);
    if (serverOrder.delivery_fee > 0) {
      lines.push(`*رسوم التوصيل:* ${serverOrder.delivery_fee} ر.س`);
    }
    lines.push(`*الإجمالي النهائي المعتمد:* *${serverOrder.total} ر.س*`);
    if (serverOrder.notes) lines.push(`*ملاحظات عامة:* ${serverOrder.notes}`);

    const targetWhatsApp = (
      serverOrder.whatsapp_number ||
      restaurant.whatsapp_number ||
      '966535717670'
    ).replace(/[^0-9]/g, '');

    const messageText = lines.join('\n');
    const waUrl = `https://wa.me/${targetWhatsApp}?text=${encodeURIComponent(messageText)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');

    setCart([]);
    setIsCartOpen(false);
    setOrderSuccessToast(`تم تأكيد وحفظ طلبك برقم (${serverOrder.order_number}) وفتح رسالة واتساب بنجاح!`);
    setTimeout(() => setOrderSuccessToast(null), 5000);
  };

  const sortedSections = useMemo(
    () =>
      [...(restaurant.homepage_sections || [])]
        .filter((s) => s.visible)
        .sort((a, b) => a.sort_order - b.sort_order),
    [restaurant.homepage_sections]
  );

  return (
    <div
      style={
        {
          '--brand-primary': restaurant.primary_color,
          '--brand-secondary': restaurant.secondary_color,
          '--brand-accent': restaurant.accent_color,
          '--brand-bg': restaurant.bg_color,
          '--brand-surface': restaurant.surface_color,
          '--font-heading': restaurant.heading_font,
          '--font-body': restaurant.body_font,
        } as React.CSSProperties
      }
      className="min-h-screen bg-[var(--brand-bg)] text-stone-100"
    >
      {/* القسم 1: الشريط العلوي الاحترافي (Header) */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-stone-950/85 border-b border-stone-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src={restaurant.logo_url}
              alt={restaurant.name}
              className="w-12 h-12 rounded-xl object-cover border border-amber-500/40"
            />
            <div>
              <span className="text-xl font-extrabold tracking-tight text-white block">
                {restaurant.name}
              </span>
              <span className="text-xs text-stone-400 hidden sm:block">
                {restaurant.tagline}
              </span>
            </div>
          </div>

          <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-stone-300">
            <a href="#offers" className="hover:text-amber-400 transition-colors">العروض</a>
            <a href="#categories" className="hover:text-amber-400 transition-colors">الأقسام</a>
            <a href="#bestsellers" className="hover:text-amber-400 transition-colors">الأكثر طلباً</a>
            <a href="#featured" className="hover:text-amber-400 transition-colors">توصيات المطعم</a>
            <a href="#menu" className="hover:text-amber-400 transition-colors">المنيو الكامل</a>
            <a href="#story" className="hover:text-amber-400 transition-colors">قصتنا</a>
            <a href="#gallery" className="hover:text-amber-400 transition-colors">المعرض</a>
            <a href="#contact" className="hover:text-amber-400 transition-colors">موقعنا</a>
          </nav>

          <div className="flex items-center gap-3">
            <a
              href="#menu"
              className="hidden sm:inline-flex px-3.5 py-2 rounded-xl text-xs font-bold border border-stone-700 text-stone-200 hover:border-amber-500 hover:text-amber-400 transition-colors"
            >
              تصفح المنيو
            </a>
            <Link
              href={`/${restaurant.slug}/admin`}
              className="px-3.5 py-2 rounded-xl text-xs font-bold border border-stone-700 text-stone-300 hover:border-emerald-500 hover:text-emerald-400 transition-colors"
            >
              لوحة التحكم
            </Link>
            <button
              onClick={() => setIsCartOpen(true)}
              style={{ backgroundColor: restaurant.primary_color }}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-stone-950 hover:opacity-95 transition-all flex items-center gap-2 shadow-lg"
            >
              <span>السلة</span>
              <span className="px-2 py-0.5 rounded-full bg-stone-950 text-amber-400 text-xs font-extrabold">
                {cart.reduce((s, i) => s + i.quantity, 0)}
              </span>
            </button>
          </div>
        </div>
      </header>

      {/* عرض الأقسام الـ 10 الديناميكية حسب الترتيب والإظهار المحدد من لوحة التحكم */}
      {sortedSections.map((sec) => {
        // القسم 2: الواجهة الرئيسية (Hero Section)
        if (sec.key === 'hero') {
          return (
            <section key="hero" className="relative overflow-hidden py-14 md:py-24 border-b border-stone-900">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
                <div className="lg:col-span-7 space-y-6">
                  <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                    {restaurant.hero_badge}
                  </span>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.18] tracking-tight text-white">
                    {restaurant.hero_title}
                  </h1>
                  <p className="text-stone-300 text-lg leading-relaxed max-w-2xl">
                    {restaurant.hero_subtitle}
                  </p>
                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    <a
                      href="#menu"
                      style={{ backgroundColor: restaurant.primary_color }}
                      className="px-8 py-4 rounded-xl text-base font-extrabold text-stone-950 shadow-xl hover:opacity-95 transition-all"
                    >
                      {restaurant.hero_primary_cta}
                    </a>
                    <a
                      href="#offers"
                      className="px-7 py-4 rounded-xl text-base font-bold bg-stone-900 border border-stone-700 text-stone-100 hover:border-amber-500/60 transition-all"
                    >
                      {restaurant.hero_secondary_cta}
                    </a>
                  </div>
                </div>
                <div className="lg:col-span-5">
                  <div className="relative rounded-3xl overflow-hidden border border-stone-800 shadow-2xl">
                    <img
                      src={restaurant.hero_image_url}
                      alt={restaurant.name}
                      className="w-full h-[380px] sm:h-[460px] object-cover"
                    />
                  </div>
                </div>
              </div>
            </section>
          );
        }

        // القسم 3: العروض والإعلانات المؤقتة (مفلترة بتاريخ البداية والنهاية)
        if (sec.key === 'offers' && validOffers.length > 0) {
          return (
            <section id="offers" key="offers" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">عروض حصرية مؤقتة</span>
                  <h2 className="text-3xl font-extrabold text-white mt-1">أحدث عروض وباقات {restaurant.name}</h2>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {validOffers.map((offer) => (
                  <div
                    key={offer.id}
                    className="rounded-2xl overflow-hidden bg-stone-900/90 border border-stone-800 grid grid-cols-1 sm:grid-cols-12"
                  >
                    <div className="sm:col-span-5">
                      <img src={offer.image_url} alt={offer.title} className="w-full h-full min-h-[220px] object-cover" />
                    </div>
                    <div className="sm:col-span-7 p-6 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300">
                            {offer.badge_text}
                          </span>
                          {offer.ends_at && (
                            <span className="text-[11px] text-stone-400">
                              ينتهي: {offer.ends_at.slice(0, 10)}
                            </span>
                          )}
                        </div>
                        <h3 className="text-xl font-bold text-white">{offer.title}</h3>
                        <p className="text-sm text-stone-400 leading-relaxed">{offer.description}</p>
                      </div>
                      <div className="flex items-center justify-between pt-3 border-t border-stone-800">
                        <div>
                          <span className="text-xs text-stone-500 line-through block">{offer.original_price} ر.س</span>
                          <span className="text-2xl font-black text-amber-400">{offer.offer_price} ر.س</span>
                        </div>
                        <button
                          onClick={() => handleAddOfferToCart(offer)}
                          style={{ backgroundColor: restaurant.primary_color }}
                          className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-stone-950 hover:opacity-90 transition-all"
                        >
                          أضف العرض للسلة +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        }

        // القسم 4: البانرات الإعلانية المتعددة (مفلترة بتاريخ البداية والنهاية)
        if (sec.key === 'banners' && validBanners.length > 0) {
          const currentBanner = validBanners[activeBannerIdx % validBanners.length];
          return (
            <section key="banners" className="py-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="relative rounded-3xl overflow-hidden bg-stone-900 border border-stone-800">
                <div className="grid grid-cols-1 lg:grid-cols-12 items-center">
                  <div className="lg:col-span-7 p-8 md:p-12 space-y-4">
                    <span className="inline-block px-3.5 py-1 rounded-full text-xs font-bold bg-amber-500 text-stone-950">
                      {currentBanner.badge_text}
                    </span>
                    <h3 className="text-2xl md:text-4xl font-extrabold text-white">{currentBanner.title}</h3>
                    <p className="text-stone-300 text-base leading-relaxed">{currentBanner.subtitle}</p>
                    <div className="pt-2 flex items-center gap-4">
                      <a
                        href={currentBanner.button_link}
                        style={{ backgroundColor: restaurant.primary_color }}
                        className="px-6 py-3 rounded-xl text-sm font-extrabold text-stone-950"
                      >
                        {currentBanner.button_text}
                      </a>
                      <div className="flex items-center gap-2">
                        {validBanners.map((b, i) => (
                          <button
                            key={b.id}
                            onClick={() => setActiveBannerIdx(i)}
                            className={`h-2.5 rounded-full transition-all ${
                              i === activeBannerIdx % validBanners.length ? 'w-8 bg-amber-400' : 'w-2.5 bg-stone-700'
                            }`}
                            aria-label={`بانر ${i + 1}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="lg:col-span-5 h-72 lg:h-96">
                    <img src={currentBanner.image_url} alt={currentBanner.title} className="w-full h-full object-cover" />
                  </div>
                </div>
              </div>
            </section>
          );
        }

        // القسم 7: التصنيفات الرئيسية المصورة
        if (sec.key === 'categories' && visibleCategories.length > 0) {
          return (
            <section id="categories" key="categories" className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-3xl font-extrabold text-white mb-8">التصنيفات الرئيسية</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {visibleCategories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => {
                      setSelectedCategory(cat.id);
                      document.getElementById('menu')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={`group text-right rounded-2xl overflow-hidden border transition-all ${
                      selectedCategory === cat.id
                        ? 'border-amber-500 bg-stone-900'
                        : 'border-stone-800 bg-stone-900/60 hover:border-stone-700'
                    }`}
                  >
                    <div className="h-36 overflow-hidden">
                      <img
                        src={cat.image_url}
                        alt={cat.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    </div>
                    <div className="p-4">
                      <h3 className="font-bold text-white text-sm">{cat.name}</h3>
                      <p className="text-xs text-stone-400 line-clamp-1 mt-1">{cat.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          );
        }

        // القسم 5: المنتجات الأكثر طلباً (Bestsellers)
        if (sec.key === 'bestsellers') {
          const bestsellers = products.filter((p) => p.is_bestseller && p.is_visible);
          if (bestsellers.length === 0) return null;
          return (
            <section id="bestsellers" key="bestsellers" className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-8">
                <span className="text-xs font-bold text-amber-400">اختيارات العملاء الأولى</span>
                <h2 className="text-3xl font-extrabold text-white mt-1">الأصناف الأكثر طلباً</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {bestsellers.slice(0, 3).map((prod) => (
                  <div
                    key={prod.id}
                    className="rounded-2xl overflow-hidden bg-stone-900/90 border border-stone-800 flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative h-56">
                        <img src={prod.image_url} alt={prod.name} className="w-full h-full object-cover" />
                        <span className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold bg-amber-500 text-stone-950">
                          الأكثر طلباً
                        </span>
                      </div>
                      <div className="p-6 space-y-2">
                        <h3 className="text-lg font-bold text-white">{prod.name}</h3>
                        <p className="text-sm text-stone-400 line-clamp-2">{prod.description}</p>
                      </div>
                    </div>
                    <div className="px-6 pb-6 pt-3 flex items-center justify-between border-t border-stone-800/80">
                      <span className="text-xl font-black text-amber-400">{prod.price} ر.س</span>
                      <button
                        onClick={() => openProductModal(prod)}
                        style={{ backgroundColor: restaurant.primary_color }}
                        className="px-4 py-2 rounded-xl text-xs font-extrabold text-stone-950"
                      >
                        تخصيص وإضافة +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        }

        // القسم 6: الأصناف المميزة وتوصيات المطعم (Featured & Chef Recommendations)
        if (sec.key === 'featured') {
          const featuredItems = products.filter((p) => p.is_featured && p.is_visible);
          if (featuredItems.length === 0) return null;
          return (
            <section id="featured" key="featured" className="py-14 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="mb-8">
                <span className="text-xs font-bold text-amber-400">إبداعات المطبخ الحرفي</span>
                <h2 className="text-3xl font-extrabold text-white mt-1">الأصناف المميزة وتوصيات المطعم</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {featuredItems.slice(0, 3).map((prod) => (
                  <div
                    key={prod.id}
                    className="rounded-2xl overflow-hidden bg-stone-900/90 border border-stone-800 flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative h-56">
                        <img src={prod.image_url} alt={prod.name} className="w-full h-full object-cover" />
                        <span className="absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-bold bg-sky-500 text-stone-950">
                          توصية الشيف
                        </span>
                      </div>
                      <div className="p-6 space-y-2">
                        <h3 className="text-lg font-bold text-white">{prod.name}</h3>
                        <p className="text-sm text-stone-400 line-clamp-2">{prod.description}</p>
                      </div>
                    </div>
                    <div className="px-6 pb-6 pt-3 flex items-center justify-between border-t border-stone-800/80">
                      <span className="text-xl font-black text-amber-400">{prod.price} ر.س</span>
                      <button
                        onClick={() => openProductModal(prod)}
                        style={{ backgroundColor: restaurant.primary_color }}
                        className="px-4 py-2 rounded-xl text-xs font-extrabold text-stone-950"
                      >
                        تخصيص وإضافة +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        }

        // المنيو الإلكتروني الكامل (Full Interactive Menu)
        if (sec.key === 'menu') {
          return (
            <section id="menu" key="menu" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                  <span className="text-xs font-bold text-amber-400">قائمة الطعام الرقمية</span>
                  <h2 className="text-3xl font-extrabold text-white mt-1">المنيو الإلكتروني الكامل</h2>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث عن برجر، بريسكت، بطاطس..."
                    className="px-4 py-2.5 rounded-xl bg-stone-900 border border-stone-800 text-sm text-white placeholder-stone-500 focus:outline-none focus:border-amber-500 w-64"
                  />
                  {(['all', 'bestseller', 'featured', 'new'] as const).map((flt) => (
                    <button
                      key={flt}
                      onClick={() => setMenuFilter(flt)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                        menuFilter === flt
                          ? 'bg-amber-500 text-stone-950 border-amber-500'
                          : 'bg-stone-900 text-stone-300 border-stone-800'
                      }`}
                    >
                      {flt === 'all'
                        ? 'الكل'
                        : flt === 'bestseller'
                        ? 'الأكثر طلباً'
                        : flt === 'featured'
                        ? 'توصيات الشيف'
                        : 'جديدنا'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${
                    selectedCategory === 'all' ? 'bg-white text-stone-950' : 'bg-stone-900 text-stone-300'
                  }`}
                >
                  جميع الأقسام ({products.filter((p) => p.is_visible).length})
                </button>
                {visibleCategories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${
                      selectedCategory === c.id ? 'bg-white text-stone-950' : 'bg-stone-900 text-stone-300'
                    }`}
                  >
                    {c.name}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="rounded-2xl overflow-hidden bg-stone-900 border border-stone-800/90 hover:border-amber-500/40 transition-all flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative h-56 overflow-hidden">
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                        <div className="absolute top-3 right-3 flex gap-1.5">
                          {product.is_bestseller && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500 text-stone-950">
                              الأكثر طلباً
                            </span>
                          )}
                          {product.is_new && (
                            <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500 text-stone-950">
                              جديد
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="p-5 space-y-2">
                        <h3 className="text-lg font-bold text-white">{product.name}</h3>
                        <p className="text-xs text-stone-400 leading-relaxed line-clamp-2">{product.description}</p>
                      </div>
                    </div>
                    <div className="p-5 pt-3 border-t border-stone-800/80 flex items-center justify-between">
                      <div>
                        {product.compare_at_price && (
                          <span className="text-xs text-stone-500 line-through block">
                            {product.compare_at_price} ر.س
                          </span>
                        )}
                        <span className="text-xl font-black text-amber-400">{product.price} ر.س</span>
                      </div>
                      <button
                        disabled={!product.is_available}
                        onClick={() => openProductModal(product)}
                        style={{ backgroundColor: product.is_available ? restaurant.primary_color : '#44403C' }}
                        className="px-4 py-2.5 rounded-xl text-xs font-extrabold text-stone-950 hover:opacity-90 disabled:text-stone-400"
                      >
                        {product.is_available ? 'أضف للسلة +' : 'نفد حالياً'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          );
        }

        // القسم 8: عن المطعم وقصته وهويته
        if (sec.key === 'story') {
          return (
            <section id="story" key="story" className="py-16 bg-stone-900/50 border-y border-stone-900">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                <div className="lg:col-span-6 space-y-5">
                  <span className="text-xs font-bold text-amber-400">{restaurant.story_badge}</span>
                  <h2 className="text-3xl md:text-4xl font-extrabold text-white">{restaurant.story_title}</h2>
                  <p className="text-stone-300 leading-relaxed text-base">{restaurant.story_content}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3">
                    {(restaurant.story_highlights || []).map((hl, i) => (
                      <div key={i} className="p-4 rounded-xl bg-stone-900 border border-stone-800">
                        <h4 className="font-bold text-amber-400 text-sm">{hl.title}</h4>
                        <p className="text-xs text-stone-400 mt-1">{hl.subtitle}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="lg:col-span-6">
                  <img
                    src={restaurant.story_image_url}
                    alt={restaurant.story_title}
                    className="w-full h-96 object-cover rounded-3xl border border-stone-800"
                  />
                </div>
              </div>
            </section>
          );
        }

        // القسم 9: معرض الصور الاحترافي للمطعم والوجبات
        if (sec.key === 'gallery' && gallery.filter((g) => g.is_visible).length > 0) {
          return (
            <section id="gallery" key="gallery" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <h2 className="text-3xl font-extrabold text-white mb-8">جولة مصورة داخل {restaurant.name}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {gallery
                  .filter((g) => g.is_visible)
                  .map((img) => (
                    <div key={img.id} className="group relative rounded-2xl overflow-hidden border border-stone-800 h-64">
                      <img
                        src={img.image_url}
                        alt={img.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-stone-950/20 to-transparent p-5 flex flex-col justify-end">
                        <h3 className="text-base font-bold text-white">{img.title}</h3>
                        <p className="text-xs text-stone-300 mt-1">{img.caption}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          );
        }

        // القسم 10: معلومات التواصل والموقع وساعات العمل
        if (sec.key === 'contact') {
          return (
            <section id="contact" key="contact" className="py-16 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="rounded-3xl bg-stone-900 border border-stone-800 p-8 md:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-6 space-y-4">
                  <span className="text-xs font-bold text-amber-400">تفضل بزيارتنا أو تواصل معنا</span>
                  <h2 className="text-3xl font-extrabold text-white">الموقع وساعات العمل</h2>
                  <p className="text-stone-300 text-sm">{restaurant.address}</p>
                  <div className="space-y-2 pt-2">
                    {(restaurant.opening_hours || []).map((oh, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-stone-950/70 border border-stone-800 text-sm">
                        <span className="font-bold text-white">{oh.days}</span>
                        <span className="text-amber-400">{oh.hours}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="lg:col-span-6 flex flex-col justify-center gap-4">
                  <a
                    href={`https://wa.me/${restaurant.whatsapp_number.replace(/[^0-9]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-5 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 font-bold text-center hover:bg-emerald-500/25 transition-all"
                  >
                    تواصل مباشر عبر واتساب: {restaurant.phone}
                  </a>
                  <a
                    href={restaurant.google_maps_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-5 rounded-2xl bg-stone-950 border border-stone-800 text-stone-200 font-bold text-center hover:border-amber-500/50 transition-all"
                  >
                    فتح الموقع في خرائط جوجل (Google Maps)
                  </a>
                </div>
              </div>
            </section>
          );
        }

        return null;
      })}

      {/* القسم 11: تذييل فاخر (Footer) */}
      <footer className="bg-stone-950 border-t border-stone-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <p className="font-extrabold text-white text-lg">{restaurant.name}</p>
            <p className="text-xs text-stone-500 mt-1">جميع الحقوق محفوظة © {new Date().getFullYear()} — يعمل بنظام RestoSaaS للمطاعم</p>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-stone-400">
            {restaurant.social_links?.instagram && (
              <a href={restaurant.social_links.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-amber-400">
                Instagram
              </a>
            )}
            {restaurant.social_links?.tiktok && (
              <a href={restaurant.social_links.tiktok} target="_blank" rel="noopener noreferrer" className="hover:text-amber-400">
                TikTok
              </a>
            )}
            {restaurant.social_links?.snapchat && (
              <a href={restaurant.social_links.snapchat} target="_blank" rel="noopener noreferrer" className="hover:text-amber-400">
                Snapchat
              </a>
            )}
            <a href="#menu" className="hover:text-amber-400">المنيو</a>
            <a href="#offers" className="hover:text-amber-400">العروض</a>
            <Link href={`/${restaurant.slug}/admin`} className="hover:text-amber-400">بوابة مدير المطعم</Link>
            <Link href="/super-admin" className="hover:text-amber-400">إدارة المنصة</Link>
          </div>
        </div>
      </footer>

      {/* نافذة تخصيص المنتج (الأحجام والإضافات) */}
      {modalProduct && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
            <div className="relative h-52">
              <img src={modalProduct.image_url} alt={modalProduct.name} className="w-full h-full object-cover" />
              <button
                onClick={() => setModalProduct(null)}
                className="absolute top-4 left-4 w-9 h-9 rounded-full bg-stone-950/80 text-white font-bold"
              >
                ✕
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-5 flex-1">
              <div>
                <h3 className="text-xl font-extrabold text-white">{modalProduct.name}</h3>
                <p className="text-xs text-stone-400 mt-1">{modalProduct.description}</p>
              </div>

              {modalProduct.sizes?.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-amber-400 block">اختر الحجم:</label>
                  <div className="grid grid-cols-1 gap-2">
                    {modalProduct.sizes.map((sz) => (
                      <button
                        key={sz.id}
                        type="button"
                        onClick={() => setSelectedSize(sz)}
                        className={`p-3 rounded-xl border text-right flex items-center justify-between text-xs font-bold ${
                          selectedSize?.id === sz.id
                            ? 'border-amber-500 bg-amber-500/10 text-white'
                            : 'border-stone-800 bg-stone-950 text-stone-300'
                        }`}
                      >
                        <span>{sz.name}</span>
                        <span>{Number(modalProduct.price) + Number(sz.price_delta)} ر.س</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {modalProduct.addons?.length > 0 && (
                <div className="space-y-2">
                  <label className="text-xs font-bold text-amber-400 block">الإضافات الاختيارية:</label>
                  <div className="grid grid-cols-1 gap-2">
                    {modalProduct.addons.map((addon) => {
                      const active = selectedAddons.some((a) => a.id === addon.id);
                      return (
                        <button
                          key={addon.id}
                          type="button"
                          onClick={() => toggleAddon(addon)}
                          className={`p-3 rounded-xl border text-right flex items-center justify-between text-xs font-bold ${
                            active
                              ? 'border-amber-500 bg-amber-500/10 text-white'
                              : 'border-stone-800 bg-stone-950 text-stone-300'
                          }`}
                        >
                          <span>{addon.name}</span>
                          <span>+{addon.price} ر.س</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1.5">ملاحظات خاصة على الصنف:</label>
                <input
                  type="text"
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  placeholder="مثال: بدون بصل، صوص إضافي..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white"
                />
              </div>
            </div>

            <div className="p-5 bg-stone-950 border-t border-stone-800 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 bg-stone-900 px-3 py-2 rounded-xl border border-stone-800">
                <button onClick={() => setItemQuantity((q) => Math.max(1, q - 1))} className="text-lg font-bold px-2">
                  -
                </button>
                <span className="font-bold text-sm">{itemQuantity}</span>
                <button onClick={() => setItemQuantity((q) => q + 1)} className="text-lg font-bold px-2">
                  +
                </button>
              </div>
              <button
                onClick={handleAddToCart}
                style={{ backgroundColor: restaurant.primary_color }}
                className="flex-1 py-3.5 rounded-xl text-sm font-extrabold text-stone-950"
              >
                إضافة للسلة • {currentModalUnitPrice * itemQuantity} ر.س
              </button>
            </div>
          </div>
        </div>
      )}

      {/* درج سلة المشتريات وإرسال الطلب عبر واتساب */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end">
          <div className="bg-stone-900 border-r border-stone-800 w-full max-w-md h-full flex flex-col justify-between p-6 overflow-y-auto">
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-stone-800 pb-4">
                <h3 className="text-xl font-extrabold text-white">سلة الطلبات</h3>
                <button onClick={() => setIsCartOpen(false)} className="text-stone-400 hover:text-white font-bold">
                  ✕ إغلاق
                </button>
              </div>

              {cart.length === 0 ? (
                <p className="text-sm text-stone-400 py-12 text-center">السلة فارغة حالياً، أضف أصنافك المفضلة من المنيو.</p>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div key={item.cartItemId} className="p-4 rounded-2xl bg-stone-950 border border-stone-800 space-y-2">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-white">{item.product.name}</h4>
                          {item.selectedSize && (
                            <p className="text-xs text-amber-400">الحجم: {item.selectedSize.name}</p>
                          )}
                          {item.selectedAddons.length > 0 && (
                            <p className="text-xs text-stone-400">
                              الإضافات: {item.selectedAddons.map((a) => a.name).join('، ')}
                            </p>
                          )}
                          {item.notes && (
                            <p className="text-xs text-amber-300/90">ملاحظة: {item.notes}</p>
                          )}
                        </div>
                        <span className="font-extrabold text-amber-400 text-sm">
                          {item.unitPrice * item.quantity} ر.س
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => updateCartQty(item.cartItemId, -1)}
                            className="w-7 h-7 rounded-lg bg-stone-900 border border-stone-700 text-xs font-bold"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold px-2">{item.quantity}</span>
                          <button
                            onClick={() => updateCartQty(item.cartItemId, 1)}
                            className="w-7 h-7 rounded-lg bg-stone-900 border border-stone-700 text-xs font-bold"
                          >
                            +
                          </button>
                        </div>
                        <button
                          onClick={() => removeCartItem(item.cartItemId)}
                          className="text-xs text-rose-400 hover:underline font-bold"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  ))}

                  {checkoutError && (
                    <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold">
                      {checkoutError}
                    </div>
                  )}

                  <div className="space-y-3 pt-4 border-t border-stone-800">
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="الاسم الكامل *"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white"
                    />
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="رقم الجوال (05xxxxxxxx) *"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      {(['pickup', 'dine_in', 'delivery'] as const).map((ft) => (
                        <button
                          key={ft}
                          type="button"
                          onClick={() => setFulfillmentType(ft)}
                          className={`py-2 rounded-xl text-xs font-bold border ${
                            fulfillmentType === ft
                              ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                              : 'border-stone-800 bg-stone-950 text-stone-400'
                          }`}
                        >
                          {ft === 'pickup' ? 'استلام فرع' : ft === 'dine_in' ? 'محلي' : 'توصيل'}
                        </button>
                      ))}
                    </div>
                    {fulfillmentType === 'delivery' && (
                      <input
                        type="text"
                        required
                        value={customerAddress}
                        onChange={(e) => setCustomerAddress(e.target.value)}
                        placeholder="عنوان التوصيل بالتفصيل (الحي، الشارع) *"
                        className="w-full px-3.5 py-2.5 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white"
                      />
                    )}
                    <textarea
                      value={orderNotes}
                      onChange={(e) => setOrderNotes(e.target.value)}
                      placeholder="ملاحظات إضافية على الطلب..."
                      rows={2}
                      className="w-full px-3.5 py-2 rounded-xl bg-stone-950 border border-stone-800 text-xs text-white"
                    />
                  </div>
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="pt-4 border-t border-stone-800 space-y-3">
                <div className="space-y-1 text-xs text-stone-400">
                  <div className="flex justify-between">
                    <span>المجموع الفرعي:</span>
                    <span>{cartSubtotal} ر.س</span>
                  </div>
                  {deliveryFee > 0 && (
                    <div className="flex justify-between">
                      <span>رسوم التوصيل:</span>
                      <span>{deliveryFee} ر.س</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-white pt-1">
                    <span>الإجمالي الكلي:</span>
                    <span className="text-amber-400 text-lg">{cartTotal} ر.س</span>
                  </div>
                </div>
                <button
                  disabled={isSubmittingOrder}
                  onClick={handleWhatsAppCheckout}
                  className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-stone-950 font-extrabold text-sm transition-all"
                >
                  {isSubmittingOrder ? 'جاري تسجيل الطلب...' : 'إرسال الطلب عبر واتساب وتأكيده الآن'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {orderSuccessToast && (
        <div className="fixed bottom-6 left-6 z-50 bg-emerald-500 text-stone-950 px-5 py-3 rounded-2xl font-bold text-xs shadow-xl">
          {orderSuccessToast}
        </div>
      )}
    </div>
  );
}
