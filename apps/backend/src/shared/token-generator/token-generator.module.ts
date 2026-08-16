import { Module } from '@nestjs/common';
import { TOKEN_GENERATOR } from 'src/shared/token-generator/token-generator';
import { TokenGeneratorCrypto } from 'src/shared/token-generator/token-generator.crypto';

@Module({
  providers: [{ provide: TOKEN_GENERATOR, useClass: TokenGeneratorCrypto }],
  exports: [TOKEN_GENERATOR],
})
export class TokenGeneratorModule {}
