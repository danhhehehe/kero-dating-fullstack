# Kero Dating Fullstack

Full-stack dating web demo using React/Vite, Node.js/Express, and MongoDB/Mongoose.

## Features

- Cookie-based authentication with httpOnly JWT.
- Profile onboarding with photos, interests, city, bio, and dating goals.
- Discover, like/pass, undo, matches, chat, report, block, and unmatch.
- Admin dashboard protected by role-based middleware.
- Password reset flow with hashed, expiring reset tokens.
- Public profile APIs avoid exposing private account data.

## Setup

Requirements:

- Node.js 20+
- Local MongoDB or a MongoDB connection string

Backend:

```bash
cd backend
npm install
copy .env.example .env
npm run seed
npm run dev
```

On macOS/Linux, use `cp .env.example .env`.

Frontend:

```bash
cd frontend
npm install
npm run dev
```

## Environment

The project does not publish login credentials in documentation or public UI.

For local development:

- Copy `backend/.env.example` to `backend/.env`.
- Put local-only admin and demo seed values in `backend/.env`.
- Do not commit `.env`.
- Do not publish seeded credentials in screenshots, docs, issues, commits, or frontend text.
- Do not use local demo credentials in production.

## Local Demo Images

`Dating.zip` is a local-only demo asset bundle. To prepare profile photos:

```bash
cd backend
npm run prepare:dating-images
```

The prepare script reads the extracted `Dating/` folder, copies image files into
`frontend/public/dating-demo/`, renames them as `qXX_YY.jpg`, and writes a local
mapping file with profile names and photo paths only.

If the script reports that the archive still needs to be extracted, run this from
the project root in PowerShell:

```powershell
Expand-Archive -LiteralPath .\Dating.zip -DestinationPath .\Dating -Force
```

## Seed Data

`npm run seed` resets local demo data. Do not run it against real data.

The seed script:

- Refuses to run in production unless an explicit confirmation env flag is set.
- Reads admin seed configuration from environment variables.
- Creates local demo users from generated photo mapping and environment config.
- Hashes all credentials with bcrypt before storing them.
- Does not print seeded credentials to the console.

## Security Notes

- Do not commit `.env`.
- Do not publish admin or demo credentials.
- Credential hashes use bcrypt.
- JWT is stored in httpOnly cookies.
- Reset tokens are hashed and expire.
- Admin routes are protected by role-based middleware.
- Public profiles do not expose email, raw birthday, exact location, or credentials.
- Demo credentials are local-only and must not be used in production.

If a secret was ever exposed:

1. Revoke the exposed secret immediately.
2. Create a replacement secret.
3. Remove the secret from current files.
4. Clean git history with an appropriate tool if the value was committed.
5. Rotate JWT, SMTP, database, and other affected credentials.
6. Invalidate active sessions if needed.

## Checks

Backend:

```bash
cd backend
node --check src/server.js
node --check src/seed.js
npm run seed
```

Frontend:

```bash
cd frontend
npm run build
```
