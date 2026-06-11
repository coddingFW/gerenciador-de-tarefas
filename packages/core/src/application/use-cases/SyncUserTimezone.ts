import type { IProfileRepository } from "../ports/index.js";

export interface SyncUserTimezoneInput {
  userId: string;
  /** Fuso detectado no cliente (ex.: Intl IANA "America/Sao_Paulo"). */
  browserTimezone: string;
}

/**
 * Infra crítica: persiste o fuso do usuário no perfil de forma SILENCIOSA e
 * IDEMPOTENTE. Sem isso, o servidor deriva streak/score em `UTC` (default da
 * coluna `profiles.timezone`) enquanto o cliente usa o fuso local — divergência
 * perto da meia-noite. Só escreve quando o valor muda; retorna o fuso efetivo.
 */
export class SyncUserTimezone {
  constructor(private readonly profiles: IProfileRepository) {}

  async execute(input: SyncUserTimezoneInput): Promise<string> {
    const timezone = input.browserTimezone?.trim() || "UTC";
    const current = await this.profiles.getTimezone(input.userId);
    if (current !== timezone) {
      await this.profiles.setTimezone(input.userId, timezone);
    }
    return timezone;
  }
}
