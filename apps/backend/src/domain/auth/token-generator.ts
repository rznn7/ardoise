export const TOKEN_GENERATOR = Symbol('TOKEN_GENERATOR');

export interface TokenGenerator {
  generate(): string;
}
