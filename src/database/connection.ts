import Database from 'better-sqlite3';

export type DatabaseConnection = Database.Database;

export function createDatabaseConnection(): DatabaseConnection {
  const database = new Database(':memory:');
  database.pragma('foreign_keys = ON');

  return database;
}
