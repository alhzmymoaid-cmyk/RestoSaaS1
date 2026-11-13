'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  TenantBundle,
  Product,
  ProductSize,
  ProductAddon,
  Category,
  Banner,
  Offer,
  GalleryImage,
  OrderStatus,
} from '@/types/database';
import { createClient } from '@/lib/supabase/client';

interface Props {
  initialBundle: TenantBundle;
}

export default function RestaurantAdminDashboard({ initialBundle }: Props) {
  const [bundle, setBundle] = useState<TenantBundle>(initialBundle);
  const [activeTab, setActiveTab] = useState<'homepage' | 'menu' | 'identity' | 'orders' | 'analytics'>('homepage');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');

  // --- Banner Editor State ---
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [banTitle, setBanTitle] = useState('');
  const [banSubtitle, setBanSubtitle] = useState('');
  const [banBadge, setBanBadge] = useState('عرض حصري');
  const [banBtnText, setBanBtnText] = useState('اطلب الآن');
  const [banBtnLink, setBanBtnLink] = useState('#menu');
  const [banImage, setBanImage] = useState('/images/burger-house/banner-family-feast.jpg');
  const [banStartsAt, setBanStartsAt] = useState('2026-11-01');
  const [banEndsAt, setBanEndsAt] = useState('2026-12-31');

  // --- Timed Offer Editor State ---
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [offTitle, setOffTitle] = useState('');
  const [offDesc, setOffDesc] = useState('');
  const [offBadge, setOffBadge] = useState('لفترة محدودة');
  const [offOrigPrice, setOffOrigPrice] = useState('180');
  const [offPrice, setOffPrice] = useState('139');
  const [offCoupon, setOffCoupon] = useState('');
  const [offImage, setOffImage] = useState('/images/burger-house/banner-family-feast.jpg');
  const [offStartsAt, setOffStartsAt] = useState('2026-11-01');
  const [offEndsAt, setOffEndsAt] = useState('2026-12-31');

  // --- Category Editor State ---
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [catImage, setCatImage] = useState('/images/burger-house/hero-wagyu-smash.jpg');

  // --- Product Editor State (Create & Edit) ---
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [prodName, setProdName] = useState('');
  const [prodDesc, setProdDesc] = useState('');
  const [prodPrice, setProdPrice] = useState('46');
  const [prodComparePrice, setProdComparePrice] = useState('');
  const [prodCalories, setProdCalories] = useState('720');
  const [prodPrepTime, setProdPrepTime] = useState('12');
  const [prodCategory, setProdCategory] = useState(bundle.categories[0]?.id || '');
  const [prodImage, setProdImage] = useState('/images/burger-house/truffle-wagyu-burger.jpg');
  const [prodSizesText, setProdSizesText] = useState('سنجل:-9, دبل كلاسيك:0, تربل:+14');
  const [prodAddonsText, setProdAddonsText] = useState('جبن شيدر إضافي:5, بيكون بقري مدخن:8, تحويل إلى وجبة:14');
  const [prodIsBestseller, setProdIsBestseller] = useState(false);
  const [prodIsFeatured, setProdIsFeatured] = useState(true);
  const [prodIsNew, setProdIsNew] = useState(true);

  // --- Gallery Editor State ---
  const [galTitle, setGalTitle] = useState('');
  const [galCaption, setGalCaption] = useState('');
  const [galImage, setGalImage] = useState('/images/burger-house/interior-lounge.jpg');

  // --- New Opening Hours Row ---
  const [newHoursDays, setNewHoursDays] = useState('');
  const [newHoursTime, setNewHoursTime] = useState('');

  const notifySaved = (msg: string) => {
    setErrorMessage(null);
    setSaveMessage(msg);
    setTimeout(() => setSaveMessage(null), 4000);
  };

  const notifyError = (msg: string) => {
    setSaveMessage(null);
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  // ============================================================================
  // 1. حفظ جميع إعدادات المطعم والواجهة الرئيسية والهوية والشعار في Supabase
  // ============================================================================
  const handleSaveRestaurantSettings = async () => {
    const r = bundle.restaurant;
    const supabase = createClient();
    if (supabase) {
      const { error } = await supabase
        .from('restaurants')
        .update({
          name: r.name,
          tagline: r.tagline,
          description: r.description,
          logo_url: r.logo_url,
          hero_image_url: r.hero_image_url,
          hero_badge: r.hero_badge,
          hero_title: r.hero_title,
          hero_subtitle: r.hero_subtitle,
          hero_primary_cta: r.hero_primary_cta,
          hero_secondary_cta: r.hero_secondary_cta,
          story_badge: r.story_badge,
          story_title: r.story_title,
          story_content: r.story_content,
          story_image_url: r.story_image_url,
          story_highlights: r.story_highlights,
          primary_color: r.primary_color,
          secondary_color: r.secondary_color,
          accent_color: r.accent_color,
          bg_color: r.bg_color,
          surface_color: r.surface_color,
          heading_font: r.heading_font,
          body_font: r.body_font,
          whatsapp_number: r.whatsapp_number,
          phone: r.phone,
          address: r.address,
          city: r.city,
          google_maps_url: r.google_maps_url,
          delivery_fee: Number(r.delivery_fee) || 0,
          internal_orders_enabled: r.internal_orders_enabled,
          opening_hours: r.opening_hours,
          social_links: r.social_links,
          homepage_sections: r.homepage_sections,
          updated_at: new Date().toISOString(),
        })
        .eq('id', r.id);

      if (error) {
        notifyError(`تعذر حفظ الإعدادات في قاعدة البيانات: ${error.message}`);
        return;
      }
    }
    notifySaved('تم حفظ جميع الإعدادات والصور والهوية في قاعدة البيانات وتحديث الموقع العام فوراً!');
  };

  // ============================================================================
  // 2. رفع الصور مباشرة من الجوال / الكاميرا إلى Supabase Storage (معزول لكل مطعم)
  // ============================================================================
  const handleMobileImageUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    onUrlReady: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('restaurantSlug', bundle.restaurant.slug);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        onUrlReady(data.url);
        notifySaved('تم رفع الصورة وتخزينها في مجلد المطعم المعزول في Supabase Storage بنجاح!');
        return;
      }
      if (res.status === 401 || res.status === 403 || res.status === 400) {
        notifyError(data.error || 'غير مصرح برفع الصورة.');
        return;
      }
    } catch {
      // Fallback to local Data URL in preview mode
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onUrlReady(reader.result);
        notifySaved('تم استيراد الصورة من الجهاز بنجاح! اضغط حفظ لتثبيت التغييرات.');
      }
    };
    reader.readAsDataURL(file);
  };

  // ============================================================================
  // 3. ترتيب أقسام الصفحة الرئيسية وإظهار / إخفاء أي قسم مع الحفظ الفوري في Supabase
  // ============================================================================
  const persistHomepageSections = async (updatedSections: typeof bundle.restaurant.homepage_sections) => {
    setBundle((prev) => ({
      ...prev,
      restaurant: { ...prev.restaurant, homepage_sections: updatedSections },
    }));
    const supabase = createClient();
    if (supabase) {
      await supabase
        .from('restaurants')
        .update({ homepage_sections: updatedSections, updated_at: new Date().toISOString() })
        .eq('id', bundle.restaurant.id);
    }
  };

  const toggleSectionVisibility = async (key: string) => {
    const updated = bundle.restaurant.homepage_sections.map((s) =>
      s.key === key ? { ...s, visible: !s.visible } : s
    );
    await persistHomepageSections(updated);
    notifySaved('تم تحديث حالة ظهور القسم وحفظها في قاعدة البيانات!');
  };

  const moveSectionOrder = async (key: string, direction: -1 | 1) => {
    const sorted = [...bundle.restaurant.homepage_sections].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((s) => s.key === key);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return;

    const tempOrder = sorted[idx].sort_order;
    sorted[idx] = { ...sorted[idx], sort_order: sorted[swapIdx].sort_order };
    sorted[swapIdx] = { ...sorted[swapIdx], sort_order: tempOrder };

    const normalized = sorted
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((s, i) => ({ ...s, sort_order: i + 1 }));

    await persistHomepageSections(normalized);
    notifySaved('تم تغيير ترتيب أقسام الصفحة الرئيسية وحفظه في قاعدة البيانات!');
  };

  // ============================================================================
  // 4. إدارة البانرات الإعلانية (إضافة، تعديل، ترتيب، تفعيل، حذف في Supabase)
  // ============================================================================
  const handleSaveBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!banTitle.trim()) return;

    const supabase = createClient();

    if (editingBannerId) {
      const updates = {
        title: banTitle.trim(),
        subtitle: banSubtitle.trim(),
        badge_text: banBadge.trim(),
        button_text: banBtnText.trim(),
        button_link: banBtnLink.trim() || '#menu',
        image_url: banImage,
        starts_at: banStartsAt,
        ends_at: banEndsAt,
      };
      if (supabase) {
        const { error } = await supabase.from('banners').update(updates).eq('id', editingBannerId);
        if (error) return notifyError(error.message);
      }
      setBundle((prev) => ({
        ...prev,
        banners: prev.banners.map((b) => (b.id === editingBannerId ? { ...b, ...updates } : b)),
      }));
      setEditingBannerId(null);
      notifySaved('تم تعديل البانر الإعلاني وحفظه في قاعدة البيانات!');
    } else {
      const newBanner: Banner = {
        id: crypto.randomUUID(),
        restaurant_id: bundle.restaurant.id,
        title: banTitle.trim(),
        subtitle: banSubtitle.trim(),
        badge_text: banBadge.trim(),
        button_text: banBtnText.trim(),
        button_link: banBtnLink.trim() || '#menu',
        image_url: banImage,
        sort_order: bundle.banners.length + 1,
        starts_at: banStartsAt,
        ends_at: banEndsAt,
        is_active: true,
      };
      if (supabase) {
        const { data, error } = await supabase.from('banners').insert(newBanner).select().single();
        if (error) return notifyError(error.message);
        if (data) newBanner.id = data.id;
      }
      setBundle((prev) => ({ ...prev, banners: [...prev.banners, newBanner] }));
      notifySaved('تمت إضافة البانر الإعلاني الجديد وحفظه في قاعدة البيانات!');
    }

    setBanTitle('');
    setBanSubtitle('');
  };

  const handleLoadBannerForEdit = (b: Banner) => {
    setEditingBannerId(b.id);
    setBanTitle(b.title);
    setBanSubtitle(b.subtitle);
    setBanBadge(b.badge_text);
    setBanBtnText(b.button_text);
    setBanBtnLink(b.button_link);
    setBanImage(b.image_url);
    setBanStartsAt((b.starts_at || '2026-11-01').slice(0, 10));
    setBanEndsAt((b.ends_at || '2026-12-31').slice(0, 10));
  };

  const handleToggleBannerActive = async (banner: Banner) => {
    const nextState = !banner.is_active;
    const supabase = createClient();
    if (supabase) {
      const { error } = await supabase.from('banners').update({ is_active: nextState }).eq('id', banner.id);
      if (error) return notifyError(error.message);
    }
    setBundle((prev) => ({
      ...prev,
      banners: prev.banners.map((b) => (b.id === banner.id ? { ...b, is_active: nextState } : b)),
    }));
    notifySaved('تم تحديث حالة تفعيل البانر في قاعدة البيانات!');
  };

  const handleDeleteBanner = async (bannerId: string) => {
    const supabase = createClient();
    if (supabase) {
      const { error } = await supabase.from('banners').delete().eq('id', bannerId);
      if (error) return notifyError(error.message);
    }
    setBundle((prev) => ({
      ...prev,
      banners: prev.banners.filter((b) => b.id !== bannerId),
    }));
    notifySaved('تم حذف البانر الإعلاني من قاعدة البيانات!');
  };

  // ============================================================================
  // 5. إدارة العروض المؤقتة (إضافة، تعديل، تحديد تاريخ البداية والنهاية، حذف)
  // ============================================================================
  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offTitle.trim()) return;
    const supabase = createClient();

    if (editingOfferId) {
      const updates = {
        title: offTitle.trim(),
        description: offDesc.trim(),
        badge_text: offBadge.trim(),
        original_price: Number(offOrigPrice) || 0,
        offer_price: Number(offPrice) || 0,
        coupon_code: offCoupon.trim(),
        image_url: offImage,
        starts_at: offStartsAt,
        ends_at: offEndsAt,
      };
      if (supabase) {
        const { error } = await supabase.from('offers').update(updates).eq('id', editingOfferId);
        if (error) return notifyError(error.message);
      }
      setBundle((prev) => ({
        ...prev,
        offers: prev.offers.map((o) => (o.id === editingOfferId ? { ...o, ...updates } : o)),
      }));
      setEditingOfferId(null);
      notifySaved('تم تعديل العرض المؤقت وحفظه في قاعدة البيانات!');
    } else {
      const newOffer: Offer = {
        id: crypto.randomUUID(),
        restaurant_id: bundle.restaurant.id,
        title: offTitle.trim(),
        description: offDesc.trim(),
        badge_text: offBadge.trim(),
        original_price: Number(offOrigPrice) || 0,
        offer_price: Number(offPrice) || 0,
        coupon_code: offCoupon.trim(),
        image_url: offImage,
        starts_at: offStartsAt,
        ends_at: offEndsAt,
        is_active: true,
        sort_order: bundle.offers.length + 1,
      };
      if (supabase) {
        const { data, error } = await supabase.from('offers').insert(newOffer).select().single();
        if (error) return notifyError(error.message);
        if (data) newOffer.id = data.id;
      }
      setBundle((prev) => ({ ...prev, offers: [newOffer, ...prev.offers] }));
      notifySaved('تم إنشاء العرض المؤقت وحفظه في قاعدة البيانات!');
    }

    setOffTitle('');
    setOffDesc('');
  };

  const handleLoadOfferForEdit = (o: Offer) => {
    setEditingOfferId(o.id);
    setOffTitle(o.title);
    setOffDesc(o.description);
    setOffBadge(o.badge_text);
    setOffOrigPrice(String(o.original_price));
    setOffPrice(String(o.offer_price));
    setOffCoupon(o.coupon_code || '');
    setOffImage(o.image_url);
    setOffStartsAt((o.starts_at || '2026-11-01').slice(0, 10));
    setOffEndsAt((o.ends_at || '2026-12-31').slice(0, 10));
  };

  const handleToggleOfferActive = async (offer: Offer) => {
    const nextState = !offer.is_active;
    const supabase = createClient();
    if (supabase) {
      const { error } = await supabase.from('offers').update({ is_active: nextState }).eq('id', offer.id);
      if (error) return notifyError(error.message);
    }
    setBundle((prev) => ({
      ...prev,
      offers: prev.offers.map((o) => (o.id === offer.id ? { ...o, is_active: nextState } : o)),
    }));
    notifySaved('تم تحديث حالة العرض المؤقت في قاعدة البيانات!');
  };

  const handleDeleteOffer = async (offerId: string) => {
    const supabase = createClient();
    if (supabase) {
      const { error } = await supabase.from('offers').delete().eq('id', offerId);
      if (error) return notifyError(error.message);
    }
    setBundle((prev) => ({
      ...prev,
      offers: prev.offers.filter((o) => o.id !== offerId),
    }));
    notifySaved('تم حذف العرض المؤقت من قاعدة البيانات!');
  };

  // ============================================================================
  // 6. إدارة أقسام المنيو (إضافة، تعديل، ترتيب، إخفاء/إظهار، حذف في Supabase)
  // ============================================================================
  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    const cleanSlug =
      (catSlug.trim() || catName.trim())
        .toLowerCase()
        .replace(/[^a-z0-9؀-ۿ-]+/g, '-') +
      '-' +
      Math.floor(10 + Math.random() * 89);

    const supabase = createClient();

    if (editingCategoryId) {
      const updates = {
        name: catName.trim(),
        description: catDesc.trim(),
        image_url: catImage,
      };
      if (supabase) {
        const { error } = await supabase.from('categories').update(updates).eq('id', editingCategoryId);
        if (error) return notifyError(error.message);
      }
      setBundle((prev) => ({
        ...prev,
        categories: prev.categories.map((c) => (c.id === editingCategoryId ? { ...c, ...updates } : c)),
      }));
      setEditingCategoryId(null);
      notifySaved('تم تعديل قسم المنيو وحفظه في قاعدة البيانات!');
    } else {
      const newCat: Category = {
        id: crypto.randomUUID(),
        restaurant_id: bundle.restaurant.id,
        name: catName.trim(),
        slug: cleanSlug,
        description: catDesc.trim(),
        image_url: catImage,
        sort_order: bundle.categories.length + 1,
        is_visible: true,
      };
      if (supabase) {
        const { data, error } = await supabase.from('categories').insert(newCat).select().single();
        if (error) return notifyError(error.message);
        if (data) newCat.id = data.id;
      }
      setBundle((prev) => ({ ...prev, categories: [...prev.categories, newCat] }));
      if (!prodCategory) setProdCategory(newCat.id);
      notifySaved('تم إنشاء قسم المنيو الجديد وحفظه في قاعدة البيانات!');
    }

    setCatName('');
    setCatSlug('');
    setCatDesc('');
  };

  const handleToggleCategoryVisible = async (cat: Category) => {
    const nextVis = !cat.is_visible;
    const supabase = createClient();
    if (supabase) {
      const { error } = await supabase.from('categories').update({ is_visible: nextVis }).eq('id', cat.id);
      if (error) return notifyError(error.message);
    }
    setBundle((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === cat.id ? { ...c, is_visible: nextVis } : c)),
    }));
    notifySaved('تم تحديث حالة ظهور القسم في قاعدة البيانات!');
  };

  const handleMoveCategoryOrder = async (catId: string, direction: -1 | 1) => {
    const sorted = [...bundle.categories].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex((c) => c.id === catId);
    const swapIdx = idx + direction;
    if (idx === -1 || swapIdx < 0 || swapIdx >= sorted.length) return;

    const a = sorted[idx];
    const b = sorted[swapIdx];
    const supabase = createClient();
    if (supabase) {
      await Promise.all([
        supabase.from('categories').update({ sort_order: b.sort_order }).eq('id', a.id),
        supabase.from('categories').update({ sort_order: a.sort_order }).eq('id', b.id),
      ]);
    }

    sorted[idx] = { ...a, sort_order: b.sort_order };
    sorted[swapIdx] = { ...b, sort_order: a.sort_order };
    setBundle((prev) => ({
      ...prev,
      categories: sorted.sort((x, y) => x.sort_order - y.sort_order),
    }));
    notifySaved('تم تحديث ترتيب أقسام المنيو في قاعدة البيانات!');
  };

  const handleDeleteCategory = async (catId: string) => {
    const supabase = createClient();
    if (supabase) {
      const { error } = await supabase.from('categories').delete().eq('id', catId);
      if (error) return notifyError(error.message);
    }
    setBundle((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c.id !== catId),
    }));
    notifySaved('تم حذف القسم من قاعدة البيانات!');
  };

  // ============================================================================
  // 7. إدارة المنتجات والأحجام والإضافات (إضافة، تعديل كامل، إخفاء، حذف في Supabase)
  // ============================================================================
  const parseSizesInput = (raw: string): ProductSize[] =>
    raw
      .split(',')
      .map((part, idx) => {
        const [name, delta] = part.split(':');
        if (!name || !name.trim()) return null;
        return { id: `sz-${idx + 1}`, name: name.trim(), price_delta: Number(delta) || 0 };
      })
      .filter((x): x is ProductSize => x !== null);

  const parseAddonsInput = (raw: string): ProductAddon[] =>
    raw
      .split(',')
      .map((part, idx) => {
        const [name, price] = part.split(':');
        if (!name || !name.trim()) return null;
        return { id: `ad-${idx + 1}`, name: name.trim(), price: Number(price) || 0 };
      })
      .filter((x): x is ProductAddon => x !== null);

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) return;

    const targetCategoryId = prodCategory || bundle.categories[0]?.id;
    const belongsToThisRestaurant = bundle.categories.some(
      (c) => c.id === targetCategoryId && c.restaurant_id === bundle.restaurant.id
    );
    if (!belongsToThisRestaurant) {
      notifyError('خطأ أمني: لا يمكن ربط المنتج بقسم لا ينتمي إلى هذا المطعم.');
      return;
    }

    const parsedSizes = parseSizesInput(prodSizesText);
    const parsedAddons = parseAddonsInput(prodAddonsText);
    const supabase = createClient();

    if (editingProductId) {
      const updates = {
        category_id: prodCategory || bundle.categories[0]?.id,
        name: prodName.trim(),
        description: prodDesc.trim(),
        price: Number(prodPrice) || 0,
        compare_at_price: prodComparePrice ? Number(prodComparePrice) : null,
        calories: Number(prodCalories) || 650,
        prep_time_minutes: Number(prodPrepTime) || 12,
        image_url: prodImage,
        is_bestseller: prodIsBestseller,
        is_featured: prodIsFeatured,
        is_new: prodIsNew,
        sizes: parsedSizes,
        addons: parsedAddons,
        updated_at: new Date().toISOString(),
      };

      if (supabase) {
        const { error } = await supabase.from('products').update(updates).eq('id', editingProductId);
        if (error) return notifyError(error.message);
      }

      setBundle((prev) => ({
        ...prev,
        products: prev.products.map((p) => (p.id === editingProductId ? { ...p, ...updates } : p)),
      }));
      setEditingProductId(null);
      notifySaved('تم حفظ تعديلات المنتج والأحجام والإضافات في قاعدة البيانات!');
    } else {
      const created: Product = {
        id: crypto.randomUUID(),
        restaurant_id: bundle.restaurant.id,
        category_id: prodCategory || bundle.categories[0]?.id,
        name: prodName.trim(),
        description: prodDesc.trim(),
        price: Number(prodPrice) || 0,
        compare_at_price: prodComparePrice ? Number(prodComparePrice) : null,
        calories: Number(prodCalories) || 650,
        prep_time_minutes: Number(prodPrepTime) || 12,
        image_url: prodImage,
        is_available: true,
        is_visible: true,
        is_bestseller: prodIsBestseller,
        is_featured: prodIsFeatured,
        is_new: prodIsNew,
        sizes: parsedSizes,
        addons: parsedAddons,
        views_count: 1,
        orders_count: 0,
        sort_order: bundle.products.length + 1,
      };

      if (supabase) {
        const { data, error } = await supabase.from('products').insert(created).select().single();
        if (error) return notifyError(error.message);
        if (data) created.id = data.id;
      }

      setBundle((prev) => ({ ...prev, products: [created, ...prev.products] }));
      notifySaved('تمت إضافة الصنف الجديد مع الأحجام والإضافات إلى قاعدة البيانات!');
    }

    setProdName('');
    setProdDesc('');
    setProdComparePrice('');
  };

  const handleLoadProductForEdit = (p: Product) => {
    setEditingProductId(p.id);
    setProdName(p.name);
    setProdDesc(p.description);
    setProdPrice(String(p.price));
    setProdComparePrice(p.compare_at_price ? String(p.compare_at_price) : '');
    setProdCalories(String(p.calories || 680));
    setProdPrepTime(String(p.prep_time_minutes || 12));
    setProdCategory(p.category_id);
    setProdImage(p.image_url);
    setProdIsBestseller(Boolean(p.is_bestseller));
    setProdIsFeatured(Boolean(p.is_featured));
    setProdIsNew(Boolean(p.is_new));
    setProdSizesText((p.sizes || []).map((s) => `${s.name}:${s.price_delta}`).join(', '));
    setProdAddonsText((p.addons || []).map((a) => `${a.name}:${a.price}`).join(', '));
  };

  const handleUpdateProductInline = async (prodId: string, updates: Partial<Product>) => {
    const supabase = createClient();
    if (supabase) {
      const { error } = await supabase
        .from('products')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', prodId);
      if (error) return notifyError(error.message);
    }
    setBundle((prev) => ({
      ...prev,
      products: prev.products.map((p) => (p.id === prodId ? { ...p, ...updates } : p)),
    }));
    notifySaved('تم تحديث بيانات المنتج في قاعدة البيانات!');
  };

  const handleDeleteProduct = async (prodId: string) => {
    const supabase = createClient();
    if (supabase) {
      const { error } = await supabase.from('products').delete().eq('id', prodId);
      if (error) return notifyError(error.message);
    }
    setBundle((prev) => ({
      ...prev,
      products: prev.products.filter((item) => item.id !== prodId),
    }));
    notifySaved('تم حذف الصنف نهائياً من قاعدة البيانات!');
  };

  // ============================================================================
  // 8. إدارة معرض الصور (إضافة وحذف في جدول gallery_images)
  // ============================================================================
  const handleAddGalleryImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!galTitle.trim()) return;
    const newImg: GalleryImage = {
      id: crypto.randomUUID(),
      restaurant_id: bundle.restaurant.id,
      title: galTitle.trim(),
      caption: galCaption.trim(),
      image_url: galImage,
      sort_order: bundle.gallery.length + 1,
      is_visible: true,
    };
    const supabase = createClient();
    if (supabase) {
      const { data, error } = await supabase.from('gallery_images').insert(newImg).select().single();
      if (error) return notifyError(error.message);
      if (data) newImg.id = data.id;
    }
    setBundle((prev) => ({ ...prev, gallery: [...prev.gallery, newImg] }));
    setGalTitle('');
    setGalCaption('');
    notifySaved('تمت إضافة الصورة إلى معرض المطعم في قاعدة البيانات!');
  };

  const handleDeleteGalleryImage = async (imgId: string) => {
    const supabase = createClient();
    if (supabase) {
      const { error } = await supabase.from('gallery_images').delete().eq('id', imgId);
      if (error) return notifyError(error.message);
    }
    setBundle((prev) => ({
      ...prev,
      gallery: prev.gallery.filter((g) => g.id !== imgId),
    }));
    notifySaved('تم حذف الصورة من معرض المطعم!');
  };

  // ============================================================================
  // 9. إدارة الطلبات الواردة وتحديث حالتها في Supabase
  // ============================================================================
  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const supabase = createClient();
    if (supabase) {
      const { error } = await supabase
        .from('orders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', orderId);
      if (error) return notifyError(error.message);
    }
    setBundle((prev) => ({
      ...prev,
      orders: prev.orders.map((o) => (o.id === orderId ? { ...o, status } : o)),
    }));
    notifySaved('تم تحديث حالة الطلب وحفظها في قاعدة البيانات!');
  };

  const sortedHomepageSections = useMemo(
    () => [...(bundle.restaurant.homepage_sections || [])].sort((a, b) => a.sort_order - b.sort_order),
    [bundle.restaurant.homepage_sections]
  );

  const filteredOrders = useMemo(
    () =>
      orderStatusFilter === 'all'
        ? bundle.orders
        : bundle.orders.filter((o) => o.status === orderStatusFilter),
    [bundle.orders, orderStatusFilter]
  );

  const productsByViews = useMemo(
    () => [...bundle.products].sort((a, b) => (b.views_count || 0) - (a.views_count || 0)),
    [bundle.products]
  );

  const productsByOrders = useMemo(
    () => [...bundle.products].sort((a, b) => (b.orders_count || 0) - (a.orders_count || 0)),
    [bundle.products]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col lg:flex-row">
      {/* القائمة الجانبية للوحة تحكم صاحب المطعم */}
      <aside className="w-full lg:w-72 bg-slate-900 border-l border-slate-800 p-6 flex flex-col justify-between">
        <div className="space-y-6">
          <div className="pb-4 border-b border-slate-800 flex items-center gap-3">
            <img
              src={bundle.restaurant.logo_url}
              alt={bundle.restaurant.name}
              className="w-12 h-12 rounded-xl object-cover border border-emerald-500/40"
            />
            <div>
              <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
                لوحة تحكم صاحب المطعم
              </span>
              <h1 className="text-base font-extrabold text-white">{bundle.restaurant.name}</h1>
              <p className="text-[11px] text-slate-400 font-mono">/{bundle.restaurant.slug}</p>
            </div>
          </div>

          <nav className="space-y-2">
            {[
              { id: 'homepage', label: '1. الصفحة الرئيسية والبانرات والعروض' },
              { id: 'menu', label: `2. إدارة المنيو والأقسام (${bundle.products.length})` },
              { id: 'identity', label: '3. الهوية والألوان والقصص والمعرض' },
              { id: 'orders', label: `4. الطلبات الواردة (${bundle.orders.length})` },
              { id: 'analytics', label: '5. الإحصائيات والأكثر مشاهدة وطلباً' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id as typeof activeTab)}
                className={`w-full text-right px-4 py-3 rounded-xl text-xs font-bold transition-all ${
                  activeTab === t.id
                    ? 'bg-emerald-500 text-slate-950 font-extrabold shadow-lg'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="pt-6 border-t border-slate-800 space-y-2">
          <Link
            href={`/${bundle.restaurant.slug}`}
            className="block w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-center text-xs font-extrabold text-slate-950"
          >
            معاينة موقع العميل الحي ↗
          </Link>
          <Link
            href="/super-admin"
            className="block w-full py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-center text-xs font-bold text-slate-300"
          >
            لوحة مدير النظام (SaaS)
          </Link>
        </div>
      </aside>

      {/* المحتوى الرئيسي للوحة التحكم */}
      <main className="flex-1 p-6 md:p-10 space-y-8 overflow-y-auto">
        {saveMessage && (
          <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
            ✓ {saveMessage}
          </div>
        )}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold">
            ✕ {errorMessage}
          </div>
        )}

        {/* ================================================================= */}
        {/* التبويب 1: إدارة الصفحة الرئيسية، ترتيب الأقسام، البانرات والعروض */}
        {/* ================================================================= */}
        {activeTab === 'homepage' && (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-2xl font-extrabold text-white">إدارة الواجهة الرئيسية وترتيب الأقسام والعروض</h2>
              <button
                onClick={handleSaveRestaurantSettings}
                className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg"
              >
                حفظ جميع إعدادات الواجهة في قاعدة البيانات
              </button>
            </div>

            {/* إعدادات قسم الـ Hero */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-slate-900 p-6 rounded-2xl border border-slate-800">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">الشارة التسويقية العلوية (Hero Badge)</label>
                <input
                  type="text"
                  value={bundle.restaurant.hero_badge}
                  onChange={(e) =>
                    setBundle((p) => ({
                      ...p,
                      restaurant: { ...p.restaurant, hero_badge: e.target.value },
                    }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">العنوان التسويقي الرئيسي (Hero Title)</label>
                <input
                  type="text"
                  value={bundle.restaurant.hero_title}
                  onChange={(e) =>
                    setBundle((p) => ({
                      ...p,
                      restaurant: { ...p.restaurant, hero_title: e.target.value },
                    }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold text-slate-300 block mb-1.5">الوصف التسويقي للواجهة</label>
                <textarea
                  rows={2}
                  value={bundle.restaurant.hero_subtitle}
                  onChange={(e) =>
                    setBundle((p) => ({
                      ...p,
                      restaurant: { ...p.restaurant, hero_subtitle: e.target.value },
                    }))
                  }
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">نص الزر الرئيسي والزر الثانوي</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={bundle.restaurant.hero_primary_cta}
                    onChange={(e) =>
                      setBundle((p) => ({
                        ...p,
                        restaurant: { ...p.restaurant, hero_primary_cta: e.target.value },
                      }))
                    }
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={bundle.restaurant.hero_secondary_cta}
                    onChange={(e) =>
                      setBundle((p) => ({
                        ...p,
                        restaurant: { ...p.restaurant, hero_secondary_cta: e.target.value },
                      }))
                    }
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">رفع صورة الواجهة الرئيسية مباشرة من الجوال</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleMobileImageUpload(e, (url) =>
                      setBundle((p) => ({
                        ...p,
                        restaurant: { ...p.restaurant, hero_image_url: url },
                      }))
                    )
                  }
                  className="w-full text-xs text-slate-300"
                />
              </div>
            </div>

            {/* ترتيب أقسام الصفحة الرئيسية وإظهار/إخفاء أي قسم */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
              <div>
                <h3 className="text-lg font-bold text-white">ترتيب أقسام الصفحة الرئيسية وإظهارها أو إخفاؤها</h3>
                <p className="text-xs text-slate-400">استخدم أزرار (↑ / ↓) لتغيير ترتيب ظهور الأقسام في صفحة العميل، أو أخفِ أي قسم بضغطة زر</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {sortedHomepageSections.map((sec, idx) => (
                  <div
                    key={sec.key}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-slate-900 border border-slate-800 text-xs font-black text-emerald-400 flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-xs font-bold text-white">{sec.label}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => moveSectionOrder(sec.key, -1)}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-bold text-slate-300"
                        title="تحريك لأعلى"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSectionOrder(sec.key, 1)}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-xs font-bold text-slate-300"
                        title="تحريك لأسفل"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleSectionVisibility(sec.key)}
                        className={`px-3 py-1 rounded-lg text-xs font-bold ${
                          sec.visible ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                        }`}
                      >
                        {sec.visible ? 'ظاهر' : 'مخفي'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* إدارة البانرات الإعلانية والعروض المؤقتة */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* البانرات الإعلانية */}
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-lg font-bold text-white">
                  {editingBannerId ? 'تعديل البانر الإعلاني' : `إدارة البانرات الإعلانية (${bundle.banners.length})`}
                </h3>
                <form onSubmit={handleSaveBanner} className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <input
                    type="text"
                    required
                    value={banTitle}
                    onChange={(e) => setBanTitle(e.target.value)}
                    placeholder="عنوان البانر الإعلاني *"
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={banBadge}
                    onChange={(e) => setBanBadge(e.target.value)}
                    placeholder="نص الشارة (مثال: عرض حصري)"
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={banSubtitle}
                    onChange={(e) => setBanSubtitle(e.target.value)}
                    placeholder="الوصف الفرعي للبانر"
                    className="sm:col-span-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={banBtnText}
                    onChange={(e) => setBanBtnText(e.target.value)}
                    placeholder="نص الزر"
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleMobileImageUpload(e, (url) => setBanImage(url))}
                    className="text-xs text-slate-300"
                  />
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">تاريخ بداية العرض</label>
                    <input
                      type="date"
                      value={banStartsAt}
                      onChange={(e) => setBanStartsAt(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">تاريخ نهاية العرض</label>
                    <input
                      type="date"
                      value={banEndsAt}
                      onChange={(e) => setBanEndsAt(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-2">
                    <button type="submit" className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-xs">
                      {editingBannerId ? 'حفظ تعديلات البانر' : '+ إضافة بانر إعلاني'}
                    </button>
                    {editingBannerId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingBannerId(null);
                          setBanTitle('');
                          setBanSubtitle('');
                        }}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                      >
                        إلغاء
                      </button>
                    )}
                  </div>
                </form>

                <div className="space-y-2.5">
                  {bundle.banners.map((b) => (
                    <div key={b.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <img src={b.image_url} alt={b.title} className="w-12 h-12 rounded-lg object-cover" />
                        <div>
                          <h4 className="text-xs font-bold text-white">{b.title}</h4>
                          <span className="text-[11px] text-slate-400">
                            {b.starts_at?.slice(0, 10)} → {b.ends_at?.slice(0, 10)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleLoadBannerForEdit(b)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 text-[11px] font-bold"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleBannerActive(b)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            b.is_active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {b.is_active ? 'نشط' : 'متوقف'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteBanner(b.id)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 text-[11px] font-bold"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* العروض المؤقتة */}
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
                <h3 className="text-lg font-bold text-white">
                  {editingOfferId ? 'تعديل العرض المؤقت' : `إدارة العروض المؤقتة (${bundle.offers.length})`}
                </h3>
                <form onSubmit={handleSaveOffer} className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <input
                    type="text"
                    required
                    value={offTitle}
                    onChange={(e) => setOffTitle(e.target.value)}
                    placeholder="اسم العرض المؤقت *"
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={offCoupon}
                    onChange={(e) => setOffCoupon(e.target.value)}
                    placeholder="كود الخصم (اختياري)"
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={offDesc}
                    onChange={(e) => setOffDesc(e.target.value)}
                    placeholder="تفاصيل العرض ومكوناته"
                    className="sm:col-span-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                  <input
                    type="number"
                    required
                    value={offOrigPrice}
                    onChange={(e) => setOffOrigPrice(e.target.value)}
                    placeholder="السعر الأصلي (ر.س)"
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                  <input
                    type="number"
                    required
                    value={offPrice}
                    onChange={(e) => setOffPrice(e.target.value)}
                    placeholder="سعر العرض بعد الخصم (ر.س)"
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                  />
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">تاريخ البداية</label>
                    <input
                      type="date"
                      value={offStartsAt}
                      onChange={(e) => setOffStartsAt(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">تاريخ النهاية</label>
                    <input
                      type="date"
                      value={offEndsAt}
                      onChange={(e) => setOffEndsAt(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleMobileImageUpload(e, (url) => setOffImage(url))}
                      className="w-full text-xs text-slate-300"
                    />
                  </div>
                  <div className="sm:col-span-2 flex items-center gap-2">
                    <button type="submit" className="flex-1 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-xs">
                      {editingOfferId ? 'حفظ تعديلات العرض' : '+ إنشاء عرض مؤقت'}
                    </button>
                    {editingOfferId && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingOfferId(null);
                          setOffTitle('');
                          setOffDesc('');
                        }}
                        className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                      >
                        إلغاء
                      </button>
                    )}
                  </div>
                </form>

                <div className="space-y-2.5">
                  {bundle.offers.map((o) => (
                    <div key={o.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                      <div>
                        <h4 className="text-xs font-bold text-white">{o.title}</h4>
                        <span className="text-[11px] text-emerald-400 font-bold">
                          {o.offer_price} ر.س (بدلاً من {o.original_price} ر.س) • حتى {o.ends_at?.slice(0, 10)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleLoadOfferForEdit(o)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-200 text-[11px] font-bold"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleOfferActive(o)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            o.is_active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {o.is_active ? 'نشط' : 'متوقف'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteOffer(o.id)}
                          className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 text-[11px] font-bold"
                        >
                          حذف
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* التبويب 2: إدارة الأقسام والمنيو والمنتجات والأحجام والإضافات       */}
        {/* ================================================================= */}
        {activeTab === 'menu' && (
          <div className="space-y-8">
            <h2 className="text-2xl font-extrabold text-white">إدارة أقسام المنيو والمنتجات والأحجام والإضافات</h2>

            {/* أولاً: إدارة أقسام المنيو وترتيبها */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-lg font-bold text-white">
                {editingCategoryId ? 'تعديل قسم المنيو' : `أقسام المنيو وترتيبها (${bundle.categories.length})`}
              </h3>
              <form onSubmit={handleSaveCategory} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <input
                  type="text"
                  required
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  placeholder="اسم القسم (مثال: برجر الواغيو) *"
                  className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                />
                <input
                  type="text"
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  placeholder="وصف مختصر للقسم"
                  className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleMobileImageUpload(e, (url) => setCatImage(url))}
                  className="text-xs text-slate-300"
                />
                <button type="submit" className="py-2 px-4 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-xs">
                  {editingCategoryId ? 'حفظ تعديل القسم' : '+ إنشاء قسم جديد'}
                </button>
              </form>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {bundle.categories.map((cat) => (
                  <div key={cat.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <img src={cat.image_url} alt={cat.name} className="w-10 h-10 rounded-lg object-cover" />
                      <div>
                        <h4 className="text-xs font-bold text-white">{cat.name}</h4>
                        <span className="text-[11px] text-slate-400">الترتيب: #{cat.sort_order}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleMoveCategoryOrder(cat.id, -1)}
                        className="px-2 py-1 rounded bg-slate-900 text-xs"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveCategoryOrder(cat.id, 1)}
                        className="px-2 py-1 rounded bg-slate-900 text-xs"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCategoryId(cat.id);
                          setCatName(cat.name);
                          setCatDesc(cat.description);
                          setCatImage(cat.image_url);
                        }}
                        className="px-2 py-1 rounded bg-slate-800 text-[11px] font-bold text-slate-200"
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleCategoryVisible(cat)}
                        className={`px-2 py-1 rounded text-[11px] font-bold ${
                          cat.is_visible ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {cat.is_visible ? 'ظاهر' : 'مخفي'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="px-2 py-1 rounded bg-rose-500/20 text-rose-300 text-[11px] font-bold"
                      >
                        حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ثانياً: نموذج إضافة أو تعديل منتج مع الأحجام والإضافات */}
            <form
              onSubmit={handleSaveProduct}
              className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">
                  {editingProductId ? 'تعديل بيانات المنتج والأحجام والإضافات' : 'إضافة منتج جديد للمنيو'}
                </h3>
                {editingProductId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingProductId(null);
                      setProdName('');
                      setProdDesc('');
                    }}
                    className="px-4 py-1.5 rounded-xl bg-slate-800 text-xs font-bold text-slate-300"
                  >
                    إلغاء وضع التعديل
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <input
                  type="text"
                  required
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="اسم الصنف *"
                  className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
                <select
                  value={prodCategory}
                  onChange={(e) => setProdCategory(e.target.value)}
                  className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                >
                  {bundle.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  required
                  value={prodPrice}
                  onChange={(e) => setProdPrice(e.target.value)}
                  placeholder="السعر الأساسي (ر.س) *"
                  className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
                <input
                  type="number"
                  value={prodComparePrice}
                  onChange={(e) => setProdComparePrice(e.target.value)}
                  placeholder="السعر قبل الخصم (اختياري)"
                  className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
                <input
                  type="text"
                  required
                  value={prodDesc}
                  onChange={(e) => setProdDesc(e.target.value)}
                  placeholder="وصف المكونات وطريقة التحضير *"
                  className="md:col-span-2 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
                <input
                  type="text"
                  value={prodSizesText}
                  onChange={(e) => setProdSizesText(e.target.value)}
                  placeholder="الأحجام (مثال: سنجل:-9, دبل:0, تربل:+14)"
                  className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
                <input
                  type="text"
                  value={prodAddonsText}
                  onChange={(e) => setProdAddonsText(e.target.value)}
                  placeholder="الإضافات (مثال: جبن شيدر:5, بيكون:8)"
                  className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prodIsBestseller}
                      onChange={(e) => setProdIsBestseller(e.target.checked)}
                    />
                    <span>الأكثر طلباً</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prodIsFeatured}
                      onChange={(e) => setProdIsFeatured(e.target.checked)}
                    />
                    <span>صنف مميز (توصيات المطعم)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prodIsNew}
                      onChange={(e) => setProdIsNew(e.target.checked)}
                    />
                    <span>صنف جديد</span>
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleMobileImageUpload(e, (url) => setProdImage(url))}
                    className="text-xs text-slate-300"
                  />
                </div>
                <button
                  type="submit"
                  className="py-2.5 px-7 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg"
                >
                  {editingProductId ? 'حفظ تعديلات الصنف في قاعدة البيانات' : '+ إضافة الصنف للمنيو'}
                </button>
              </div>
            </form>

            {/* قائمة المنتجات الحالية مع أزرار التعديل والتمييز والإخفاء والحذف الفعلي */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {bundle.products.map((p) => (
                <div
                  key={p.id}
                  className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3.5">
                    <img src={p.image_url} alt={p.name} className="w-16 h-16 rounded-xl object-cover" />
                    <div>
                      <h4 className="font-bold text-sm text-white">{p.name}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          type="number"
                          value={p.price}
                          onChange={(e) => handleUpdateProductInline(p.id, { price: Number(e.target.value) || 0 })}
                          className="w-20 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs font-extrabold text-emerald-400"
                        />
                        <span className="text-xs text-slate-400">ر.س</span>
                        <span className="text-[11px] text-slate-500">
                          ({p.sizes?.length || 0} أحجام • {p.addons?.length || 0} إضافات)
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleLoadProductForEdit(p)}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold"
                    >
                      تعديل كامل
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateProductInline(p.id, { is_bestseller: !p.is_bestseller })}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${
                        p.is_bestseller ? 'bg-amber-500 text-slate-950' : 'bg-slate-950 text-slate-400 border border-slate-800'
                      }`}
                    >
                      الأكثر طلباً
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateProductInline(p.id, { is_featured: !p.is_featured })}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${
                        p.is_featured ? 'bg-sky-500 text-slate-950' : 'bg-slate-950 text-slate-400 border border-slate-800'
                      }`}
                    >
                      مميز
                    </button>
                    <button
                      type="button"
                      onClick={() => handleUpdateProductInline(p.id, { is_visible: !p.is_visible })}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${
                        p.is_visible ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {p.is_visible ? 'ظاهر' : 'مخفي'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteProduct(p.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 text-xs font-bold"
                    >
                      حذف
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* التبويب 3: الهوية البصرية، الألوان، الخطوط، القصة، المعرض، والتواصل */}
        {/* ================================================================= */}
        {activeTab === 'identity' && (
          <div className="space-y-8">
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <h2 className="text-2xl font-extrabold text-white">إدارة هوية المطعم والألوان والخطوط والتواصل</h2>
                <button
                  onClick={handleSaveRestaurantSettings}
                  className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shadow-lg"
                >
                  حفظ الهوية وتطبيقها على الموقع العام
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">اسم المطعم</label>
                  <input
                    type="text"
                    value={bundle.restaurant.name}
                    onChange={(e) =>
                      setBundle((p) => ({ ...p, restaurant: { ...p.restaurant, name: e.target.value } }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">الشعار اللفظي (Tagline)</label>
                  <input
                    type="text"
                    value={bundle.restaurant.tagline}
                    onChange={(e) =>
                      setBundle((p) => ({ ...p, restaurant: { ...p.restaurant, tagline: e.target.value } }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">رفع شعار المطعم (Logo) من الجوال</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      handleMobileImageUpload(e, (url) =>
                        setBundle((p) => ({ ...p, restaurant: { ...p.restaurant, logo_url: url } }))
                      )
                    }
                    className="w-full text-xs text-slate-300"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">اللون الأساسي للهوية (Primary Color)</label>
                  <input
                    type="color"
                    value={bundle.restaurant.primary_color}
                    onChange={(e) =>
                      setBundle((p) => ({
                        ...p,
                        restaurant: { ...p.restaurant, primary_color: e.target.value },
                      }))
                    }
                    className="w-full h-11 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">لون الخلفية (Background Color)</label>
                  <input
                    type="color"
                    value={bundle.restaurant.bg_color}
                    onChange={(e) =>
                      setBundle((p) => ({
                        ...p,
                        restaurant: { ...p.restaurant, bg_color: e.target.value },
                      }))
                    }
                    className="w-full h-11 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">الخط العربي للعناوين</label>
                  <select
                    value={bundle.restaurant.heading_font}
                    onChange={(e) =>
                      setBundle((p) => ({
                        ...p,
                        restaurant: { ...p.restaurant, heading_font: e.target.value },
                      }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  >
                    <option value="Cairo">خط القاهرة الفاخر (Cairo)</option>
                    <option value="Tajawal">خط تجول العصري (Tajawal)</option>
                    <option value="Readex Pro">خط ريدكس الهندسي (Readex Pro)</option>
                    <option value="Amiri">خط أميري الكلاسيكي (Amiri)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">رقم واتساب لاستقبال الطلبات</label>
                  <input
                    type="text"
                    value={bundle.restaurant.whatsapp_number}
                    onChange={(e) =>
                      setBundle((p) => ({
                        ...p,
                        restaurant: { ...p.restaurant, whatsapp_number: e.target.value },
                      }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">عنوان المطعم</label>
                  <input
                    type="text"
                    value={bundle.restaurant.address}
                    onChange={(e) =>
                      setBundle((p) => ({
                        ...p,
                        restaurant: { ...p.restaurant, address: e.target.value },
                      }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-2">رابط الموقع على خرائط Google</label>
                  <input
                    type="url"
                    value={bundle.restaurant.google_maps_url}
                    onChange={(e) =>
                      setBundle((p) => ({
                        ...p,
                        restaurant: { ...p.restaurant, google_maps_url: e.target.value },
                      }))
                    }
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
              </div>

              {/* روابط التواصل الاجتماعي */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-800">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">رابط حساب Instagram</label>
                  <input
                    type="url"
                    value={bundle.restaurant.social_links?.instagram || ''}
                    onChange={(e) =>
                      setBundle((p) => ({
                        ...p,
                        restaurant: {
                          ...p.restaurant,
                          social_links: { ...p.restaurant.social_links, instagram: e.target.value },
                        },
                      }))
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">رابط حساب TikTok</label>
                  <input
                    type="url"
                    value={bundle.restaurant.social_links?.tiktok || ''}
                    onChange={(e) =>
                      setBundle((p) => ({
                        ...p,
                        restaurant: {
                          ...p.restaurant,
                          social_links: { ...p.restaurant.social_links, tiktok: e.target.value },
                        },
                      }))
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1.5">رابط حساب Snapchat</label>
                  <input
                    type="url"
                    value={bundle.restaurant.social_links?.snapchat || ''}
                    onChange={(e) =>
                      setBundle((p) => ({
                        ...p,
                        restaurant: {
                          ...p.restaurant,
                          social_links: { ...p.restaurant.social_links, snapchat: e.target.value },
                        },
                      }))
                    }
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                </div>
              </div>

              {/* ساعات العمل */}
              <div className="pt-4 border-t border-slate-800 space-y-3">
                <h3 className="text-sm font-bold text-white">إدارة ساعات العمل</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(bundle.restaurant.opening_hours || []).map((oh, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-white">
                        {oh.days}: <span className="text-emerald-400">{oh.hours}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setBundle((p) => ({
                            ...p,
                            restaurant: {
                              ...p.restaurant,
                              opening_hours: p.restaurant.opening_hours.filter((_, i) => i !== idx),
                            },
                          }))
                        }
                        className="text-xs text-rose-400 font-bold"
                      >
                        حذف
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={newHoursDays}
                    onChange={(e) => setNewHoursDays(e.target.value)}
                    placeholder="الأيام (مثال: السبت - الأربعاء)"
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={newHoursTime}
                    onChange={(e) => setNewHoursTime(e.target.value)}
                    placeholder="الساعات (مثال: 1:00 م - 2:00 ص)"
                    className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newHoursDays.trim() || !newHoursTime.trim()) return;
                      setBundle((p) => ({
                        ...p,
                        restaurant: {
                          ...p.restaurant,
                          opening_hours: [
                            ...(p.restaurant.opening_hours || []),
                            { days: newHoursDays.trim(), hours: newHoursTime.trim(), is_open: true },
                          ],
                        },
                      }));
                      setNewHoursDays('');
                      setNewHoursTime('');
                    }}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-white"
                  >
                    + إضافة فترة عمل
                  </button>
                </div>
              </div>
            </div>

            {/* إدارة معرض الصور */}
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
              <h3 className="text-lg font-bold text-white">إدارة معرض صور المطعم والوجبات ({bundle.gallery.length})</h3>
              <form onSubmit={handleAddGalleryImage} className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800">
                <input
                  type="text"
                  required
                  value={galTitle}
                  onChange={(e) => setGalTitle(e.target.value)}
                  placeholder="عنوان الصورة *"
                  className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                />
                <input
                  type="text"
                  value={galCaption}
                  onChange={(e) => setGalCaption(e.target.value)}
                  placeholder="وصف مختصر للصورة"
                  className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                />
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleMobileImageUpload(e, (url) => setGalImage(url))}
                  className="text-xs text-slate-300"
                />
                <button type="submit" className="py-2 px-4 rounded-xl bg-emerald-500 text-slate-950 font-extrabold text-xs">
                  + إضافة صورة للمعرض
                </button>
              </form>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {bundle.gallery.map((g) => (
                  <div key={g.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <img src={g.image_url} alt={g.title} className="w-12 h-12 rounded-lg object-cover" />
                      <div>
                        <h4 className="text-xs font-bold text-white">{g.title}</h4>
                        <p className="text-[11px] text-slate-400 line-clamp-1">{g.caption}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteGalleryImage(g.id)}
                      className="px-2.5 py-1 rounded-lg bg-rose-500/20 text-rose-300 text-xs font-bold"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* التبويب 4: إدارة الطلبات الواردة وتفاصيلها                         */}
        {/* ================================================================= */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <h2 className="text-2xl font-extrabold text-white">إدارة الطلبات الواردة ({filteredOrders.length})</h2>
              <div className="flex flex-wrap items-center gap-2">
                {(['all', 'new', 'preparing', 'ready', 'completed', 'cancelled'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setOrderStatusFilter(st)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border ${
                      orderStatusFilter === st
                        ? 'bg-emerald-500 text-slate-950 border-emerald-500'
                        : 'bg-slate-900 text-slate-300 border-slate-800'
                    }`}
                  >
                    {st === 'all'
                      ? 'الكل'
                      : st === 'new'
                      ? 'جديد'
                      : st === 'preparing'
                      ? 'قيد التحضير'
                      : st === 'ready'
                      ? 'جاهز'
                      : st === 'completed'
                      ? 'مكتمل'
                      : 'ملغي'}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {filteredOrders.map((ord) => (
                <div
                  key={ord.id}
                  className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-extrabold text-amber-400">طلب #{ord.order_number}</span>
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] bg-slate-800 text-slate-300">
                        {ord.fulfillment_type === 'pickup'
                          ? 'استلام فرع'
                          : ord.fulfillment_type === 'dine_in'
                          ? 'محلي'
                          : 'توصيل'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-white">
                      {ord.customer_name} — {ord.customer_phone}
                    </h3>
                    {ord.customer_address && (
                      <p className="text-xs text-slate-300">العنوان: {ord.customer_address}</p>
                    )}
                    <p className="text-xs text-slate-400">
                      الأصناف:{' '}
                      {ord.items
                        .map(
                          (i) =>
                            `${i.product_name} (×${i.quantity}${i.size_name ? ` - ${i.size_name}` : ''})`
                        )
                        .join(' + ')}
                    </p>
                    {ord.notes && <p className="text-xs text-amber-300">ملاحظة: {ord.notes}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-black text-emerald-400">{ord.total} ر.س</span>
                    <select
                      value={ord.status}
                      onChange={(e) => updateOrderStatus(ord.id, e.target.value as OrderStatus)}
                      className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold text-white"
                    >
                      <option value="new">طلب جديد</option>
                      <option value="preparing">قيد التحضير</option>
                      <option value="ready">جاهز للاستلام</option>
                      <option value="completed">مكتمل</option>
                      <option value="cancelled">ملغي</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* التبويب 5: الإحصائيات والزيارات والمنتجات الأكثر مشاهدة وطلباً     */}
        {/* ================================================================= */}
        {activeTab === 'analytics' && (
          <div className="space-y-8">
            <h2 className="text-2xl font-extrabold text-white">إحصائيات الزيارات والمنتجات الأكثر مشاهدة وطلباً</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400">إجمالي زيارات الموقع</span>
                <p className="text-3xl font-black text-white mt-2">{bundle.restaurant.visits_count.toLocaleString()}</p>
              </div>
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400">إجمالي مشاهدات الأصناف</span>
                <p className="text-3xl font-black text-emerald-400 mt-2">
                  {bundle.products.reduce((s, p) => s + p.views_count, 0).toLocaleString()}
                </p>
              </div>
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800">
                <span className="text-xs text-slate-400">إجمالي الطلبات المسجلة</span>
                <p className="text-3xl font-black text-amber-400 mt-2">
                  {bundle.products.reduce((s, p) => s + p.orders_count, 0).toLocaleString()}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-3">
                <h3 className="text-base font-bold text-white">المنتجات الأكثر مشاهدة</h3>
                {productsByViews.map((p, idx) => (
                  <div key={p.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                    <span className="font-bold text-white">
                      #{idx + 1} — {p.name}
                    </span>
                    <span className="text-emerald-400 font-extrabold">{p.views_count.toLocaleString()} مشاهدة</span>
                  </div>
                ))}
              </div>
              <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-3">
                <h3 className="text-base font-bold text-white">المنتجات الأكثر طلباً</h3>
                {productsByOrders.map((p, idx) => (
                  <div key={p.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                    <span className="font-bold text-white">
                      #{idx + 1} — {p.name}
                    </span>
                    <span className="text-amber-400 font-extrabold">{p.orders_count.toLocaleString()} طلب</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
