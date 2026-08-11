-- ═══════════════════════════════════════════════════════════
--  Victorias / Derrotas PVP — Ejecutar en Supabase SQL Editor
--  1) Agrega columnas de conteo a profiles
--  2) Reescribe resolver_duelos() para que AL RESOLVER el duelo
--     sume +1 victoria al ganador y +1 derrota al perdedor
--     (vencer = más aciertos; empate = gana el más rápido)
-- ═══════════════════════════════════════════════════════════

alter table public.profiles add column if not exists pvp_victorias integer not null default 0;
alter table public.profiles add column if not exists pvp_derrotas integer not null default 0;

create or replace function public.resolver_duelos()
returns void language plpgsql as $$
declare d public.duelos%rowtype;
begin
  for d in select * from public.duelos where estado = 'pendiente' loop
    -- 5a. Vencido por tiempo
    if d.fecha_limite < now() then
      -- Si alguien abandonó (tiempo = 999999): el que abandonó PIERDE la apuesta
      if d.tiempo_retador >= 999999 and d.tiempo_retado < 999999 then
        update public.profiles set coins = coins + (d.apuesta * 2),
               pvp_victorias = pvp_victorias + 1 where id = d.retado_id;
        update public.profiles set coins = greatest(0, coins - d.apuesta),
               pvp_derrotas = pvp_derrotas + 1 where id = d.retador_id;
        update public.duelos set estado = 'jugado', ganador_id = d.retado_id,
               resuelto_en = now() where id = d.id;
      elsif d.tiempo_retado >= 999999 and d.tiempo_retador < 999999 then
        update public.profiles set coins = coins + (d.apuesta * 2),
               pvp_victorias = pvp_victorias + 1 where id = d.retador_id;
        update public.profiles set coins = greatest(0, coins - d.apuesta),
               pvp_derrotas = pvp_derrotas + 1 where id = d.retado_id;
        update public.duelos set estado = 'jugado', ganador_id = d.retador_id,
               resuelto_en = now() where id = d.id;
      else
        update public.profiles set coins = coins + d.apuesta,
               pvp_victorias = pvp_victorias + 1 where id = d.retador_id;
        update public.profiles set coins = greatest(0, coins - d.apuesta),
               pvp_derrotas = pvp_derrotas + 1 where id = d.retado_id;
        update public.duelos set estado = 'no_presentado', ganador_id = d.retador_id,
               resuelto_en = now() where id = d.id;
      end if;
    end if;
  end loop;

  -- 5b. Duelos jugados: comparar aciertos, desempate por tiempo
  for d in select * from public.duelos where estado = 'jugado' and ganador_id is null loop
    declare ganador uuid; perdedor uuid;
    begin
      if d.aciertos_retador > d.aciertos_retado then ganador := d.retador_id;
      elsif d.aciertos_retado > d.aciertos_retador then ganador := d.retado_id;
      elsif d.tiempo_retador < d.tiempo_retado then ganador := d.retador_id;
      elsif d.tiempo_retado < d.tiempo_retador then ganador := d.retado_id;
      else ganador := d.retador_id; -- empate total: gana el retador
      end if;
      perdedor := case when ganador = d.retador_id then d.retado_id else d.retador_id end;

      update public.profiles set coins = coins + (d.apuesta * 2),
             pvp_victorias = pvp_victorias + 1 where id = ganador;
      update public.profiles set coins = greatest(0, coins - d.apuesta),
             pvp_derrotas = pvp_derrotas + 1 where id = perdedor;
      update public.duelos set ganador_id = ganador, resuelto_en = now() where id = d.id;
    end;
  end loop;
end $$;

-- Prueba manual:
-- select public.resolver_duelos();