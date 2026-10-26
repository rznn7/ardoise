import { type Payment } from './payment';

export const PAYMENT_REPOSITORY = Symbol('PAYMENT_REPOSITORY');

export interface PaymentRepository {
  findById(id: number): Promise<Payment | null>;
  findByGroupId(groupId: number): Promise<Payment[]>;
  create(input: Omit<Payment, 'id' | 'createdAt'>): Promise<Payment>;
}
