-- ═══════════════════════════════════════════════════════════
--  PVP "Retos" — Ejecutar en Supabase SQL Editor
--  Crea tablas, reglas y el cron que resuelve los duelos
-- ═══════════════════════════════════════════════════════════

-- ── 1. TABLA duelos ──────────────────────────────────────────
create table if not exists public.duelos (
  id uuid primary key default gen_random_uuid(),
  retador_id uuid not null references public.profiles(id) on delete cascade,
  retado_id uuid not null references public.profiles(id) on delete cascade,
  estado text not null default 'pendiente' check (estado in ('pendiente','jugado','expirado','no_presentado')),
  seed integer not null,
  apuesta integer not null default 50,
  aciertos_retador integer not null default 0,
  aciertos_retado integer not null default 0,
  tiempo_retador integer not null default 0,
  tiempo_retado integer not null default 0,
  ganador_id uuid references public.profiles(id) on delete set null,
  creado_en timestamptz not null default now(),
  fecha_limite timestamptz not null default now() + interval '48 hours',
  jugado_en timestamptz,
  resuelto_en timestamptz
);

-- ── 2. TABLA respuestas_pvp (auditoría / desempate) ─────────
create table if not exists public.respuestas_pvp (
  id uuid primary key default gen_random_uuid(),
  duelo_id uuid not null references public.duelos(id) on delete cascade,
  jugador_id uuid not null references public.profiles(id) on delete cascade,
  correcta boolean not null,
  creado_en timestamptz not null default now()
);

create index if not exists idx_respuestas_duelo on public.respuestas_pvp (duelo_id, jugador_id);

-- ── 3. REGLAS ───────────────────────────────────────────────
-- No retarse a sí mismo
alter table public.duelos drop constraint if exists duelo_no_self;
alter table public.duelos add constraint duelo_no_self check (retador_id <> retado_id);

-- Solo casas distintas: trigger valida contra profiles.squad_id
create or replace function public.duelo_casas_distintas()
returns trigger language plpgsql as $$
declare r_sq integer; t_sq integer;
begin
  if new.retador_id = new.retado_id then
    raise exception 'No puedes retarte a ti mismo';
  end if;
  select squad_id into r_sq from public.profiles where id = new.retador_id;
  select squad_id into t_sq from public.profiles where id = new.retado_id;
  if r_sq is null or r_sq = 0 or t_sq is null or t_sq = 0 then
    return new;
  end if;
  if r_sq = t_sq then
    raise exception 'No puedes retar a alguien de tu misma casa';
  end if;
  return new;
end $$;

drop trigger if exists trg_duelo_casas on public.duelos;
create trigger trg_duelo_casas before insert on public.duelos
  for each row execute function public.duelo_casas_distintas();

-- Máx. 5 retos pendientes Lanzados
create or replace function public.duelo_limite_lanzados()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.duelos
      where retador_id = new.retador_id and estado = 'pendiente') >= 5 then
    raise exception 'Ya tienes 5 retos pendientes lanzados';
  end if;
  return new;
end $$;

drop trigger if exists trg_duelo_limite_lanzados on public.duelos;
create trigger trg_duelo_limite_lanzados before insert on public.duelos
  for each row execute function public.duelo_limite_lanzados();

-- Máx. 5 retos pendientes Recibidos
create or replace function public.duelo_limite_recibidos()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.duelos
      where retado_id = new.retado_id and estado = 'pendiente') >= 5 then
    raise exception 'Ese jugador ya tiene 5 retos pendientes';
  end if;
  return new;
end $$;

drop trigger if exists trg_duelo_limite_recibidos on public.duelos;
create trigger trg_duelo_limite_recibidos before insert on public.duelos
  for each row execute function public.duelo_limite_recibidos();

-- No duplicar reto activo entre la misma pareja
create unique index if not exists idx_duelo_unico
  on public.duelos (least(retador_id, retado_id), greatest(retador_id, retado_id))
  where estado = 'pendiente';

-- ── 4. RLS ──────────────────────────────────────────────────
alter table public.duelos enable row level security;
alter table public.respuestas_pvp enable row level security;

drop policy if exists duelo_select on public.duelos;
create policy duelo_select on public.duelos for select
  using (auth.uid() in (retador_id, retado_id));

drop policy if exists duelo_insert on public.duelos;
create policy duelo_insert on public.duelos for insert
  with check (auth.uid() = retador_id);

drop policy if exists duelo_update on public.duelos;
create policy duelo_update on public.duelos for update
  using (auth.uid() in (retador_id, retado_id));

drop policy if exists respuestas_select on public.respuestas_pvp;
create policy respuestas_select on public.respuestas_pvp for select
  using (auth.uid() = jugador_id or exists (
    select 1 from public.duelos d
    where d.id = respuestas_pvp.duelo_id
      and auth.uid() in (d.retador_id, d.retado_id)));

drop policy if exists respuestas_insert on public.respuestas_pvp;
create policy respuestas_insert on public.respuestas_pvp for insert
  with check (auth.uid() = jugador_id);

-- ── 5. CRON: resolver duelos (cada 10 min) ──────────────────
create or replace function public.resolver_duelos()
returns void language plpgsql as $$
declare d public.duelos%rowtype;
begin
  for d in select * from public.duelos where estado = 'pendiente' loop
    -- 5a. Vencido por tiempo
    if d.fecha_limite < now() then
      -- Si alguien abandonó (tiempo = 999999): el que abandonó PIERDE la apuesta
      if d.tiempo_retador >= 999999 and d.tiempo_retado < 999999 then
        update public.profiles set coins = coins + (d.apuesta * 2) where id = d.retado_id;
        update public.profiles set coins = greatest(0, coins - d.apuesta) where id = d.retador_id;
        update public.duelos set estado = 'jugado', ganador_id = d.retado_id,
               resuelto_en = now() where id = d.id;
      elsif d.tiempo_retado >= 999999 and d.tiempo_retador < 999999 then
        update public.profiles set coins = coins + (d.apuesta * 2) where id = d.retador_id;
        update public.profiles set coins = greatest(0, coins - d.apuesta) where id = d.retado_id;
        update public.duelos set estado = 'jugado', ganador_id = d.retador_id,
               resuelto_en = now() where id = d.id;
      else
        update public.profiles set coins = coins + d.apuesta where id = d.retador_id;
        update public.profiles set coins = greatest(0, coins - d.apuesta) where id = d.retado_id;
        update public.duelos set estado = 'no_presentado', ganador_id = d.retador_id,
               resuelto_en = now() where id = d.id;
      end if;
    end if;
  end loop;

  -- 5b. Duelos jugados: comparar aciertos, desempate por tiempo
  for d in select * from public.duelos where estado = 'jugado' and ganador_id is null loop
    declare ganador uuid;
    begin
      if d.aciertos_retador > d.aciertos_retado then ganador := d.retador_id;
      elsif d.aciertos_retado > d.aciertos_retador then ganador := d.retado_id;
      elsif d.tiempo_retador < d.tiempo_retado then ganador := d.retador_id;
      elsif d.tiempo_retado < d.tiempo_retador then ganador := d.retado_id;
      else ganador := d.retador_id; -- empate total: gana el retador
      end if;

      update public.profiles set coins = coins + (d.apuesta * 2) where id = ganador;
      update public.profiles set coins = greatest(0, coins - d.apuesta) where id = (case when ganador = d.retador_id then d.retado_id else d.retador_id end);
      update public.duelos set ganador_id = ganador, resuelto_en = now() where id = d.id;
    end;
  end loop;
end $$;

-- Crear el job (idempotente)
do $$
begin
  if not exists (select 1 from cron.job where jobname = 'resolver-duelos') then
    perform cron.schedule('resolver-duelos', '*/10 * * * *', 'select public.resolver_duelos();');
  end if;
end $$;

-- ── 6. Llamada manual de prueba ─────────────────────────────
-- select public.resolver_duelos();
