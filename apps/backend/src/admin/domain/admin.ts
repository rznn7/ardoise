export class NotAnAdmin extends Error {}
export class AdminUserNotFound extends Error {}
export class AdminGroupNotFound extends Error {}

export const assertAdmin = (user: {
  readonly role: 'user' | 'admin';
}): void => {
  if (user.role !== 'admin') throw new NotAnAdmin();
};
