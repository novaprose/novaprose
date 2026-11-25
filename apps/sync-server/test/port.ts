import { createServer } from 'node:net';

/** Свободный порт. listen(0) у Hocuspocus не годится: 0 считается «не задан» и берётся порт 80. */
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
