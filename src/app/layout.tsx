import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'برجر هاوس | نظام مواقع ومنيوهات المطاعم الرقمية الفاخرة (SaaS)',
  description: 'منصة احترافية متعددة المطاعم لإنشاء المواقع والمنيوهات الرقمية التفاعلية مع ربط واتساب ولوحة تحكم شاملة',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl">
      <body className="antialiased selection:bg-amber-500 selection:text-stone-950">
        {children}
      </body>
    </html>
  );
}
