/* ============================================================
   AFINITIE WEDDING — RSVP LAMBDA FUNCTION

   Receives RSVP form data and saves to DynamoDB.
   No email on submission — a separate weekly digest Lambda
   will summarize all RSVPs and send one email per week.

   AWS Services used:
   - API Gateway (trigger)
   - Lambda (this function)
   - DynamoDB (stores RSVPs)
   ============================================================ */

const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');
const { randomUUID }                     = require('crypto');

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });

const TABLE_NAME = process.env.RSVP_TABLE || 'afinitie-rsvps';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

exports.handler = async (event) => {

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

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
