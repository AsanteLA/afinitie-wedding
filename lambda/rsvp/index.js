/* ============================================================
   AFINITIE WEDDING — RSVP LAMBDA FUNCTION

   POST /rsvp  — Submit a new RSVP (public)
   GET  /rsvp  — Fetch all RSVPs (admin key required)

   AWS Services used:
   - API Gateway (trigger)
   - Lambda (this function)
   - DynamoDB (stores RSVPs)
   ============================================================ */

const { DynamoDBClient, PutItemCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const { randomUUID } = require('crypto');

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });

const TABLE_NAME  = process.env.RSVP_TABLE  || 'afinitie-rsvps';
const ADMIN_KEY   = process.env.ADMIN_KEY   || 'afinitie-admin-2026'; // set in Lambda env vars

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-admin-key',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

exports.handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method || 'POST';

  // CORS preflight
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  // ── GET: return all RSVPs (admin only) ──────────────────────────
  if (method === 'GET') {
    const key = event.headers?.['x-admin-key'] || event.queryStringParameters?.key;
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

      // Sort newest first
      items.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      return { statusCode: 200, headers: CORS, body: JSON.stringify({ rsvps: items }) };
    } catch (err) {
      console.error('DynamoDB scan error:', err);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to fetch RSVPs' }) };
    }
  }

  // ── POST: save new RSVP ─────────────────────────────────────────
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { name, email, attending, guests, dietary, song, message, timestamp } = body;

  if (!name || !email || !attending) {
    return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Missing required fields' }) };
  }

  const id = randomUUID();
  const ts = timestamp || new Date().toISOString();

  try {
    await dynamo.send(new PutItemCommand({
      TableName: TABLE_NAME,
      Item: {
        id:        { S: id },
        name:      { S: name },
        email:     { S: email },
        attending: { S: attending },
        guests:    { S: guests   || '0' },
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

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({ success: true, id }),
  };
};
