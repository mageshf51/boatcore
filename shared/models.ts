export type Role = 'admin' | 'operator' | 'guest';
export type User = { id: string; name: string; role: Role };
export type Kind =
  | 'crew'
  | 'products'
  | 'trips'
  | 'sales'
  | 'expenses'
  | 'settlements'
  | 'messages'
  | 'advances'
  | 'wages'
  | 'crewPayments';
// Flexible JSON payloads are validated per kind at the API boundary; SQL indexes key relational fields.
export type Entity = {
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  [key: string]: any;
};
export type Audit = {
  id: string;
  actor: string;
  userId: string;
  action: string;
  kind: string;
  recordId: string;
  tripId?: string;
  before: Entity | null;
  after: Entity | null;
  at: string;
};
export type Snapshot = {
  users: (User & { pinHash: string; active: boolean })[];
  sessions: { tokenHash: string; userId: string; expiresAt: number }[];
  attempts: Record<string, { count: number; until: number }>;
  entities: Record<Kind, Entity[]>;
  audit: Audit[];
  settings: {
    commissionPercent: string;
    crewPercent: string;
    fieldVisibility: Record<Role, string[]>;
  };
};
export const kinds: Kind[] = [
  'crew',
  'products',
  'trips',
  'sales',
  'expenses',
  'settlements',
  'messages',
  'advances',
  'wages',
  'crewPayments',
];
export const emptySnapshot = (): Snapshot => ({
  users: [],
  sessions: [],
  attempts: {},
  entities: {
    crew: [],
    products: [],
    trips: [],
    sales: [],
    expenses: [],
    settlements: [],
    messages: [],
    advances: [],
    wages: [],
    crewPayments: [],
  },
  audit: [],
  settings: {
    commissionPercent: '2',
    crewPercent: '21',
    fieldVisibility: { admin: ['*'], guest: ['*'], operator: ['operations', 'finance'] },
  },
});
