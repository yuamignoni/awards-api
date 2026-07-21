import { resolve } from 'node:path';
import { buildApp } from './app';

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_CSV_PATH = resolve(__dirname, '../data/Movielist.csv');

export interface StartOptions {
  csvPath?: string;
}

export async function start(options: StartOptions = {}): Promise<void> {
  let app: ReturnType<typeof buildApp>;

  try {
    app = buildApp({ csvPath: options.csvPath ?? DEFAULT_CSV_PATH });
  } catch (error: unknown) {
    console.error('Failed to start application', error);
    process.exitCode = 1;
    return;
  }

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

if (require.main === module) {
  void start();
}
