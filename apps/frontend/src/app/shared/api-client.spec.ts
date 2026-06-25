import { type HttpClient } from '@angular/common/http';
import { expenseGroupApi, type ExpenseGroupSummary } from '@ardoise/shared';
import { firstValueFrom, of } from 'rxjs';

import { type ApiClient, createApiClient } from './api-client';

const summary: ExpenseGroupSummary = {
  id: 1,
  name: 'Trip',
  currencyCode: 'EUR',
  createdAt: '2024-01-01T00:00:00.000Z',
};

function setup(response: unknown = of(summary)): {
  client: ApiClient<typeof expenseGroupApi>;
  request: ReturnType<typeof vi.fn>;
} {
  const request = vi.fn().mockReturnValue(response);
  const http = { request } as unknown as HttpClient;
  const client = createApiClient(expenseGroupApi, { http, baseUrl: '/api' });
  return { client, request };
}

describe('createApiClient', () => {
  it('interpolates path params into the URL', () => {
    const { client, request } = setup();

    client.findOne({ params: { id: 5 } });

    expect(request).toHaveBeenCalledWith('GET', '/api/expense-groups/5', {
      body: undefined,
      withCredentials: true,
    });
  });

  it('sends the body and verb for a write endpoint', () => {
    const { client, request } = setup();

    client.create({ body: { name: 'Trip', currencyCode: 'EUR' } });

    expect(request).toHaveBeenCalledWith('POST', '/api/expense-groups', {
      body: { name: 'Trip', currencyCode: 'EUR' },
      withCredentials: true,
    });
  });

  it('calls a no-arg endpoint without a request object', () => {
    const { client, request } = setup(of([summary]));

    client.listMine();

    expect(request).toHaveBeenCalledWith('GET', '/api/expense-groups', {
      body: undefined,
      withCredentials: true,
    });
  });

  it('parses the response against the contract schema', async () => {
    const { client } = setup(of(summary));

    await expect(firstValueFrom(client.findOne({ params: { id: 1 } }))).resolves.toEqual(summary);
  });

  it('errors when the response violates the contract schema', async () => {
    const { client } = setup(of({ id: 'not-a-number' }));

    await expect(firstValueFrom(client.findOne({ params: { id: 1 } }))).rejects.toThrow();
  });

  it('throws when a required path param is missing', () => {
    const { client } = setup();

    expect(() => (client.findOne as (req: { params: object }) => unknown)({ params: {} })).toThrow(
      /Missing path param: id/,
    );
  });
});
