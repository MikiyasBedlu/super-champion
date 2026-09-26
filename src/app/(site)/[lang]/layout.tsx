import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { DICT, isLang, type Lang } from '@/lib/dictionaries';
import '../../globals.css';

export const dynamic = 'force-dynamic';

export function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'am' }];
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const d = DICT[isLang(lang) ? (lang as Lang) : 'en'];
  return {
    title: d['meta.title'],
    description: d['meta.description'],
    icons: { icon: '/assets/img/favicon.png', apple: '/assets/img/icon-192.png' },
    manifest: '/site.webmanifest',
    openGraph: { title: d['meta.title'], description: d['meta.description'], images: ['/assets/img/icon-512.png'] },
  };
}

export default async function SiteLayout({ children, params }: { children: React.ReactNode; params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  return (
    <html lang={lang}>
      <head>
        <meta name="theme-color" content="#011E26" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&family=Noto+Sans+Ethiopic:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
