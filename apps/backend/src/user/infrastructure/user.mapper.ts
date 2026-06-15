import { type MeResponse } from '@ardoise/shared';
import { type User } from 'src/user/domain/user';

export const toMeResponse = (user: User): MeResponse => ({
  id: user.id,
  name: user.name,
  role: user.role,
});
