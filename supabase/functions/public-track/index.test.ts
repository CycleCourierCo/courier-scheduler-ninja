import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('public-track reference compatibility', () => {
  const source = readFileSync(new URL('./index.ts', import.meta.url), 'utf8');
  const tracking = 'CCC754365464370LUCS11';

  const lookup = async (method: string, query: string, body?: unknown) => {
    let handler: ((req: Request) => Promise<Response>) | undefined;
    const rpc = async (_name: string, args: Record<string, unknown>) => ({
      data: args.p_identifier === tracking ? { tracking_number: tracking, status: 'collected' } : null,
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
});