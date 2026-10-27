import { Inject, Injectable } from '@nestjs/common';
import { assertAdmin } from 'src/admin/domain/admin';
import {
  ADMIN_READ_REPOSITORY,
  type AdminOverviewRead,
  type AdminReadRepository,
} from 'src/admin/domain/admin-read-repository';
import { type SessionUser } from 'src/shared/http/express';

@Injectable()
export class GetAdminOverviewUseCase {
  constructor(
    @Inject(ADMIN_READ_REPOSITORY) private readonly admin: AdminReadRepository,
  ) {}

  async execute({
    caller,
  }: {
    caller: SessionUser;
  }): Promise<AdminOverviewRead> {
    assertAdmin(caller);
    return this.admin.overview();
  }
}
