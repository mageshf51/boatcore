import type { Entity } from './models.ts';
export function captainIdFor(crew: Entity[], requested?: string | null): string | null {
  const eligible = crew.filter((c) => c.isCaptain).sort((a, b) => a.serial - b.serial);
  if (requested) return eligible.some((c) => c.id === requested) ? requested : null;
  return eligible[0]?.id || null;
}
