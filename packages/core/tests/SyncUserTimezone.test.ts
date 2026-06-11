import { beforeEach, describe, expect, it } from "vitest";
import { SyncUserTimezone } from "../src/application/use-cases/SyncUserTimezone.js";
import { FakeProfileRepository } from "./fakes.js";

describe("SyncUserTimezone", () => {
  let profiles: FakeProfileRepository;
  let useCase: SyncUserTimezone;

  beforeEach(() => {
    profiles = new FakeProfileRepository();
    useCase = new SyncUserTimezone(profiles);
  });

  it("persiste o fuso quando ainda não há nenhum salvo", async () => {
    const tz = await useCase.execute({ userId: "u1", browserTimezone: "America/Sao_Paulo" });
    expect(tz).toBe("America/Sao_Paulo");
    expect(await profiles.getTimezone("u1")).toBe("America/Sao_Paulo");
    expect(profiles.writes).toBe(1);
  });

  it("é idempotente: não reescreve quando o fuso é o mesmo", async () => {
    profiles = new FakeProfileRepository({ u1: "America/Sao_Paulo" });
    useCase = new SyncUserTimezone(profiles);
    await useCase.execute({ userId: "u1", browserTimezone: "America/Sao_Paulo" });
    expect(profiles.writes).toBe(0);
  });

  it("atualiza quando o usuário troca de fuso (viagem)", async () => {
    profiles = new FakeProfileRepository({ u1: "America/Sao_Paulo" });
    useCase = new SyncUserTimezone(profiles);
    const tz = await useCase.execute({ userId: "u1", browserTimezone: "Europe/Lisbon" });
    expect(tz).toBe("Europe/Lisbon");
    expect(profiles.writes).toBe(1);
  });

  it("faz fallback para UTC quando o fuso vem vazio", async () => {
    const tz = await useCase.execute({ userId: "u1", browserTimezone: "" });
    expect(tz).toBe("UTC");
    expect(await profiles.getTimezone("u1")).toBe("UTC");
  });
});
