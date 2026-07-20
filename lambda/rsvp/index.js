/* ============================================================
   AFINITIE WEDDING — RSVP LAMBDA FUNCTION

   POST /rsvp  — Submit a new RSVP (public)
   GET  /rsvp  — Fetch all RSVPs (admin key required)

   AWS Services used:
   - API Gateway (trigger)
   - Lambda (this function)
   - DynamoDB (stores RSVPs)
   - SES (sends confirmation + notification emails)
   ============================================================ */

const { DynamoDBClient, PutItemCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');
const { randomUUID } = require('crypto');

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
const ses    = new SESClient({ region: 'us-east-2' });

const TABLE_NAME  = process.env.RSVP_TABLE  || 'afinitie-rsvps';
const ADMIN_KEY   = process.env.ADMIN_KEY   || 'MindyRoxx!!';
const FROM_EMAIL  = 'hello@afinitie.com';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

/* ── Email helpers ─────────────────────────────────────────── */

async function sendConfirmation(guest) {
  const { name, email, guests, dietary, song, sealing, ring_ceremony, luncheon, reception,
          sealing_count, ring_count, luncheon_count, reception_count } = guest;
  const firstName = name.split(' ')[0];

  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif; max-width:560px; margin:0 auto; color:#2c1810;">
      <div style="text-align:center; padding:40px 0 24px;">
        <p style="font-size:11px; letter-spacing:0.2em; text-transform:uppercase; color:#8a7060; margin:0 0 12px;">Abbie &amp; Asante · September 15, 2026</p>
        <h1 style="font-family:Georgia,serif; font-size:32px; font-weight:300; color:#0c6870; margin:0 0 8px;">We'll see you there! 🤍</h1>
        <div style="width:60px; height:1px; background:#c89020; margin:16px auto;"></div>
      </div>

      <div style="padding:0 32px 32px;">
        <p style="font-size:16px; line-height:1.6;">Hi ${firstName},</p>
        <p style="font-size:16px; line-height:1.6; color:#5a6a7a;">
          Thank you so much for RSVPing — we are so glad you'll be celebrating with us!
          Here's a summary of what we have on file for you:
        </p>

        <table style="width:100%; border-collapse:collapse; margin:24px 0; font-size:15px;">
          ${sealing === 'yes' ? `
          <tr style="border-bottom:1px solid #e8e0d4;">
            <td style="padding:10px 0; color:#8a7060; width:160px;">Temple Sealing</td>
            <td style="padding:10px 0; font-weight:500;">12:00 PM · Lindon Utah Temple <span style="font-weight:400; color:#8a7060;">(${sealing_count || '1'} guest${(sealing_count || '1') !== '1' ? 's' : ''})</span></td>
          </tr>` : ''}
          ${ring_ceremony === 'yes' ? `
          <tr style="border-bottom:1px solid #e8e0d4;">
            <td style="padding:10px 0; color:#8a7060; width:160px;">Ring Ceremony</td>
            <td style="padding:10px 0; font-weight:500;">2:30 PM <span style="font-weight:400; color:#8a7060;">(${ring_count || '1'} guest${(ring_count || '1') !== '1' ? 's' : ''})</span></td>
          </tr>` : ''}
          ${luncheon === 'yes' ? `
          <tr style="border-bottom:1px solid #e8e0d4;">
            <td style="padding:10px 0; color:#8a7060;">Luncheon</td>
            <td style="padding:10px 0; font-weight:500;">4:00 PM · Walker Farms <span style="font-weight:400; color:#8a7060;">(${luncheon_count || '1'} guest${(luncheon_count || '1') !== '1' ? 's' : ''})</span></td>
          </tr>` : ''}
          ${reception === 'yes' ? `
          <tr style="border-bottom:1px solid #e8e0d4;">
            <td style="padding:10px 0; color:#8a7060;">Reception</td>
            <td style="padding:10px 0; font-weight:500;">7:00 PM · Walker Farms <span style="font-weight:400; color:#8a7060;">(${reception_count || '1'} guest${(reception_count || '1') !== '1' ? 's' : ''})</span></td>
          </tr>` : ''}
          ${dietary ? `
          <tr style="border-bottom:1px solid #e8e0d4;">
            <td style="padding:10px 0; color:#8a7060;">Dietary notes</td>
            <td style="padding:10px 0;">${dietary}</td>
          </tr>` : ''}
          ${song ? `
          <tr style="border-bottom:1px solid #e8e0d4;">
            <td style="padding:10px 0; color:#8a7060;">Song request</td>
            <td style="padding:10px 0; font-style:italic;">${song}</td>
          </tr>` : ''}
        </table>

        <p style="font-size:15px; line-height:1.6; color:#5a6a7a;">
          Need to make changes? Just reach out to us at
          <a href="mailto:hello@afinitie.com" style="color:#0c6870;">hello@afinitie.com</a>.
        </p>

        <div style="text-align:center; margin:32px 0;">
          <a href="https://afinitie.com/schedule.html"
             style="display:inline-block; padding:14px 32px; background:#0c6870; color:#fff;
                    text-decoration:none; font-size:12px; letter-spacing:0.15em;
                    text-transform:uppercase; margin-bottom:16px;">
            View the Schedule
          </a>

          <div style="margin-top:16px;">
            <p style="font-size:12px; color:#8a7060; letter-spacing:0.08em; text-transform:uppercase; margin:0 0 12px;">Add to Calendar</p>
            <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=Abbie+%26+Asante%27s+Wedding&dates=20260915T180000Z%2F20260916T030000Z&details=Temple+Sealing+at+noon%2C+Ring+Ceremony+at+2%3A30pm%2C+Luncheon+at+4pm%2C+Reception+at+7pm.+Full+details+at+https%3A%2F%2Fafinitie.com&location=850+E+Center+St%2C+Lindon%2C+UT+84042"
               target="_blank"
               style="display:inline-block; padding:10px 20px; border:1px solid #0c6870; color:#0c6870;
                      text-decoration:none; font-size:11px; letter-spacing:0.12em; text-transform:uppercase;
                      margin:0 6px;">
              Google Calendar
            </a>
            <a href="https://afinitie.com/wedding.ics"
               style="display:inline-block; padding:10px 20px; border:1px solid #0c6870; color:#0c6870;
                      text-decoration:none; font-size:11px; letter-spacing:0.12em; text-transform:uppercase;
                      margin:0 6px;">
              Apple / Outlook
            </a>
          </div>
        </div>

        <p style="font-size:14px; color:#8a7060; text-align:center; margin:0;">
          With love,<br>
          <span style="font-family:Georgia,serif; font-size:18px; color:#0c6870;">Abbie &amp; Asante</span>
        </p>
      </div>

      <div style="border-top:1px solid #e8e0d4; padding:20px 32px; text-align:center;">
        <p style="font-size:11px; color:#b0a090; letter-spacing:0.08em; margin:0;">
          September 15, 2026 · Lindon Utah Temple &amp; Walker Farms
        </p>
      </div>
    </div>
  `;

  const text = `Hi ${firstName},\n\nThank you for RSVPing — we are so glad you'll be celebrating with us!\n\nGuests attending: ${guests}${dietary ? `\nDietary notes: ${dietary}` : ''}${song ? `\nSong request: ${song}` : ''}\n\nNeed to make changes? Reach out at hello@afinitie.com.\n\nWith love,\nAbbie & Asante\n\nSeptember 15, 2026 · Lindon Utah Temple & Walker Farms`;

  await ses.send(new SendEmailCommand({
    Source: `Abbie & Asante <${FROM_EMAIL}>`,
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: 'You\'re on the list! — Abbie & Asante, Sept 15' },
      Body: {
        Html: { Data: html },
        Text: { Data: text },
      },
    },
  }));
}

/* ── Handler ───────────────────────────────────────────────── */

exports.handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method || 'POST';

  // CORS preflight
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  // ── GET: return all RSVPs (admin) or public messages ────────
  if (method === 'GET') {
    const params = event.queryStringParameters || {};

    // Public endpoint — returns only name + message for guestbook display
    if (params.source === 'messages') {
      try {
        const items = [];
        let lastKey;
        do {
          const res = await dynamo.send(new ScanCommand({
            TableName: TABLE_NAME,
            ExclusiveStartKey: lastKey,
          }));
          items.push(...(res.Items || []).map(i => unmarshall(i)));
          lastKey = res.LastEvaluatedKey;
        } while (lastKey);

        const messages = items
          .filter(r => r.message && r.message.trim())
          .map(r => ({ name: r.name, message: r.message, timestamp: r.timestamp }))
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        return { statusCode: 200, headers: CORS, body: JSON.stringify(messages) };
      } catch (err) {
        console.error('DynamoDB scan error:', err);
        return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to fetch messages' }) };
      }
    }

    // Admin endpoint — full RSVP list
    const key = event.headers?.['x-admin-key'] || params.key;
    if (key !== ADMIN_KEY) {
      return { statusCode: 401, headers: CORS, body: JSON.stringify({ error: 'Unauthorized' }) };
    }

    try {
      const items = [];
      let lastKey;
      do {
        const res = await dynamo.send(new ScanCommand({
          TableName: TABLE_NAME,
          ExclusiveStartKey: lastKey,
        }));
        items.push(...(res.Items || []).map(i => unmarshall(i)));
        lastKey = res.LastEvaluatedKey;
      } while (lastKey);

      items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ rsvps: items }) };
    } catch (err) {
      console.error('DynamoDB scan error:', err);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to fetch RSVPs' }) };
    }
  }

  // ── POST: save new RSVP ─────────────────────────────────────
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { name, email, attending, guests, dietary, song, message, timestamp,
          tier, sealing, ring_ceremony, luncheon, reception,
          sealing_count, ring_count, luncheon_count, reception_count } = body;

  if (!name || !email || !attending) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const id = randomUUID();
  const ts = timestamp || new Date().toISOString();

  // Save to DynamoDB
  try {
    await dynamo.send(new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        id:        { S: id },
        name:      { S: name },
        email:     { S: email },
        attending: { S: attending },
        tier:         { S: tier         || 'full' },
        sealing:      { S: sealing      || 'na' },
        ring_ceremony:{ S: ring_ceremony|| 'na' },
        luncheon:     { S: luncheon     || 'na' },
        reception:    { S: reception    || 'na' },
        guests:          { S: guests          || '0' },
        sealing_count:   { S: sealing_count   || '0' },
        ring_count:      { S: ring_count      || '0' },
        luncheon_count:  { S: luncheon_count  || '0' },
        reception_count: { S: reception_count || '0' },
        dietary:   { S: dietary  || '' },
        song:      { S: song     || '' },
        message:   { S: message  || '' },
        timestamp: { S: ts },
      },
    }));
  } catch (err) {
    console.error('DynamoDB error:', err);
    return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to save RSVP' }) };
  }

  // Send confirmation email to guest (non-blocking — don't fail the RSVP if email fails)
  if (attending === 'yes') {
    const [result] = await Promise.allSettled([sendConfirmation({
      name, email, guests, dietary, song,
      sealing, ring_ceremony, luncheon, reception,
      sealing_count, ring_count, luncheon_count, reception_count,
    })]);
    if (result.status === 'rejected') {
      console.error('SES confirmation failed:', JSON.stringify(result.reason));
    } else {
      console.log('SES confirmation sent to:', email);
    }
  }

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ success: true, id }),
  };
};
