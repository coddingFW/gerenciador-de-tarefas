# ADR-0003 — Web Push via VAPID próprio (vs serviço gerenciado)

- **Status:** Aceito
- **Data:** 2026-06-16
- **Fase:** 2 (Lembretes)

## Contexto
A feature central da Fase 2 é lembrar o usuário de executar seus hábitos via
notificação, inclusive com o app fechado (Web Push). Era preciso escolher o
mecanismo de entrega.

## Problema
Entregar push de forma confiável, alinhada à arquitetura (Clean Architecture,
server-side nas Edge Functions), sem custo e sem lock-in.

## Alternativas
1. **VAPID próprio** — chaves VAPID; envio server-side (Edge Function) com
   `web-push`; subscriptions guardadas no Postgres (RLS).
2. **Serviço gerenciado (OneSignal, etc.)** — SDK no cliente + API externa.
   Setup de push mais rápido, mas dependência externa, SDK no bundle, custo a
   partir de certo volume e fuga do padrão de ports/adapters.

## Decisão
Adotar **(1)**. Chave **pública** VAPID no cliente (`VITE_VAPID_PUBLIC_KEY`,
pública por design); **privada + subject** como secrets da Edge Function
`send-reminders` (server-only). Subscriptions em `public.push_subscriptions`
(RLS owner-only), enviadas via SyncEngine.

## Consequências
- ✅ Sem custo, sem dependência externa, sem SDK no bundle do cliente.
- ✅ Envio 100% server-side; chave privada nunca no bundle.
- ⚠️ `web-push` (npm) roda em Deno via `npm:` specifier; se houver
  incompatibilidade de cripto no runtime, o **fallback** é implementar a
  assinatura VAPID (JWT ES256) + payload `aes128gcm` via **Web Crypto API**.
- ⚠️ iOS exige PWA instalado na tela de início (tratado na UX — ADR-0004/UI).
