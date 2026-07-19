import Database from 'better-sqlite3';

export type DatabaseConnection = Database.Database;

export function createDatabaseConnection(): DatabaseConnection {
  return new Database(':memory:');
}
