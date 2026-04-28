import { randomBytes } from 'crypto';
import type { TokenGenerator } from 'src/domain/auth/token-generator';

export class TokenGeneratorCrypto implements TokenGenerator {
  generate(): string {
    return randomBytes(32).toString('base64url');
  }
}
