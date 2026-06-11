# Utah Living Sealing Finder

Personal planning tool — not part of the guest-facing wedding site.

## What it does
Searches every Utah temple on the Church's temple scheduling site (tos.churchofjesuschrist.org) for **living sealing** openings across a date range you choose, and shows them on a calendar. Click a day to see which temples have openings and at what times.

## How it works
There is no public API for the scheduling site, and it requires your Church Account login. So the tool ships as a **bookmarklet**: a bookmark you click *while on the scheduling site*, where it can use your existing logged-in session. It learns the site's internal API automatically by watching one availability request, then fans out across all Utah temples and your whole date range.

## Usage
1. Open `index.html` in your browser.
2. Pick your date range (Step 1).
3. Drag the bookmarklet button to your bookmarks bar (Step 2). Re-drag after changing dates — the range is baked into the bookmark.
4. Go to tos.churchofjesuschrist.org, sign in, click the bookmark.
5. In the scheduler: open any Utah temple → choose **Living Sealing** → click any date in your range. The panel takes over from there.
6. Green calendar days have openings; click one to see temples + times.

## Notes
- Runs entirely in your browser. No credentials or data leave your machine.
- Max range: 120 days (keeps the request count reasonable).
- Replaces the older `utah-temple-sealing-finder.html` in the repo root (hardcoded to Sept 2026).
- Personal use only. Not affiliated with The Church of Jesus Christ of Latter-day Saints.
