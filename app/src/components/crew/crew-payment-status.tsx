'use client';
import { useWorkspace } from '../providers/workspace-provider';
import { useT } from '../../lib/translations';
export function CrewPaymentStatus({ tripId, crewId }: { tripId: string; crewId: string }) {
  const { data } = useWorkspace(),
    t = useT();
  const paid = data?.crewLedger.payments.find(
    (p) => p.sourceType === 'trip' && p.sourceId === tripId && p.crewId === crewId,
  );
  return (
    <span
      className={`badge ${paid ? 'paid' : 'pending'}`}
      title={paid ? `${paid.date} · ${paid.actor}` : undefined}
    >
      {t(paid ? 'Paid' : 'Pending')}
    </span>
  );
}
