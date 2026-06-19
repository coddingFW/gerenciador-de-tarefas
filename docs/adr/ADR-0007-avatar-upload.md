# ADR-0007 — Avatar: bucket público + resize/EXIF no cliente + cache-bust

- **Status:** Aceito
- **Data:** 2026-06-16
- **Fase:** 3 (Perfil e preferências) — Etapa 2

## Contexto
O usuário pode definir uma foto de perfil. O app é offline-first, mobile-first e
de bundle mínimo; fotos de câmera mobile trazem orientação EXIF.

## Decisões
1. **Bucket `avatars` público (leitura)** — o avatar aparece sem auth (CDN). A
   escrita é restrita por policy ao dono e ao prefixo `avatars/{userId}/`
   (migration `0014`). Trade-off: a URL é pública/adivinhável; aceitável para foto
   de avatar (não é dado sensível).
2. **Processamento no cliente** — `createImageBitmap(file, { imageOrientation:
   'from-image' })` corrige a rotação EXIF; center-crop quadrado + canvas →
   **webp 256×256**. Sem libs de imagem (mantém o bundle). Fallback `<img>.decode()`
   quando a opção não é suportada.
3. **Cache-bust** — a URL salva no profile recebe `?v={timestamp}` a cada upload,
   forçando navegador + CDN a buscar a versão nova (o caminho do arquivo é fixo,
   `{userId}/avatar.webp`, com `upsert`). Se a CDN se mostrar teimosa, o fallback
   documentado é migrar para path único por upload (`{userId}/{ts}.webp`) + limpeza.
4. **Exceção offline-first** — upload binário exige rede; não passa pela fila do
   SyncEngine. Em modo demo (sem Supabase), usa `objectURL` local (preview da
   sessão). A URL resultante é persistida no profile via `UpdateProfile` e
   sincroniza normalmente (é só texto).

## Alternativas rejeitadas
- Bucket privado + signed URLs: mais complexidade para um dado não sensível.
- Lib de crop/EXIF (ex.: cropperjs): peso desproporcional ao escopo.
- Subir o binário pela fila offline: o SyncEngine é para dados (JSON), não blobs.

## Consequências
- ✅ Bundle praticamente inalterado; orientação correta; troca de foto reflete na
  hora (cache-bust); funciona em demo (preview local).
- ⚠️ URL do avatar é pública. ⚠️ O `objectURL` de demo expira ao recarregar — o
  `Avatar` cai para iniciais via `onError`.
