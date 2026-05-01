/**
 * QA Intelligence Hub — Backend Proxy Server
 *
 * USE CASE: Team/shared deployments where you don't want the Anthropic API key
 *           visible in the browser. This server:
 *           1. Serves the built React app (dist/)
 *           2. Proxies /api/claude  → Anthropic API  (key stays on server)
 *           3. Proxies /api/ado     → Azure DevOps   (bypasses browser CORS completely)
 *
 * SETUP:
 *   npm install
 *   cp .env.example .env   # add ANTHROPIC_KEY
 *   npm run build          # build the React app
 *   npm run server         # start on PORT (default 3001)
 */

import express from 'express';
import cors    from 'cors';
import fetch   from 'node-fetch';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createHash, randomBytes } from 'crypto';
import 'dotenv/config';

const __dir = dirname(fileURLToPath(import.meta.url));
const app   = express();
const PORT  = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// ── Per-browser session store (in-memory) ────────────────────────────────────
// Each browser gets its own session cookie so each team member signs in with
// their own GitHub Copilot account and uses their own subscription.
const SESSIONS = new Map();

function getSession(req, res) {
  const cookieHeader = req.headers.cookie || '';
  let sid = (cookieHeader.match(/(?:^|;\s*)qahub-sid=([^;]+)/) || [])[1] || '';
  if (!sid || !SESSIONS.has(sid)) {
    sid = randomBytes(24).toString('hex');
    SESSIONS.set(sid, {
      githubToken: '', copilotToken: '', copilotTokenExp: 0,
      lastDeviceCode: '', lastUserCode: '', lastDeviceExp: 0,
      adoAccessToken: '', adoRefreshToken: '', adoTokenExp: 0,
      adoUser: null, adoAuthState: '', adoPkceVerifier: '', adoOrg: '',
    });
    res.setHeader('Set-Cookie', `qahub-sid=${sid}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${60*60*24*30}`);
  }
  return SESSIONS.get(sid);
}

function absoluteUrl(req, path) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}${path}`;
}

function base64Url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeJwtPayload(token) {
  try {
    const part = String(token || '').split('.')[1];
    if (!part) return null;
    return JSON.parse(Buffer.from(part.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

function cleanEnvValue(value) {
  return String(value || '').trim().replace(/^['"]|['"]$/g, '');
}

function pickQueryOrRaw(value, key) {
  const raw = cleanEnvValue(value);
  if (!raw) return '';
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      return cleanEnvValue(u.searchParams.get(key) || raw);
    }
    if (raw.includes('=') || raw.includes('&')) {
      const params = new URLSearchParams(raw.replace(/^\?/, ''));
      return cleanEnvValue(params.get(key) || raw);
    }
  } catch {}
  return raw;
}

function cleanTenant(value) {
  const raw = cleanEnvValue(value);
  if (!raw) return 'organizations';
  try {
    if (/^https?:\/\//i.test(raw)) {
      const u = new URL(raw);
      const part = u.pathname.split('/').filter(Boolean)[0];
      return part || 'organizations';
    }
  } catch {}
  return raw.replace(/^\/+|\/+$/g, '').split('/')[0] || 'organizations';
}

function adoAuthConfig(req) {
  const tenant = cleanTenant(process.env.ADO_AUTH_TENANT_ID || process.env.AZURE_TENANT_ID || 'organizations');
  const clientId = pickQueryOrRaw(process.env.ADO_AUTH_CLIENT_ID || process.env.AZURE_CLIENT_ID || '', 'client_id');
  const clientSecret = pickQueryOrRaw(process.env.ADO_AUTH_CLIENT_SECRET || process.env.AZURE_CLIENT_SECRET || '', 'client_secret');
  const configuredRedirect = cleanEnvValue(process.env.ADO_AUTH_REDIRECT_URI);
  const redirectUri = configuredRedirect || absoluteUrl(req, '/api/ado-auth/callback');
  return { tenant, clientId, clientSecret, redirectUri };
}

function adoAuthScope() {
  return cleanEnvValue(process.env.ADO_AUTH_SCOPE || 'openid profile email offline_access 499b84ac-1321-427f-aa17-267ca6975798/.default');
}

async function exchangeAdoToken(req, params) {
  const { tenant, clientId, clientSecret, redirectUri } = adoAuthConfig(req);
  if (!clientId) throw new Error('ADO_AUTH_CLIENT_ID is not configured on the server.');
  const body = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: adoAuthScope(),
    ...params,
  });
  if (clientSecret) body.set('client_secret', clientSecret);
  const r = await fetch(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error_description || data.error || `Microsoft token exchange failed (${r.status}).`);
  return data;
}

async function ensureAdoToken(req, session) {
  if (session.adoAccessToken && Date.now() < session.adoTokenExp - 120_000) return true;
  if (!session.adoRefreshToken) return false;
  try {
    const tok = await exchangeAdoToken(req, {
      grant_type: 'refresh_token',
      refresh_token: session.adoRefreshToken,
    });
    session.adoAccessToken = tok.access_token || '';
    session.adoRefreshToken = tok.refresh_token || session.adoRefreshToken;
    session.adoTokenExp = Date.now() + ((tok.expires_in || 3600) * 1000);
    return !!session.adoAccessToken;
  } catch (e) {
    console.warn('[ado-auth] refresh failed:', e.message);
    session.adoAccessToken = '';
    session.adoTokenExp = 0;
    return false;
  }
}

// ── 1. Proxy → Anthropic API ──────────────────────────────────────────────────
// Frontend calls POST /api/claude with the same body as the Anthropic messages API.
// The server adds the secret API key and forwards the request.
app.post('/api/claude', async (req, res) => {
  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       process.env.ANTHROPIC_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(req.body),
    });
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: { message: `Proxy error: ${err.message}` } });
  }
});

// ── 1b. GitHub Copilot — OAuth device flow + chat proxy ──────────────────────
// Public GitHub Copilot OAuth client id used by editor integrations
// (same one Copilot.vim and Neovim plugin use). Lets users sign in with their
// own Copilot subscription without registering a custom GitHub App.
const COPILOT_CLIENT_ID = process.env.GITHUB_CLIENT_ID || 'Iv1.b507a08c87ecfe98';

// Start device-flow login. Tokens are stored per-session (per browser).
app.post('/api/copilot/auth/start', async (req, res) => {
  const session = getSession(req, res);
  try {
    const r = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'qahub-copilot' },
      body: JSON.stringify({ client_id: COPILOT_CLIENT_ID, scope: 'read:user' }),
    });
    const d = await r.json();
    if (d.error) return res.status(400).json(d);
    session.lastDeviceCode = d.device_code || '';
    session.lastUserCode = d.user_code || '';
    session.lastDeviceExp = Date.now() + ((d.expires_in||900)*1000);
    res.json(d);
  } catch (err) { res.status(502).json({ error: err.message }); }
});

app.post('/api/copilot/auth/poll', async (req, res) => {
  const session = getSession(req, res);
  const device_code = (req.body && req.body.device_code) || session.lastDeviceCode;
  if (!device_code) return res.status(400).json({ error: 'Missing device_code. Click Sign in again.' });
  try {
    const r = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'qahub-copilot' },
      body: JSON.stringify({ client_id: COPILOT_CLIENT_ID, device_code, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }),
    });
    const d = await r.json();
    if (d.access_token) {
      session.githubToken = d.access_token;
      session.copilotToken = '';
      session.copilotTokenExp = 0;
      const ok = await refreshCopilotToken(session);
      if (!ok.ok) return res.status(400).json({ error: ok.error || 'No Copilot access on this account.' });
      return res.json({ ok: true });
    }
    res.json(d);
  } catch (err) { res.status(502).json({ error: err.message }); }
});

async function refreshCopilotToken(session) {
  if (!session.githubToken) return { ok: false, error: 'Not signed in.' };
  try {
    const ct = await fetch('https://api.github.com/copilot_internal/v2/token', {
      headers: {
        'Authorization': `token ${session.githubToken}`,
        'Accept': 'application/json',
        'User-Agent': 'qahub-copilot',
        'Editor-Version': 'Neovim/0.6.1',
        'Editor-Plugin-Version': 'copilot.vim/1.16.0',
      },
    });
    const tok = await ct.json();
    if (tok.token) {
      session.copilotToken = tok.token;
      session.copilotTokenExp = (tok.expires_at || 0) * 1000;
      return { ok: true };
    }
    return { ok: false, error: tok.message || 'Failed to obtain Copilot token. Account may not have Copilot access.' };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function ensureCopilotToken(session) {
  if (session.copilotToken && Date.now() < session.copilotTokenExp - 60_000) return true;
  const r = await refreshCopilotToken(session); return r.ok;
}

app.get('/api/copilot/auth/status', (req, res) => {
  const session = getSession(req, res);
  res.json({
    authenticated: !!(session.copilotToken || session.githubToken),
    pendingUserCode: (!session.githubToken && Date.now() < session.lastDeviceExp) ? session.lastUserCode : null,
  });
});

// Streaming chat proxy: POST { model, messages, stream } → SSE to client.
app.post('/api/copilot/chat', async (req, res) => {
  const session = getSession(req, res);
  const ok = await ensureCopilotToken(session);
  if (!ok) return res.status(401).json({ error: 'Not authenticated. Open Settings → GitHub Copilot → Sign in.' });
  try {
    const upstream = await fetch('https://api.githubcopilot.com/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.copilotToken}`,
        'Content-Type': 'application/json',
        'Copilot-Integration-Id': 'vscode-chat',
        'Editor-Version': 'vscode/1.93.0',
        'Editor-Plugin-Version': 'copilot-chat/0.20.0',
        'OpenAI-Intent': 'conversation-panel',
        'User-Agent': 'GitHubCopilotChat/0.20.0',
      },
      body: JSON.stringify({ stream: true, ...req.body }),
    });
    if (!upstream.ok) {
      const errTxt = await upstream.text();
      return res.status(upstream.status).type('text/plain').send(errTxt);
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    upstream.body.on('data', chunk => res.write(chunk));
    upstream.body.on('end', () => res.end());
    upstream.body.on('error', e => { try { res.write(`data: {"error":${JSON.stringify(e.message)}}\n\n`); } catch {} res.end(); });
  } catch (err) { res.status(502).json({ error: err.message }); }
});

// List Copilot-available models (best-effort).
app.get('/api/copilot/models', async (req, res) => {
  const session = getSession(req, res);
  const ok = await ensureCopilotToken(session);
  if (!ok) return res.json({ data: [] });
  try {
    const r = await fetch('https://api.githubcopilot.com/models', {
      headers: {
        'Authorization': `Bearer ${session.copilotToken}`,
        'Copilot-Integration-Id': 'vscode-chat',
        'Editor-Version': 'vscode/1.93.0',
      },
    });
    res.status(r.status).json(await r.json());
  } catch (err) { res.status(502).json({ error: err.message }); }
});

// Microsoft Entra sign-in for Azure DevOps. Tokens stay server-side in the
// qahub-sid session; the browser only receives an HttpOnly session cookie.
app.get('/api/ado-auth/status', async (req, res) => {
  const session = getSession(req, res);
  const { clientId, tenant, redirectUri } = adoAuthConfig(req);
  const authenticated = await ensureAdoToken(req, session);
  res.json({
    configured: !!clientId,
    authenticated,
    tenant,
    redirectUri,
    org: session.adoOrg || '',
    user: authenticated ? session.adoUser : null,
  });
});

app.get('/api/ado-auth/config', (req, res) => {
  const { clientId, tenant, redirectUri } = adoAuthConfig(req);
  const scope = adoAuthScope();
  const easyAuthHeaders = Object.keys(req.headers).some(h => h.toLowerCase().startsWith('x-ms-client-'));
  res.json({
    configured: !!clientId,
    tenant,
    redirectUri,
    clientIdSuffix: clientId ? clientId.slice(-6) : '',
    clientIdLooksValidGuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(clientId),
    scopeHasClientId: /\bclient_id\s*=/i.test(scope),
    easyAuthHeaders,
  });
});

app.get('/api/ado-auth/start', (req, res) => {
  const session = getSession(req, res);
  const { tenant, clientId, redirectUri } = adoAuthConfig(req);
  if (!clientId) {
    return res.redirect(`/?adoAuth=missing_config&message=${encodeURIComponent('Microsoft sign-in is not configured on the server. Add ADO_AUTH_CLIENT_ID and ADO_AUTH_TENANT_ID in Azure App Service settings, then restart the app.')}`);
  }
  const verifier = base64Url(randomBytes(48));
  const challenge = base64Url(createHash('sha256').update(verifier).digest());
  const state = base64Url(randomBytes(24));
  session.adoAuthState = state;
  session.adoPkceVerifier = verifier;
  session.adoOrg = String(req.query.org || session.adoOrg || '').trim();

  const authUrl = new URL(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/authorize`);
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_mode', 'query');
  authUrl.searchParams.set('scope', adoAuthScope());
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');
  authUrl.searchParams.set('prompt', 'select_account');
  console.log('[ado-auth] redirect', {
    tenant,
    redirectUri,
    clientIdSuffix: clientId.slice(-6),
    queryKeys: Array.from(authUrl.searchParams.keys()),
  });
  res.redirect(authUrl.toString());
});

app.get('/api/ado-auth/callback', async (req, res) => {
  const session = getSession(req, res);
  try {
    if (req.query.error) throw new Error(req.query.error_description || req.query.error);
    if (!req.query.code) throw new Error('Microsoft did not return an authorization code.');
    if (!session.adoAuthState || req.query.state !== session.adoAuthState) throw new Error('Invalid sign-in state. Please try again.');
    const tok = await exchangeAdoToken(req, {
      grant_type: 'authorization_code',
      code: String(req.query.code),
      code_verifier: session.adoPkceVerifier,
    });
    const id = decodeJwtPayload(tok.id_token) || {};
    session.adoAccessToken = tok.access_token || '';
    session.adoRefreshToken = tok.refresh_token || '';
    session.adoTokenExp = Date.now() + ((tok.expires_in || 3600) * 1000);
    session.adoUser = {
      name: id.name || id.given_name || '',
      email: id.preferred_username || id.email || id.upn || '',
      oid: id.oid || id.sub || '',
      tid: id.tid || '',
    };
    session.adoAuthState = '';
    session.adoPkceVerifier = '';
    res.redirect('/?adoAuth=success');
  } catch (err) {
    console.error('[ado-auth] callback failed:', err.message);
    res.redirect(`/?adoAuth=error&message=${encodeURIComponent(err.message)}`);
  }
});

app.post('/api/ado-auth/logout', (req, res) => {
  const session = getSession(req, res);
  session.adoAccessToken = '';
  session.adoRefreshToken = '';
  session.adoTokenExp = 0;
  session.adoUser = null;
  session.adoOrg = '';
  res.json({ ok: true });
});

// ── 2. Proxy → Azure DevOps (eliminates CORS entirely) ───────────────────────
// Frontend calls /api/ado?url=<encoded_ado_url>. The server re-issues the
// request with the signed-in Microsoft user's Azure DevOps bearer token.
app.all('/api/ado', async (req, res) => {
  const session = getSession(req, res);
  const target = decodeURIComponent(req.query.url || '');
  if (!target.startsWith('https://dev.azure.com/')) {
    return res.status(400).json({ error: 'Only dev.azure.com URLs are allowed.' });
  }
  try {
    const hasHeaderAuth = !!req.headers.authorization;
    const hasSessionAuth = await ensureAdoToken(req, session);
    const authorization = req.headers.authorization || (hasSessionAuth ? `Bearer ${session.adoAccessToken}` : '');
    if (!authorization) {
      return res.status(401).json({ error: 'Not signed in to Microsoft. Click Sign in with Microsoft to access Azure DevOps.' });
    }
    const upstream = await fetch(target, {
      method:  req.method,
      headers: {
        'Authorization': authorization,
        'Content-Type':  'application/json',
        'Accept':        'application/json',
      },
      body: ['POST', 'PUT', 'PATCH'].includes(req.method) ? JSON.stringify(req.body) : undefined,
    });
    const text = await upstream.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        const preview = text.replace(/\s+/g, ' ').slice(0, 240);
        return res.status(upstream.status || 502).json({
          error: upstream.status === 401
            ? (hasHeaderAuth
              ? 'Azure DevOps rejected the provided authorization header.'
              : 'Azure DevOps rejected the Microsoft sign-in token. Confirm this user has access to the organization/project and the app registration has Azure DevOps delegated permissions.')
            : 'Azure DevOps returned non-JSON content.',
          status: upstream.status,
          preview,
        });
      }
    }
    res.status(upstream.status).json(data);
  } catch (err) {
    res.status(502).json({ error: `ADO proxy error: ${err.message}` });
  }
});

// ── 3. MCP host (spawn stdio servers + tool-calling agent loop) ─────────────
import { spawn } from 'child_process';
let MCP_SDK = null;
const mcpClients = new Map(); // name -> { client, tools: [{name,description,inputSchema}] }

async function loadMcpSdk() {
  if (MCP_SDK) return MCP_SDK;
  try {
    const ClientMod    = await import('@modelcontextprotocol/sdk/client/index.js');
    const StdioMod     = await import('@modelcontextprotocol/sdk/client/stdio.js');
    MCP_SDK = { Client: ClientMod.Client, StdioClientTransport: StdioMod.StdioClientTransport };
  } catch (e) {
    console.warn('[mcp] SDK not installed (npm install @modelcontextprotocol/sdk). Agent mode disabled.', e.message);
  }
  return MCP_SDK;
}

async function startMcpServer(name, cfg) {
  const sdk = await loadMcpSdk();
  if (!sdk) return;
  if (cfg.enabled === false) return;
  try {
    const transport = new sdk.StdioClientTransport({
      command: cfg.command,
      args: cfg.args || [],
      env: { ...process.env, ...(cfg.env || {}) },
      stderr: 'pipe',
    });
    const client = new sdk.Client({ name: `qahub-${name}`, version: '1.0.0' }, { capabilities: {} });
    await client.connect(transport);
    const list = await client.listTools();
    mcpClients.set(name, { client, tools: list.tools || [] });
    console.log(`[mcp] ${name}: ${(list.tools || []).length} tools`);
  } catch (e) {
    console.warn(`[mcp] failed to start "${name}": ${e.message}`);
  }
}

async function startAllMcp() {
  let cfg = { servers: {} };
  try { cfg = JSON.parse(readFileSync(join(__dir, 'mcp-config.json'), 'utf8')); }
  catch { console.log('[mcp] no mcp-config.json — skipping'); return; }
  for (const [name, sc] of Object.entries(cfg.servers || {})) await startMcpServer(name, sc);
}

function allToolsAsOpenAI() {
  const out = [];
  for (const [server, { tools }] of mcpClients) {
    for (const t of tools) {
      out.push({
        type: 'function',
        function: {
          name: `${server}__${t.name}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 63),
          description: (t.description || '').slice(0, 1000),
          parameters: t.inputSchema || { type: 'object', properties: {} },
        },
      });
    }
  }
  return out;
}

async function callMcpTool(qualifiedName, args) {
  const idx = qualifiedName.indexOf('__');
  if (idx < 0) throw new Error(`bad tool name: ${qualifiedName}`);
  const server = qualifiedName.slice(0, idx);
  const tool = qualifiedName.slice(idx + 2);
  const entry = mcpClients.get(server);
  if (!entry) throw new Error(`unknown MCP server: ${server}`);
  // Resolve original (un-sanitized) tool name
  const real = entry.tools.find(t => t.name === tool) || entry.tools.find(t => t.name.replace(/[^a-zA-Z0-9_-]/g, '_') === tool);
  if (!real) throw new Error(`tool not found in ${server}: ${tool}`);
  const r = await entry.client.callTool({ name: real.name, arguments: args || {} });
  const text = (r.content || []).map(c => c.text || JSON.stringify(c)).join('\n');
  if (r.isError) throw new Error(text || 'tool error');
  return text;
}

app.get('/api/mcp/tools', (_req, res) => {
  const groups = {};
  for (const [name, { tools }] of mcpClients) groups[name] = tools.map(t => ({ name: t.name, description: t.description }));
  res.json({ servers: groups, total: allToolsAsOpenAI().length });
});

app.post('/api/mcp/call', async (req, res) => {
  try { const out = await callMcpTool(req.body.name, req.body.arguments || {}); res.json({ ok: true, content: out }); }
  catch (e) { res.status(400).json({ ok: false, error: e.message }); }
});

// Agent loop: model + MCP tools. Streams JSON events as NDJSON:
//   {"type":"tool_call","name":"...","args":{...}}
//   {"type":"tool_result","name":"...","content":"..."}
//   {"type":"delta","text":"..."}      // final assistant text deltas
//   {"type":"done"}  | {"type":"error","error":"..."}
app.post('/api/agent/chat', async (req, res) => {
  const session = getSession(req, res);
  const ok = await ensureCopilotToken(session);
  if (!ok) { res.status(401).json({ error: 'Not authenticated. Sign in to GitHub Copilot in Settings.' }); return; }
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Cache-Control', 'no-cache');
  const send = (obj) => { try { res.write(JSON.stringify(obj) + '\n'); } catch {} };

  const tools = allToolsAsOpenAI();
  const messages = req.body.messages || [];
  if (req.body.system) messages.unshift({ role: 'system', content: req.body.system });
  const model = req.body.model || 'gpt-4o';
  const maxIter = 8;

  try {
    for (let i = 0; i < maxIter; i++) {
      const r = await fetch('https://api.githubcopilot.com/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.copilotToken}`,
          'Content-Type': 'application/json',
          'Copilot-Integration-Id': 'vscode-chat',
          'Editor-Version': 'vscode/1.93.0',
          'Editor-Plugin-Version': 'copilot-chat/0.20.0',
          'OpenAI-Intent': 'conversation-panel',
          'User-Agent': 'GitHubCopilotChat/0.20.0',
        },
        body: JSON.stringify({ model, stream: false, messages, tools, tool_choice: 'auto', max_tokens: 1500 }),
      });
      if (!r.ok) { send({ type: 'error', error: `Copilot ${r.status}: ${(await r.text()).slice(0, 400)}` }); res.end(); return; }
      const data = await r.json();
      const msg = data.choices?.[0]?.message;
      if (!msg) { send({ type: 'error', error: 'empty response' }); res.end(); return; }
      messages.push(msg);

      const calls = msg.tool_calls || [];
      if (calls.length === 0) {
        // Final text
        if (msg.content) send({ type: 'delta', text: msg.content });
        send({ type: 'done' });
        res.end();
        return;
      }
      // Execute each tool call sequentially
      for (const c of calls) {
        const fn = c.function?.name || '';
        let args = {};
        try { args = c.function?.arguments ? JSON.parse(c.function.arguments) : {}; } catch {}
        send({ type: 'tool_call', name: fn, args });
        let content;
        try { content = await callMcpTool(fn, args); }
        catch (e) { content = `ERROR: ${e.message}`; }
        send({ type: 'tool_result', name: fn, content: content.slice(0, 8000) });
        messages.push({ role: 'tool', tool_call_id: c.id, name: fn, content: content.slice(0, 8000) });
      }
    }
    send({ type: 'error', error: `Stopped after ${maxIter} iterations.` });
    res.end();
  } catch (err) {
    send({ type: 'error', error: err.message });
    res.end();
  }
});

startAllMcp().catch(e => console.warn('[mcp] init failed:', e.message));

// ── 4. Serve built React app ─────────────────────────────────────────────────
const distPath = join(__dir, 'dist');
try {
  readFileSync(join(distPath, 'index.html')); // check dist exists
  app.use(express.static(distPath));
  app.get('*', (req, res) => res.sendFile(join(distPath, 'index.html')));
  console.log('Serving built React app from dist/');
} catch {
  console.log('No dist/ found — run "npm run build" first, or use "npm run dev" for development.');
  app.get('*', (req, res) => res.status(503).send('Run "npm run build" to generate the production app.'));
}

app.listen(PORT, () => {
  console.log(`\n✅ QA Intelligence Hub proxy server running`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Anthropic key: ${process.env.ANTHROPIC_KEY ? '✓ set from .env' : '✗ NOT SET — add ANTHROPIC_KEY to .env'}\n`);
});
