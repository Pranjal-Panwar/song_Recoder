

let cachedAuth = { at: 0 };

async function b2Auth(env) {
  if (cachedAuth.at > Date.now() - 6 * 3600e3) return cachedAuth;
  const basic = btoa(`${env.B2_KEY_ID}:${env.B2_APP_KEY}`);
  const r = await fetch('https://api.backblazeb2.com/b2api/v3/b2_authorize_account',
    { headers: { Authorization: 'Basic ' + basic } });
  if (!r.ok) throw new Error('b2 auth failed: ' + await r.text());
  const j = await r.json();
  const storage = j.apiInfo?.storageApi || j;
  cachedAuth = {
    at: Date.now(),
    token: j.authorizationToken,
    api: storage.apiUrl,
    dl: storage.downloadUrl
  };
  return cachedAuth;
}

async function upload(req, env) {
  const a = await b2Auth(env);
  const name = decodeURIComponent(req.headers.get('X-File-Name') || 'take.webm');
  const bytes = await req.arrayBuffer();

  const g = await fetch(`${a.api}/b2api/v3/b2_get_upload_url`, {
    method: 'POST',
    headers: { Authorization: a.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucketId: env.B2_BUCKET_ID })
  });
  if (!g.ok) throw new Error(await g.text());
  const { uploadUrl, authorizationToken } = await g.json();

  const u = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: authorizationToken,
      'X-Bz-File-Name': encodeURIComponent(name),
      'Content-Type': req.headers.get('Content-Type') || 'audio/webm',
      'Content-Length': String(bytes.byteLength),
      'X-Bz-Content-Sha1': 'do_not_verify'
    },
    body: bytes
  });
  if (!u.ok) throw new Error(await u.text());
  const f = await u.json();
  return { fileName: f.fileName, fileId: f.fileId, size: f.contentLength };
}

async function list(env) {
  const a = await b2Auth(env);
  const r = await fetch(`${a.api}/b2api/v3/b2_list_file_names`, {
    method: 'POST',
    headers: { Authorization: a.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ bucketId: env.B2_BUCKET_ID, maxFileCount: 500 })
  });
  if (!r.ok) throw new Error(await r.text());
  const { files } = await r.json();
  return {
    files: (files || [])
      .filter(f => f.action === 'upload')
      .map(({ fileName, fileId, contentLength, uploadTimestamp, contentType }) =>
        ({ fileName, fileId, contentLength, uploadTimestamp, contentType }))
  };
}

async function stream(name, req, env, cors) {
  const a = await b2Auth(env);
  const head = { Authorization: a.token };
  const range = req.headers.get('Range');
  if (range) head.Range = range;                  // so she can drag through a take
  const r = await fetch(
    `${a.dl}/file/${env.B2_BUCKET_NAME}/${encodeURIComponent(name)}`, { headers: head });
  const out = new Headers(cors);
  for (const h of ['Content-Type', 'Content-Length', 'Content-Range', 'Accept-Ranges']) {
    const v = r.headers.get(h); if (v) out.set(h, v);
  }
  out.set('Cache-Control', 'private, max-age=3600');
  return new Response(r.body, { status: r.status, headers: out });
}

async function remove(req, env) {
  const a = await b2Auth(env);
  const { fileName, fileId } = await req.json();
  const r = await fetch(`${a.api}/b2api/v3/b2_delete_file_version`, {
    method: 'POST',
    headers: { Authorization: a.token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fileName, fileId })
  });
  if (!r.ok) throw new Error(await r.text());
  return { deleted: true };
}

export default {
  async fetch(req, env) {
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Content-Type, X-Studio-Key, X-File-Name',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin'
    };
    const json = (o, s = 200) =>
      new Response(JSON.stringify(o), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(req.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';

    if (req.headers.get('X-Studio-Key') !== env.STUDIO_KEY) return json({ error: 'not allowed' }, 401);

    try {
      if (path === '/upload' && req.method === 'POST') return json(await upload(req, env));
      if (path === '/list') return json(await list(env));
      if (path === '/file') {
        const name = url.searchParams.get('name');
        if (!name) return json({ error: 'name missing' }, 400);
        return await stream(name, req, env, cors);
      }
      if (path === '/delete' && req.method === 'POST') return json(await remove(req, env));
      return json({ error: 'no such route' }, 404);
    } catch (e) {
      return json({ error: String(e.message || e) }, 500);
    }
  }
};
