import type { DatabaseConnection } from './connection';

export function createDatabaseSchema(database: DatabaseConnection): void {
  database.exec(`
    CREATE TABLE movies (
      id INTEGER PRIMARY KEY,
      year INTEGER NOT NULL,
      title TEXT NOT NULL,
      studios TEXT NOT NULL,
      winner INTEGER NOT NULL CHECK (winner IN (0, 1))
    );

    CREATE TABLE producers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE
    );

    CREATE TABLE movie_producers (
      movie_id INTEGER NOT NULL REFERENCES movies(id),
      producer_id INTEGER NOT NULL REFERENCES producers(id),
      PRIMARY KEY (movie_id, producer_id)
    );
  `);
}
