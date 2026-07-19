import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';

describe('GET /api/v1/producers/award-intervals', () => {
  it('returns the minimum and maximum intervals between consecutive wins', async () => {
    const csvPath = resolve(__dirname, 'fixtures/simple.csv');
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
    const csvPath = resolve(__dirname, 'fixtures/simple.csv');
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
