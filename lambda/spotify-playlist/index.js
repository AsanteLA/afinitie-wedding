/* ============================================================
   AFINITIE WEDDING — SPOTIFY PLAYLIST BUILDER LAMBDA

   Triggered weekly by EventBridge Schedule.
   Pulls song requests from DynamoDB, rebuilds the Spotify
   playlist with the latest guest requests.

   SSM Parameters required:
     /afinitie/spotify/refresh_token  (SecureString)
     /afinitie/spotify/playlist_id    (String, written by this function)
   ============================================================ */

const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall }                   = require('@aws-sdk/util-dynamodb');
const { SSMClient, GetParameterCommand, PutParameterCommand } = require('@aws-sdk/client-ssm');

const dynamo = new DynamoDBClient({ region: process.env.AWS_REGION });
const ssm    = new SSMClient({ region: process.env.AWS_REGION });

const TABLE_NAME    = process.env.RSVP_TABLE    || 'afinitie-rsvps';
const CLIENT_ID     = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const PLAYLIST_NAME = 'Afinitie Wedding — Guest Song Requests';

// ── SSM helpers ────────────────────────────────────────────────────────

async function getParam(name, withDecryption = false) {
  const res = await ssm.send(new GetParameterCommand({ Name: name, WithDecryption: withDecryption }));
  return res.Parameter.Value;
}

async function putParam(name, value, type = 'String') {
  await ssm.send(new PutParameterCommand({ Name: name, Value: value, Type: type, Overwrite: true }));
}

// ── Spotify helpers ────────────────────────────────────────────────────

async function spotifyAPI(path, method, body, token) {
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const res = await fetch(`https://api.spotify.com${path}`, {
    method, headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}


async function refreshSpotifyToken(refreshToken) {
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res  = await fetch('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
  });
  return res.json();
}

// ── DynamoDB ───────────────────────────────────────────────────────────

async function getSongRequests() {
  const items = [];
  let lastKey;
  do {
    const cmd = new ScanCommand({
      TableName:        TABLE_NAME,
      FilterExpression: 'attending = :yes AND #s <> :empty',
      ExpressionAttributeNames:  { '#s': 'song' },
      ExpressionAttributeValues: { ':yes': { S: 'yes' }, ':empty': { S: '' } },
      ExclusiveStartKey: lastKey,
    });
    const res = await dynamo.send(cmd);
    items.push(...(res.Items || []).map(i => unmarshall(i)));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  return items.map(i => ({ song: i.song, name: i.name })).filter(i => i.song?.trim());
}

// ── Main handler ───────────────────────────────────────────────────────

exports.handler = async () => {
  console.log('Starting Spotify playlist rebuild...');

  // 1. Refresh Spotify token
  const savedRefresh = await getParam('/afinitie/spotify/refresh_token', true);
  const tokRes       = await refreshSpotifyToken(savedRefresh);
  const token        = tokRes.access_token;
  if (!token) throw new Error('Failed to refresh Spotify token: ' + JSON.stringify(tokRes));

  // Save rotated refresh token if Spotify issued a new one
  if (tokRes.refresh_token) {
    await putParam('/afinitie/spotify/refresh_token', tokRes.refresh_token, 'SecureString');
  }

  // 2. Get song requests from DynamoDB
  const requests = await getSongRequests();
  console.log(`Found ${requests.length} song request(s)`);
  if (requests.length === 0) {
    console.log('No songs yet — skipping playlist rebuild');
    return { status: 'skipped' };
  }

  // 3. Get or create playlist
  let playlistId;
  try { playlistId = await getParam('/afinitie/spotify/playlist_id'); } catch (_) {}

  if (!playlistId || playlistId === 'placeholder') {
    const plRes = await spotifyAPI('/v1/me/playlists', 'POST', {
      name: PLAYLIST_NAME, description: 'Song requests from our wedding guests ♡', public: true,
    }, token);
    if (plRes.status !== 201) throw new Error('Failed to create playlist: ' + JSON.stringify(plRes.body));
    playlistId = plRes.body.id;
    await putParam('/afinitie/spotify/playlist_id', playlistId);
    console.log(`Created new playlist ${playlistId}`);
    await new Promise(r => setTimeout(r, 1500));
  } else {
    console.log(`Using existing playlist ${playlistId}`);
  }

  // 4. Search for all songs
  const trackUris = [];
  const notFound  = [];
  for (const { song, name } of requests) {
    const res   = await spotifyAPI(`/v1/search?q=${encodeURIComponent(song)}&type=track&limit=1`, 'GET', null, token);
    const track = res.body?.tracks?.items?.[0];
    if (track) {
      console.log(`✓ "${song}" → ${track.name} — ${track.artists[0].name}`);
      trackUris.push(track.uri);
    } else {
      console.log(`✗ "${song}" not found`);
      notFound.push({ song, name });
    }
  }

  // 5. Replace playlist content (PUT first 100, POST the rest)
  if (trackUris.length > 0) {
    await spotifyAPI(`/v1/playlists/${playlistId}/items`, 'PUT', { uris: trackUris.slice(0, 100) }, token);
    for (let i = 100; i < trackUris.length; i += 100) {
      await spotifyAPI(`/v1/playlists/${playlistId}/items`, 'POST', { uris: trackUris.slice(i, i + 100) }, token);
    }
  }

  console.log(`Done — playlist updated with ${trackUris.length} track(s). https://open.spotify.com/playlist/${playlistId}`);
  if (notFound.length) console.log('Not found:', notFound.map(n => n.song).join(', '));

  return { status: 'ok', tracks: trackUris.length, playlistId };
};
