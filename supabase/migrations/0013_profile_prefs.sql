-- 0013_profile_prefs.sql — preferências do perfil (Fase 3): tema da UI.
-- profiles já tem RLS de update do dono (0002), grants (0010) e realtime (0009);
-- o trigger protect_profile_privileges trava apenas role/plan, então `theme` é
-- atualizável pelo dono normalmente. avatar_url/display_name já existem (0001).

alter table public.profiles
  add column if not exists theme text not null default 'system'
    check (theme in ('light', 'dark', 'system'));
