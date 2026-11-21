import { calculateSettlement } from './settlement-calculator.ts';
import { kinds, type Snapshot } from './models.ts';
// Additive upgrade: old records are preserved. Old sales without receipt history are
// treated as fully received, so an upgrade never invents historical buyer debt.
export function normalizeSnapshot(state: Snapshot): Snapshot {
  for (const kind of kinds) state.entities[kind] ||= [];
  for (const crew of state.entities.crew)
    if (crew.isCaptain === undefined) crew.isCaptain = /\bcaptain\b/i.test(crew.name);
  for (const trip of state.entities.trips) {
    if (trip.captainId === undefined)
      trip.captainId =
        state.entities.crew
          .filter((c) => c.isCaptain && trip.crewIds.includes(c.id))
          .sort((a, b) => a.serial - b.serial)[0]?.id || null;
  }
  for (const trip of state.entities.trips)
    if (trip.completed && !trip.archiveSummary) {
      const crew = state.entities.crew.filter((c) => trip.crewIds.includes(c.id));
      trip.archiveCrew = structuredClone(crew);
      trip.archiveSummary = calculateSettlement(
        trip.id,
        state.entities.sales,
        state.entities.expenses,
        crew,
        {
          ...state.entities.settlements.find((v) => v.tripId === trip.id),
          captainId: trip.captainId,
        },
        state.settings,
      );
    }
  return state;
}
