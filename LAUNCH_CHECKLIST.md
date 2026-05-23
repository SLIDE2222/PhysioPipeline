# PhysioPipeline Launch Checklist

## Added in this launch-prep pass

- Trust pages:
  - `about.html`
  - `contato.html`
  - `privacidade.html`
  - `termos.html`
- SEO pages:
  - `fisioterapeuta-em-sorocaba.html`
  - `fisioterapeuta-em-itapetininga.html`
  - `fisioterapeuta-em-sao-paulo.html`
  - `fisioterapia-dor-lombar.html`
  - `pilates-itapetininga.html`
  - `fisioterapia-pos-operatorio.html`
- Homepage sections explaining the platform, patient flow, profile claiming, and common search intents.
- Footer links for About, Contact, Privacy, and Terms.
- SEO meta descriptions and Open Graph placeholders on main pages.
- Contact form with honeypot anti-spam validation.
- Claim form honeypot anti-spam validation.
- Public trust labels for claimed and unclaimed profiles.
- Dynamic city, neighborhood, and specialty dropdown expansion from saved profile data through Supabase public profiles or `GET /profiles/options`.
- Frontend dropdowns now merge predefined options with database values, dedupe them, sort them, and keep defaults available.
- Public profile browsing now tries Supabase first through `api.js`, caches safe public profile cards in `sessionStorage`, and falls back to Render if Supabase blocks the request.
- Results page shows loading skeleton cards before profile data arrives.
- `about.html` and logged-in profile CTA buttons now send authenticated users to their profile instead of signup.
- `cadastro.html` redirects logged-in users with an existing profile away from duplicate signup.
- Added `supabase-public-read-policies.sql` with a safe public-profile view setup and notes for future direct Supabase ownership policies.

## Manual setup before public launch

- Buy and connect the domain.
- Set the production frontend URL in the backend environment as `CLIENT_URL`.
- Add the production backend URL to frontend config if it changes from the current Render URL.
- Test register, login, profile creation, profile edit, search, claim request, password reset, and contact form on the production domain.
- Review Privacy Policy and Terms with legal guidance before serious paid traffic.
- In Supabase, run or adapt `supabase-public-read-policies.sql` if direct public reads are blocked by RLS or grants.
- Do not move profile creation/editing fully to frontend Supabase until `Profile` has a Supabase Auth ownership mapping. Current `Profile.ownerUserId` points to the app `User.id`, not `auth.uid()`.

## Google Analytics

Paste the real GA4 script in the `<head>` of each HTML page where this comment appears:

```html
<!-- Google Analytics: cole aqui o script GA4 real quando tiver o ID de medição. -->
```

Do not use fake IDs. Use the real `G-XXXXXXXXXX` ID from Google Analytics.

## Google Search Console

Paste the Search Console verification meta tag in the `<head>` of each HTML page where this comment appears:

```html
<!-- Google Search Console: cole aqui a meta tag de verificação real quando tiver o domínio. -->
```

Example shape only:

```html
<meta name="google-site-verification" content="REAL_VERIFICATION_TOKEN" />
```

## Domain/DNS notes

- Point the frontend domain to the hosting provider used for the static site.
- Point the API/backend domain or Render service separately if using a subdomain like `api.yourdomain.com`.
- Update `CLIENT_URL` on the backend to the final frontend domain, for example `https://physiopipeline.com.br`.
- If the API domain changes, update `API_BASE` logic in `api.js` or set `window.PHYSIO_API_BASE`.
- If the Supabase project changes, update `window.PHYSIO_SUPABASE_URL` and `window.PHYSIO_SUPABASE_ANON_KEY` or the defaults in `api.js`.

## Required environment variables

Backend:

- `DATABASE_URL`
- `JWT_SECRET`
- `CLIENT_URL`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`
- `CONTACT_EMAIL` optional, defaults to `physiopipelinefisio@gmail.com`.
- `CLAIM_REVIEW_EMAIL`
- Contact form recipient defaults to `physiopipelinefisio@gmail.com`.
- `SMTP_TIMEOUT_MS`
- `SMTP_SECURE` optional. Use `true` for SMTP port `465`; the app now auto-detects this when the port is `465`.
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Optional/feature-specific:

- Google login client IDs/secrets if Google auth remains enabled.
- Any storage/Supabase variables used for profile photos, if configured in deployment.

## Final launch checks

- Run `npm install`.
- Run `npx prisma generate`.
- Run `npm start` or the Render start command.
- Open the homepage, search page, results page, profile page, contact page, privacy page, and terms page on mobile and desktop.
- Check that no page has horizontal scroll on mobile.
- Submit a contact form test with a real e-mail.
- Submit a claim form test with a PDF.
- Create or edit one profile with a new city/specialty, then confirm it appears in search/register/edit dropdown suggestions.
- Confirm the backend receives no spam submission when honeypot fields are filled.
- Submit sitemap/important pages in Google Search Console after the domain is live.
