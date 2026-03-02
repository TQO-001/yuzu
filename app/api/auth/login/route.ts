// WM-03: POST /api/auth/login
//
// Validates credentials against environment variables (suitable for a
// single-admin tool). In a multi-user SaaS app, this would query a
// users table with bcrypt password comparison.

import { NextRequest, NextResponse } from 'next/server';
import { signToken } from '@/lib/auth/jwt';

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await request.json() as { email?: string; password?: string };

  const { email, password } = body;

  // Validate against environment-configured admin credentials
  if (
    email    !== process.env.ADMIN_EMAIL    ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return NextResponse.json(
      { error: 'Invalid email or password' },
      { status: 401 }
    );
  }

  const token = await signToken({ userId: 'admin', email });

  const response = NextResponse.json({ success: true });

  // HTTP-only cookie — JS in the browser cannot read this
  response.cookies.set('auth_token', token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   60 * 60 * 8, // 8 hours in seconds
    path:     '/',
  });

  return response;
}
