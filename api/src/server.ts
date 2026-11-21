import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createRepository, type Repository } from './repositories/state-repository.ts';
import { seed } from './services/seed-service.ts';
import { newToken, digest, verifyPin } from './security/pin-security.ts';
import {
  HttpError,
  requireWrite,
  upsert,
  addPayment,
  completeTrip,
  publicState,
  audit,
} from './services/business-service.ts';
import { kinds, type User, type Snapshot, type Entity } from '../../shared/models.ts';
import {
  addAdvance,
  saveWages,
  payCrew,
  receiveSalePayment,
} from './services/crew-payable-service.ts';
import { mode } from './config/environment.ts';
export function createApp(repo: Repository) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      const origin = req.get('origin');
      if (
        req.get('x-boatcore-client') !== 'web' ||
        (origin && origin !== (process.env.APP_ORIGIN || 'http://localhost:3000'))
      )
        return res.status(403).json({ error: 'Request origin rejected' });
    }
    next();
  });
  app.get('/api/health', async (_req, res) => {
    await repo.read();
    res.json({ ok: true, mode });
  });
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 8 * 60 * 60 * 1000,
  };
  async function current(s: Snapshot, token?: string): Promise<User> {
    const session = s.sessions.find(
      (x) => x.tokenHash === digest(token || '') && x.expiresAt > Date.now(),
    );
    const user = s.users.find((u) => u.id === session?.userId && u.active);
    if (!user) throw new HttpError(401, 'Please sign in');
    return { id: user.id, name: user.name, role: user.role };
  }
  app.post('/api/auth/login', async (req, res) => {
    if (process.env.PUBLIC_REVIEW_ONLY === 'true')
      throw new HttpError(403, 'This public portfolio is available through guest access only');
    const pin = z
      .string()
      .regex(/^\d{4}$/)
      .parse(req.body.pin);
    const token = newToken();
    const result = await repo.transaction((s) => {
      const key = digest(req.ip || 'unknown'),
        now = Date.now();
      let attempt = s.attempts[key];
      if (!attempt || attempt.until < now)
        attempt = s.attempts[key] = { count: 0, until: now + 15 * 60000 };
      if (attempt.count >= 8)
        return { error: 'Too many attempts. Try again in 15 minutes.', status: 429 };
      const found = s.users.find((u) => u.active && verifyPin(pin, u.pinHash));
      if (!found) {
        attempt.count++;
        return { error: 'Invalid PIN or account unavailable', status: 401 };
      }
      attempt.count = 0;
      s.sessions = s.sessions.filter((x) => x.expiresAt > now);
      s.sessions.push({
        tokenHash: digest(token),
        userId: found.id,
        expiresAt: now + cookieOptions.maxAge,
      });
      return { user: { id: found.id, name: found.name, role: found.role } };
    });
    if ('error' in result) return res.status(result.status!).json({ error: result.error });
    res.cookie('boatcore_session', token, cookieOptions).json(result);
  });
  app.post('/api/auth/guest', async (_req, res) => {
    if (process.env.PUBLIC_GUEST_ACCESS === 'false')
      throw new HttpError(403, 'Guest shortcut disabled');
    const token = newToken();
    const user = await repo.transaction((s) => {
      const guest = s.users.find((u) => u.active && u.role === 'guest');
      if (!guest) throw new HttpError(404, 'Guest not configured');
      s.sessions = s.sessions.filter((x) => x.expiresAt > Date.now());
      s.sessions.push({
        tokenHash: digest(token),
        userId: guest.id,
        expiresAt: Date.now() + cookieOptions.maxAge,
      });
      return { id: guest.id, name: guest.name, role: guest.role };
    });
    res.cookie('boatcore_session', token, cookieOptions).json({ user });
  });
  app.post('/api/auth/logout', async (req, res) => {
    await repo.transaction((s) => {
      s.sessions = s.sessions.filter(
        (x) => x.tokenHash !== digest(req.cookies.boatcore_session || ''),
      );
    });
    res.clearCookie('boatcore_session', { path: '/' }).json({ ok: true });
  });
  app.get('/api/state', async (req, res) => {
    const s = await repo.read();
    res.json(publicState(s, await current(s, req.cookies.boatcore_session)));
  });
  async function mutate(req: express.Request, action: (s: Snapshot, u: User) => unknown) {
    return repo.transaction(async (s) => {
      const u = await current(s, req.cookies.boatcore_session);
      requireWrite(u);
      const key = z.uuid().parse(req.get('idempotency-key'));
      const cache = ((s as any).requests ||= {}) as Record<
        string,
        { signature: string; value: any }
      >;
      const scoped = `${u.id}:${key}`,
        signature = digest(req.method + req.path + JSON.stringify(req.body));
      if (cache[scoped]) {
        if (cache[scoped].signature !== signature)
          throw new HttpError(409, 'Request key reused with different data');
        return cache[scoped].value;
      }
      const value = action(s, u);
      cache[scoped] = { signature, value };
      const keys = Object.keys(cache);
      if (keys.length > 2000) delete cache[keys[0]];
      return value;
    });
  }
  app.post('/api/records/:kind', async (req, res) => {
    const kind = z.enum(kinds).parse(req.params.kind);
    res.status(201).json(await mutate(req, (s, u) => upsert(s, u, kind, req.body)));
  });
  app.put('/api/records/:kind/:id', async (req, res) => {
    const kind = z.enum(kinds).parse(req.params.kind);
    res.json(await mutate(req, (s, u) => upsert(s, u, kind, req.body, String(req.params.id))));
  });
  app.post('/api/expenses/:id/payments', async (req, res) =>
    res.json(await mutate(req, (s, u) => addPayment(s, u, String(req.params.id), req.body))),
  );
  app.post('/api/crew/advances', async (req, res) =>
    res.status(201).json(await mutate(req, (s, u) => addAdvance(s, u, req.body))),
  );
  app.post('/api/crew/wages', async (req, res) =>
    res.status(201).json(await mutate(req, (s, u) => saveWages(s, u, req.body))),
  );
  app.put('/api/crew/wages/:id', async (req, res) =>
    res.json(await mutate(req, (s, u) => saveWages(s, u, req.body, String(req.params.id)))),
  );
  app.post('/api/crew/pay', async (req, res) =>
    res.json(await mutate(req, (s, u) => payCrew(s, u, req.body))),
  );
  app.post('/api/sales/:id/payments', async (req, res) =>
    res.json(
      await mutate(req, (s, u) => receiveSalePayment(s, u, String(req.params.id), req.body)),
    ),
  );
  app.post('/api/trips/:id/complete', async (req, res) =>
    res.json(
      await mutate(req, (s, u) =>
        completeTrip(s, u, String(req.params.id), z.number().int().parse(req.body.version)),
      ),
    ),
  );
  app.put('/api/settings', async (req, res) =>
    res.json(
      await mutate(req, (s, u) => {
        if (u.role !== 'admin') throw new HttpError(403, 'Admin access required');
        const settings = z
          .object({
            commissionPercent: z.string().regex(/^\d{1,2}(\.\d{1,2})?$/),
            crewPercent: z.string().regex(/^\d{1,2}(\.\d{1,2})?$/),
            fieldVisibility: z.object({
              admin: z.array(z.string()),
              operator: z.array(z.string()),
              guest: z.array(z.string()),
            }),
          })
          .parse(req.body);
        if (
          s.entities.trips.some((t) => t.completed) &&
          (settings.commissionPercent !== s.settings.commissionPercent ||
            settings.crewPercent !== s.settings.crewPercent)
        )
          throw new HttpError(
            400,
            'Rates are locked after a completed trip to preserve archived totals',
          );
        const before = { ...s.settings, id: 'settings', version: 1, createdAt: '', updatedAt: '' };
        s.settings = settings;
        audit(s, u, 'update', 'settings', before, {
          ...settings,
          id: 'settings',
          version: 1,
          createdAt: '',
          updatedAt: '',
        });
        return settings;
      }),
    ),
  );
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });
  app.post(
    '/api/uploads',
    async (req, res, next) => {
      try {
        requireWrite(await current(await repo.read(), req.cookies.boatcore_session));
        next();
      } catch (e) {
        next(e);
      }
    },
    upload.single('file'),
    async (req, res) => {
      const file = req.file;
      if (!file) throw new HttpError(400, 'Choose an image');
      const b = file.buffer;
      const png = b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
        jpg = b[0] === 255 && b[1] === 216 && b[2] === 255,
        webp = b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP';
      if (!png && !jpg && !webp) throw new HttpError(400, 'Use a PNG, JPEG or WebP image');
      const id = randomUUID(),
        type = png ? 'image/png' : jpg ? 'image/jpeg' : 'image/webp';
      await mkdir('uploads', { recursive: true });
      await writeFile(`uploads/${id}`, b, { flag: 'wx' });
      await repo.transaction(async (s) => {
        const u = await current(s, req.cookies.boatcore_session);
        requireWrite(u);
        ((s as any).attachments ||= []).push({ id, userId: u.id, type });
        audit(s, u, 'upload', 'attachments', null, {
          id,
          version: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          type,
        });
      });
      res.status(201).json({ id, url: `/api/uploads/${id}` });
    },
  );
  app.get('/api/uploads/:id', async (req, res) => {
    const s = await repo.read();
    await current(s, req.cookies.boatcore_session);
    const id = z.uuid().parse(req.params.id);
    const file = (s as any).attachments?.find((x: any) => x.id === id);
    if (!file) throw new HttpError(404, 'Image not found');
    res
      .set('Content-Type', file.type)
      .set('Content-Disposition', 'inline')
      .send(await readFile(`uploads/${id}`));
  });
  app.use(
    (error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      if (error instanceof z.ZodError)
        return res
          .status(400)
          .json({ error: error.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ') });
      if (error instanceof HttpError)
        return res.status(error.status).json({ error: error.message });
      if (error instanceof multer.MulterError)
        return res.status(400).json({ error: 'Image exceeds the 5 MB limit' });
      console.error(error);
      res
        .status(500)
        .json({ error: 'Service unavailable. Check the API logs and database connection.' });
    },
  );
  return app;
}
if (!process.env.BOATCORE_TEST) {
  const repo = await createRepository();
  if (mode === 'demo') await repo.transaction((s) => seed(s, true, true));
  const server = createApp(repo).listen(Number(process.env.PORT || 4000), '0.0.0.0', () =>
    console.log(`BoatCore API on :${process.env.PORT || 4000} (${mode})`),
  );
  process.on('SIGTERM', () => server.close(() => void repo.close()));
}
