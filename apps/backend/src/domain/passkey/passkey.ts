export interface Passkey {
  id: number;
  userId: number;
  credentialId: string;
  publicKey: Uint8Array;
  counter: number;
  createdAt: Date;
  lastUsedAt: Date | null;
}
