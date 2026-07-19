import { buildApp } from './app';
const DEFAULT_PORT = 3000;
const DEFAULT_HOST = '0.0.0.0';

async function start(): Promise<void> {
  const app = buildApp();

  try {
    await app.listen({
      port: DEFAULT_PORT,
      host: DEFAULT_HOST,
    });
  } catch (error: unknown) {
    app.log.error(error);
    process.exitCode = 1;
  }
}

void start();
