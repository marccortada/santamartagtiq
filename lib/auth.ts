import type { User } from '@supabase/supabase-js';

const ownerEmails = (process.env.OWNER_EMAILS ?? '')
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);

export const OWNER_CODE_COOKIE = 'sm_owner_code_ok';

export function isOwner(user: User | null): boolean {
  if (!user) return false;
  if (ownerEmails.length === 0) return true;
  return ownerEmails.includes((user.email ?? '').toLowerCase());
}
