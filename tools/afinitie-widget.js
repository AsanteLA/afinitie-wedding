// ══════════════════════════════════════════════════════════
//  AFINITIE WEDDING — iOS RSVP Widget
//  Built for Scriptable (free on App Store)
//
//  Setup:
//    1. Install Scriptable from the App Store
//    2. Paste this entire file into a new script
//    3. Fill in your ADMIN_KEY below
//    4. Add a Medium widget to your home screen → Scriptable
//    5. Choose this script
// ══════════════════════════════════════════════════════════

const API_URL   = "https://zj2njddkgg.execute-api.us-east-2.amazonaws.com/prod/rsvp";
const ADMIN_KEY   = "YOUR_ADMIN_KEY_HERE"; // ← paste your admin key

// ── Palette ──────────────────────────────────────────────
const C = {
  bg:     new Color("#faf8f4"),
  navy:   new Color("#1b3a6b"),
  gold:   new Color("#d4981a"),
  muted:  new Color("#7a8896"),
  border: new Color("#e4ddd3"),
  pill:   new Color("#eef1f5"),
};

// ── Fetch & parse ─────────────────────────────────────────
async function getData() {
  try {
    const req = new Request(API_URL);
    req.headers = { "x-admin-key": ADMIN_KEY };
    const json = await req.loadJSON();

    const rsvps     = json.rsvps || [];
    const attending = rsvps.filter(r => r.attending === "yes");
    const declined  = rsvps.filter(r => r.attending === "no").length;

    let sealing = 0, ring = 0, luncheon = 0, reception = 0;
    for (const r of attending) {
      sealing   += parseInt(r.sealing_count   || "0", 10);
      ring      += parseInt(r.ring_count      || "0", 10);
      luncheon  += parseInt(r.luncheon_count  || "0", 10);
      reception += parseInt(r.reception_count || "0", 10);
    }

    return {
      ok: true,
      sealing, ring, luncheon, reception,
      attending: attending.length,
      declined,
      total: rsvps.length,
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ── Widget ────────────────────────────────────────────────
async function buildWidget() {
  const data = await getData();

  const w = new ListWidget();
  w.backgroundColor = C.bg;
  w.setPadding(16, 18, 14, 18);
  w.refreshAfterDate = new Date(Date.now() + 30 * 60 * 1000);
  w.url = "https://afinitie.com/admin.html";

  // ── Error state ──────────────────────────────────────
  if (!data.ok) {
    const err = w.addText("Could not load RSVPs");
    err.textColor = C.muted;
    err.font = Font.systemFont(13);
    return w;
  }

  // ── Header row ───────────────────────────────────────
  const hdr = w.addStack();
  hdr.layoutHorizontally();
  hdr.centerAlignContent();

  const logoText = hdr.addText("A & A");
  logoText.textColor = C.navy;
  logoText.font = Font.boldSystemFont(12);

  hdr.addSpacer();

  const now     = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const upd     = hdr.addText("↻  " + timeStr);
  upd.textColor = C.gold;
  upd.font      = Font.systemFont(9);

  w.addSpacer(4);

  // Gold rule
  const ruleStack = w.addStack();
  ruleStack.layoutHorizontally();
  const rule = ruleStack.addStack();
  rule.size            = new Size(36, 1);
  rule.backgroundColor = C.gold;

  w.addSpacer(10);

  // ── Event rows ───────────────────────────────────────
  const events = [
    { label: "Temple Sealing",  count: data.sealing,   icon: "⛪" },
    { label: "Ring Ceremony",   count: data.ring,      icon: "💍" },
    { label: "Luncheon",        count: data.luncheon,  icon: "🍽️" },
    { label: "Reception",       count: data.reception, icon: "✨" },
  ];

  for (let i = 0; i < events.length; i++) {
    const ev  = events[i];
    const row = w.addStack();
    row.layoutHorizontally();
    row.centerAlignContent();

    // Label
    const label = row.addText(ev.label);
    label.textColor          = C.muted;
    label.font               = Font.systemFont(11);
    label.minimumScaleFactor = 0.8;

    row.addSpacer();

    // Count pill
    const pill = row.addStack();
    pill.backgroundColor = C.pill;
    pill.cornerRadius    = 8;
    pill.setPadding(2, 8, 2, 8);

    const countText = pill.addText(String(ev.count));
    countText.textColor = C.navy;
    countText.font      = Font.boldSystemFont(13);

    if (i < events.length - 1) {
      w.addSpacer(7);
    }
  }

  w.addSpacer(10);

  // ── Footer ───────────────────────────────────────────
  const sep = w.addStack();
  sep.layoutHorizontally();
  const sepLine = sep.addStack();
  sepLine.size            = new Size(200, 1);
  sepLine.backgroundColor = C.border;

  w.addSpacer(8);

  const foot = w.addStack();
  foot.layoutHorizontally();
  foot.centerAlignContent();

  const attText = foot.addText(String(data.attending) + " attending");
  attText.textColor = C.gold;
  attText.font      = Font.mediumSystemFont(10);

  foot.addSpacer();

  const decText = foot.addText(String(data.declined) + " declined");
  decText.textColor = C.muted;
  decText.font      = Font.systemFont(10);

  return w;
}

// ── Run ───────────────────────────────────────────────────
const widget = await buildWidget();

if (config.runsInWidget) {
  Script.setWidget(widget);
} else {
  // Preview in app
  await widget.presentMedium();
}

Script.complete();
