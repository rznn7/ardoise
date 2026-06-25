import { type HttpClient } from '@angular/common/http';
import { type Endpoint } from '@ardoise/shared';
import { map, type Observable } from 'rxjs';
import { type z } from 'zod';

type PathParams<P extends string> = P extends `${string}:${infer Param}/${infer Rest}`
  ? Param | PathParams<`/${Rest}`>
  : P extends `${string}:${infer Param}`
    ? Param
    : never;

type ParamsArg<E extends Endpoint> =
  PathParams<E['path']> extends never
    ? object
    : { params: Record<PathParams<E['path']>, string | number> };

type BodyArg<E extends Endpoint> = E extends { body: z.ZodType }
  ? { body: z.input<E['body']> }
  : object;

type RequestArg<E extends Endpoint> = ParamsArg<E> & BodyArg<E>;

type Res<E extends Endpoint> = E extends { res: z.ZodType } ? z.infer<E['res']> : void;

type ClientMethod<E extends Endpoint> = keyof RequestArg<E> extends never
  ? () => Observable<Res<E>>
  : (req: RequestArg<E>) => Observable<Res<E>>;

export type ApiClient<T extends Record<string, Endpoint>> = {
  [K in keyof T]: ClientMethod<T[K]>;
};

const interpolate = (path: string, params?: Record<string, string | number>): string =>
  path.replace(/:([A-Za-z0-9_]+)/g, (_, key: string) => {
    const value = params?.[key];
    if (value === undefined) throw new Error(`Missing path param: ${key}`);
    return String(value);
  });

export const createApiClient = <T extends Record<string, Endpoint>>(
  contract: T,
  config: { http: HttpClient; baseUrl: string },
): ApiClient<T> => {
  const client = {} as Record<string, unknown>;

  for (const [name, endpoint] of Object.entries(contract)) {
    client[name] = (req?: {
      params?: Record<string, string | number>;
      body?: unknown;
    }): Observable<unknown> => {
      const response = config.http.request(
        endpoint.method,
        `${config.baseUrl}${interpolate(endpoint.path, req?.params)}`,
        { body: req?.body, withCredentials: true },
      );
      const schema = endpoint.res;
      return schema ? response.pipe(map((res) => schema.parse(res))) : response;
    };
  }

  return client as ApiClient<T>;
};
