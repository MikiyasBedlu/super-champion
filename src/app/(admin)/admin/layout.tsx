import type { Metadata } from 'next';
import '../../globals.css';
import './admin.css';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Organiser — Super Champion',
  robots: { index: false, follow: false },
  icons: { icon: '/assets/img/favicon.png' },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="theme-color" content="#011E26" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
