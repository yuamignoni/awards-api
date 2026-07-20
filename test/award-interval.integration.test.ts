import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
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

describe('application lifecycle', () => {
  it('creates and closes an isolated database for each app instance', async () => {
    const csvPath = resolve(fixturesPath, 'simple.csv');
    const firstApp = buildApp({ csvPath });
    const secondApp = buildApp({ csvPath });

    try {
      expect(firstApp.database).not.toBe(secondApp.database);

      firstApp.database.exec('CREATE TABLE instance_marker (id INTEGER PRIMARY KEY)');

      const markerInSecondApp = secondApp.database
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'instance_marker'")
        .get();

      expect(markerInSecondApp).toBeUndefined();
    } finally {
      await Promise.all([firstApp.close(), secondApp.close()]);
    }

    expect(firstApp.database.open).toBe(false);
    expect(secondApp.database.open).toBe(false);
  });
});

describe('CSV parsing', () => {
  it('parses and converts a valid movie file', () => {
    const movies = parseMoviesCsv(resolve(fixturesPath, 'simple.csv'));

    expect(movies).toEqual([
      {
        year: 2000,
        title: 'Short Interval Start',
        studios: 'Studio A',
        producers: ['Alice Producer'],
        winner: true,
      },
      {
        year: 2001,
        title: 'Short Interval End',
        studios: 'Studio B',
        producers: ['Alice Producer'],
        winner: true,
      },
      {
        year: 1990,
        title: 'Long Interval Start',
        studios: 'Studio C',
        producers: ['Bob Producer'],
        winner: true,
      },
      {
        year: 2010,
        title: 'Long Interval End',
        studios: 'Studio D',
        producers: ['Bob Producer'],
        winner: true,
      },
      {
        year: 2025,
        title: 'Non-winning Movie',
        studios: 'Studio E',
        producers: ['Carol Producer', 'Dan Producer', 'Anderson'],
        winner: false,
      },
    ]);
  });

  it('rejects an unexpected header with file, line and field details', () => {
    const csvPath = resolve(fixturesPath, 'invalid-header.csv');

    expect(() => parseMoviesCsv(csvPath)).toThrow(
      /invalid-header\.csv.*line 1.*field "header"/i,
    );
  });

  it('prevents app startup for an invalid record with a useful diagnostic', () => {
    const csvPath = resolve(fixturesPath, 'invalid-record.csv');

    expect(() => buildApp({ csvPath })).toThrow(
      /invalid-record\.csv.*line 2.*field "year"/i,
    );
  });
});
