-- ═══════════════════════════════════════════════════════════
--  BORRAR CUENTAS (admin) — Ejecutar en Supabase SQL Editor
--  Crea una función que elimina la cuenta completa:
--  retos, respuestas, perfil público y el LOGIN (auth.users)
--  security definer → evita bloqueos de RLS
-- ═══════════════════════════════════════════════════════════

create or replace function public.delete_user(uid uuid)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (select 1 from public.profiles where id = uid) then
    return 'no_existe';
  end if;
  if exists (select 1 from public.profiles where id = uid and username = 'profemiguel') then
    return 'es_admin';
  end if;

  -- Retos (retador, retado o ganador) y respuestas — los FK
  -- ya tienen ON DELETE CASCADE, pero se limpian por seguridad
  delete from public.duelos where retador_id = uid or retado_id = uid;
  delete from public.respuestas_pvp where jugador_id = uid;

  -- Perfil público
  delete from public.profiles where id = uid;

  -- Login real (auth.users): elimina la cuenta por completo
  delete from auth.users where id = uid;

  return 'ok';
end $$;

grant execute on function public.delete_user(uuid) to authenticated;
