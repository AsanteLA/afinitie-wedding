# Afinitie — Wedding Website

A password-gated wedding site for **Abbie & Asante**, September 15, 2026, in Lindon, Utah.

Vanilla HTML, CSS, and JavaScript. No framework, no bundler, no build step. Static files live on S3 behind CloudFront; RSVPs, guestbook posts, emails, and the guest playlist run on Lambda + DynamoDB + SES.

Live site: [afinitie.com](https://afinitie.com)

---

## Table of contents

1. [What this is](#what-this-is)
2. [How it was built](#how-it-was-built)
3. [Architecture](#architecture)
4. [Repo map](#repo-map)
5. [Design system](#design-system)
6. [Pages and features](#pages-and-features)
7. [Invite tiers](#invite-tiers)
8. [RSVP data model](#rsvp-data-model)
9. [Starting from scratch](#starting-from-scratch)
10. [Local development](#local-development)
11. [Deploying](#deploying)
12. [Day-of and after](#day-of-and-after)
13. [Lessons learned](#lessons-learned)
14. [What we would do differently](#what-we-would-do-differently)

---

## What this is

Guests get a QR code (or a passcode) that unlocks the site and remembers which events they are invited to. They can RSVP per event with a headcount, request a song, leave a message, look at photos, and add the day to their calendar.

The couple gets an admin dashboard, a weekly email digest of new RSVPs, and a Spotify playlist that rebuilds itself from song requests.

The whole thing was built to be cheap, fast to change, and easy to host. A wedding site does not need a React app.

---

## How it was built

This grew in layers. If you are copying the idea, you do not have to ship everything on day one. Ship in this order; each layer is useful on its own.

### Phase 1 — Static brochure (early June 2026)

Started as a handful of HTML pages sharing one stylesheet and a tiny nav script:

- Home, Our Story, Schedule, RSVP, Registry
- CSS variables for the palette, Google Fonts, a mobile hamburger
- Placeholders everywhere (`<!-- ... PLACEHOLDER -->`) until venues and times were locked

Hosting target from day one: **S3 + CloudFront**, because there is nothing to compile. GitHub → CodePipeline → S3 was wired up next, then a Lambda that invalidates CloudFront after every deploy so guests do not see a stale cache.

**Takeaway:** get the visual language and page skeleton live before any backend. You will rewrite copy a dozen times.

### Phase 2 — Real content and polish

- Replaced placeholders with Lindon Utah Temple + Walker Farms
- Added a gallery, guestbook, playlist page, QR print sheet, `.ics` calendar file
- Tuned the palette (peacock teal, jewel purple, burnt orange, mustard, cream)
- Full-bleed hero photo on the homepage; logo filter so it reads on both cream pages and the dark hero
- Print stylesheet on the schedule page so it can be saved as a PDF program

**Takeaway:** print CSS is worth doing early if you want a physical program that matches the site.

### Phase 3 — Access control and invite tiers

Not every guest is invited to every event. Three invite codes (baked into QR codes) set a **tier** in `localStorage`:

| Tier | Events shown |
|---|---|
| `full` | Sealing, ring ceremony, luncheon, reception |
| `luncheon` | Ring ceremony, luncheon, reception |
| `reception` | Reception only |

`js/gate.js` also has a shared passcode fallback. First QR scan asks “have you already RSVPed?” and either sends them to the homepage or straight to the form.

The schedule page injects a `<style>` **before paint** so hidden events do not flash.

**Takeaway:** this is *courtesy* gating, not security. Anyone with the URL and a little effort can see the HTML. That is fine for a wedding site. Do not put anything truly private in the static files.

### Phase 4 — RSVP backend

The form started as `console.log`. Then:

1. API Gateway HTTP API in `us-east-2`
2. Lambda writes to DynamoDB (`afinitie-rsvps`)
3. SES sends a confirmation email with calendar links
4. Admin page (`admin.html`) lists every RSVP with filters, per-event headcounts, and print-to-PDF
5. EventBridge weekly digest email
6. Per-event yes/no plus a guest stepper (1–10) so luncheon headcount can differ from reception headcount
7. Confirmation page that reads a one-shot `sessionStorage` summary

**Takeaway:** store **per-event counts**, not just one guest number. Catering and the temple sealing have different lists.

### Phase 5 — Guestbook, songs, playlist

- Separate guestbook table + Lambda, later merged on the wall with RSVP `message` fields (`GET /rsvp?source=messages`)
- Song field uses the **iTunes Search API via JSONP** (no API key, avoids CORS)
- Local Node script (`spotify-playlist.js`) does the first OAuth dance, then a weekly Lambda rebuilds a public Spotify playlist from DynamoDB

**Takeaway:** iTunes search on the form, Spotify search on the server. Guests type a real track name; Lambda can actually find it.

---

## Architecture

```
Guest browser
    │
    ├── Static pages  ──► CloudFront ──► S3 bucket
    │
    ├── POST /rsvp, GET /rsvp
    ├── GET/POST /guestbook
    │         └──► API Gateway (us-east-2)
    │                    ├── Lambda: rsvp        → DynamoDB afinitie-rsvps
    │                    │                      → SES confirmation email
    │                    └── Lambda: guestbook   → DynamoDB afinitie-guestbook
    │
    └── Spotify embed (playlist.html)

Scheduled (EventBridge)
    ├── weekly-digest Lambda     → scan last 7 days → SES to the couple
    └── spotify-playlist Lambda  → scan song fields → Spotify Web API
                                   (refresh token in SSM)

Git push to main
    └── CodePipeline → sync to S3 → invalidate-cloudfront Lambda (/*)
```

**Region:** most of this lives in **us-east-2**. CloudFront and ACM certificates for HTTPS must be in **us-east-1**.

**Why vanilla files:** CodePipeline can dump the repo onto S3. No Node build, no environment injection at build time. The tradeoff is that API URLs and a few secrets ended up hardcoded in HTML/JS (see [Lessons learned](#lessons-learned)).

---

## Repo map

```
Afinitie/
├── index.html              Home — hero, countdown, quick links
├── our-story.html          Timeline
├── gallery.html            Editorial photo grid
├── schedule.html           Day-of program, venues, hotels, FAQ (tier-aware)
├── rsvp.html               RSVP form
├── confirmation.html       Post-submit thank-you
├── registry.html           Amazon + Venmo
├── guestbook.html          Message wall + form
├── playlist.html           Spotify embed + live stats
├── admin.html              RSVP dashboard (separate passcode)
├── qr.html                 Printable QR codes for invitations
├── messages.html           Alternate / older messages view
├── wedding.ics             Apple / Outlook calendar file
│
├── styles/main.css         Entire design system
├── js/
│   ├── main.js             Nav, hamburger, scroll reveal, countdown
│   ├── gate.js             Passcode + invite tokens + first-scan modal
│   ├── rsvp.js             Tier-aware form + POST
│   ├── guestbook.js        Wall load + POST
│   └── song-search.js      iTunes autocomplete
│
├── images/
│   ├── logo.png            Wordmark (CSS-filtered teal / white)
│   ├── gallery/            Couple photos (fed to generate-gallery.js)
│   └── temple/             Venue strip on the schedule page
│
├── lambda/
│   ├── rsvp/               POST save + GET admin + GET public messages
│   ├── guestbook/          GET approved + POST new
│   ├── weekly-digest/      Sunday RSVP email
│   ├── spotify-playlist/   Rebuild guest playlist
│   └── invalidate-cloudfront/   CodePipeline post-deploy hook
│
├── tools/
│   ├── generate-gallery.js     Scan photos → inject HTML into gallery.html
│   └── sealing-finder/         Personal temple-scheduling bookmarklet (not guest-facing)
│
├── spotify-playlist.js     Local OAuth helper (first-time Spotify login)
└── utah-temple-sealing-finder.html   Older one-off planner; prefer tools/sealing-finder
```

Files that should **not** ship to guests (exclude them from the S3 sync):

- `lambda/`, `*.zip`, `node_modules/`, `tools/`, `spotify-playlist.js`
- `.spotify-token.json`, `.spotify-playlist.json`
- `admin.html` is currently public-but-gated; hide it from the nav (footer logo is a quiet link)

---

## Design system

All in `styles/main.css`. Change the `:root` variables and the whole site follows.

| Token | Hex | Role |
|---|---|---|
| `--color-navy` | `#0c6870` | Peacock teal — headings, nav, primary text |
| `--color-burgundy` | `#5a2d88` | Jewel purple — accent |
| `--color-orange` / `--color-highlight` | `#c4601a` | Burnt orange — primary buttons |
| `--color-mustard` / `--color-gold` | `#c89020` | Eyebrows, dividers, details |
| `--color-cream` / `--color-bg` | `#faf6f0` | Page background |
| `--color-muted` | `#526870` | Secondary copy |
| `--color-border` | `#e0d8cc` | Hairlines |

**Type:** [Cormorant Garamond](https://fonts.google.com/specimen/Cormorant+Garamond) (headings, italic `&`) + [Jost](https://fonts.google.com/specimen/Jost) (UI, nav, buttons). Loaded from Google Fonts with `preconnect`.

**Shared patterns:**

- `.eyebrow` — tiny uppercase gold label
- `.divider` — 60px accent rule
- `.btn--primary` / `.btn--outline`
- `.page-hero` — inner-page title block
- `.card` — bordered surface
- `.reveal` — scroll-in animation (applied by `js/main.js`; above-the-fold skips it so nothing flashes)
- Nav: `body.home` gets a white logo + white links until `.scrolled`; inner pages stay teal
- Logo is one PNG; a CSS `filter` tints it. Homepage unscrolled uses invert + drop-shadow so it sits on the photo

**Page template.** Every guest page repeats the same `<nav>`, Google Fonts, favicon, Open Graph tags, and footer. There is no include system. When you change the nav, change it on every HTML file. Annoying, but it keeps deploys as “copy files to S3.”

---

## Pages and features

### Home (`index.html`)

Full-viewport hero photo, names, date, countdown to `September 15, 2026 00:00:00`, welcome copy, four cards.

### Schedule (`schedule.html`)

Program times, temple + Walker Farms cards with Google/Apple Maps, hotel suggestions, FAQ. Elements use `data-tiers="full"` or `data-tiers="full luncheon"` so the inline script can hide them. Print CSS produces a one-page program (`window.print()`).

### RSVP (`rsvp.html` + `js/rsvp.js`)

UI is built in JS from `localStorage.afinitie_tier`:

- **full / luncheon:** checkboxes per event, each with a guest stepper
- **reception:** simple yes/no + one stepper

Overall `guests` stored in DynamoDB is the **max** headcount across events (useful as a single “how many people is this party?” number). Per-event counts are the source of truth for catering.

On success, a summary is written to `sessionStorage` and the browser goes to `confirmation.html`.

### Confirmation (`confirmation.html`)

Reads that summary once and deletes it (refreshing the page will not replay it). Declines get a softer message; attendees see which events they picked.

### Guestbook

`guestbook.js` fetches **both** `/guestbook` and `/rsvp?source=messages`, merges, sorts newest first. RSVP notes show up on the wall without a second form.

### Gallery

CSS grid with a 9-cell repeating pattern (feature / tall / wide). Do not hand-edit the photo list. Drop files in `images/gallery/` and run:

```bash
npm install
npm run gallery
```

`tools/generate-gallery.js` reads dimensions, prefers landscapes in the big slots and portraits in the tall slot, and rewrites the block between `<!-- GALLERY:START -->` and `<!-- GALLERY:END -->`.

Compress photos before upload. A folder of wedding JPEGs will dominate the CloudFront bill and first-load time more than any JS on this site.

### Playlist (`playlist.html`)

Spotify iframe (HTTPS only — on `http://localhost` it shows a fallback). Stats currently call the **admin** RSVP endpoint. That is convenient and also a security smell; see below.

### Admin (`admin.html`)

Passcode checked against the Lambda `x-admin-key`. On `localhost` it uses mock RSVPs so you can design the dashboard without AWS. Filters, sortable columns, per-event guest totals, “quick view” tables, print-to-PDF.

Hidden entry: click the footer logo on most pages.

### QR sheet (`qr.html`)

Uses [qrcodejs](https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js) in the browser. Three invite URLs plus Amazon registry and Venmo. Print the page. Localhost generates codes against your local origin so you can test scans.

### Calendar (`wedding.ics`)

Linked from the SES confirmation email. Times are UTC (`DTSTART:20260915T180000Z` = noon MDT). If you change the schedule, update this file **and** the Google Calendar URL in `lambda/rsvp/index.js`.

### Sealing finder (`tools/sealing-finder/`)

Not part of the guest site. A bookmarklet that, while you are logged into the Church temple scheduler, searches Utah temples for living-sealing openings. See that folder’s README.

---

## Invite tiers

Defined in `js/gate.js`:

```
URL ?invite=TOKEN  →  localStorage.afinitie_auth = "1"
                   →  localStorage.afinitie_tier = "full" | "luncheon" | "reception"
```

A shared site passcode also sets `afinitie_auth` and defaults the tier to `full`.

Generate **your own** random tokens. Do not reuse the ones in this repo if you fork it. Print `qr.html` after you change them.

The gate is client-side. Treat it as “keep casual browsers out,” not “keep determined people out.”

---

## RSVP data model

DynamoDB table `afinitie-rsvps`, partition key `id` (UUID string). All values are stored as strings except where noted.

| Field | Meaning |
|---|---|
| `id` | UUID |
| `name`, `email` | Required |
| `attending` | `yes` / `no` (yes if **any** event is yes) |
| `tier` | `full` / `luncheon` / `reception` |
| `sealing`, `ring_ceremony`, `luncheon`, `reception` | `yes` / `no` / `na` |
| `sealing_count`, `ring_count`, `luncheon_count`, `reception_count` | `"0"`–`"10"` |
| `guests` | Max of the per-event counts |
| `dietary`, `song`, `message` | Optional |
| `timestamp` | ISO 8601 |

Guestbook table `afinitie-guestbook`: `id`, `name`, `message`, `timestamp`, `approved` (bool). `AUTO_APPROVE` in the Lambda is currently `true`. Flip it to `false` if you want to moderate.

---

## Starting from scratch

This is the path we actually took, written as a checklist you can follow for a new couple / domain / year.

### 0. Decide the constraints first

Write these down before opening an editor. Changing them later touches HTML, CSS, Lambda emails, `.ics`, and QR codes.

- Couple names, date, city
- Event list and which guest groups see which events
- Domain name
- Palette (or steal the CSS variables and recolor)
- Registry / Venmo / hotel block
- Whether you need a gate at all

### 1. Scaffold the static site

No framework. Copy this layout:

```
index.html  our-story.html  schedule.html  rsvp.html  registry.html
styles/main.css
js/main.js
images/logo.png
```

Every page: same `<head>` (fonts, OG tags, favicon), same nav, same footer. Put the wedding date in **one obvious place per page** (hero + footer) so find-and-replace works.

Run locally:

```bash
python3 -m http.server 8080
# or
npx serve .
```

`file://` will fight you (modules, fetch, Spotify). Always use a local server.

### 2. Buy the domain and put HTTPS in front

1. Register the domain (Route 53 or wherever).
2. Create a private S3 bucket. Do **not** enable public website hosting if you are using CloudFront + Origin Access Control — that is the current AWS recommendation.
3. Request an ACM certificate in **us-east-1** for `yourdomain.com` and `www.yourdomain.com`.
4. Create a CloudFront distribution:
   - Origin: the S3 bucket (OAC)
   - Default root object: `index.html`
   - Alternate domain names + the ACM cert
   - Custom error pages: 403/404 → `/index.html` (or a dedicated `404.html`) with 200 if you want SPA-style fallbacks. This site is multi-page, so a simple 404 HTML is nicer.
5. Route 53 A (alias) records → CloudFront.

### 3. Deploy pipeline

GitHub repo on `main` → CodePipeline (or GitHub Actions):

```bash
aws s3 sync . s3://YOUR_BUCKET \
  --exclude ".git/*" \
  --exclude "node_modules/*" \
  --exclude "lambda/*" \
  --exclude "tools/*" \
  --exclude "*.zip" \
  --exclude "spotify-playlist.js" \
  --exclude ".spotify-*" \
  --exclude "README.md" \
  --cache-control "max-age=300"
```

Then a Lambda (`lambda/invalidate-cloudfront`) as a pipeline action:

- Env: `DISTRIBUTION_ID`
- Invalidates `/*`
- Calls `PutJobSuccessResult` / `PutJobFailureResult` so the pipeline does not hang

IAM: the pipeline role needs `s3:PutObject` (and delete if you prune), the Lambda role needs `cloudfront:CreateInvalidation` and `codepipeline:PutJob*`.

Short cache (`max-age=300`) plus invalidation means copy fixes show up in minutes. HTML can stay short; hashed assets could be longer, but this project has no hashed filenames.

### 4. Email (SES)

Do this **early**. SES new accounts start in sandbox (you can only mail verified addresses).

1. Verify `hello@yourdomain.com` (or whatever From address) in SES, same region as the Lambda (`us-east-2` here).
2. Verify the couple’s inbox for testing.
3. Request production access. Approval can take a day or more. Do not wait until invitations go out.
4. SPF/DKIM on the domain so confirmations do not land in spam.

The RSVP Lambda sends mail on success but **does not fail the RSVP** if SES errors (`Promise.allSettled`). Guests should never lose a submission because email is down. Watch CloudWatch logs.

### 5. DynamoDB

Two on-demand tables (wedding traffic will never justify provisioned capacity):

- `yourprefix-rsvps` — PK `id` (String)
- `yourprefix-guestbook` — PK `id` (String)

No GSIs required. Weekly digest and admin both `Scan`. Fine for hundreds of guests; do not copy this pattern for a product with millions of rows.

### 6. Lambdas + API Gateway

Runtime: Node.js 20+ (native `fetch`, AWS SDK v3). Package each function with its `node_modules` (or rely on the Lambda Node 18+ built-in fetch and bundle only `@aws-sdk/*` if they are not in the runtime).

**RSVP function env:**

| Variable | Purpose |
|---|---|
| `RSVP_TABLE` | DynamoDB table |
| `ADMIN_KEY` | Shared secret for GET |
| `AWS_REGION` | Set automatically |

Hardcode the From address only after SES is verified. Put `ADMIN_KEY` in the Lambda environment, **not** in the repo.

**API Gateway HTTP API:**

| Method | Path | Auth |
|---|---|---|
| `POST` | `/rsvp` | none |
| `GET` | `/rsvp` | header `x-admin-key` (except `?source=messages`) |
| `OPTIONS` | `/rsvp` | CORS |
| `GET`/`POST`/`OPTIONS` | `/guestbook` | none |

Enable CORS for `Content-Type` and `x-admin-key`. The Lambdas also return CORS headers so preflight and error responses both work.

After deploy, paste the invoke URL into:

- `js/rsvp.js`
- `js/guestbook.js`
- `admin.html`
- `playlist.html` (or, better, stop calling admin from the public playlist page)

### 7. Gate, QR codes, RSVP form

1. Pick a site passcode and three random invite tokens. Put them only in `js/gate.js` and `qr.html`.
2. Add `data-tiers` to schedule blocks.
3. Build the RSVP UI from the stored tier (`js/rsvp.js`).
4. Print `qr.html` and tape a code to a test invitation. Scan from a phone **not** logged into your laptop’s `localStorage`.

### 8. Confirmation email and calendar

Keep these three in sync whenever times change:

- `schedule.html`
- `lambda/rsvp/index.js` (HTML email + Google Calendar query string)
- `wedding.ics` (UTC times)

Google Calendar template URLs use UTC (`20260915T180000Z`). Utah in September is MDT (UTC−6).

### 9. Weekly digest

Lambda + EventBridge schedule (`cron(0 8 ? * SUN *)` = Sunday 08:00 UTC, which is Saturday evening in Utah — pick a time you will actually read).

Env: `RSVP_TABLE`, `FROM_EMAIL`, `TO_EMAIL`. Skip the send if the week’s scan is empty.

### 10. Spotify playlist (optional, do last)

1. Create a Spotify app at developer.spotify.com. Redirect URI: `http://127.0.0.1:8888/callback`.
2. Scopes: `playlist-modify-public playlist-modify-private user-read-email`.
3. Put **client id / secret in Lambda env or SSM**, not in a git-tracked JS file.
4. Run the local helper once to complete OAuth. Store the refresh token in SSM as a SecureString (`/yourprefix/spotify/refresh_token`).
5. Weekly EventBridge → `lambda/spotify-playlist`. It creates the playlist on first run and writes `/yourprefix/spotify/playlist_id`.
6. Paste that playlist ID into the iframe on `playlist.html`.

If Spotify rotates the refresh token, the Lambda already writes the new one back to SSM. The local script writes `.spotify-token.json` (gitignored).

### 11. Photos

1. Export web-sized JPEGs (long edge ~1600–2000px, quality ~70–80).
2. Drop into `images/gallery/`.
3. `npm run gallery`.
4. Commit the HTML change **and** the images.

Same for `images/temple/` if you use the scrolling venue strip — animation distance in CSS is hardcoded to the image count × width.

### 12. Content you will forget to update

Search the repo for the old date/names/venues before launch:

- Footer on every HTML page
- Open Graph titles
- SES email HTML and text
- `wedding.ics`
- Countdown in `js/main.js`
- QR Amazon / Venmo URLs
- Hotel names and maps links on the schedule page

---

## Local development

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080](http://localhost:8080).

- Gate: use the site passcode, or `?invite=YOUR_TOKEN`.
- Clear `localStorage` keys `afinitie_auth`, `afinitie_tier`, `afinitie_welcomed` to re-test the gate.
- `admin.html` on localhost uses mock RSVPs (any admin key works).
- Guestbook / RSVP POST still hit **production** API URLs unless you change them. Do not spam real tables while designing the form.
- Spotify embed is hidden on HTTP.

No tests. Check on an iPhone Safari window — the hamburger, gate overlay, and `100svh` hero are where most bugs showed up.

---

## Deploying

Push to `main`. CodePipeline syncs S3 and invalidates CloudFront.

To ship a Lambda change:

```bash
cd lambda/rsvp
npm install --omit=dev
zip -r function.zip index.js node_modules package.json
aws lambda update-function-code \
  --function-name YOUR_RSVP_FUNCTION \
  --zip-file fileb://function.zip \
  --region us-east-2
```

Repeat for guestbook, weekly-digest, spotify-playlist, invalidate-cloudfront. Those zip files in the repo (`lambda/rsvp.zip`, `weekly-digest.zip`, `function.zip`) are leftovers from manual uploads — do not treat them as the source of truth. The source of truth is `index.js`.

---

## Day-of and after

**Before invitations go out**

- [ ] SES in production, test a real RSVP to a non-sandbox inbox
- [ ] Scan each QR from a fresh phone
- [ ] Confirm each tier sees the right schedule **and** the right RSVP checkboxes
- [ ] Admin dashboard totals match a couple of hand-checked submissions
- [ ] `.ics` opens on iPhone and the times are correct

**While RSVPs are open**

- Check `admin.html` or wait for the Sunday digest
- Dietary tags and song lists have their own filters / PDF export
- Guestbook auto-approves; skim it occasionally

**After the wedding**

- Turn off EventBridge rules (digest + Spotify) so you are not billed forever
- CloudFront + S3 can stay up as a keepsake; or export DynamoDB to CSV and shut the API down
- The site gate can stay; nobody new needs in

---

## Lessons learned

These are the things that ate time, in roughly the order they appeared.

**Mobile nav stacking.** `backdrop-filter` on `.nav.scrolled` creates a stacking context. The full-screen menu was trapped *inside* the 60px bar. Fix: strip `.scrolled` while the hamburger is open (`js/main.js`).

**Hero vs inner pages.** One logo file, two treatments. Homepage unscrolled: white invert. Everything else: teal filter. If you add a new full-bleed photo page, give `body` a class and copy the `body.home` exceptions.

**Tier flash.** Schedule hiding must run in `<head>` (or immediately in `<body>`) before the program HTML. A `DOMContentLoaded` listener is too late.

**localStorage across the first-scan redirect.** The welcome modal originally redirected without putting `?invite=` back on the URL. Some mobile browsers had not persisted `localStorage` yet, so the next page showed the gate again. Re-attach the token on that redirect.

**One guest count is not enough.** People bring kids to the reception and not the sealing. Steppers per event, then `guests = max(counts)` for a single headline number.

**SES sandbox.** You will test with your own email, it will work, then the first real guest will get nothing. Request production access as soon as the domain verifies.

**iTunes JSONP.** The Search API does not send CORS headers. JSONP (`callback=`) is the boring solution that works from a static page with no backend.

**Spotify on localhost.** The embed needs HTTPS. Show a fallback. Do the OAuth dance on `127.0.0.1`, not `localhost` — Spotify’s redirect allow-list treats them as different.

**Gallery layout.** CSS `nth-child` spans only look good if the *image orientation* matches the slot. Automate that (`tools/generate-gallery.js`) or the grid will look random.

**Admin key in the browser.** `playlist.html` currently sends `x-admin-key` to load song counts. Anyone can read that file. Prefer a public, field-limited endpoint (you already have `GET /rsvp?source=messages` as a pattern) or drop the live stats.

**Secrets in git.** Spotify client secret and a default admin key have lived in source. Rotate them if this repo is or was public. Use Lambda env / SSM. Add `*.zip` and token JSON to `.gitignore` (token files are already ignored).

**Duplicate nav.** Without a static site generator, nav edits are a grep-and-pray operation. If you were starting over and knew you would have 12 pages, an 11ty / Eleventy include (still emitting flat HTML for S3) would be worth the tiny build.

**CodePipeline tests.** The first week of commits is almost entirely “does the pipeline actually upload.” Deploy a `test.html` first. Do not debug CloudFront cache, S3 policy, and Lambda all on the same afternoon.

**Courtesy gate ≠ auth.** Do not put addresses of private events only in HTML and assume the passcode protects them. For this wedding that was an accepted tradeoff.

---

## What we would do differently

If this were a template for the next person:

1. **Eleventy (or similar)** for nav/footer/head includes, still emitting static HTML.
2. **One `config.js`** (names, date, venues, API URL, tokens) loaded by every page, instead of hunting strings.
3. **No secrets in the client.** Public playlist stats from a scan that returns `{ songs, guests }` only.
4. **Image CDN / compression** in the pipeline (`sharp` or CloudFront image optimization). Wedding photos are the whole bandwidth budget.
5. **RSVP uniqueness.** Right now a guest can submit twice and you get two rows. An email+name upsert, or a magic edit link in the confirmation email, would save cleanup.
6. **Infrastructure as code.** A small SAM/CDK stack for the tables, functions, HTTP API, EventBridge rules, and SSM params. Recreating this from the AWS console is how it was actually done; it is also how you forget an env var.
7. **Exclude Lambda zips from the website bucket.** They do not belong next to `index.html`.

None of that is required to have a working wedding site. The current stack is: static files, four Lambdas, two tables, one API, one distribution. That is the whole product.
