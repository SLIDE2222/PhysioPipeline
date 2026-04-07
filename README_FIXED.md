Physio Pipeline - Email delivery fix

What changed:
- Claim requests now MUST send the email to CLAIM_REVIEW_EMAIL / SMTP_USER.
- No browser-side fallback save message anymore.
- SMTP password spaces are stripped automatically, so Google app passwords copied with spaces still work.
- Shared mail config uses SMTP_HOST/SMTP_PORT/SMTP_USER/SMTP_PASS.

How to use:
1. Copy .env.example to .env
2. Put the real Gmail App Password in SMTP_PASS
3. Run: npm install
4. Run: npm run dev
5. Open the frontend and submit the claim form

Expected result:
- Success message says the claim was sent to the review email.
- If SMTP fails, the frontend now shows the backend mail error instead of pretending it succeeded.
