import type { FastifyInstance } from 'fastify';
import { getAwardIntervals } from './award-interval.repository';

export function registerAwardIntervalRoute(app: FastifyInstance): void {
  app.get('/api/v1/producers/award-intervals', () => {
    return getAwardIntervals(app.database);
  });
}
