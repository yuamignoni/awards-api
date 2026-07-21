import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app';
import { start } from '../src/server';
import { createDatabaseConnection } from '../src/database/connection';
import { createDatabaseSchema } from '../src/database/schema';
import { importMovies } from '../src/ingestion/import-movies';
import { parseMoviesCsv } from '../src/ingestion/parse-movies-csv';

const fixturesPath = resolve(__dirname, 'fixtures');

async function requestAwardIntervals(fixtureName: string): Promise<unknown> {
  const csvPath = resolve(fixturesPath, fixtureName);
  const app = buildApp({ csvPath });

  try {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/producers/award-intervals',
    });

    expect(response.statusCode).toBe(200);
    return response.json();
  } finally {
    await app.close();
  }
}

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

  it('uses adjacent wins regardless of CSV order and preserves tied intervals', async () => {
    await expect(requestAwardIntervals('consecutive-wins.csv')).resolves.toEqual({
      min: [
        {
          producer: 'Beta Producer',
          interval: 1,
          previousWin: 2001,
          followingWin: 2002,
        },
      ],
      max: [
        {
          producer: 'Alpha Producer',
          interval: 5,
          previousWin: 2000,
          followingWin: 2005,
        },
        {
          producer: 'Alpha Producer',
          interval: 5,
          previousWin: 2005,
          followingWin: 2010,
        },
      ],
    });
  });

  it('preserves tied coproducer events, Anderson and wins in the same year', async () => {
    await expect(requestAwardIntervals('tied-coproducers.csv')).resolves.toEqual({
      min: [
        {
          producer: 'Anderson',
          interval: 0,
          previousWin: 2001,
          followingWin: 2001,
        },
        {
          producer: 'Gamma Producer',
          interval: 0,
          previousWin: 2001,
          followingWin: 2001,
        },
      ],
      max: [
        {
          producer: 'Beta Producer',
          interval: 20,
          previousWin: 1990,
          followingWin: 2010,
        },
        {
          producer: 'Shared Producer',
          interval: 20,
          previousWin: 1990,
          followingWin: 2010,
        },
      ],
    });
  });

  it('returns the same tied events in both arrays when min equals max', async () => {
    const expectedIntervals = [
      {
        producer: 'Alpha Producer',
        interval: 2,
        previousWin: 2000,
        followingWin: 2002,
      },
      {
        producer: 'Beta Producer',
        interval: 2,
        previousWin: 2010,
        followingWin: 2012,
      },
    ];

    await expect(requestAwardIntervals('equal-intervals.csv')).resolves.toEqual({
      min: expectedIntervals,
      max: expectedIntervals,
    });
  });

  it('accepts a BOM and returns empty arrays when there are no intervals', async () => {
    await expect(requestAwardIntervals('bom-no-interval.csv')).resolves.toEqual({
      min: [],
      max: [],
    });
  });

  it('returns the expected intervals for Movielist.csv', async () => {
    const csvPath = resolve(__dirname, '../data/Movielist.csv');
    const app = buildApp({ csvPath });

    try {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/producers/award-intervals',
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toEqual({
        min: [
          {
            producer: 'Joel Silver',
            interval: 1,
            previousWin: 1990,
            followingWin: 1991,
          },
        ],
        max: [
          {
            producer: 'Matthew Vaughn',
            interval: 13,
            previousWin: 2002,
            followingWin: 2015,
          },
        ],
      });
      expect(
        app.database
          .prepare(
            `
              SELECT
                (SELECT COUNT(*) FROM movies) AS movies,
                (SELECT COUNT(*) FROM producers) AS producers,
                (SELECT COUNT(*) FROM movie_producers) AS movieProducers
            `,
          )
          .get(),
      ).toEqual({
        movies: 206,
        producers: 359,
        movieProducers: 472,
      });
    } finally {
      await app.close();
    }
  });
});

describe('application bootstrap from CSV', () => {
  it('handles CSV bootstrap failures before listen', async () => {
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;
    const csvPath = resolve(fixturesPath, 'invalid-record.csv');
    const diagnostic = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await expect(start({ csvPath })).resolves.toBeUndefined();

      expect(process.exitCode).toBe(1);
      expect(diagnostic).toHaveBeenCalledWith(
        'Failed to start application',
        expect.objectContaining({
          message: expect.stringMatching(
            /invalid-record\.csv.*line 2.*field "year"/i,
          ),
        }),
      );
    } finally {
      process.exitCode = previousExitCode;
      diagnostic.mockRestore();
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
