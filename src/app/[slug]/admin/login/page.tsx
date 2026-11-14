'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function getSafeInternalRedirect(rawRedirect: string | null, fallbackPath: string): string {
  if (!rawRedirect) return fallbackPath;
  const trimmed = rawRedirect.trim();
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('://')) {
    return trimmed;
  }
  return fallbackPath;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const params = useParams();
  const slug = (params?.slug as string) || 'burger-house';
  const defaultTarget = `/${slug}/admin`;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [targetPath, setTargetPath] = useState<string>(defaultTarget);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const redir = sp.get('redirect');
      setTargetPath(getSafeInternalRedirect(redir, `/${slug}/admin`));
    } catch {
      setTargetPath(`/${slug}/admin`);
    }
  }, [slug]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const supabase = createClient();
    if (!supabase) {
      router.push(targetPath);
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setErrorMsg('بيانات الدخول غير صحيحة أو الحساب غير مصرح له بإدارة هذا المطعم.');
      setLoading(false);
      return;
    }

    router.push(targetPath);
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 shadow-2xl">
        <div className="space-y-2 text-center">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400">
            نظام الحماية وعزل المطاعم (Supabase RLS)
          </span>
          <h1 className="text-2xl font-extrabold text-white">
            {targetPath.startsWith('/super-admin')
              ? 'تسجيل دخول مدير النظام (Super Admin)'
              : 'تسجيل دخول مالك المطعم'}
          </h1>
          <p className="text-xs text-slate-400">
            الوجهة بعد الدخول: <span className="text-amber-400 font-mono">{targetPath}</span>
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">البريد الإلكتروني</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@burgerhouse.sa"
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">كلمة المرور</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-3 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm transition-all"
          >
            {loading ? 'جاري التحقق من الصلاحيات...' : 'دخول آمن إلى لوحة التحكم'}
          </button>
        </form>
      </div>
    </main>
  );
}
