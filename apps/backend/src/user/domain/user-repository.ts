import { type User } from './user';

export const USER_REPOSITORY = Symbol('USER_REPOSITORY');

export interface UserRepository {
  findById(id: number): Promise<User | null>;
  findByWebauthnUserId(id: string): Promise<User | null>;
  create(input: { webauthnUserId: string; name: string }): Promise<User>;
  rename(id: number, name: string): Promise<User>;
}
