-- ═══════════════════════════════════════════════════════════
--  PREMIOS DE DECRETOS / MISIONES DE CASA
--  Ejecutar en Supabase SQL Editor
--  Cuando una casa cumple el objetivo del decreto, TODOS sus
--  miembros reciben la recompensa en florines (una sola vez).
-- ═══════════════════════════════════════════════════════════

-- 1. Tabla para no entregar dos veces el mismo premio
create table if not exists public.decreto_recompensas (
  mission_id bigint not null references public.squad_missions(id) on delete cascade,
  squad_id integer not null,
  granted_at timestamptz not null default now(),
  primary key (mission_id, squad_id)
);

alter table public.decreto_recompensas enable row level security;

-- Los jugadores pueden ver los premios entregados de SU casa
drop policy if exists decreto_recompensas_select on public.decreto_recompensas;
create policy decreto_recompensas_select on public.decreto_recompensas for select
  to authenticated
  using (squad_id in (select squad_id from public.profiles where id = auth.uid()));

-- 2. Función que reparte los premios (idempotente)
create or replace function public.resolver_decretos()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  m record;
  sq integer;
  prog integer;
begin
  for m in select * from public.squad_missions where is_active = true loop
    for sq in select distinct squad_id from public.profiles
              where squad_id is not null and squad_id > 0
              order by squad_id loop
      if exists (select 1 from public.decreto_recompensas
                 where mission_id = m.id and squad_id = sq) then
        continue;
      end if;

      if m.type = 'points' then
        select coalesce(sum(total_score), 0) into prog from public.profiles where squad_id = sq;
      elsif m.type = 'attacks' then
        select coalesce(sum(total_attacks), 0) into prog from public.profiles where squad_id = sq;
      else
        select coalesce(max(current_level), 0) into prog from public.profiles where squad_id = sq;
      end if;

      if prog >= m.goal then
        insert into public.decreto_recompensas (mission_id, squad_id) values (m.id, sq);
        update public.profiles set coins = coins + m.reward where squad_id = sq;
      end if;
    end loop;
  end loop;
end $$;

grant execute on function public.resolver_decretos() to authenticated;

-- 3. Cron cada 10 minutos (idempotente)
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'resolver-decretos') then
    perform cron.schedule('resolver-decretos', '*/10 * * * *', 'select public.resolver_decretos();');
  end if;
end $$;

-- 4. Repartir YA (prueba manual):
-- select public.resolver_decretos();
