<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/02ab2c86-090c-48cf-85ae-54c9a75c4e1f

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. The Gemini API key is now hardcoded in `server.ts` so no secret setup is required for AI chat.
3. Configure SMTP settings in [.env.local](.env.local) if you want email reminders:
   - `SMTP_HOST`
   - `SMTP_PORT`
   - `SMTP_USER`
   - `SMTP_PASS`
   - `EMAIL_FROM`
4. Run the app:
   `npm run dev`
