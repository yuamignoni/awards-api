import Fastify, { type FastifyInstance } from 'fastify';
import {
  createDatabaseConnection,
  type DatabaseConnection,
} from './database/connection';

declare module 'fastify' {
  interface FastifyInstance {
    database: DatabaseConnection;
  }
}

export interface BuildAppOptions {
  csvPath: string;
}

export function buildApp(_options: BuildAppOptions): FastifyInstance {
  const app = Fastify({
    logger: true,
  });
  const database = createDatabaseConnection();

  app.decorate('database', database);
  app.addHook('onClose', (_instance, done) => {
    database.close();
    done();
  });

  return app;
}
