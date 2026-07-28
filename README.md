# SBE Opportunity Intelligence Platform

Tracks, scores, and manages funding opportunities (grants, fellowships, prizes, challenge
funds) for **SBE Aquafarm** and **SBE FBT**. Static frontend + Netlify serverless functions,
AI features via **OpenRouter**, email digests via **Resend**, data stored in **Netlify Blobs**
(no separate database to set up).

## What it does

- **Tracker dashboard** — every opportunity as a card: funder, amount, deadline countdown,
  status, AI fit score (contour-ring badge), venture tag.
- **AI fit scoring** (`score-opportunity`) — scores 0-100 against both venture profiles on a
  95 / 80 / 65 banding, weighting hard on eligibility for **individuals / unregistered
  ventures**, since neither SBE Aquafarm nor SBE FBT is currently a registered organization.
- **Proposal-writing advice** (`proposal-advice`) — tailored angles, proof points, and risks
  to address, grounded in the real profile data in `data/sbe-profile.json`. When the funder is
  a US federal agency, it adds factual, non-partisan phrasing-adaptation notes (see
  *Terminology adaptation* below).
- **Live opportunity discovery** (`find-opportunities`) — searches the web via an
  OpenRouter `:online` model for currently-open opportunities matching the venture profiles,
  and appends genuinely new ones to the tracker. Falls back to a curated offline list if the
  live search or API key isn't available.
- **Manual tracker CRUD** (`custom-opportunities`) — add, edit, archive, or delete any
  opportunity by hand.
- **Daily deadline digest** — a Netlify **scheduled function** runs every day at
  **06:00 UTC (09:00 Kampala time)**, checks every non-archived opportunity for deadlines
  within 21 days, and emails a digest via Resend. No action needed once env vars are set.
- **"Send test digest now"** button in the app — triggers the same digest on demand,
  protected by a shared secret (`DIGEST_SECRET`) so it can't be spammed by strangers.

## Project layout

```
netlify.toml               Netlify build/functions config
package.json                Dependencies (@netlify/blobs)
data/sbe-profile.json       Venture profiles used by every AI call
data/opportunities-seed.json  Starter opportunities (seeded into Blobs on first run)
netlify/functions/          Serverless functions (the backend)
netlify/lib/                Shared helpers (storage, OpenRouter client, digest, terminology)
public/                     Static frontend (index.html, styles.css, app.js)
```

## Deploying it (one-time setup)

1. **Push this folder to a GitHub repo.**
   ```
   cd opportunity-intel
   git init && git add -A && git commit -m "Initial commit"
   gh repo create sbe-opportunity-intel --private --source=. --push
   ```
   (Or create the repo on GitHub's website and `git push` normally.)

2. **Connect it to Netlify.** In the Netlify dashboard: *Add new site → Import an existing
   project* → pick the repo. Build settings are already defined in `netlify.toml`
   (publish dir `public`, functions dir `netlify/functions`) — you shouldn't need to change
   anything.

3. **Set environment variables** in Netlify: *Site configuration → Environment variables*.
   Copy the keys from `.env.example`:
   - `OPENROUTER_API_KEY` — from [openrouter.ai/keys](https://openrouter.ai/keys)
   - `RESEND_API_KEY` — from [resend.com/api-keys](https://resend.com/api-keys)
   - `ALERT_EMAIL` — the inbox that should receive deadline digests
   - `DIGEST_SECRET` — any long random string you invent (protects the test-digest button)
   - Optionally override `OPENROUTER_MODEL_SCORING`, `OPENROUTER_MODEL_ADVICE`,
     `OPENROUTER_MODEL_ONLINE`, `DIGEST_FROM_EMAIL` — see `.env.example` for defaults.

4. **Deploy.** Netlify will build and deploy automatically. **Netlify Blobs requires no setup**
   — it's available automatically to functions on a deployed Netlify site.

5. **Verify the scheduled function is registered.** After the first deploy, check
   *Site → Functions → scheduled-digest* in the Netlify dashboard — it should show a
   "Scheduled" badge with the `0 6 * * *` cron. You can also trigger it manually from there
   for a first test, or just use the in-app "Send test digest now" button.

### Local development

```
npm install
npx netlify dev
```
This serves the frontend and functions together on `localhost:8888` with the same routing
as production. Create a `.env` file (copy `.env.example`) in the project root for local
env vars — `netlify dev` loads it automatically. Netlify Blobs also works locally under
`netlify dev` (it uses a local emulated store).

## How the AI features are wired to OpenRouter

All three AI functions call OpenRouter's standard `/v1/chat/completions` endpoint
(see `netlify/lib/openrouter.js`):

- `score-opportunity` and `proposal-advice` use a standard chat model
  (`OPENROUTER_MODEL_SCORING` / `OPENROUTER_MODEL_ADVICE`, default
  `anthropic/claude-sonnet-4.5`).
- `find-opportunities` uses `OPENROUTER_MODEL_ONLINE` (default
  `perplexity/sonar-pro:online`) — the `:online` suffix is OpenRouter's convention for
  enabling web-search grounding on a compatible model. If that call fails for any reason
  (bad key, model unavailable, rate limit, no network), the function catches the error and
  returns a curated **offline fallback** list instead of failing the request outright.

## Terminology adaptation (US federal funders)

`netlify/lib/terminology.js` encodes a factual, non-partisan observation: as of 2025-2026,
several US federal agencies (NSF, NIH, USDA, DOE, DOD and others) have been reported — per
court filings and reporting from Higher Ed Dive, Grist, and NPR — to screen grant language for
certain terms (e.g. "climate change," "clean energy," "decarbonization," "equity"). When
`proposal-advice` detects that an opportunity's funder is a US federal agency, it surfaces
meaning-preserving phrasing alternatives (e.g. "climate change" → "extreme weather" /
"weather variability") as optional suggestions — it never changes what the project actually
does, and the founder always chooses whether to use them. For non-US-federal funders, this
logic doesn't run at all.

## Data model

Each opportunity (see `data/opportunities-seed.json` for full examples) has: `name`, `funder`,
`type`, `amountMin`/`amountMax`/`currency`, `deadline`, `openingDate`, `cycle`, `eligibility`
(`individualsAllowed`, `orgRequired`, `ageRange`, `geography`), `requirements`, `sdgs`,
`pastWinners`, `reviewTimeline`, `applicationLink`, `ventureFit` (`aquafarm`/`fbt`), `status`
(`not started` / `in progress` / `submitted` / `awarded` / `rejected`), `score` (AI-generated),
`notes`, `archived`, `source` (`seed` / `manual` / `ai-found`), `verified`.

## Honest limitations to know about

- **Seed data is a starting point, not verified fact.** The six seed opportunities are real,
  well-known funders/fellowships, but exact amounts, deadlines, and eligibility rules are
  marked `"verified": false` and mostly left blank — confirm details on the funder's site (or
  run "Scan for new opportunities") before relying on them.
- **AI-found opportunities can still be wrong.** Web-search-grounded models are much better
  than an ungrounded model at not inventing funders, but they can still get deadlines,
  amounts, or eligibility details wrong. Every AI-found entry is tagged `ai-found` with a
  confidence note — treat it as a lead to verify, not a confirmed fact, especially before a
  submission decision.
- **This was built and tested as code, not deployed.** I don't have the ability to create
  Netlify/OpenRouter/Resend accounts, push to GitHub, or set live environment variables on
  your behalf — steps 1-4 above are the ones you'll need to do yourself. Everything else
  (all the function logic, the data model, the UI) is complete and ready to run.
