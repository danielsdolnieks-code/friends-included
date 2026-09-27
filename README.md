# Friends Included first milestone

A Vercel application connecting a real Telegram bot, Supabase and Google Sheets. This starter implements pending sales only. Expenses, manager approvals, final commissions and the final dashboard are intentionally left for the next milestone. It is not yet the completed homework.

## 1. Supabase
Create a project named friends-included. Open SQL Editor, paste `supabase/schema.sql`, and run it once. Save your Project URL and server secret API key from the project's Connect dialog or Settings > API Keys. Put these in Vercel environment variables, never in public files. RLS blocks browser access; the server checks demonstration roles. The public role selector is intentionally for fictional course data, not production authentication.

## 2. Telegram
In Telegram open the official @BotFather, send `/newbot`, choose a display name and a unique username ending in `bot`. Store the token privately. Open your new bot and press Start; it will reply only after deployment and webhook registration below.

## 3. Google Sheets
Create a Google account if needed. In Google Cloud Console create a project, enable Google Sheets API, then create a service account (IAM & Admin > Service Accounts). Create a JSON key and keep the downloaded file private and outside this repository. No project-wide IAM role is needed just to write to a shared sheet.
Create a spreadsheet named Friends Included with tabs named exactly Sales and Expenses. Share the spreadsheet with the service account's client_email as Editor. Give the instructor Viewer access separately.
Paste these tab-separated headings in cell A1 of Sales:

```
Reference	Submission time	Salesperson	Customer	Project	Description	Amount	Proposed Richard %	Proposed Anastasia %	Proposed Jean-Claude %	Approved Richard %	Approved Anastasia %	Approved Jean-Claude %	Richard earned	Anastasia earned	Jean-Claude earned	Status
```

The spreadsheet ID is between `/d/` and `/edit` in its URL. Keep Sales rows in database order: do not physically sort, insert or delete them. Sync uses database ID + 1 for a stable destination so retries cannot append duplicates. Filter views are fine. Ensure enough sheet rows exist if you exceed the initial sheet capacity.

## 4. GitHub and Vercel
Create a GitHub repository named friends-included and push the contents of this folder. Import it into Vercel. Use framework preset Other, build command `npm run build`, output directory `public`, Node 24.
Add all names from `.env.example` under Vercel project Settings > Environment Variables:

- SUPABASE_URL: your project URL
- SUPABASE_SECRET_KEY: server secret key
- TELEGRAM_BOT_TOKEN: BotFather token
- TELEGRAM_WEBHOOK_SECRET: a random private value with letters, numbers, dashes or underscores
- GOOGLE_SERVICE_ACCOUNT_EMAIL: client_email from the JSON key
- GOOGLE_PRIVATE_KEY: private_key from the JSON key (actual newlines or literal backslash-n both work)
- GOOGLE_SHEET_ID: spreadsheet ID

Redeploy after adding environment variables. Allow public access to the production deployment so Telegram can reach it.

## 5. Register the webhook
Run this locally with TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET and APP_URL set in your private environment. APP_URL is the production HTTPS Vercel URL. Do not paste actual secrets into chat or commit them.

```js
const r = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
  method: 'POST', headers: {'Content-Type':'application/json'},
  body: JSON.stringify({url: `${process.env.APP_URL}/api/telegram`, secret_token: process.env.TELEGRAM_WEBHOOK_SECRET, allowed_updates:['message']})
});
console.log(await r.json());
```

## 6. First real transaction
1. Send `/start` to your bot. Its reply includes your Telegram user and chat IDs.
2. On the website select Svetlana under Demonstration role and link both IDs to Richard.
3. Send this to the bot:
   `/sale PRACTICE01 | Olivia Rose | A | Proud uncle | 1000 | 50,30,20`
4. Expect a recorded confirmation. On the website select Richard or Svetlana and refresh. Check the actual Sales tab for the same reference, Pending approval, empty approved shares and zero earned commissions.
5. Refresh again to verify persistence. A duplicate reference must fail without adding a row.
6. To test sync recovery, temporarily revoke the service account's sheet access, submit a new practice reference and check Sync failed. Restore access and select Retry Sheets as Svetlana. Confirm only one matching row exists.

If Telegram confirmation fails, the saved sale remains and its confirmation status reports Failed. A network timeout after Telegram accepts a message can produce a repeated notification on retry; no financial record is duplicated.

Before formal Test 1, clear practice records and their corresponding spreadsheet rows together. Do not delete only the database records and leave stale sheet copies. We will handle this when building the next milestone.

## Local verification
Run `npm test` and `npm run build`. These validate submission rules and syntax; live connections still require your accounts and an end-to-end test. Use `npx vercel dev` for a local server after securely setting the environment variables. No API key belongs in public/app.js or public/index.html.
