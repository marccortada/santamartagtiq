import { NextResponse } from 'next/server';
import { OWNER_CODE_COOKIE } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ success: true });
  response.cookies.set({
    name: OWNER_CODE_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
