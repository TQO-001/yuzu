// WM-03: Edge Middleware — JWT-based route protection.
//
// HOW IT WORKS:
//   Next.js runs this file before every matched request, in the Edge Runtime.
//   It intercepts the request, checks for a valid JWT in the HTTP-only cookie,
//   and redirects to /login if the user is not authenticated.
//
// SECURITY NOTE:
//   The cookie is HTTP-only (JS cannot read it) and is set by the login API.
//   This prevents XSS attacks from stealing the token.

import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth/jwt';

// Routes that do not require authentication
const PUBLIC_PATHS = [
  '/login',
  '/api/auth/login',
  '/api/auth/logout',
];

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Allow public paths through immediately
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    // No token — redirect to login page
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    await verifyToken(token);
    return NextResponse.next();
  } catch {
    // Token invalid or expired — clear cookie and redirect
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('auth_token');
    return response;
  }
}

// Apply middleware to all routes except static assets
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
