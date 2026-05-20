# Lead Tracking MVP

This update adds lightweight lead tracking so PhysioPipeline can prove profile value to physiotherapists.

## What is tracked

- PROFILE_VIEW when a patient opens a public profile
- WHATSAPP_CLICK when a patient clicks the WhatsApp button
- INSTAGRAM_CLICK when a patient clicks Instagram
- LINKEDIN_CLICK when a patient clicks LinkedIn

## New API

- POST /lead-events records a public lead event
- GET /lead-events/me/summary returns the logged-in professional's last-30-days lead summary

## Database

Run Prisma migration/generate before deploying:

    npx prisma migrate deploy
    npx prisma generate

For local development, use:

    npx prisma migrate dev

This is intentionally small: it creates proof of profile views and contact intent before adding paid plans.
