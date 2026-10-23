import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('public-track reference compatibility', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  const tracking = 'CCC754365464370LUCS11';

  const lookup = async (method: string, query: string, body?: unknown) => {
    let handler: ((req: Request) => Promise<Response>) | undefined;
    const rpc = async (_name: string, args: Record<string, unknown>) => ({
      data: args.p_identifier === tracking ? { tracking_number: tracking, status: 'delivered', order_delivered: true, scheduled_pickup_date: '2026-10-20T10:00:00+00:00', tracking_events: { shipday: { updates: [{ leg: 'pickup', event: 'ORDER_ASSIGNED', timestamp: 't', description: 'Driver Abdul Hadi assigned for collection' }, { leg: 'pickup', event: 'ORDER_ACCEPTED_AND_STARTED', timestamp: 't', description: 'Driver Abdul Hadi has accepted and started collection' }] } } } : null,
      error: null,
    });
    const { z } = await import('zod');
    const executable = source.replace(/^import .*;$/gm, '');
    const { transform } = await import('esbuild');
    const compiled = await transform(executable, { loader: 'ts', format: 'cjs' });
    new Function('Deno', 'createClient', 'z', compiled.code)(
      { serve: (fn: typeof handler) => { handler = fn; }, env: { get: () => 'test' } },
      () => ({ rpc }), z,
    );
    if (!handler) throw new Error('Missing endpoint handler');
    return handler(new Request(`https://example.com/?${query}`, {
      method,
      ...(body ? { body: JSON.stringify(body) } : {}),
    }));
  };

  it('accepts the retail GET ref parameter', async () => {
    const response = await lookup('GET', `ref=${tracking}`);
    expect(response.status).toBe(200);
    expect((await response.json()).order.tracking_number).toBe(tracking);
  });
  it('preserves GET tracking support', async () => {
    expect((await lookup('GET', `tracking=${tracking}`)).status).toBe(200);
  });
  it('accepts the retail POST ref parameter', async () => {
    expect((await lookup('POST', '', { ref: tracking })).status).toBe(200);
  });
  it('still rejects malformed references', async () => {
    expect((await lookup('GET', 'ref=invalid')).status).toBe(404);
  });
  it('returns flat status and date fields for the retail page', async () => {
    const b = await (await lookup('GET', `ref=${tracking}`)).json();
    expect(b.status_label).toBe('Delivered');
    expect(b.delivered).toBe(true);
    expect(b.collection_date).toBe('2026-10-20');
  });
  it('removes driver names from timeline text', async () => {
    const b = await (await lookup('GET', `ref=${tracking}`)).json();
    expect(b.order.events[0].description).toBe('Driver assigned for collection');
    expect(b.order.events[1].description).toBe('Driver has accepted and started collection');
  });
});
