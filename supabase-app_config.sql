-- Tabla de configuración global del panel (una sola fila).
-- Ejecuta este script en el SQL Editor de Supabase.

create table if not exists public.app_config (
  id int primary key default 1 check (id = 1),
  data jsonb not null default '{}',
  updated_at timestamptz default now()
);

-- Una única fila con valores por defecto.
insert into public.app_config (id, data)
values (
  1,
  '{
    "businessName": "Santa Marta",
    "welcomeText": "Panel principal",
    "terminalName": "lector-caja-1",
    "fichajeToleranceMinutes": 5,
    "timeFormat24h": true,
    "giftCardDefaultAmounts": [20, 30, 50, 100],
    "giftCardExpiryMonths": 0,
    "giftCardsRechargeable": true,
    "newEmployeeActiveByDefault": true,
    "theme": "light",
    "fontSize": "normal"
  }'::jsonb
)
on conflict (id) do nothing;

-- RLS: permitir lectura y escritura a usuarios autenticados (o anon si usas solo código de owner).
alter table public.app_config enable row level security;

create policy "Allow read for authenticated"
  on public.app_config for select
  to authenticated
  using (true);

create policy "Allow update for authenticated"
  on public.app_config for update
  to authenticated
  using (true)
  with check (true);

create policy "Allow insert for authenticated"
  on public.app_config for insert
  to authenticated
  with check (true);

-- Si en tu proyecto solo usas código de owner (cookie) y no Supabase Auth, descomenta y usa esta política en lugar de las de arriba:
-- drop policy if exists "Allow read for authenticated" on public.app_config;
-- drop policy if exists "Allow update for authenticated" on public.app_config;
-- drop policy if exists "Allow insert for authenticated" on public.app_config;
-- create policy "Allow all for anon" on public.app_config for all to anon using (true) with check (true);
