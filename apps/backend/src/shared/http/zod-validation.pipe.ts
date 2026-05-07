import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import z from 'zod';

@Injectable()
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value);
    if (!result.success)
      throw new BadRequestException(z.treeifyError(result.error));

    return result.data;
  }
}
