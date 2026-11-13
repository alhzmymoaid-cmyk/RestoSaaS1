'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Restaurant, Profile } from '@/types/database';
import { createClient } from '@/lib/supabase/client';

interface Props {
  initialRestaurants: Restaurant[];
  initialProfiles: Profile[];
}

export default function SuperAdminConsole({ initialRestaurants, initialProfiles }: Props) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>(initialRestaurants);
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // New Tenant Form State
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newTagline, setNewTagline] = useState('واجهة مطعم ومنيو رقمي فاخر');
  const [newCity, setNewCity] = useState('جدة');
  const [newWhatsapp, setNewWhatsapp] = useState('966535717670');
  const [newOwnerEmail, setNewOwnerEmail] = useState('');
  const [newColor, setNewColor] = useState('#D97706');

  const notify = (msg: string) => {
    setErrorMessage(null);
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 4500);
  };

  const notifyErr = (msg: string) => {
    setStatusMessage(null);
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(null), 5000);
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = newSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!newName.trim() || !cleanSlug || !newOwnerEmail.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/super-admin/tenants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          slug: cleanSlug,
          tagline: newTagline.trim(),
          city: newCity.trim(),
          whatsapp_number: newWhatsapp.trim(),
          primary_color: newColor,
          owner_email: newOwnerEmail.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        notifyErr(data.error || 'تعذر إنشاء المطعم في قاعدة البيانات');
        setLoading(false);
        return;
      }

      if (data.tenant) {
        setRestaurants((prev) => [data.tenant, ...prev]);
      }
      setNewName('');
      setNewSlug('');
      setNewOwnerEmail('');
      notify(`تم إنشاء موقع ولوحة تحكم المطعم «${newName}» في قاعدة بيانات Supabase بنجاح!`);
    } catch {
      notifyErr('حدث خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleTenantActive = async (rest: Restaurant) => {
    const nextActive = !rest.is_active;
    const res = await fetch('/api/super-admin/tenants', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: rest.id, is_active: nextActive }),
    });

    if (res.ok) {
      setRestaurants((prev) =>
        prev.map((r) => (r.id === rest.id ? { ...r, is_active: nextActive } : r))
      );
      notify(nextActive ? `تم تفعيل مطعم ${rest.name}` : `تم إيقاف مطعم ${rest.name} مؤقتاً`);
    } else {
      const err = await res.json();
      notifyErr(err.error || 'تعذر تحديث حالة المطعم');
    }
  };

  const handleUpdateOwnerEmail = async (restId: string, ownerEmail: string) => {
    const res = await fetch('/api/super-admin/tenants', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: restId, owner_email: ownerEmail }),
    });
    if (res.ok) {
      setRestaurants((prev) =>
        prev.map((r) => (r.id === restId ? { ...r, owner_email: ownerEmail } : r))
      );
      notify('تم تحديث بريد مالك المطعم وحفظه في قاعدة البيانات!');
    }
  };

  const handleDeleteTenant = async (restId: string, restName: string) => {
    const res = await fetch(`/api/super-admin/tenants?id=${encodeURIComponent(restId)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setRestaurants((prev) => prev.filter((r) => r.id !== restId));
      notify(`تم حذف مطعم «${restName}» وكافة بياناته المرتبطة من قاعدة البيانات.`);
    } else {
      const err = await res.json();
      notifyErr(err.error || 'تعذر حذف المطعم');
    }
  };

  const handleUpdateProfileRole = async (profileId: string, role: 'super_admin' | 'restaurant_owner', restaurantId?: string | null) => {
    const supabase = createClient();
    if (supabase) {
      const { error } = await supabase
        .from('profiles')
        .update({ role, restaurant_id: restaurantId || null })
        .eq('id', profileId);
      if (error) return notifyErr(error.message);
    }
    setProfiles((prev) =>
      prev.map((p) => (p.id === profileId ? { ...p, role, restaurant_id: restaurantId } : p))
    );
    notify('تم تحديث صلاحيات الحساب وربطه بالمطعم في قاعدة البيانات!');
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
          <div>
            <span className="text-xs font-bold text-sky-400">لوحة مدير النظام العام (Super Admin SaaS Console)</span>
            <h1 className="text-3xl font-extrabold text-white mt-1">
              إدارة المطاعم المشتركة وحسابات الملاك وعزل البيانات (Supabase RLS)
            </h1>
          </div>
          <Link
            href="/burger-house"
            className="px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold hover:border-sky-500"
          >
            العودة إلى نموذج برجر هاوس ←
          </Link>
        </div>

        {statusMessage && (
          <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold">
            ✓ {statusMessage}
          </div>
        )}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-500/15 border border-rose-500/40 text-rose-300 text-xs font-bold">
            ✕ {errorMessage}
          </div>
        )}

        {/* نموذج إنشاء مطعم جديد وربطه بقاعدة بيانات Supabase */}
        <form
          onSubmit={handleCreateTenant}
          className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4"
        >
          <h2 className="text-lg font-bold text-white">إنشاء موقع ولوحة تحكم لمطعم جديد في قاعدة البيانات</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              required
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="اسم المطعم أو الكافيه الجديد *"
              className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
            />
            <input
              type="text"
              required
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="الرابط المستقل (مثال: aroma-cafe) *"
              className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
            />
            <input
              type="email"
              required
              value={newOwnerEmail}
              onChange={(e) => setNewOwnerEmail(e.target.value)}
              placeholder="البريد الإلكتروني لمالك المطعم *"
              className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
            />
            <input
              type="text"
              value={newTagline}
              onChange={(e) => setNewTagline(e.target.value)}
              placeholder="الشعار اللفظي للمطعم"
              className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white"
            />
            <input
              type="text"
              value={newWhatsapp}
              onChange={(e) => setNewWhatsapp(e.target.value)}
              placeholder="رقم واتساب للطلبات (9665xxxxxxxx)"
              className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white font-mono"
            />
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="w-12 h-10 rounded-xl bg-slate-950 border border-slate-800 cursor-pointer"
              />
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2.5 px-6 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-xs"
              >
                {loading ? 'جاري الإنشاء في Supabase...' : '+ إنشاء المطعم وتفعيل العزل'}
              </button>
            </div>
          </div>
        </form>

        {/* قائمة المطاعم المسجلة في المنصة */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {restaurants.map((t) => (
            <div key={t.id} className="p-6 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="w-4 h-4 rounded-full" style={{ backgroundColor: t.primary_color }} />
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                        t.is_active ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'
                      }`}
                    >
                      {t.is_active ? 'نشط' : 'موقوف'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-500/15 text-sky-300">
                      RLS مفعل
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">{t.name}</h3>
                  <p className="text-xs text-sky-400 font-mono mt-0.5">/{t.slug}</p>
                </div>
                <div className="space-y-1.5 pt-2">
                  <label className="text-[11px] text-slate-400 block">بريد المالك المعتمد:</label>
                  <input
                    type="email"
                    defaultValue={t.owner_email || `owner@${t.slug}.sa`}
                    onBlur={(e) => handleUpdateOwnerEmail(t.id, e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-800">
                <div className="flex items-center justify-between text-xs font-bold">
                  <Link href={`/${t.slug}`} className="text-amber-400 hover:underline">
                    واجهة العميل ↗
                  </Link>
                  <Link href={`/${t.slug}/admin`} className="text-emerald-400 hover:underline">
                    لوحة تحكم المالك ↗
                  </Link>
                </div>
                <div className="flex items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleToggleTenantActive(t)}
                    className="flex-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-200"
                  >
                    {t.is_active ? 'إيقاف مؤقت' : 'تفعيل الموقع'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTenant(t.id, t.name)}
                    className="px-3 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 text-[11px] font-bold"
                  >
                    حذف
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* إدارة حسابات المستخدمين والصلاحيات (profiles) */}
        <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 space-y-4">
          <h2 className="text-lg font-bold text-white">إدارة حسابات الملاك وصلاحيات النظام (جدول profiles)</h2>
          {profiles.length === 0 ? (
            <p className="text-xs text-slate-400">
              يتم إدراج حسابات الملاك هنا تلقائياً عند تسجيلهم في Supabase Auth وربطهم بمعرف المطعم (`restaurant_id`).
            </p>
          ) : (
            <div className="space-y-2.5">
              {profiles.map((prof) => (
                <div key={prof.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-white">{prof.full_name || prof.email}</p>
                    <p className="text-[11px] text-slate-400 font-mono">{prof.email}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={prof.role}
                      onChange={(e) =>
                        handleUpdateProfileRole(
                          prof.id,
                          e.target.value as 'super_admin' | 'restaurant_owner',
                          prof.restaurant_id
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                    >
                      <option value="restaurant_owner">صاحب مطعم (معزول)</option>
                      <option value="super_admin">مدير نظام عام (Super Admin)</option>
                    </select>
                    <select
                      value={prof.restaurant_id || ''}
                      onChange={(e) => handleUpdateProfileRole(prof.id, prof.role, e.target.value || null)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-white"
                    >
                      <option value="">-- بدون مطعم محدد --</option>
                      {restaurants.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
