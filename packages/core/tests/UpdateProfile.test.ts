import { beforeEach, describe, expect, it } from "vitest";
import { UpdateProfile } from "../src/application/use-cases/UpdateProfile.js";
import type { Theme } from "../src/domain/entities/index.js";
import { FakeEventBus, FakeProfileRepository } from "./fakes.js";

describe("UpdateProfile", () => {
  let profiles: FakeProfileRepository;
  let bus: FakeEventBus;
  let useCase: UpdateProfile;

  beforeEach(() => {
    profiles = new FakeProfileRepository();
    bus = new FakeEventBus();
    useCase = new UpdateProfile(profiles, bus);
  });

  it("atualiza o tema e publica ProfileUpdated", async () => {
    await useCase.execute({ userId: "u1", theme: "dark" });
    expect((await profiles.getProfile("u1"))?.theme).toBe("dark");
    expect(bus.types()).toEqual(["ProfileUpdated"]);
  });

  it("atualiza nome e avatar juntos", async () => {
    await useCase.execute({ userId: "u1", displayName: "Juan", avatarUrl: "https://x/a.webp" });
    const p = await profiles.getProfile("u1");
    expect(p?.displayName).toBe("Juan");
    expect(p?.avatarUrl).toBe("https://x/a.webp");
  });

  it("rejeita tema inválido", async () => {
    await expect(useCase.execute({ userId: "u1", theme: "neon" as Theme })).rejects.toThrow(
      "PROFILE_THEME_INVALID",
    );
  });

  it("no-op quando não há campos para atualizar (não publica evento)", async () => {
    await useCase.execute({ userId: "u1" });
    expect(bus.types()).toEqual([]);
    expect(profiles.writes).toBe(0);
  });
});
