import { randomBytes } from 'crypto';
import type { TokenGenerator } from 'src/shared/token-generator/token-generator';

export class TokenGeneratorCrypto implements TokenGenerator {
  generate(): string {
    return randomBytes(32).toString('base64url');
  }
}
