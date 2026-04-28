export type User = {
  readonly id: number;
  readonly name: string;
  readonly role: 'user' | 'admin';
  readonly webauthnUserId: string;
};
