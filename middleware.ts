import { NextResponse, type NextRequest } from 'next/server';
import { isOwner, OWNER_CODE_COOKIE } from '@/lib/auth';
import { updateSession } from '@/lib/supabase/middleware';

const protectedPrefixes = ['/dashboard', '/fichar', '/test'];

function isProtectedRoute(pathname: string): boolean {
  return protectedPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function applyCookies(from: NextResponse, to: NextResponse): NextResponse {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
  return to;
}

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname, search } = request.nextUrl;
  const hasCodeSession = request.cookies.get(OWNER_CODE_COOKIE)?.value === '1';

  if (isProtectedRoute(pathname) && hasCodeSession) {
    return response;
  }

  if (isProtectedRoute(pathname) && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.searchParams.set('next', `${pathname}${search}`);
    return applyCookies(response, NextResponse.redirect(loginUrl));
  }

  if (isProtectedRoute(pathname) && user && !isOwner(user)) {
    const unauthorizedUrl = request.nextUrl.clone();
    unauthorizedUrl.pathname = '/unauthorized';
    unauthorizedUrl.search = '';
    return applyCookies(response, NextResponse.redirect(unauthorizedUrl));
  }

  if (pathname === '/login' && user && isOwner(user)) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return applyCookies(response, NextResponse.redirect(dashboardUrl));
  }

  if (pathname === '/login' && hasCodeSession) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return applyCookies(response, NextResponse.redirect(dashboardUrl));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
