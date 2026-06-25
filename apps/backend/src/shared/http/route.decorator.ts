import { type Endpoint } from '@ardoise/shared';
import {
  applyDecorators,
  Delete,
  Get,
  HttpCode,
  Patch,
  Post,
  Put,
} from '@nestjs/common';

const VERB = { GET: Get, POST: Post, PATCH: Patch, PUT: Put, DELETE: Delete };

export const Route = (endpoint: Endpoint): MethodDecorator =>
  endpoint.status === undefined
    ? VERB[endpoint.method](endpoint.path)
    : applyDecorators(
        VERB[endpoint.method](endpoint.path),
        HttpCode(endpoint.status),
      );
