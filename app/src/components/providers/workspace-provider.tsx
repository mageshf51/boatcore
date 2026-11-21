'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../../lib/api-client';
import type { CrewSalary } from '../../../../shared/crew-ledger';
import type { Entity, Kind, User, Audit, Snapshot } from '../../../../shared/models';
export type Workspace = {
  user: User;
  entities: Record<Kind, Entity[]>;
  settings: Snapshot['settings'];
  summaries: any[];
  audit: Audit[];
  team: User[];
  crewLedger: {
    pending: CrewSalary[];
    crew: {
      crewId: string;
      name: string;
      advance: string;
      pendingSalary: string;
      pendingCount: number;
    }[];
    payments: Entity[];
  };
  ownerTotals: { landWages: string; profit: string };
  mode: string;
};
const Context = createContext<{
  data: Workspace | null;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
}>({ data: null, loading: true, error: '', refresh: async () => {} });
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Workspace | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  const refresh = useCallback(async () => {
    try {
      setData(await api('/state'));
      setError('');
    } catch (e: any) {
      if (e.status === 401) {
        setData(null);
        setError('');
      } else setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    return () => clearInterval(timer);
  }, [refresh]);
  return <Context.Provider value={{ data, loading, error, refresh }}>{children}</Context.Provider>;
}
export const useWorkspace = () => useContext(Context);
