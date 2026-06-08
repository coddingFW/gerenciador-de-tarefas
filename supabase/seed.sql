-- seed.sql — dados iniciais para desenvolvimento local (supabase db reset).
-- Não inclui usuários: estes nascem via login com Google.

insert into public.feature_flags (key, description, enabled_global)
values
  ('ai_suggestions', 'Sugestões de hábitos por IA (preparado para o futuro)', false),
  ('premium_dashboard', 'Dashboards avançados do plano premium', false)
on conflict (key) do nothing;
