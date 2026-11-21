# Publish the employer guest review link

No public deployment or domain is included in the ZIP. A host with Node.js and persistent disk is required for the API; SQL Server must be reachable from it. A static-only hosting service cannot run this SQL Server API. Use a VM/server or suitable managed Node hosting for both services, and SQL Server on a private network.

## Public portfolio workspace

Create a separate database with `SEED_SAMPLE_DATA=true` and fictional records. Set:

```dotenv
DATA_MODE=sqlserver
APP_ORIGIN=https://YOUR_DOMAIN
COOKIE_SECURE=true
PUBLIC_GUEST_ACCESS=true
PUBLIC_REVIEW_ONLY=true
```

`PUBLIC_REVIEW_ONLY=true` rejects all PIN login requests. The review button creates a read-only guest session. This lets an employer inspect all screens without exposing write credentials. Keep your real operational deployment and data separate.

For a lower-cost demo, `DATA_MODE=demo` uses the fictional SQLite workspace instead; persist both `api/data` and `api/uploads`. Do not imply this demo is backed by SQL Server.

## Build and run

From project root:

```sh
npm ci
npm run typecheck
npm test
npm run build
```

Start two supervised processes (PM2, systemd, Windows service or your host's process manager):

```sh
npm run start -w api
npm run start -w app
```

`api/.env` is read by the API start command. `API_INTERNAL_URL` is read during the app build and defaults to `http://127.0.0.1:4000`. If hosted separately, set it before `npm run build`. The frontend proxies `/api/*`; browser requests and cookies stay on one public origin. Keep port 4000 private. Forward public HTTPS traffic to port 3000 through a reverse proxy, with persistent API storage and a valid TLS certificate.

Example reverse-proxy location inside an HTTPS Nginx server block:

```nginx
client_max_body_size 6m;
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Configure HTTPS certificate and domain through your host; do not use the placeholder as a real URL. Next's proxy forwards API requests to the backend. The current limiter sees the proxy source by default, so many invalid public attempts can temporarily block PIN sign-ins together; public guest-only access does not use PIN login.

After deployment verify `/api/health`, Review as Guest, all detail tabs, chart interaction, guest mutation denial and image views. Add your actual HTTPS URL to the resume only after these checks.

## Mobile development check

Connect phone and computer to the same network. Set `APP_ORIGIN=http://YOUR_PC_LAN_IP:3000`, restart the API and open that address on the phone. Permit access only on a trusted private network. Test at 390px, 360px, tablet and desktop widths; keyboard input, filters, drawer, confirmation dialogs and long tables. Camera capture may require a real HTTPS deployment. Run browser tests with both app and API running in demo mode.

## Backups

Back up the SQL Server database and `api/uploads`. In demo mode also retain `api/data/boatcore-demo.sqlite` (use SQLite's backup facilities or stop the API before copying). Do not store `.env` in source control. Keep the supplied setup credentials off the running host after provisioning if they are no longer needed.
