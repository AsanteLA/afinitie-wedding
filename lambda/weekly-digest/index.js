/* ============================================================
   AFINITIE WEDDING — WEEKLY RSVP DIGEST LAMBDA

   Triggered every Sunday at 8am UTC by EventBridge.
   Scans DynamoDB for RSVPs submitted in the past 7 days
   and sends an HTML email via SES.

   Environment variables required:
     RSVP_TABLE   — DynamoDB table name (default: afinitie-rsvps)
     FROM_EMAIL   — SES verified sender address
     TO_EMAIL     — your email address to receive the digest
   ============================================================ */

const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { SESClient, SendEmailCommand }  = require('@aws-sdk/client-ses');

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
const ses    = new SESClient({ region: process.env.AWS_REGION });

const TABLE_NAME = process.env.RSVP_TABLE  || 'afinitie-rsvps';
const FROM_EMAIL = process.env.FROM_EMAIL;
const TO_EMAIL   = process.env.TO_EMAIL;

const esc = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const showDietary = v => v && !['na','n/a','none','no','-',''].includes(v.trim().toLowerCase());

function buildEmail(items, allTimeGuests) {
  const attending    = items.filter(i => i.attending.S === 'yes');
  const notAttending = items.filter(i => i.attending.S === 'no');
  const totalGuests  = attending.reduce((s, i) => s + parseInt(i.guests.S || '1', 10), 0);
  const songs        = attending.filter(i => i.song?.S);

  const stat = (num, label, color) => `
    <td style="text-align:center;padding:0 16px;">
      <div style="font-size:2.2rem;font-weight:300;color:${color};line-height:1;">${num}</div>
      <div style="font-size:10px;font-weight:500;letter-spacing:0.15em;text-transform:uppercase;color:#5a6a7a;margin-top:4px;">${label}</div>
    </td>`;

  const attendingRows = attending.map((i, idx) => {
    const g = i.guests.S || '1';
    const dietary = showDietary(i.dietary?.S) ? `<div style="margin-top:4px;"><span style="background:#fef3e2;color:#c4601a;font-size:11px;padding:2px 8px;border-radius:100px;">${esc(i.dietary.S)}</span></div>` : '';
    const song    = i.song?.S    ? `<div style="font-size:12px;color:#5a6a7a;font-style:italic;margin-top:4px;">&#9834; ${esc(i.song.S)}</div>` : '';
    const note    = i.message?.S ? `<div style="font-size:12px;color:#5a6a7a;margin-top:4px;">"${esc(i.message.S)}"</div>` : '';
    return `
      <tr style="border-bottom:1px solid #e8e0d4;">
        <td style="padding:12px 16px;font-size:13px;color:#5a6a7a;text-align:center;">${idx + 1}</td>
        <td style="padding:12px 16px;">
          <strong style="color:#0c6870;font-size:14px;">${esc(i.name.S)}</strong>
          ${dietary}${song}${note}
        </td>
        <td style="padding:12px 16px;text-align:center;font-size:13px;color:#0c6870;font-weight:500;">${g}</td>
      </tr>`;
  }).join('');

  const declinedRows = notAttending.map((i, idx) => {
    const note = i.message?.S ? `<div style="font-size:12px;color:#5a6a7a;margin-top:4px;">"${esc(i.message.S)}"</div>` : '';
    return `
      <tr style="border-bottom:1px solid #e8e0d4;">
        <td style="padding:12px 16px;font-size:13px;color:#5a6a7a;text-align:center;">${idx + 1}</td>
        <td style="padding:12px 16px;">
          <strong style="color:#888;font-size:14px;">${esc(i.name.S)}</strong>${note}
        </td>
      </tr>`;
  }).join('');

  const songRows = songs.map(i => `
    <tr style="border-bottom:1px solid #e8e0d4;">
      <td style="padding:10px 16px;font-size:13px;color:#0c6870;font-style:italic;">${esc(i.song.S)}</td>
      <td style="padding:10px 16px;font-size:12px;color:#5a6a7a;">${esc(i.name.S)}</td>
    </tr>`).join('');

  const section = (title, content) => `
    <div style="margin-bottom:28px;">
      <div style="border-top:2px solid #c89020;padding-top:12px;margin-bottom:12px;">
        <span style="font-size:10px;font-weight:500;letter-spacing:0.2em;text-transform:uppercase;color:#c89020;">${title}</span>
      </div>${content}
    </div>`;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e2d8cc;">
  <div style="background:#0c6870;padding:32px 40px;text-align:center;">
    <div style="font-size:10px;font-weight:500;letter-spacing:0.3em;text-transform:uppercase;color:#c89020;margin-bottom:8px;">Weekly Digest</div>
    <div style="font-family:Georgia,serif;font-size:28px;font-weight:300;color:#ffffff;line-height:1.2;">Abbie &amp; Asante</div>
    <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:6px;letter-spacing:0.1em;">September 15, 2026</div>
  </div>
  <div style="background:#faf6f0;border-bottom:1px solid #e2d8cc;padding:24px 40px;">
    <table style="width:100%;border-collapse:collapse;"><tr>
      ${stat(items.length,       'New This Week',      '#0c6870')}
      ${stat(attending.length,   'Attending',          '#0c6870')}
      ${stat(totalGuests,        'Guests This Week',   '#c4601a')}
      ${stat(allTimeGuests,      'Total Guests So Far','#c4601a')}
      ${stat(notAttending.length,'Declined',           '#888888')}
    </tr></table>
  </div>
  <div style="padding:32px 40px;">
    ${attending.length > 0 ? section(`Attending (${attending.length})`, `
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="border-bottom:1px solid #e2d8cc;">
          <th style="text-align:center;padding:8px 16px;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#5a6a7a;font-weight:500;">#</th>
          <th style="text-align:left;padding:8px 16px;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#5a6a7a;font-weight:500;">Name</th>
          <th style="text-align:center;padding:8px 16px;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#5a6a7a;font-weight:500;">Guests</th>
        </tr></thead>
        <tbody>${attendingRows}</tbody>
      </table>`) : ''}
    ${notAttending.length > 0 ? section(`Not Attending (${notAttending.length})`, `
      <table style="width:100%;border-collapse:collapse;"><tbody>${declinedRows}</tbody></table>`) : ''}
    ${songs.length > 0 ? section(`Song Requests (${songs.length})`, `
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr style="border-bottom:1px solid #e2d8cc;">
          <th style="text-align:left;padding:8px 16px;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#5a6a7a;font-weight:500;">Song</th>
          <th style="text-align:left;padding:8px 16px;font-size:10px;letter-spacing:0.1em;text-transform:uppercase;color:#5a6a7a;font-weight:500;">Requested By</th>
        </tr></thead>
        <tbody>${songRows}</tbody>
      </table>`) : ''}
  </div>
  <div style="background:#faf6f0;border-top:1px solid #e2d8cc;padding:20px 40px;text-align:center;">
    <div style="font-size:11px;color:#5a6a7a;">Afinitie Wedding &mdash; September 15, 2026</div>
  </div>
</div>
</body></html>`;
}

exports.handler = async () => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // This week's RSVPs
  let items = [];
  try {
    const result = await dynamo.send(new ScanCommand({
      TableName:        TABLE_NAME,
      FilterExpression: '#ts >= :since',
      ExpressionAttributeNames:  { '#ts': 'timestamp' },
      ExpressionAttributeValues: { ':since': { S: since } },
    }));
    items = result.Items || [];
  } catch (err) {
    console.error('DynamoDB scan error:', err);
    return;
  }

  if (items.length === 0) {
    console.log('No new RSVPs this week — skipping email.');
    return;
  }

  // All-time total guest count
  let allTimeGuests = 0;
  try {
    const allResult = await dynamo.send(new ScanCommand({ TableName: TABLE_NAME }));
    const allAttending = (allResult.Items || []).filter(i => i.attending?.S === 'yes');
    allTimeGuests = allAttending.reduce((s, i) => s + parseInt(i.guests?.S || '1', 10), 0);
  } catch (err) {
    console.error('All-time scan error:', err);
  }

  const subject  = `Weekly RSVP Update — ${items.length} new response${items.length !== 1 ? 's' : ''}`;
  const htmlBody = buildEmail(items, allTimeGuests);

  try {
    await ses.send(new SendEmailCommand({
      Source:      FROM_EMAIL,
      Destination: { ToAddresses: [TO_EMAIL] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: htmlBody,  Charset: 'UTF-8' },
          Text: { Data: `${subject}\n\nOpen in an HTML-capable email client to view this digest.`, Charset: 'UTF-8' },
        },
      },
    }));
    console.log('HTML digest sent via SES.');
  } catch (err) {
    console.error('SES send error:', err);
  }
};
