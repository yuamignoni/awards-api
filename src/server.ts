import { resolve } from 'node:path';
import { buildApp } from './app';

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_CSV_PATH = resolve(process.cwd(), 'data/Movielist.csv');

async function start(): Promise<void> {
  const app = buildApp({ csvPath: DEFAULT_CSV_PATH });
  let isShuttingDown = false;

  async function shutdown(reason: NodeJS.Signals | 'startup-error'): Promise<void> {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    app.log.info({ reason }, 'Shutting down application');

    try {
      await app.close();
    } catch (error: unknown) {
      app.log.error(error, 'Failed to close application');
      process.exitCode = 1;
    }
  }

  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  try {
    await app.listen({
      port: DEFAULT_PORT,
      host: DEFAULT_HOST,
    });
  } catch (error: unknown) {
    app.log.error(error);
    process.exitCode = 1;
    await shutdown('startup-error');
  }
}

void start();
