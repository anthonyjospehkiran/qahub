#!/usr/bin/env node
/**
 * QAHub steel-domain MCP server.
 *
 * Deterministic steel QA helpers for demo-grade grounding:
 * - spec_lookup: canonical mechanical/impact limits for common grades
 * - spec_evaluate: pass/fail evaluation with unit normalization
 * - validate_traceability: heat/coil/sample/MTR chain checks
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { evaluateSpec, lookupSpec, validateTraceability } from './steel-domain-core.mjs';

const TOOLS = [
  {
    name: 'spec_lookup',
    description: 'Look up demo steel grade requirements: yield, tensile, elongation, Charpy when known.',
    inputSchema: { type: 'object', properties: { grade: { type: 'string' }, standard: { type: 'string' } }, required: ['grade'] },
  },
  {
    name: 'spec_evaluate',
    description: 'Deterministically evaluate mechanical/Charpy test results against a known steel spec with unit normalization.',
    inputSchema: {
      type: 'object',
      properties: {
        grade: { type: 'string' },
        standard: { type: 'string' },
        results: {
          type: 'object',
          properties: {
            yield: { type: 'number' },
            tensile: { type: 'number' },
            uts: { type: 'number' },
            elongation: { type: 'number' },
            strengthUnit: { type: 'string', enum: ['ksi', 'MPa', 'psi'] },
            charpyEnergy: { type: 'number' },
            impactEnergyUnit: { type: 'string', enum: ['ft-lb', 'J'] },
            charpyTemperature: { type: 'number' },
            temperatureUnit: { type: 'string', enum: ['F', 'C'] },
          },
        },
      },
      required: ['grade', 'results'],
    },
  },
  {
    name: 'validate_traceability',
    description: 'Validate heat -> coil -> sample -> MTR traceability fields for generated test cases or sample data.',
    inputSchema: {
      type: 'object',
      properties: {
        record: {
          type: 'object',
          properties: {
            heatNumber: { type: 'string' },
            coilId: { type: 'string' },
            sampleId: { type: 'string' },
            mtrId: { type: 'string' },
            coilHeatNumber: { type: 'string' },
            sampleHeatNumber: { type: 'string' },
            mtrHeatNumber: { type: 'string' },
            testResults: { type: 'array' },
          },
        },
      },
      required: ['record'],
    },
  },
];

const server = new Server({ name: 'qahub-steel-domain', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    let out;
    if (name === 'spec_lookup') out = lookupSpec(args);
    else if (name === 'spec_evaluate') out = evaluateSpec(args);
    else if (name === 'validate_traceability') out = validateTraceability(args);
    else throw new Error(`Unknown tool: ${name}`);
    return { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] };
  } catch (e) {
    return { isError: true, content: [{ type: 'text', text: String(e.message || e) }] };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[steel-domain-mcp] connected');
