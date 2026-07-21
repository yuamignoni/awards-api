import type { DatabaseConnection } from '../database/connection';
import type {
  AwardInterval,
  AwardIntervals,
} from './award-interval.types';

interface AwardIntervalRow extends AwardInterval {
  boundary: 'min' | 'max';
}

export function getAwardIntervals(
  database: DatabaseConnection,
): AwardIntervals {
  const rows = database
    .prepare(
      `
        WITH ordered_wins AS (
          SELECT
            producers.name AS producer,
            movies.id AS following_movie_id,
            movies.year AS following_win,
            LAG(movies.id) OVER producer_wins AS previous_movie_id,
            LAG(movies.year) OVER producer_wins AS previous_win
          FROM movies
          INNER JOIN movie_producers
            ON movie_producers.movie_id = movies.id
          INNER JOIN producers
            ON producers.id = movie_producers.producer_id
          WHERE movies.winner = 1
          WINDOW producer_wins AS (
            PARTITION BY producers.id
            ORDER BY movies.year, movies.id
          )
        ),
        intervals AS (
          SELECT
            producer,
            following_movie_id,
            previous_movie_id,
            following_win - previous_win AS interval,
            previous_win,
            following_win
          FROM ordered_wins
          WHERE previous_win IS NOT NULL
        ),
        limits AS (
          SELECT
            MIN(interval) AS minimum_interval,
            MAX(interval) AS maximum_interval
          FROM intervals
        )
        SELECT
          'min' AS boundary,
          producer,
          interval,
          previous_win AS previousWin,
          following_win AS followingWin,
          previous_movie_id,
          following_movie_id
        FROM intervals
        CROSS JOIN limits
        WHERE interval = minimum_interval

        UNION ALL

        SELECT
          'max' AS boundary,
          producer,
          interval,
          previous_win AS previousWin,
          following_win AS followingWin,
          previous_movie_id,
          following_movie_id
        FROM intervals
        CROSS JOIN limits
        WHERE interval = maximum_interval

        ORDER BY
          boundary,
          producer,
          previousWin,
          followingWin,
          previous_movie_id,
          following_movie_id
      `,
    )
    .all() as AwardIntervalRow[];

  const result: AwardIntervals = {
    min: [],
    max: [],
  };

  for (const { boundary, producer, interval, previousWin, followingWin } of rows) {
    result[boundary].push({
      producer,
      interval,
      previousWin,
      followingWin,
    });
  }

  return result;
}
