import type { Theme } from "../../domain/entities/index.js";
import { createEvent } from "../../domain/events/index.js";
import type { IEventBus, IProfileRepository, ProfileUpdate } from "../ports/index.js";

export interface UpdateProfileInput {
  userId: string;
  theme?: Theme;
  displayName?: string | null;
  avatarUrl?: string | null;
}

const THEMES: Theme[] = ["light", "dark", "system"];

/**
 * Atualiza preferências do perfil (tema, nome, avatar). Validação de domínio +
 * publica `ProfileUpdated`. Persistência offline-first; o SyncEngine propaga ao
 * Supabase com o mesmo merge dos demais registros.
 */
export class UpdateProfile {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly bus: IEventBus,
  ) {}

  async execute(input: UpdateProfileInput): Promise<void> {
    if (input.theme !== undefined && !THEMES.includes(input.theme)) {
      throw new Error("PROFILE_THEME_INVALID");
    }

    const patch: ProfileUpdate = {};
    if (input.theme !== undefined) patch.theme = input.theme;
    if (input.displayName !== undefined) patch.displayName = input.displayName;
    if (input.avatarUrl !== undefined) patch.avatarUrl = input.avatarUrl;
    if (Object.keys(patch).length === 0) return;

    await this.profiles.updateProfile(input.userId, patch);
    await this.bus.publish(createEvent("ProfileUpdated", input.userId, input.userId, { ...patch }));
  }
}
