/* ============================================================
   AFINITIE WEDDING — GUESTBOOK LAMBDA FUNCTION

   GET  /guestbook  → returns all approved messages
   POST /guestbook  → saves a new message

   Messages are stored in DynamoDB with an 'approved' flag.
   Set approved = true by default, or false if you want to
   manually approve before messages go public.
   ============================================================ */

const { DynamoDBClient, PutItemCommand, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { randomUUID } = require('crypto');

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });

// ---- CONFIGURE ----
const TABLE_NAME     = process.env.GUESTBOOK_TABLE || 'afinitie-guestbook';
const AUTO_APPROVE   = true; // set false to manually approve messages first
// -------------------

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

exports.handler = async (event) => {

  const method = event.httpMethod || (event.requestContext && event.requestContext.http && event.requestContext.http.method);

  // CORS preflight
  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: CORS, body: '' };
  }

  // GET — fetch all approved messages
  if (method === 'GET') {
    try {
      const result = await dynamo.send(new ScanCommand({
        TableName:        TABLE_NAME,
        FilterExpression: 'approved = :a',
        ExpressionAttributeValues: { ':a': { BOOL: true } },
      }));

      const messages = (result.Items || [])
        .map(item => ({
          id:        item.id.S,
          name:      item.name.S,
          message:   item.message.S,
          timestamp: item.timestamp.S,
        }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // newest first

      return {
        statusCode: 200,
        headers: CORS,
        body: JSON.stringify(messages),
      };
    } catch (err) {
      console.error('DynamoDB scan error:', err);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to fetch messages' }) };
    }
  }

  // POST — save a new message
  if (method === 'POST') {
    let body;
    try {
      body = JSON.parse(event.body || '{}');
    } catch {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { name, message } = body;

    if (!name || !message) {
      return { statusCode: 400, headers: CORS, body: JSON.stringify({ error: 'Name and message are required' }) };
    }

    const id = randomUUID();
    const ts = new Date().toISOString();

    try {
      await dynamo.send(new PutItemCommand({
        TableName: TABLE_NAME,
        Item: {
          id:        { S: id },
          name:      { S: name.trim() },
          message:   { S: message.trim() },
          timestamp: { S: ts },
          approved:  { BOOL: AUTO_APPROVE },
        },
      }));
    } catch (err) {
      console.error('DynamoDB put error:', err);
      return { statusCode: 500, headers: CORS, body: JSON.stringify({ error: 'Failed to save message' }) };
    }

    return {
      statusCode: 201,
      headers: CORS,
      body: JSON.stringify({ success: true, id, approved: AUTO_APPROVE }),
    };
  }

  return { statusCode: 405, headers: CORS, body: JSON.stringify({ error: 'Method not allowed' }) };
};
