FORCE FIX FOR IPHONE LOGIN UI

Replace in your frontend:
- index.html
- script.js

What changed:
- index.html now loads:
  api.js?v=iphonefixFINAL3
  script.js?v=iphonefixFINAL3

- script.js now logs stored auth and falls back to localStorage token if /auth/me fails.

After replacing:
1. Commit + push
2. Redeploy frontend
3. On iPhone Safari:
   - close the tab
   - reopen site
   - login again
   - if it still shows Entrar, clear Safari website data for physio-pipeline.vercel.app
