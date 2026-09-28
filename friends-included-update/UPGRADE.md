# Enable approvals and expenses

This update adds manager decisions, expense submissions in Telegram and on the website, automatic commissions, financial results, decision notifications and readable sync errors. Existing practice sales and Telegram links are preserved.

1. In Supabase SQL Editor run `supabase/002-approvals-expenses.sql` once. Do not rerun `schema.sql`. The migration is transactional: an error rolls back all its changes.
2. Upload the updated project files to the existing GitHub repository, keeping `api`, `lib`, `public`, `supabase` and `test` as folders at the repository root. Include the new `public/style.css`. Do not upload a ZIP as the application source; extract it first. Existing Vercel environment variables remain in place.
3. Wait for Vercel's new Production deployment to become Ready.
4. Select Svetlana and approve PRACTICE01. Verify €100 commission, split €50 / €30 / €20, project A result €900, and the decision message in the original Telegram chat. Check that Sheets updates the existing row.
5. Relink your Telegram ID to Kevin, then send `/expense PRACTICE02 | Practice taxi | Travel | 10 | A`. Company result should become €890 while project A remains €900 until allocation. Approve its allocation to A; both results should then be €890. Verify the Telegram allocation message and Expenses row.

Run these practice checks only if PRACTICE01 is the sole starting sale and there are no other transactions; otherwise the dashboard correctly includes the additional records.

Before Test 1, clear practice data in Supabase and its corresponding Sheets rows together, including entries in transaction_references. Do not clear the employee links. Ask for help with the cleanup before running it; this update does not automatically reset or delete records.

## Business rules

All website actions are checked on the server according to the selected demonstration role. This intentionally public fictional-role switch is not production authentication. Telegram roles are determined exclusively from the manager-created user-ID link.

Original proposals are preserved. Final splits and allocations are editable only while pending, at the moment of approval. Repeat approval requests do not change the decision or totals. References are unique across sales and expenses. Commissions are calculated from approved sales and never inserted as separate expenses.

For a website transaction with no recipient at submission, linking the employee before approval (or retrying the decision after linking) supplies a recipient. Bot transactions always retain their original chat.

## Delivery behavior

Financial saves are independent of delivery. Sheets failures retain the record, show a readable error and offer retry. Headers are written automatically. Database IDs map to stable sheet rows; do not physically sort, delete or insert rows in these tabs. Filter views are safe. Keep enough rows for the record IDs.

Telegram failures remain retryable and are not reported as sent. A transport timeout after Telegram accepts a message can cause a repeated notification on retry; there is no financial duplication.

## Verification

`npm test` covers both cumulative homework results, pending expenses, commission rounding and tie ordering, role restrictions, validation, repeat-approval no-op behavior, original/final Sheets columns, and changed-decision message contents. A local preview using isolated fictional fixtures was checked for manager and employee views. Real database migration, Google sync, Telegram delivery and the full homework workflow must still be verified on the deployed update.
