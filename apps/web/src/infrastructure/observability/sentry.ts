/**
 * Observabilidade — inicialização do Sentry (Fase 1).
 *
 * No-op quando `VITE_SENTRY_DSN` está vazio (modo demo/offline e dev local): o
 * app local-first nunca depende de um backend de telemetria para funcionar.
 *
 * O Sentry é carregado por import dinâmico — o chunk só é baixado quando há DSN
 * configurado (build de produção), preservando o bundle base mínimo
 * (alvo mobile-first). Ver docs/adr/ADR-0002-sentry-observability.md.
 */
export async function initSentry(): Promise<void> {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  const Sentry = await import("@sentry/browser");
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Amostragem conservadora: erros sempre; tracing leve para não pesar no mobile.
    tracesSampleRate: 0.1,
    // Sem PII por padrão (e-mail/IP não são enviados sem opt-in explícito).
    sendDefaultPii: false,
  });
}
