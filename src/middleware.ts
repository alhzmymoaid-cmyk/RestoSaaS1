import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },

        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });

          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });

          response.cookies.set({ name, value, ...options });
        },

        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });

          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });

          response.cookies.set({ name, value: '', ...options });
        },
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const pathname = request.nextUrl.pathname;

    if (pathname.startsWith('/api/')) {
      return response;
    }

    if (pathname.startsWith('/super-admin') && !pathname.includes('/login')) {
      if (!user) {
        const loginUrl = new URL('/burger-house/admin/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
      }
    }

    const tenantAdminMatch = pathname.match(/^\/([a-z0-9-]+)\/admin(\/.*)?$/i);

    if (tenantAdminMatch && !pathname.endsWith('/login')) {
      const slug = tenantAdminMatch[1];

      if (!user) {
        const loginUrl = new URL(`/${slug}/admin/login`, request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico |images/).*)'],
};
