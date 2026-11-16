# FrontDesk AI for a Dental Clinic

A patient chat page and a staff ticket page. The bot answers only from the clinic data.
If it is not sure, it opens a ticket for staff. It works with no AI key at all.

## Pages

| Address | What it is |
|---|---|
| `/` | Patient chat. `/?q=your question` asks that question when the page opens. |
| `/staff` | All tickets with status, age and priority. Reply to a patient, close a ticket, edit clinic data. |
| `/api/health` | Shows if the AI key and the store are switched on. Never shows a key. |

## How an answer is made

1. Safety checks run first, in code: emergency, "ignore your rules" or discount, booking request, pain or symptoms.
2. The matcher looks for the answer in the clinic data and copies numbers word for word.
3. If nothing matches, the bot says it is not sure and opens a `needs human` ticket.
4. Only when an AI key works, the AI rewords a fact answer. A guard throws the rewording away if any number or name changed.

With no key, or when the AI fails, replies carry the label "Answered from the clinic file".

## Run on your laptop

```
npm test
npm run dev
```

Then open http://localhost:3000. No install step is needed: the app has no packages.
Without Supabase settings, tickets are kept in memory only.

## Put it live

1. Supabase: open the SQL editor and run `supabase/schema.sql`.
2. Vercel: import this GitHub repository. Framework preset: Other. No build command.
3. Vercel > Settings > Environment Variables: add the names from `.env.example`.
4. Redeploy, then open `/api/health` on the live link. `store_working` must be `true`.

To test the no-key run, remove `GEMINI_API_KEY` and `DEEPSEEK_API_KEY` in Vercel and redeploy.

## Files

| Path | What it holds |
|---|---|
| `lib/engine.js` | The matcher and the safety rules |
| `lib/lang.js` | Hindi and Telugu detection and prepared sentences |
| `lib/ai.js` | Optional rewording by Gemini, then DeepSeek, with the guard |
| `lib/store.js` | Tickets, messages and clinic data in Supabase |
| `api/` | Server functions |
| `public/` | The two pages, one stylesheet |
| `data/clinic-data.json` | Starting clinic data, and the fallback if the store is down |
| `test/` | The 8 sample checks, extra checks, and a second made-up clinic |
