import Fastify, { type FastifyInstance } from 'fastify';
import { registerAwardIntervalRoute } from './awards/award-interval.route';
import {
  createDatabaseConnection,
  type DatabaseConnection,
} from './database/connection';
import { createDatabaseSchema } from './database/schema';
import {
  importMovies,
  type ImportSummary,
} from './ingestion/import-movies';
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
  const movies = parseMoviesCsv(options.csvPath);
  const database = createDatabaseConnection();
  let importSummary: ImportSummary;

  try {
    createDatabaseSchema(database);
    importSummary = importMovies(database, movies);
  } catch (error: unknown) {
    database.close();
    throw error;
  }

  const app = Fastify({
    logger: true,
  });

  app.decorate('database', database);
  app.log.info(
    { csvPath: options.csvPath, ingestion: importSummary },
    'CSV import completed',
  );
  registerAwardIntervalRoute(app);
  app.addHook('onClose', (_instance, done) => {
    database.close();
    done();
  });

  return app;
}
