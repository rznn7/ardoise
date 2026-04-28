export type Passkey = {
  readonly id: number;
  readonly userId: number;
  readonly credentialId: string;
  readonly publicKey: Uint8Array;
  readonly counter: number;
  readonly createdAt: Date;
  readonly lastUsedAt: Date | null;
};
