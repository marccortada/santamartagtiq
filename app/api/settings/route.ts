import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabaseServer';
import { requireOwner } from '@/lib/server/owner-auth';

export type AppConfigData = {
  businessName: string;
  welcomeText: string;
  terminalName: string;
  fichajeToleranceMinutes: number;
  timeFormat24h: boolean;
  giftCardDefaultAmounts: number[];
  giftCardExpiryMonths: number;
  giftCardsRechargeable: boolean;
  newEmployeeActiveByDefault: boolean;
  theme: 'light' | 'dark' | 'system';
  fontSize: 'normal' | 'large';
};

const DEFAULTS: AppConfigData = {
  businessName: 'Santa Marta',
  welcomeText: 'Panel principal',
  terminalName: 'lector-caja-1',
  fichajeToleranceMinutes: 5,
  timeFormat24h: true,
  giftCardDefaultAmounts: [20, 30, 50, 100],
  giftCardExpiryMonths: 0,
  giftCardsRechargeable: true,
  newEmployeeActiveByDefault: true,
  theme: 'light',
  fontSize: 'normal',
};

function mergeWithDefaults(data: Partial<AppConfigData> | null): AppConfigData {
  if (!data || typeof data !== 'object') return { ...DEFAULTS };
  return {
    ...DEFAULTS,
    ...data,
    giftCardDefaultAmounts: Array.isArray(data.giftCardDefaultAmounts)
      ? data.giftCardDefaultAmounts.filter((n) => Number.isFinite(n))
      : DEFAULTS.giftCardDefaultAmounts,
  };
}

export async function GET(request: Request) {
  const owner = await requireOwner(request);
  if (owner.ok === false) return owner.response;

  try {
    const supabase = createSupabaseServerClient();
    const { data: row, error } = await supabase
      .from('app_config')
      .select('data')
      .eq('id', 1)
      .maybeSingle();

    if (error) {
      console.error('[api/settings] Supabase:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const config = mergeWithDefaults((row?.data as Partial<AppConfigData>) ?? null);
    return NextResponse.json(config);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al cargar ajustes';
    console.error('[api/settings]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const owner = await requireOwner(request);
  if (owner.ok === false) return owner.response;

  try {
    const body = (await request.json()) as Partial<AppConfigData>;
    const supabase = createSupabaseServerClient();

    const { data: existing } = await supabase
      .from('app_config')
      .select('data')
      .eq('id', 1)
      .maybeSingle();

    const current = mergeWithDefaults((existing?.data as Partial<AppConfigData>) ?? null);
    const data: AppConfigData = {
      ...current,
      businessName: typeof body.businessName === 'string' ? body.businessName : current.businessName,
      welcomeText: typeof body.welcomeText === 'string' ? body.welcomeText : current.welcomeText,
      terminalName: typeof body.terminalName === 'string' ? body.terminalName : current.terminalName,
      fichajeToleranceMinutes: Number.isFinite(body.fichajeToleranceMinutes)
        ? body.fichajeToleranceMinutes
        : current.fichajeToleranceMinutes,
      timeFormat24h: typeof body.timeFormat24h === 'boolean' ? body.timeFormat24h : current.timeFormat24h,
      giftCardDefaultAmounts: Array.isArray(body.giftCardDefaultAmounts)
        ? body.giftCardDefaultAmounts.filter((n) => Number.isFinite(n))
        : current.giftCardDefaultAmounts,
      giftCardExpiryMonths: Number.isFinite(body.giftCardExpiryMonths)
        ? body.giftCardExpiryMonths
        : current.giftCardExpiryMonths,
      giftCardsRechargeable:
        typeof body.giftCardsRechargeable === 'boolean' ? body.giftCardsRechargeable : current.giftCardsRechargeable,
      newEmployeeActiveByDefault:
        typeof body.newEmployeeActiveByDefault === 'boolean'
          ? body.newEmployeeActiveByDefault
          : current.newEmployeeActiveByDefault,
      theme:
        body.theme === 'light' || body.theme === 'dark' || body.theme === 'system' ? body.theme : current.theme,
      fontSize: body.fontSize === 'normal' || body.fontSize === 'large' ? body.fontSize : current.fontSize,
    };

    const { error } = await supabase
      .from('app_config')
      .upsert({ id: 1, data, updated_at: new Date().toISOString() }, { onConflict: 'id' });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Error al guardar ajustes';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
