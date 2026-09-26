import { NextResponse, type NextRequest } from 'next/server';

const LANGS = ['en', 'am'];

/* Sends "/" to the visitor's language and sets the security headers for every response. */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname === '/' || pathname === '') {
    const cookie = req.cookies.get('sc_lang')?.value;
    const header = req.headers.get('accept-language') ?? '';
    const lang = LANGS.includes(cookie ?? '') ? cookie : header.toLowerCase().startsWith('am') ? 'am' : 'en';
    return NextResponse.redirect(new URL(`/${lang}`, req.url));
  }

  const res = NextResponse.next();
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  // Next inlines a small amount of CSS and its own bootstrap script, so 'unsafe-inline'
  // is required here. Everything else is locked to this origin and Google Fonts.
  res.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'" + (process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"),
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data:",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  );
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|assets|favicon.ico).*)'],
};
