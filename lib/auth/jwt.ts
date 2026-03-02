// WM-03: JWT utility using `jose` — Edge Runtime compatible.
//
// WHY JOSE INSTEAD OF JSONWEBTOKEN?
//   Next.js middleware runs in the Edge Runtime which does not have access
//   to Node.js built-in crypto module. `jose` uses the Web Crypto API
//   which is available in both Edge and Node.js environments.

import { SignJWT, jwtVerify } from 'jose';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'CHANGE_THIS_IN_PRODUCTION_MIN_32_CHARS!!'
);

export interface JWTPayload {
  userId: string;
  email:  string;
}

/**
 * Signs a JWT with the provided payload.
 * Expires in 8 hours — suitable for a workday session.
 */
export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(SECRET);
}

/**
 * Verifies a JWT and returns the decoded payload.
 * Throws if the token is invalid or expired.
 */
export async function verifyToken(token: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, SECRET);
  return payload as unknown as JWTPayload;
}
