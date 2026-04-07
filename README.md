# Physio Pipeline backend starter

A Node.js + Express + PostgreSQL + Prisma starter for your physio marketplace.

## What this gives you

- User registration and login
- Password hashing with bcrypt
- JWT auth plus httpOnly cookie
- Public profiles in Postgres
- Claimed vs unclaimed profiles
- Claim request by email
- Email verification link for claims

## 1. Install

```bash
npm install
```

## 2. Add environment variables

Copy `.env.example` to `.env` and fill the values.

## 3. Start Postgres

Use local Postgres or Supabase Postgres.

## 4. Run Prisma

```bash
npx prisma generate
npx prisma migrate dev --name init
node prisma/seed.js
```

## 5. Start the API

```bash
npm run dev
```

Server runs on `http://localhost:3000`

## Endpoints

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

### Profiles
- `GET /profiles`
- `GET /profiles/:id`
- `POST /profiles`
- `PUT /profiles/me`

### Claims
- `POST /claims/request`
- `GET /claims/verify?token=...`

## Example register body

```json
{
  "email": "jeff@example.com",
  "password": "123456"
}
```

## Example create profile body

```json
{
  "name": "Jeff Walker",
  "specialty": "Fisioterapia Ortopédica",
  "city": "Itapetininga",
  "neighborhood": "Centro",
  "phone": "15999999999",
  "bio": "Atendimento focado em reabilitação funcional.",
  "publicEmail": "jeff@example.com",
  "attendance": "Clínica e domiciliar"
}
```

## Frontend hookup plan

1. Replace localStorage registration with `POST /auth/register`
2. After auth, call `POST /profiles` for brand new profiles
3. Replace localStorage login with `POST /auth/login`
4. Replace profile search with `GET /profiles?city=...&specialty=...`
5. Replace claim localStorage flow with `POST /claims/request`

## Good next steps

- Add refresh tokens or stronger session auth
- Add admin review for disputed claims
- Add password reset flow
- Add rate limiting
- Add image upload storage

Because apparently software cannot simply exist. It must also authenticate people.
