import { NextResponse } from 'next/server';
import { OWNER_CODE_COOKIE } from '@/lib/auth';

function getRequiredCode(): string {
  const value = process.env.OWNER_ACCESS_CODE?.trim();
  if (!value) {
    throw new Error('Missing OWNER_ACCESS_CODE');
  }
  return value;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { code?: string };
    const code = body.code?.trim() ?? '';
    const requiredCode = getRequiredCode();

    if (code.length === 0 || code !== requiredCode) {
      return NextResponse.json({ error: 'Codigo invalido' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set({
      name: OWNER_CODE_COOKIE,
      value: '1',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 12,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error login por codigo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
