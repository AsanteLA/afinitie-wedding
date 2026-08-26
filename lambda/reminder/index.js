/* ============================================================
   AFINITIE WEDDING — WEEK-BEFORE REMINDER LAMBDA

   Triggered once on Sept 8, 2026 (one week before the wedding).
   Scans DynamoDB for all attending RSVPs with an email and
   sends each guest a warm personalised reminder via SES.

   Environment variables:
     RSVP_TABLE  — DynamoDB table name (default: afinitie-rsvps)
     FROM_EMAIL  — SES verified sender address
   ============================================================ */

const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
const ses    = new SESClient({ region: 'us-east-2' });

const TABLE_NAME = process.env.RSVP_TABLE || 'afinitie-rsvps';
const FROM_EMAIL = process.env.FROM_EMAIL || 'hello@afinitie.com';

const esc = s => (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

function buildReminderEmail(guest) {
  const firstName = (guest.name || 'Friend').split(' ')[0];
  const hasSealing = guest.sealing === 'yes';
  const hasRing    = guest.ring_ceremony === 'yes';
  const hasLunch   = guest.luncheon === 'yes';
  const hasRecep   = guest.reception === 'yes';

  const eventRows = [
    hasSealing ? `<tr style="border-bottom:1px solid #e8e0d4;">
      <td style="padding:10px 0;color:#8a7060;width:160px;">Temple Sealing</td>
      <td style="padding:10px 0;font-weight:500;">12:00 PM · Lindon Utah Temple<div style="font-size:12px;color:#c4601a;margin-top:3px;">Please arrive by 11:30 AM</div></td>
    </tr>` : '',
    hasRing ? `<tr style="border-bottom:1px solid #e8e0d4;">
      <td style="padding:10px 0;color:#8a7060;">Ring Ceremony</td>
      <td style="padding:10px 0;font-weight:500;">3:00 PM</td>
    </tr>` : '',
    hasLunch ? `<tr style="border-bottom:1px solid #e8e0d4;">
      <td style="padding:10px 0;color:#8a7060;">Luncheon</td>
      <td style="padding:10px 0;font-weight:500;">4:00 PM · Walker Farms</td>
    </tr>` : '',
    hasRecep ? `<tr style="border-bottom:1px solid #e8e0d4;">
      <td style="padding:10px 0;color:#8a7060;">Reception</td>
      <td style="padding:10px 0;font-weight:500;">7:00 PM · Walker Farms</td>
    </tr>` : '',
  ].filter(Boolean).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5f0e8;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e2d8cc;">
  <div style="background:#0c6870;padding:32px 40px;text-align:center;">
    <div style="font-size:10px;font-weight:500;letter-spacing:0.3em;text-transform:uppercase;color:#c89020;margin-bottom:8px;">One Week Away</div>
    <div style="font-family:Georgia,serif;font-size:28px;font-weight:300;color:#ffffff;line-height:1.2;">Abbie &amp; Asante</div>
    <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:6px;letter-spacing:0.1em;">September 15, 2026</div>
  </div>
  <div style="padding:32px 40px;">
    <p style="font-size:16px;line-height:1.6;">Hi ${esc(firstName)},</p>
    <p style="font-size:16px;line-height:1.6;color:#5a6a7a;">
      We are one week away and we could not be more excited to celebrate with you! We just wanted to send a quick note to remind you of your plans for the day.
    </p>
    <table style="width:100%;border-collapse:collapse;margin:24px 0;font-size:15px;">
      ${eventRows}
    </table>
    <p style="font-size:15px;line-height:1.6;color:#5a6a7a;">
      Full details, directions, and FAQs are on our website at
      <a href="https://afinitie.com/schedule?go=1&tier=${guest.tier || 'full'}" style="color:#0c6870;">afinitie.com/schedule</a>.
    </p>
    <div style="text-align:center;margin:32px 0;">
      <a href="https://afinitie.com?go=1&tier=${guest.tier || 'full'}" style="display:inline-block;padding:14px 32px;background:#0c6870;color:#fff;text-decoration:none;font-size:12px;letter-spacing:0.15em;text-transform:uppercase;">
        Visit Our Website
      </a>
    </div>
    <p style="font-size:14px;color:#8a7060;text-align:center;margin:0;">
      With so much love,<br>
      <span style="font-family:Georgia,serif;font-size:18px;color:#0c6870;">Abbie &amp; Asante</span>
    </p>
  </div>
  <div style="background:#faf6f0;border-top:1px solid #e2d8cc;padding:20px 40px;text-align:center;">
    <div style="font-size:11px;color:#5a6a7a;">September 15, 2026 · Lindon Utah Temple &amp; Walker Farms</div>
  </div>
</div>
</body></html>`;
}

exports.handler = async () => {
  // Scan all attending RSVPs with an email
  let items = [];
  try {
    let lastKey;
    do {
      const res = await dynamo.send(new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: '#att = :yes',
        ExpressionAttributeNames:  { '#att': 'attending' },
        ExpressionAttributeValues: { ':yes': { S: 'yes' } },
        ExclusiveStartKey: lastKey,
      }));
      items.push(...(res.Items || []).map(i => unmarshall(i)));
      lastKey = res.LastEvaluatedKey;
    } while (lastKey);
  } catch (err) {
    console.error('DynamoDB scan error:', err);
    return;
  }

  const withEmail = items.filter(i => i.email && i.email.trim());
  console.log(`Sending reminders to ${withEmail.length} guests…`);

  let sent = 0, failed = 0;
  for (const guest of withEmail) {
    try {
      await ses.send(new SendEmailCommand({
        Source:      `Abbie & Asante <${FROM_EMAIL}>`,
        Destination: { ToAddresses: [guest.email] },
        Message: {
          Subject: { Data: 'See you next week! — Abbie & Asante, Sept 15', Charset: 'UTF-8' },
          Body: {
            Html: { Data: buildReminderEmail(guest), Charset: 'UTF-8' },
            Text: { Data: `Hi ${(guest.name||'').split(' ')[0]},\n\nWe are one week away and can't wait to celebrate with you!\n\nFull details at https://afinitie.com/schedule?go=1&tier=${guest.tier || 'full'}\n\nWith love,\nAbbie & Asante`, Charset: 'UTF-8' },
          },
        },
      }));
      sent++;
    } catch (err) {
      console.error(`Failed to send to ${guest.email}:`, err.message);
      failed++;
    }
  }

  console.log(`Done. Sent: ${sent}, Failed: ${failed}`);
};
