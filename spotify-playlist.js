#!/usr/bin/env node
/**
 * AFINITIE WEDDING — Spotify Playlist Builder
 *
 * Pulls song requests from DynamoDB and creates a Spotify playlist.
 *
 * Setup:
 *   npm install @aws-sdk/client-dynamodb @aws-sdk/util-dynamodb @aws-sdk/client-ssm
 *
 * Run:
 *   node spotify-playlist.js
 *
 * ⚠️  Keep this file private — it contains your Spotify credentials.
 */

const http   = require('http');
const url    = require('url');
const fs     = require('fs');
const path   = require('path');
const { execSync } = require('child_process');

const TOKEN_FILE = path.join(__dirname, '.spotify-token.json');

// ── Config ────────────────────────────────────────────────────────────
const CLIENT_ID     = 'f3695bec6f464b159206c21fa659f114';
const CLIENT_SECRET = '04eec8a15a6742639570a8e04ef84c00';
const REDIRECT_URI  = 'http://127.0.0.1:8888/callback';
const SCOPES        = 'playlist-modify-public playlist-modify-private user-read-email';
const TABLE_NAME    = 'afinitie-rsvps';
const REGION        = 'us-east-2';
const PLAYLIST_NAME = 'Afinitie Wedding — Guest Song Requests';
// ─────────────────────────────────────────────────────────────────────

const { DynamoDBClient, ScanCommand } = require('@aws-sdk/client-dynamodb');
const { unmarshall } = require('@aws-sdk/util-dynamodb');
const { SSMClient, GetParameterCommand, PutParameterCommand } = require('@aws-sdk/client-ssm');

const ssm = new SSMClient({ region: REGION });

async function getSSMParam(name) {
  try {
    const res = await ssm.send(new GetParameterCommand({ Name: name }));
    return res.Parameter.Value;
  } catch (_) { return null; }
}

async function putSSMParam(name, value) {
  await ssm.send(new PutParameterCommand({ Name: name, Value: value, Type: 'String', Overwrite: true }));
}

// ── HTTP helpers (native fetch — Node 18+) ────────────────────────────

async function spotifyAPI(path, method, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`https://api.spotify.com${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, body: data };
}

async function spotifyAuth(params) {
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method:  'POST',
    headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams(params).toString(),
  });
  return res.json();
}

// ── Spotify API calls ─────────────────────────────────────────────────

const getAccessToken  = code          => spotifyAuth({ grant_type: 'authorization_code', code, redirect_uri: REDIRECT_URI });
const refreshToken    = refreshTok    => spotifyAuth({ grant_type: 'refresh_token', refresh_token: refreshTok });
const getMe           = token              => spotifyAPI('/v1/me', 'GET', null, token);
const getMyPlaylists  = token              => spotifyAPI('/v1/me/playlists?limit=50', 'GET', null, token);
const deletePlaylist  = (id, token)        => spotifyAPI(`/v1/playlists/${id}/followers`, 'DELETE', null, token);
const searchTrack     = (query, token)     => spotifyAPI(`/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`, 'GET', null, token);
const createPlaylist  = token              => spotifyAPI('/v1/me/playlists', 'POST', { name: PLAYLIST_NAME, description: 'Song requests from our wedding guests ♡', public: true }, token);
const addTracks       = (id, uris, token)  => spotifyAPI(`/v1/playlists/${id}/items`, 'POST', { uris }, token);

// ── OAuth: open browser + catch callback ──────────────────────────────

function waitForCode() {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const parsed = url.parse(req.url, true);
      if (parsed.pathname === '/callback' && parsed.query.code) {
        res.end(`
          <html><body style="font-family:sans-serif;text-align:center;padding:4rem;background:#faf6f0;">
            <h2 style="color:#1b3a6b;">✓ Authenticated!</h2>
            <p style="color:#5a6a7a;">You can close this tab and go back to your terminal.</p>
          </body></html>
        `);
        server.close();
        resolve(parsed.query.code);
      } else {
        res.end('Waiting for Spotify callback...');
      }
    });

    server.listen(8888, () => {
      const authUrl =
        `https://accounts.spotify.com/authorize` +
        `?client_id=${CLIENT_ID}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&scope=${encodeURIComponent(SCOPES)}` +
        `&show_dialog=true`;

      console.log('\n🔐  Opening Spotify login in your browser...');
      console.log('    If it does not open automatically, paste this URL:\n');
      console.log('   ', authUrl, '\n');

      try {
        const cmd = process.platform === 'darwin' ? 'open'
                  : process.platform === 'win32'  ? 'start'
                  : 'xdg-open';
        execSync(`${cmd} "${authUrl}"`);
      } catch (_) { /* browser open failed — user can paste manually */ }
    });

    server.on('error', reject);
  });
}

// ── DynamoDB: get all song requests ───────────────────────────────────

async function getSongRequests() {
  const client = new DynamoDBClient({ region: REGION });
  const items  = [];
  let lastKey;

  do {
    const cmd = new ScanCommand({
      TableName:        TABLE_NAME,
      FilterExpression: 'attending = :yes AND #s <> :empty',
      ExpressionAttributeNames:  { '#s': 'song' },
      ExpressionAttributeValues: { ':yes': { S: 'yes' }, ':empty': { S: '' } },
      ExclusiveStartKey: lastKey,
    });
    const res = await client.send(cmd);
    items.push(...(res.Items || []).map(i => unmarshall(i)));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  return items
    .map(i => ({ song: i.song, name: i.name }))
    .filter(i => i.song && i.song.trim() !== '');
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🎶  Afinitie Wedding — Spotify Playlist Builder');
  console.log('    ─────────────────────────────────────────────\n');

  // 1. Fetch songs from DynamoDB
  console.log('📦  Fetching song requests from DynamoDB...');
  const requests = await getSongRequests();

  if (requests.length === 0) {
    console.log('    No song requests found yet — RSVPs may still be coming in!');
    return;
  }

  console.log(`    Found ${requests.length} song request(s):\n`);
  requests.forEach((r, i) => console.log(`    ${i + 1}. "${r.song}" — requested by ${r.name}`));

  // 2. Spotify Auth — reuse saved refresh token if available
  let token;
  const saved = fs.existsSync(TOKEN_FILE) ? JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf8')) : null;

  if (saved?.refresh_token) {
    console.log('🔐  Refreshing Spotify token (no browser needed)...');
    const refreshRes = await refreshToken(saved.refresh_token);
    token = refreshRes.access_token;
    if (token) {
      fs.writeFileSync(TOKEN_FILE, JSON.stringify({
        refresh_token: refreshRes.refresh_token || saved.refresh_token,
      }));
      console.log('    ✓ Token refreshed silently\n');
    }
  }

  if (!token) {
    console.log('🔐  First-time login — opening Spotify in your browser...');
    const code   = await waitForCode();
    const tokRes = await getAccessToken(code);
    token = tokRes.access_token;
    if (!token) {
      console.error('\n❌  Failed to get access token:', JSON.stringify(tokRes));
      process.exit(1);
    }
    console.log(`    Granted scopes: ${tokRes.scope}`);
    if (tokRes.refresh_token) {
      fs.writeFileSync(TOKEN_FILE, JSON.stringify({ refresh_token: tokRes.refresh_token }));
      console.log('    ✓ Token saved — future runs won\'t need the browser\n');
    }
  }

  // 3. Get Spotify user ID
  const meRes  = await getMe(token);
  const userId = meRes.body.id;
  console.log(`    Logged in as: ${meRes.body.display_name} (${meRes.body.email}) — id: ${userId}`);

  // 4. Delete previous playlist using shared SSM ID
  const oldPlaylistId = await getSSMParam('/afinitie/spotify/playlist_id');
  if (oldPlaylistId && oldPlaylistId !== 'placeholder') {
    console.log(`🗑   Removing previous playlist...`);
    await deletePlaylist(oldPlaylistId, token);
  }

  // 5. Create fresh playlist
  console.log(`🎵  Creating playlist "${PLAYLIST_NAME}"...`);
  const plRes = await createPlaylist(token);
  if (plRes.status !== 200 && plRes.status !== 201) {
    console.error('\n❌  Failed to create playlist:', JSON.stringify(plRes.body));
    process.exit(1);
  }
  const playlistId  = plRes.body.id;
  const playlistUrl = `https://open.spotify.com/playlist/${playlistId}`;
  await putSSMParam('/afinitie/spotify/playlist_id', playlistId);

  // Small delay to let Spotify provision the new playlist
  await new Promise(r => setTimeout(r, 1500));

  // 6. Search for each song
  console.log('\n🔍  Searching Spotify for each song...\n');
  const trackUris = [];
  const notFound  = [];

  for (const { song, name } of requests) {
    const res   = await searchTrack(song, token);
    const track = res.body?.tracks?.items?.[0];
    if (track) {
      console.log(`    ✓  "${song}" → ${track.name} — ${track.artists[0].name}`);
      trackUris.push(track.uri);
    } else {
      console.log(`    ✗  "${song}" — not found (add manually)`);
      notFound.push({ song, name });
    }
  }

  // 6. Add tracks (Spotify max 100 per request)
  if (trackUris.length > 0) {
    for (let i = 0; i < trackUris.length; i += 100) {
      await addTracks(playlistId, trackUris.slice(i, i + 100), token);
    }
    console.log(`\n✅  Added ${trackUris.length} track(s) to your Spotify playlist!`);
    console.log(`    Open it here → ${playlistUrl}\n`);
  }

  if (notFound.length > 0) {
    console.log(`⚠️   ${notFound.length} song(s) not found on Spotify — add these manually:`);
    notFound.forEach(({ song, name }) => console.log(`    - "${song}" (requested by ${name})`));
    console.log();
  }
}

main().catch(err => {
  console.error('\n❌  Error:', err.message || err);
  process.exit(1);
});
