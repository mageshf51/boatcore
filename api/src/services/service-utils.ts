import { randomUUID } from 'node:crypto';
import type { Snapshot, Entity, User } from '../../../shared/models.ts';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const requireWrite = (u: User) => {
  if (u.role === 'guest') throw new HttpError(403, 'Guest access is read only');
};
export const assert = (condition: unknown, message: string) => {
  if (!condition) throw new HttpError(400, message);
};
export function audit(
  s: Snapshot,
  user: User,
  action: string,
  kind: string,
  before: Entity | null,
  after: Entity | null,
  recordId?: string,
) {
  s.audit.push({
    id: randomUUID(),
    actor: user.name,
    userId: user.id,
    action,
    kind,
    recordId: recordId || after?.id || before?.id || '',
    tripId:
      after?.tripId || before?.tripId || (kind === 'trips' ? after?.id || before?.id : undefined),
    before: before ? structuredClone(before) : null,
    after: after ? structuredClone(after) : null,
    at: new Date().toISOString(),
  });
}
export function tripFor(s: Snapshot, id: string) {
  const trip = s.entities.trips.find((t) => t.id === id);
  if (!trip) throw new HttpError(404, 'Trip not found');
  return trip;
}
