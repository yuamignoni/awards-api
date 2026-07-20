import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { createDatabaseConnection } from '../src/database/connection';
import { createDatabaseSchema } from '../src/database/schema';
import { importMovies } from '../src/ingestion/import-movies';
import { parseMoviesCsv } from '../src/ingestion/parse-movies-csv';

const fixturesPath = resolve(__dirname, 'fixtures');

describe('GET /api/v1/producers/award-intervals', () => {
  it('returns the minimum and maximum intervals between consecutive wins', async () => {
    const csvPath = resolve(fixturesPath, 'simple.csv');
    const app = buildApp({ csvPath });

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/producers/award-intervals',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toBe('application/json; charset=utf-8');
      expect(response.json()).toEqual({
        min: [
          {
            producer: 'Alice Producer',
            interval: 1,
            previousWin: 2000,
            followingWin: 2001,
          },
        ],
        max: [
          {
            producer: 'Bob Producer',
            interval: 20,
            previousWin: 1990,
            followingWin: 2010,
          },
        ],
      });
    } finally {
      await app.close();
    }
  });
});

describe('application bootstrap from CSV', () => {
  it('accepts a valid movie file', async () => {
    const csvPath = resolve(fixturesPath, 'simple.csv');
    const app = buildApp({ csvPath });

    try {
      await app.ready();
    } finally {
      await app.close();
    }
  });

  it('rejects an unexpected header with file, line and field details', () => {
    const csvPath = resolve(fixturesPath, 'invalid-header.csv');

    expect(() => buildApp({ csvPath })).toThrow(
      /invalid-header\.csv.*line 1.*field "header"/i,
    );
  });

  it('prevents app startup for an invalid record with a useful diagnostic', () => {
    const csvPath = resolve(fixturesPath, 'invalid-record.csv');

    expect(() => buildApp({ csvPath })).toThrow(
      /invalid-record\.csv.*line 2.*field "year"/i,
    );
  });

  it('rejects a record with extra columns', () => {
    const csvPath = resolve(fixturesPath, 'invalid-extra-column.csv');

    expect(() => buildApp({ csvPath })).toThrow(
      /invalid-extra-column\.csv.*line 2.*field "record".*expect 5, got 6/i,
    );
  });

  it('loads movies, producers and their relationships into SQLite', async () => {
    const csvPath = resolve(fixturesPath, 'simple.csv');
    const app = buildApp({ csvPath });

    try {
      await app.ready();

      const foreignKeys = app.database.pragma('foreign_keys', {
        simple: true,
      });
      const counts = app.database
        .prepare(
          `
            SELECT
              (SELECT COUNT(*) FROM movies) AS movies,
              (SELECT COUNT(*) FROM producers) AS producers,
              (SELECT COUNT(*) FROM movie_producers) AS movieProducers
          `,
        )
        .get();

      expect(foreignKeys).toBe(1);
      expect(counts).toEqual({
        movies: 5,
        producers: 5,
        movieProducers: 7,
      });
    } finally {
      await app.close();
    }
  });

  it('rolls back the entire import when one insert fails', () => {
    const csvPath = resolve(fixturesPath, 'simple.csv');
    const movies = parseMoviesCsv(csvPath);
    const database = createDatabaseConnection();

    try {
      createDatabaseSchema(database);
      database.exec(`
        CREATE TRIGGER reject_second_movie
        BEFORE INSERT ON movies
        WHEN NEW.title = 'Short Interval End'
        BEGIN
          SELECT RAISE(ABORT, 'controlled import failure');
        END;
      `);

      expect(() => importMovies(database, movies)).toThrow(
        /controlled import failure/i,
      );

      const counts = database
        .prepare(
          `
            SELECT
              (SELECT COUNT(*) FROM movies) AS movies,
              (SELECT COUNT(*) FROM producers) AS producers,
              (SELECT COUNT(*) FROM movie_producers) AS movieProducers
          `,
        )
        .get();

      expect(counts).toEqual({
        movies: 0,
        producers: 0,
        movieProducers: 0,
      });
    } finally {
      database.close();
    }
  });
});
