-- 0014_storage_avatars.sql — bucket de avatares (Fase 3 Etapa 2).
-- Leitura pública (CDN); escrita só do dono, restrita ao prefixo {userId}/.
-- O resize/crop/EXIF acontece no cliente; o servidor só guarda o webp final.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Leitura pública dos arquivos do bucket (avatar aparece sem auth).
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

-- Escrita (insert/update/delete) só do dono, e apenas sob avatars/{seu_uid}/...
create policy "avatars_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "avatars_owner_update" on storage.objects
  for update using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "avatars_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
