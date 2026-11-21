import { z } from 'zod';
const text = z.string().trim().min(1).max(200),
  note = z.string().max(2000).default('');
const amount = z
  .string()
  .regex(/^\d{1,10}(\.\d{1,2})?$/, 'Enter a nonnegative amount with up to 2 decimal places');
const date = z.iso.date();
const id = z.uuid();
const attachment = z.uuid().nullable().optional();
export const schemas = {
  crew: z.object({
    name: text,
    serial: z.number().int().positive(),
    active: z.boolean().default(true),
    isCaptain: z.boolean().default(false),
  }),
  products: z.object({ name: text, unit: text, active: z.boolean().default(true) }),
  trips: z.object({
    name: text,
    departure: date,
    crewIds: z.array(id).min(1).max(100),
    captainId: id.nullable().optional(),
    notes: note,
    returnDate: date.nullable().optional(),
  }),
  sales: z.object({
    tripId: id,
    type: z.enum(['cash', 'sale']),
    date,
    amount,
    initialPaid: amount.optional(),
    buyer: z.string().max(200).default(''),
    phone: z.string().max(30).default(''),
    notes: note,
    attachmentId: attachment,
  }),
  expenses: z.object({
    tripId: id,
    date,
    productId: id,
    supplier: z.string().trim().max(200).default(''),
    quantity: z.string().regex(/^\d{1,7}(\.\d{1,3})?$/),
    unitPrice: amount,
    initialPaid: amount.optional(),
    notes: note,
    attachmentId: attachment,
  }),
  settlements: z.object({
    tripId: id,
    deduction: amount,
    wages: amount,
    extraShareIds: z.array(id),
    deductedExpenseIds: z.array(id),
    cashOverride: amount.nullable(),
    salesOverride: amount.nullable(),
    overrideReason: z.string().max(2000).default(''),
  }),
  advances: z.never(),
  wages: z.never(),
  crewPayments: z.never(),
  messages: z.object({ text: z.string().trim().min(1).max(2000) }),
};
