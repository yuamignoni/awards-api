import type { DatabaseConnection } from '../database/connection';
import type { ParsedMovie } from './parse-movies-csv';

interface ProducerRow {
  id: number;
}

export function importMovies(
  database: DatabaseConnection,
  movies: ParsedMovie[],
): void {
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

  const importAll = database.transaction(() => {
    for (const movie of movies) {
      const movieResult = insertMovie.run({
        year: movie.year,
        title: movie.title,
        studios: movie.studios,
        winner: Number(movie.winner),
      });

      for (const producer of movie.producers) {
        insertProducer.run(producer);
        const producerRow = findProducer.get(producer) as ProducerRow | undefined;

        if (producerRow === undefined) {
          throw new Error(`Unable to load producer "${producer}"`);
        }

        insertMovieProducer.run(movieResult.lastInsertRowid, producerRow.id);
      }
    }
  });

  importAll();
}
