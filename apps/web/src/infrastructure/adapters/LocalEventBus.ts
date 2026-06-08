import type { DomainEvent, IEventBus } from "@habit/core";

/**
 * No cliente, os Domain Events são a fonte para reações locais e analytics. A
 * gravação autoritativa no outbox (`domain_events`) acontece no servidor via
 * triggers/Edge Functions (Fase 1 §6) — o cliente nunca escreve o outbox direto.
 * Para o MVP, registramos em console; é o ponto de extensão para telemetria.
 */
export class LocalEventBus implements IEventBus {
  async publish(event: DomainEvent): Promise<void> {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug("[domain-event]", event.type, event.payload);
    }
  }
}
