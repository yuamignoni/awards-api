import Fastify, { type FastifyInstance } from 'fastify';
import {
  createDatabaseConnection,
  type DatabaseConnection,
} from './database/connection';
import { parseMoviesCsv } from './ingestion/parse-movies-csv';

declare module 'fastify' {
  interface FastifyInstance {
    database: DatabaseConnection;
  }
}

export interface BuildAppOptions {
  csvPath: string;
}

export function buildApp(options: BuildAppOptions): FastifyInstance {
  parseMoviesCsv(options.csvPath);

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
