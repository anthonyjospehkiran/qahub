#!/usr/bin/env node
/**
 * QAHub Azure AI Search RAG MCP server.
 *
 * Disabled by default in mcp-config.json. Enable after creating an Azure AI
 * Search index over SOPs, MTRs, NCRs/MRBs, customer specs, or test assets.
 *
 * Required env:
 *   AZURE_SEARCH_ENDPOINT  https://<service>.search.windows.net
 *   AZURE_SEARCH_INDEX     index name
 *   AZURE_SEARCH_KEY       query/admin key
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const ENDPOINT = (process.env.AZURE_SEARCH_ENDPOINT || '').replace(/\/$/, '');
const INDEX = process.env.AZURE_SEARCH_INDEX || '';
const KEY = process.env.AZURE_SEARCH_KEY || '';
const API_VERSION = process.env.AZURE_SEARCH_API_VERSION || '2024-07-01';

const TOOLS = [
  {
    name: 'rag_search',
    description: 'Search indexed Nucor/steel QA corpus documents and return cited snippets for grounding QA review/test generation.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        top: { type: 'integer', minimum: 1, maximum: 10, default: 5 },
        filter: { type: 'string', description: 'Optional OData filter, e.g. docType eq \'MTR\'' },
      },
      required: ['query'],
    },
  },
];

async function ragSearch({ query, top = 5, filter = '' }) {
  if (!ENDPOINT || !INDEX || !KEY) {
    throw new Error('Missing AZURE_SEARCH_ENDPOINT / AZURE_SEARCH_INDEX / AZURE_SEARCH_KEY.');
  }
  const url = `${ENDPOINT}/indexes/${encodeURIComponent(INDEX)}/docs/search?api-version=${API_VERSION}`;
  const body = {
    search: query,
    top: Math.max(1, Math.min(Number(top) || 5, 10)),
    queryType: 'semantic',
    semanticConfiguration: process.env.AZURE_SEARCH_SEMANTIC_CONFIG || undefined,
    captions: 'extractive',
    answers: 'extractive|count-3',
    select: process.env.AZURE_SEARCH_SELECT || undefined,
    filter: filter || undefined,
  };
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': KEY,
    },
    body: JSON.stringify(body),
  });
  const txt = await r.text();
  let data;
  try { data = JSON.parse(txt); } catch { data = { raw: txt }; }
  if (!r.ok) throw new Error(`Azure Search ${r.status}: ${txt.slice(0, 500)}`);

  const value = data.value || [];
  return {
    query,
    count: value.length,
    answers: data['@search.answers'] || [],
    results: value.map((doc) => ({
      score: doc['@search.score'],
      rerankerScore: doc['@search.rerankerScore'],
      captions: doc['@search.captions'] || [],
      title: doc.title || doc.fileName || doc.name || doc.id || null,
      source: doc.source || doc.url || doc.path || null,
      docType: doc.docType || doc.type || null,
      content: doc.content || doc.chunk || doc.text || null,
      id: doc.id || doc.key || null,
    })),
  };
}

const server = new Server({ name: 'qahub-azure-search-rag', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    if (name !== 'rag_search') throw new Error(`Unknown tool: ${name}`);
    const out = await ragSearch(args);
    return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] };
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: String(e.message || e) }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[azure-search-rag-mcp] connected');
