import { createServer } from 'node:net';

/** A free port. listen(0) doesn't work with Hocuspocus: 0 counts as "not set" and port 80 is taken. */
export function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as { port: number };
      probe.close(() => resolve(port));
    });
  });
}
