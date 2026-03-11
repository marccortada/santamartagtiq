import { createClient, type User } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { isOwner, OWNER_CODE_COOKIE } from '@/lib/auth';

function getEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

type OwnerAuthOk = {
  ok: true;
  user: User;
};

type OwnerAuthFail = {
  ok: false;
  response: NextResponse;
};

function hasOwnerCodeCookie(request: Request): boolean {
  const cookie = request.headers.get('cookie') ?? '';
  return cookie
    .split(';')
    .map((value) => value.trim())
    .some((value) => value === `${OWNER_CODE_COOKIE}=1`);
}

export async function requireOwner(request: Request): Promise<OwnerAuthOk | OwnerAuthFail> {
  if (hasOwnerCodeCookie(request)) {
    return {
      ok: true,
      user: { id: 'owner-code-session' } as User,
    };
  }

  const authHeader = request.headers.get('authorization') ?? '';
  const bearerPrefix = 'Bearer ';

  if (!authHeader.startsWith(bearerPrefix)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Missing bearer token' }, { status: 401 }),
    };
  }

  const accessToken = authHeader.slice(bearerPrefix.length).trim();
  if (!accessToken) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid bearer token' }, { status: 401 }),
    };
  }

  const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  const requesterClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const {
    data: { user },
    error,
  } = await requesterClient.auth.getUser();

  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  if (!isOwner(user)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { ok: true, user };
}
