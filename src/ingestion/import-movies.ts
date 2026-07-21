import type { DatabaseConnection } from '../database/connection';
import type { ParsedMovie } from './parse-movies-csv';

interface ProducerRow {
  id: number;
}

export interface ImportSummary {
  movies: number;
  producers: number;
  movieProducers: number;
}

export function importMovies(
  database: DatabaseConnection,
  movies: ParsedMovie[],
): ImportSummary {
  const insertMovie = database.prepare(`
    INSERT INTO movies (year, title, studios, winner)
    VALUES (@year, @title, @studios, @winner)
  `);
  const insertProducer = database.prepare(`
    INSERT INTO producers (name)
    VALUES (?)
    ON CONFLICT (name) DO NOTHING
  `);
  const findProducer = database.prepare('SELECT id FROM producers WHERE name = ?');
  const insertMovieProducer = database.prepare(`
    INSERT INTO movie_producers (movie_id, producer_id)
    VALUES (?, ?)
  `);

  const importAll = database.transaction((): ImportSummary => {
    const summary: ImportSummary = {
      movies: 0,
      producers: 0,
      movieProducers: 0,
    };

    for (const movie of movies) {
      const movieResult = insertMovie.run({
        year: movie.year,
        title: movie.title,
        studios: movie.studios,
        winner: Number(movie.winner),
      });
      summary.movies += 1;

      for (const producer of movie.producers) {
        const producerResult = insertProducer.run(producer);
        const producerRow = findProducer.get(producer) as ProducerRow | undefined;

        if (producerRow === undefined) {
          throw new Error(`Unable to load producer "${producer}"`);
        }

        insertMovieProducer.run(movieResult.lastInsertRowid, producerRow.id);
        summary.producers += producerResult.changes;
        summary.movieProducers += 1;
      }
    }

    return summary;
  });

  return importAll();
}
