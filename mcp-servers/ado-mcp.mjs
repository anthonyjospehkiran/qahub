#!/usr/bin/env node
/**
 * QAHub Azure DevOps MCP server
 *
 * Exposes ADO operations as MCP tools. Reads creds from env:
 *   ADO_ORG       e.g. https://dev.azure.com/myorg
 *   ADO_PROJECT   e.g. NextGen
 *   ADO_PAT       Personal access token with Work Items: Read & Write
 *
 * Spawned over stdio by server.js (see mcp-config.json).
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const ORG = (process.env.ADO_ORG || '').replace(/\/$/, '');
const PROJECT = process.env.ADO_PROJECT || '';
const PAT = process.env.ADO_PAT || '';

if (!ORG || !PROJECT || !PAT) {
  console.error('[ado-mcp] Missing ADO_ORG / ADO_PROJECT / ADO_PAT — server will return errors.');
}

const auth = 'Basic ' + Buffer.from(':' + PAT).toString('base64');
const base = `${ORG}/${encodeURIComponent(PROJECT)}/_apis`;
const wiqlStr = (v) => `'${String(v ?? '').replace(/'/g, "''")}'`;

async function ado(path, opts = {}) {
  const sep = path.includes('?') ? '&' : '?';
  const url = `${ORG}${path.startsWith('/') ? '' : '/'}${path}${sep}api-version=7.1`;
  const r = await fetch(url, {
    method: opts.method || 'GET',
    headers: {
      'Authorization': auth,
      'Content-Type': opts.contentType || 'application/json',
      'Accept': 'application/json',
    },
    body: opts.body ? (typeof opts.body === 'string' ? opts.body : JSON.stringify(opts.body)) : undefined,
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`ADO ${r.status}: ${text.slice(0, 500)}`);
  try { return JSON.parse(text); } catch { return text; }
}

const TOOLS = [
  {
    name: 'ado_query_wiql',
    description: 'Run a WIQL query against the configured ADO project. Returns matching work item ids and refs.',
    inputSchema: { type: 'object', properties: { wiql: { type: 'string', description: 'WIQL query string, e.g. SELECT [System.Id] FROM WorkItems WHERE [System.WorkItemType]=\"Bug\"' } }, required: ['wiql'] },
  },
  {
    name: 'ado_get_work_items',
    description: 'Get full details (fields + relations) for one or more work item ids.',
    inputSchema: { type: 'object', properties: { ids: { type: 'array', items: { type: 'integer' }, description: 'Work item ids' } }, required: ['ids'] },
  },
  {
    name: 'ado_search_work_items',
    description: 'Search work items by title (substring) and optional type/state. Returns up to 50 ids.',
    inputSchema: { type: 'object', properties: { title: { type: 'string' }, type: { type: 'string' }, state: { type: 'string' } }, required: ['title'] },
  },
  {
    name: 'ado_create_work_item',
    description: 'Create a new work item. type e.g. \"User Story\", \"Test Case\", \"Bug\". fields: { System.Title: \"...\", System.Description: \"...\", Microsoft.VSTS.TCM.Steps: \"...\" } etc.',
    inputSchema: { type: 'object', properties: { type: { type: 'string' }, fields: { type: 'object' } }, required: ['type', 'fields'] },
  },
  {
    name: 'ado_update_work_item',
    description: 'Update fields on an existing work item.',
    inputSchema: { type: 'object', properties: { id: { type: 'integer' }, fields: { type: 'object' } }, required: ['id', 'fields'] },
  },
  {
    name: 'ado_add_comment',
    description: 'Add a comment to a work item.',
    inputSchema: { type: 'object', properties: { id: { type: 'integer' }, text: { type: 'string' } }, required: ['id', 'text'] },
  },
];

const server = new Server({ name: 'qahub-ado', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    let out;
    switch (name) {
      case 'ado_query_wiql':
        out = await ado(`/${encodeURIComponent(PROJECT)}/_apis/wit/wiql`, { method: 'POST', body: { query: args.wiql } });
        break;
      case 'ado_get_work_items': {
        const ids = (args.ids || []).join(',');
        if (!ids) throw new Error('ids is empty');
        out = await ado(`/_apis/wit/workitems?ids=${ids}&$expand=All`);
        break;
      }
      case 'ado_search_work_items': {
        const conds = [`[System.TeamProject]=@project`, `[System.Title] CONTAINS ${wiqlStr(args.title || '')}`];
        if (args.type) conds.push(`[System.WorkItemType]=${wiqlStr(args.type)}`);
        if (args.state) conds.push(`[System.State]=${wiqlStr(args.state)}`);
        const wiql = `SELECT [System.Id],[System.Title],[System.WorkItemType],[System.State] FROM WorkItems WHERE ${conds.join(' AND ')} ORDER BY [System.ChangedDate] DESC`;
        out = await ado(`/${encodeURIComponent(PROJECT)}/_apis/wit/wiql?$top=50`, { method: 'POST', body: { query: wiql } });
        break;
      }
      case 'ado_create_work_item': {
        const ops = Object.entries(args.fields || {}).map(([k, v]) => ({ op: 'add', path: `/fields/${k}`, value: v }));
        out = await ado(`/${encodeURIComponent(PROJECT)}/_apis/wit/workitems/$${encodeURIComponent(args.type)}`, { method: 'POST', contentType: 'application/json-patch+json', body: ops });
        break;
      }
      case 'ado_update_work_item': {
        const ops = Object.entries(args.fields || {}).map(([k, v]) => ({ op: 'add', path: `/fields/${k}`, value: v }));
        out = await ado(`/_apis/wit/workitems/${args.id}`, { method: 'PATCH', contentType: 'application/json-patch+json', body: ops });
        break;
      }
      case 'ado_add_comment':
        out = await ado(`/${encodeURIComponent(PROJECT)}/_apis/wit/workItems/${args.id}/comments?api-version=7.1-preview.4`, { method: 'POST', body: { text: args.text } });
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return { content: [{ type: 'text', text: typeof out === 'string' ? out : JSON.stringify(out, null, 2) }] };
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: String(e.message || e) }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[ado-mcp] connected. project=${PROJECT}`);
