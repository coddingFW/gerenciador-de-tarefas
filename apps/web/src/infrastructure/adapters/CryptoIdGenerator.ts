import type { IIdGenerator } from "@habit/core";

/** UUID v4 via Web Crypto — funciona offline (gerado no cliente). */
export class CryptoIdGenerator implements IIdGenerator {
  uuid(): string {
    return crypto.randomUUID();
  }
}
