/* ============================================================
   AFINITIE WEDDING — WEEKLY RSVP DIGEST LAMBDA

   Triggered every Sunday at 8am UTC by EventBridge.
   Scans DynamoDB for RSVPs submitted in the past 7 days
   and publishes a summary to an SNS topic which emails you.

   AWS Services used:
   - EventBridge (trigger — scheduled, free)
   - Lambda (this function — free tier)
   - DynamoDB (reads RSVPs — free tier)
   - SNS (sends 1 email/week — free tier: 1,000 emails/month)
   ============================================================ */

const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { SNSClient, PublishCommand }   = require('@aws-sdk/client-sns');

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
const sns    = new SNSClient({ region: process.env.AWS_REGION });

const TABLE_NAME = process.env.RSVP_TABLE   || 'afinitie-rsvps';
const SNS_TOPIC  = process.env.SNS_TOPIC_ARN;  // set in Lambda env vars

exports.handler = async () => {

  // Scan all RSVPs from the past 7 days
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

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

  // Build summary
  const attending    = items.filter(i => i.attending.S === 'yes');
  const notAttending = items.filter(i => i.attending.S === 'no');
  const totalGuests  = attending.reduce((sum, i) => sum + parseInt(i.guests.S || '1', 10), 0);
  const songs        = attending.filter(i => i.song.S).map(i => `  • ${i.song.S} (${i.name.S})`);

  const lines = [
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    `  Afinitie — Weekly RSVP Digest`,
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `New RSVPs this week: ${items.length}`,
    `  ✓ Attending:     ${attending.length} (${totalGuests} total guests)`,
    `  ✗ Not attending: ${notAttending.length}`,
    ``,
  ];

  if (attending.length > 0) {
    lines.push('ATTENDING:');
    attending.forEach(i => {
      lines.push(`  • ${i.name.S} (${i.guests.S} guest${i.guests.S !== '1' ? 's' : ''})`);
      if (i.dietary.S) lines.push(`    Dietary: ${i.dietary.S}`);
      if (i.message.S) lines.push(`    "${i.message.S}"`);
    });
    lines.push('');
  }

  if (notAttending.length > 0) {
    lines.push('NOT ATTENDING:');
    notAttending.forEach(i => {
      lines.push(`  • ${i.name.S}`);
      if (i.message.S) lines.push(`    "${i.message.S}"`);
    });
    lines.push('');
  }

  if (songs.length > 0) {
    lines.push('SONG REQUESTS:');
    lines.push(...songs);
    lines.push('');
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`September 23, 2026 — Asante & Abbie`);

  const body = lines.join('\n');

  // Publish to SNS
  try {
    await sns.send(new PublishCommand({
      TopicArn: SNS_TOPIC,
      Subject:  `Weekly RSVP Update — ${items.length} new response${items.length !== 1 ? 's' : ''}`,
      Message:  body,
    }));
    console.log('Digest sent successfully.');
  } catch (err) {
    console.error('SNS publish error:', err);
  }
};
