import { useState, useEffect, useRef, useCallback } from "react";

// ─── Theme system: light + dark, swappable at runtime ───────────────────────
// Structural tokens are theme-independent (radius, type/space scale, fonts).
const STRUCT = {
  r:"8px", rLg:"12px", rFull:"999px",
  fs:{ xs:"11px", sm:"12px", md:"13px", lg:"15px", xl:"18px", xxl:"22px", xxxl:"28px" },
  fw:{ regular:400, medium:500, semibold:600, bold:700 },
  lh:{ tight:1.3, snug:1.5, normal:1.65 },
  sp:{ xs:4, sm:6, md:8, lg:12, xl:16, xxl:24, xxxl:32 },
  font:"'Inter','Segoe UI',-apple-system,system-ui,sans-serif",
  fontMono:"'JetBrains Mono','SF Mono',Consolas,monospace",
  fontDisplay:"'Inter','Segoe UI',-apple-system,sans-serif",
};
// Light theme — refined: cooler greys, Nucor cardinal accent.
const LIGHT = {
  ...STRUCT, name:"light",
  bg:"#fafaf9", bgCard:"#ffffff", bgMuted:"#f4f4f5", bgDeep:"#e7e5e4",
  navy:"#0f172a", navyMid:"#1e293b", navyLight:"#334155",
  accent:"#dc2626", accentLight:"#fef2f2",
  border:"#e7e5e4", borderMid:"#d6d3d1",
  text:"#0c0a09", textMuted:"#57534e", textFaint:"#a8a29e",
  green:"#16a34a", greenBg:"#f0fdf4", greenBd:"#86efac",
  amber:"#d97706", amberBg:"#fffbeb", amberBd:"#fde68a",
  red:"#dc2626",   redBg:"#fef2f2",   redBd:"#fca5a5",
  violet:"#7c3aed",violetBg:"#f5f3ff",violetBd:"#c4b5fd",
  blue:"#2563eb",  blueBg:"#eff6ff",  blueBd:"#bfdbfe",
  cyan:"#0891b2",  cyanBg:"#ecfeff",
  sh:"0 1px 3px rgba(0,0,0,0.07)", shMd:"0 4px 16px rgba(0,0,0,0.10)",
  surface1:"#ffffff", surface2:"#f4f4f5", surface3:"#e7e5e4",
};
// Dark theme — control-room aesthetic: deep navy, electric-cyan accent.
const DARK = {
  ...STRUCT, name:"dark",
  bg:"#0a0e17", bgCard:"#0f172a", bgMuted:"#1a2236", bgDeep:"#0c1424",
  navy:"#0f172a", navyMid:"#1e293b", navyLight:"#334155",
  accent:"#22d3ee", accentLight:"#0a1f2a",
  border:"#1e293b", borderMid:"#334155",
  text:"#f1f5f9", textMuted:"#94a3b8", textFaint:"#64748b",
  green:"#4ade80", greenBg:"#052e16", greenBd:"#14532d",
  amber:"#fbbf24", amberBg:"#3a2106", amberBd:"#52310a",
  red:"#f87171",   redBg:"#3a0a0a",   redBd:"#52060a",
  violet:"#a78bfa",violetBg:"#1e1b4b",violetBd:"#312e81",
  blue:"#60a5fa",  blueBg:"#0a1628",  blueBd:"#1e3a5f",
  cyan:"#22d3ee",  cyanBg:"#0a2530",
  sh:"0 1px 3px rgba(0,0,0,0.4)", shMd:"0 4px 18px rgba(0,0,0,0.55)",
  surface1:"#0f172a", surface2:"#1a2236", surface3:"#1e293b",
};
// Live token object. Mutated in place on theme change so every consumer of T
// picks up new values on its next render (no signature changes required).
const T = { ...LIGHT };
const _themeListeners = new Set();
function applyTheme(name) {
  Object.assign(T, name === "dark" ? DARK : LIGHT);
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", name);
    document.documentElement.style.colorScheme = name;
  }
  try { localStorage.setItem("qa-hub-theme", name); } catch {}
  _themeListeners.forEach(fn => { try { fn(name); } catch {} });
}
function useTheme() {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force(x => x + 1);
    _themeListeners.add(fn);
    return () => { _themeListeners.delete(fn); };
  }, []);
  return [T.name, applyTheme];
}
// Initialize theme: saved → system pref → light.
(function initTheme() {
  if (typeof window === "undefined") return;
  let saved = null;
  try { saved = localStorage.getItem("qa-hub-theme"); } catch {}
  const sys = window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  applyTheme(saved || sys);
})();
// Inject global stylesheet once: fonts, keyframes, focus rings, scrollbar.
(function injectGlobalStyle() {
  if (typeof document === "undefined") return;
  if (document.getElementById("qa-hub-global-style")) return;
  const s = document.createElement("style");
  s.id = "qa-hub-global-style";
  s.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    html, body, #root { margin:0; padding:0; height:100%; }
    body { font-family:'Inter','Segoe UI',-apple-system,system-ui,sans-serif; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; }
    *:focus-visible { outline: 2px solid #22d3ee; outline-offset: 2px; }
    [data-theme="light"] *:focus-visible { outline-color:#2563eb; }
    ::-webkit-scrollbar { width:10px; height:10px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background:#9ca3af55; border-radius:6px; }
    ::-webkit-scrollbar-thumb:hover { background:#9ca3af99; }
    [data-theme="dark"] ::-webkit-scrollbar-thumb { background:#33415555; }
    [data-theme="dark"] ::-webkit-scrollbar-thumb:hover { background:#475569; }
  `;
  document.head.appendChild(s);
})();

// ─── Storage ──────────────────────────────────────────────────────────────────
const SK = "qa-ado-v6";
// localStorage storage — works in any browser without Claude.ai
function migrateProviderOnce() {
  try {
    if (localStorage.getItem("qa-hub-migrated-copilot-v1")) return;
    if (localStorage.getItem("qa-hub-ai-provider") === "ollama") {
      localStorage.setItem("qa-hub-ai-provider", "copilot");
    }
    localStorage.removeItem("qa-hub-ollama-model");
    localStorage.removeItem("qa-hub-defaulted-ollama-v1");
    localStorage.setItem("qa-hub-migrated-copilot-v1", "1");
  } catch {}
}
async function loadDB() {
  try {
    const r = localStorage.getItem(SK);
    if (!r) return null;
    const db = JSON.parse(r);
    if (db?.conn?.pat) {
      delete db.conn.pat;
      localStorage.setItem(SK, JSON.stringify(db));
    }
    return db;
  } catch { return null; }
}
function stripSecretsForStorage(d) {
  if (!d) return d;
  const out = { ...d };
  if (out.conn) {
    const { pat, ...safeConn } = out.conn;
    out.conn = safeConn;
  }
  return out;
}
async function saveDB(d) { try { localStorage.setItem(SK, JSON.stringify(stripSecretsForStorage(d))); } catch {} }
function getApiKey() {
  const provider = getAIProvider();
  if(provider==="copilot") return "";
  if(provider==="openai"){
    return (typeof import.meta !== "undefined" ? import.meta.env?.VITE_OPENAI_KEY : "") ||
           localStorage.getItem("qa-hub-openai-key") || "";
  }
  return (typeof import.meta !== "undefined" ? import.meta.env?.VITE_ANTHROPIC_KEY : "") ||
         localStorage.getItem("qa-hub-anthropic-key") ||
         localStorage.getItem("qa-hub-apikey") || "";
}
function getAIProvider() {
  return localStorage.getItem("qa-hub-ai-provider") || "copilot";
}
function getCopilotModel() {
  return localStorage.getItem("qa-hub-copilot-model") || "gpt-4o";
}
function setCopilotModel(m) { try { localStorage.setItem("qa-hub-copilot-model", m); } catch {} }
function getAnalysisModel() {
  // Used for Review / Generate Test Cases / Coverage. Falls back to chat model.
  return localStorage.getItem("qa-hub-copilot-analysis-model") || getCopilotModel();
}
function setAnalysisModel(m) { try { localStorage.setItem("qa-hub-copilot-analysis-model", m); } catch {} }
const MODEL_ROUTE = {
  openai: {
    chat: "gpt-4.1-mini",
    review: "gpt-4.1",
    tests: "gpt-5",
    coverage: "gpt-5",
  },
  anthropic: {
    chat: "claude-haiku-4-5",
    review: "claude-sonnet-4-6",
    tests: "claude-opus-4-7",
    coverage: "claude-opus-4-7",
  },
};
function getTaskModel(provider, task="chat") {
  if (provider === "copilot") return task === "chat" ? getCopilotModel() : getAnalysisModel();
  const key = `qa-hub-${provider}-${task}-model`;
  try {
    const saved = localStorage.getItem(key);
    if (saved) return saved;
  } catch {}
  return MODEL_ROUTE[provider]?.[task] || MODEL_ROUTE[provider]?.chat;
}
function makeOpenAIJsonFormat() {
  return {
    type: "json_schema",
    json_schema: {
      name: "qa_hub_structured_output",
      schema: { type: "object", additionalProperties: true },
      strict: false,
    },
  };
}
function makeAnthropicSystem(system) {
  return [{ type:"text", text:system, cache_control:{ type:"ephemeral" } }];
}
function openAITokenBudget(model, maxTokens) {
  return /^gpt-5|^o\d|^o-/i.test(model) ? { max_completion_tokens:maxTokens } : { max_tokens:maxTokens };
}
function hasAIConfig() {
  return getAIProvider()==="copilot" || !!getApiKey();
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const WI_ICON = {"User Story":"📖","Feature":"⭐","Epic":"🏔","Product Backlog Item":"📦","Task":"✅","Bug":"🐛","Spike":"⚡","Test Case":"🧪","Issue":"⚠️"};
const WI_TYPES = ["User Story","Feature","Epic","Product Backlog Item","Bug","Spike","Task","Test Case"];
const ALL_STATES = ["New","Proposed","Active","Approved","In Progress","Committed","Ready","Ready for Testing","Resolved","Done","Closed"];
const PRIORITIES = ["Critical","High","Medium","Low"];
const now = () => new Date().toISOString();

function stripHtml(h) {
  if (!h) return "";
  return h.replace(/<br\s*\/?>/gi,"\n").replace(/<\/p>/gi,"\n").replace(/<\/li>/gi,"\n")
    .replace(/<li>/gi,"• ").replace(/<[^>]+>/g,"")
    .replace(/&nbsp;/g," ").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&#39;/g,"'")
    .replace(/\n{3,}/g,"\n\n").trim();
}

function parseOrg(raw) {
  if (!raw) return "";
  const s = raw.trim().replace(/\/$/, "");
  try {
    const u = new URL(s.includes("://") ? s : `https://${s}`);
    if (u.hostname.endsWith("visualstudio.com")) return u.hostname.replace(".visualstudio.com","");
    if (u.hostname === "dev.azure.com") return u.pathname.replace(/^\//,"").split("/")[0] || s;
  } catch {}
  return s;
}

function wiqlStr(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

// ─── Azure DevOps API ─────────────────────────────────────────────────────────
function adoBase(org) { return `https://dev.azure.com/${parseOrg(org)}`; }
function adoHdr(pat)  { return { Authorization:`Basic ${btoa(`:${pat}`)}`, "Content-Type":"application/json", Accept:"application/json" }; }

// CORS proxy — used automatically when direct requests are blocked (common from browser-based tools)
let _proxyMode = false;
let _proxyConfirmed = false;

function proxify(url) {
  return url;
}

function adoProxyUrl(url) {
  return `/api/ado?url=${encodeURIComponent(url)}`;
}

async function _rawFetch(url, pat, opts) {
  const res = await fetch(url, { ...opts, headers:{ ...adoHdr(pat), ...(opts.headers||{}) } });
  const txt = await res.text();
  let b = {};
  if (txt) {
    try { b = JSON.parse(txt); }
    catch {
      const preview = txt.replace(/\s+/g," ").slice(0,120);
      throw new Error(`ADO endpoint returned non-JSON (${res.status}). ${preview}`);
    }
  }
  if (!res.ok) {
    if (res.status===401) throw new Error("Unauthorized (401) — PAT expired or missing Work Items: Read scope.");
    if (res.status===403) throw new Error("Forbidden (403) — PAT lacks access to this project.");
    if (res.status===404) throw new Error("Not found (404) — verify org name and project name are correct.");
    throw new Error(b.message || b.errorCode || `ADO error ${res.status}`);
  }
  return b;
}

async function adoFetch(url, pat, opts={}) {
  try {
    return await _rawFetch(adoProxyUrl(url), pat, opts);
  } catch(err) {
    if (err.message.includes("fetch") || err.message === "Failed to fetch" || err.message.includes("non-JSON")) {
      throw new Error("Azure DevOps connection failed. Start the bundled server with `npm run server`, then open the app at the server URL, or run Vite on port 3000 so /api/ado can proxy to server.js on port 3001.");
    }
    throw err;
  }

  // Try the bundled server.js proxy first. In Vite dev this is forwarded by
  // vite.config.js to localhost:3001.
  try {
    const result = await _rawFetch(adoProxyUrl(url), pat, opts);
    _proxyMode = false;
    _proxyConfirmed = true;
    return result;
  } catch(localErr) {
    if (!/Failed to fetch|non-JSON|404|502|proxy/i.test(localErr.message)) throw localErr;
    console.warn("Local ADO proxy unavailable; trying direct ADO request.", localErr.message);
  }

  // Try direct second
  if (!_proxyMode) {
    try {
      const result = await _rawFetch(url, pat, opts);
      return result;
    } catch(directErr) {
      // "Failed to fetch" = CORS or network block — switch to proxy and retry
      if (directErr.message.includes("fetch") || directErr.message.includes("network") || directErr.message.includes("CORS") || directErr.message === "Failed to fetch") {
        console.log("Direct ADO call blocked — switching to CORS proxy automatically.");
        _proxyMode = true;
      } else {
        throw directErr; // auth error, 404, etc — don't retry with proxy
      }
    }
  }
  // Proxy attempt
  try {
    const result = await _rawFetch(proxify(url), pat, opts);
    _proxyConfirmed = true;
    return result;
  } catch(proxyErr) {
    if (proxyErr.message.includes("fetch") || proxyErr.message === "Failed to fetch" || proxyErr.message.includes("non-JSON")) {
      throw new Error("Azure DevOps connection failed. Start the bundled server with `npm run server`, then open the app at the server URL, or run Vite on port 3000 so /api/ado can proxy to server.js on port 3001.");
    }
    throw proxyErr;
  }
}

// Returns whether proxy mode was activated (for UI notice)
function isProxyMode() { return _proxyMode; }

async function adoListProjects(org, pat) {
  const d = await adoFetch(`${adoBase(org)}/_apis/projects?api-version=7.1&$top=200`, pat);
  return d.value || [];
}

async function adoAreaPaths(org, project, pat) {
  const d = await adoFetch(`${adoBase(org)}/${encodeURIComponent(project)}/_apis/wit/classificationnodes/areas?$depth=5&api-version=7.1`, pat);
  const flat=[]; function walk(n,p){const path=p?`${p}\\${n.name}`:n.name;flat.push(path);(n.children||[]).forEach(c=>walk(c,path));} walk(d,""); return flat;
}
async function adoIterPaths(org, project, pat) {
  const d = await adoFetch(`${adoBase(org)}/${encodeURIComponent(project)}/_apis/wit/classificationnodes/iterations?$depth=5&api-version=7.1`, pat);
  const flat=[]; function walk(n,p){const path=p?`${p}\\${n.name}`:n.name;flat.push(path);(n.children||[]).forEach(c=>walk(c,path));} walk(d,""); return flat;
}

async function adoQueryWI(org, project, pat, {types=[], states=[], areaPath="", iterPath="", assignedTo="", search="", top=300}={}) {
  const conds = [`[System.TeamProject] = ${wiqlStr(project)}`];
  if (types.length)  conds.push(`[System.WorkItemType] IN (${types.map(wiqlStr).join(",")})`);
  if (states.length) conds.push(`[System.State] IN (${states.map(wiqlStr).join(",")})`);
  if (areaPath)      conds.push(`[System.AreaPath] UNDER ${wiqlStr(areaPath)}`);
  if (iterPath)      conds.push(`[System.IterationPath] UNDER ${wiqlStr(iterPath)}`);
  if (assignedTo)    conds.push(`[System.AssignedTo] = ${wiqlStr(assignedTo)}`);
  const wiql = `SELECT [System.Id] FROM WorkItems WHERE ${conds.join(" AND ")} ORDER BY [System.ChangedDate] DESC`;
  const base = `${adoBase(org)}/${encodeURIComponent(project)}`;
  const r = await adoFetch(`${base}/_apis/wit/wiql?api-version=7.1&$top=${top}`, pat, {method:"POST",body:JSON.stringify({query:wiql})});
  return { ids: r.workItems||[], wiql };
}

async function adoGetDetails(org, project, pat, ids) {
  if (!ids.length) return [];
  const base  = `${adoBase(org)}/${encodeURIComponent(project)}`;
  // Use $expand=all so we get every field that exists in the project (incl. any custom
  // "Test Plan" / "QA Notes" field) without having to know its exact reference name up front.
  // Listing an unknown custom field by name causes ADO to return TF51535 and fail the whole batch.
  let all=[];
  for (let i=0;i<ids.length;i+=200){
    const batch = ids.slice(i,i+200).map(w=>w.id).join(",");
    const d = await adoFetch(`${base}/_apis/wit/workitems?ids=${batch}&$expand=all&api-version=7.1`, pat);
    all = all.concat(d.value||[]);
  }
  return all;
}

async function adoAddComment(org, project, pat, wiId, html) {
  const base = `${adoBase(org)}/${encodeURIComponent(project)}`;
  return adoFetch(`${base}/_apis/wit/workItems/${wiId}/comments?api-version=7.1-preview.3`, pat, {method:"POST",body:JSON.stringify({text:html})});
}

function wiToItem(wi) {
  const f = wi.fields||{};
  return {
    id: wi.id,
    url: wi._links?.html?.href||"",
    title:         f["System.Title"]||"",
    type:          f["System.WorkItemType"]||"",
    state:         f["System.State"]||"",
    priority:      ["","Critical","High","Medium","Low"][f["Microsoft.VSTS.Common.Priority"]]||"Medium",
    points:        f["Microsoft.VSTS.Scheduling.StoryPoints"]||null,
    assignedTo:    f["System.AssignedTo"]?.displayName||"",
    areaPath:      f["System.AreaPath"]||"",
    iterationPath: f["System.IterationPath"]||"",
    tags:          f["System.Tags"]||"",
    description:   stripHtml(f["System.Description"]||""),
    acceptanceCriteria: stripHtml(f["Microsoft.VSTS.Common.AcceptanceCriteria"]||""),
    // ADO "test plan" / QA notes  →  QAHub QA Notes.
    // We probe a known list first, then fall back to ANY field whose reference name
    // contains "testplan" / "qanotes" / "qa_notes" / "testnotes" / "reprosteps" / "systeminfo".
    testPlan: (function(){
      const known = [
        "Custom.TestPlan","Nucor.TestPlan","Custom.QANotes","Custom.QA_Notes",
        "Nucor.QANotes","Custom.TestNotes","Custom.QANote","Custom.QaNotes",
        "Microsoft.VSTS.TCM.ReproSteps","Microsoft.VSTS.TCM.SystemInfo"
      ];
      for (const k of known) { if (f[k]) return stripHtml(f[k]); }
      for (const [k,v] of Object.entries(f||{})) {
        if (!v || typeof v !== "string") continue;
        const key = k.toLowerCase().replace(/[^a-z0-9]/g,"");
        if (key.includes("testplan") || key.includes("qanotes") ||
            key.includes("qanote")    || key.includes("testnotes") ||
            key.includes("reprosteps")|| key.includes("systeminfo")) {
          return stripHtml(v);
        }
      }
      return "";
    })(),
    changedDate:   f["System.ChangedDate"]||"",
    hasAC:         !!f["Microsoft.VSTS.Common.AcceptanceCriteria"],
    relations:     (wi.relations||[]).map(r=>({ rel:r.rel, url:r.url, title:r.attributes?.name||r.attributes?.comment||"", type:r.attributes?.resourceType||"" })),
    // local QA data (stored separately in DB)
    review: null, testCases: null, notes: "", editedContent: "",
  };
}

function keywordsFrom(text) {
  const stop = new Set(["the","and","for","with","from","this","that","into","when","then","user","story","feature","create","update","view","able","allow","need","needs","system"]);
  return [...new Set(String(text||"").toLowerCase().replace(/[^a-z0-9\s-]/g," ").split(/\s+/).filter(w=>w.length>3&&!stop.has(w)))];
}

function findSimilarItems(item, items) {
  if (!item) return [];
  const source = keywordsFrom(`${item.title} ${item.description} ${item.acceptanceCriteria} ${item.tags}`);
  return (items||[])
    .filter(x=>x.id!==item.id)
    .map(x=>{
      const target = keywordsFrom(`${x.title} ${x.description} ${x.acceptanceCriteria} ${x.tags}`);
      const overlap = source.filter(k=>target.includes(k));
      const areaBoost = item.areaPath && x.areaPath === item.areaPath ? 2 : 0;
      return { item:x, overlap, score:overlap.length + areaBoost };
    })
    .filter(x=>x.score>=2)
    .sort((a,b)=>b.score-a.score)
    .slice(0,8)
    .map(x=>({ id:x.item.id, title:x.item.title, type:x.item.type, state:x.item.state, areaPath:x.item.areaPath, tags:x.item.tags, overlap:x.overlap.slice(0,8) }));
}

function buildCoverageContext(item, items) {
  const similar = findSimilarItems(item, items);
  const linked = (item.relations||[]).map(r=>`${r.rel}: ${r.title || r.url}`).slice(0,20);
  const source = keywordsFrom(`${item.title} ${item.description} ${item.acceptanceCriteria} ${item.tags} ${item.areaPath}`);
  const existingTestCases = (items||[])
    .filter(x=>/test case/i.test(x.type))
    .map(x=>{
      const target = keywordsFrom(`${x.title} ${x.description} ${x.acceptanceCriteria} ${x.tags} ${x.areaPath}`);
      const overlap = source.filter(k=>target.includes(k));
      const relationHit = (item.relations||[]).some(r=>String(r.url||"").includes(String(x.id)) || String(r.title||"").includes(String(x.id)));
      const areaBoost = item.areaPath && x.areaPath === item.areaPath ? 2 : 0;
      return { item:x, overlap, score:overlap.length + areaBoost + (relationHit?5:0), relationHit };
    })
    .filter(x=>x.score>=1)
    .sort((a,b)=>b.score-a.score)
    .slice(0,20)
    .map(x=>({ id:x.item.id, title:x.item.title, state:x.item.state, areaPath:x.item.areaPath, tags:x.item.tags, matchedKeywords:x.overlap.slice(0,8), directlyLinked:x.relationHit }));
  return {
    similar,
    existingTestCases,
    linked,
    loadedWorkItemCount: items?.length || 0,
    loadedTestCaseCount: (items||[]).filter(x=>/test case/i.test(x.type)).length,
    unitSignals: linked.filter(x=>/pull request|commit|branch|build|coverage|unit/i.test(x)),
    testSignals: linked.filter(x=>/test case|tested by|test/i.test(x)),
  };
}

// ─── Claude AI ────────────────────────────────────────────────────────────────
async function callClaude(system, messages, maxTokens=4096, jsonMode=false, onChunk=null, signal=null, task="chat", modelOverride=null) {
  const apiKey = getApiKey();
  const provider = getAIProvider();
  if(provider==="copilot"){
    const stream = !!onChunk;
    const r = await fetch("/api/copilot/chat",{method:"POST",headers:{"Content-Type":"application/json"},signal,body:JSON.stringify({
      model: modelOverride || getTaskModel("copilot", task),
      max_tokens:maxTokens,
      stream,
      ...(jsonMode?{response_format:{type:"json_object"}}:{}),
      messages:[{role:"system",content:system},...messages]
    })});
    if(!r.ok){ const t=await r.text(); throw new Error(`Copilot: ${t||r.statusText}`); }
    if(!stream){
      const d=await r.json();
      return d.choices?.[0]?.message?.content||"";
    }
    const reader=r.body.getReader(); const dec=new TextDecoder(); let buf="", full="";
    while(true){
      const {value,done}=await reader.read(); if(done) break;
      buf+=dec.decode(value,{stream:true});
      let nl;
      while((nl=buf.indexOf("\n"))>=0){
        const line=buf.slice(0,nl).trim(); buf=buf.slice(nl+1);
        if(!line.startsWith("data:")) continue;
        const payload=line.slice(5).trim();
        if(payload==="[DONE]") return full;
        try{ const j=JSON.parse(payload); const part=j.choices?.[0]?.delta?.content||""; if(part){ full+=part; onChunk(full); } }catch{}
      }
    }
    return full;
  }
  if (!apiKey) throw new Error(`No ${provider==="openai"?"OpenAI":"Anthropic"} API key — click Settings to add one.`);
  if(provider==="openai"){
    const stream=!!onChunk;
    const model = modelOverride || getTaskModel("openai", task);
    const oaiBody={model,...openAITokenBudget(model,maxTokens),stream,messages:[{role:"system",content:system},...messages]};
    if(jsonMode) oaiBody.response_format=makeOpenAIJsonFormat();
    const r = await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Authorization":`Bearer ${apiKey}`},signal,body:JSON.stringify(oaiBody)});
    if(!r.ok){ const d=await r.json().catch(()=>({})); throw new Error(d.error?.message||r.statusText); }
    if(!stream){ const d=await r.json(); return d.choices?.[0]?.message?.content||""; }
    const reader=r.body.getReader(); const dec=new TextDecoder(); let buf="", full="";
    while(true){
      const {value,done}=await reader.read(); if(done) break;
      buf+=dec.decode(value,{stream:true});
      let nl;
      while((nl=buf.indexOf("\n"))>=0){
        const line=buf.slice(0,nl).trim(); buf=buf.slice(nl+1);
        if(!line.startsWith("data:")) continue;
        const payload=line.slice(5).trim(); if(payload==="[DONE]") return full;
        try{ const j=JSON.parse(payload); const part=j.choices?.[0]?.delta?.content||""; if(part){ full+=part; onChunk(full); } }catch{}
      }
    }
    return full;
  }
  // Anthropic
  const stream=!!onChunk;
  const r = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":apiKey,"anthropic-version":"2023-06-01","anthropic-beta":"prompt-caching-2024-07-31","anthropic-dangerous-direct-browser-access":"true"},signal,body:JSON.stringify({model:modelOverride || getTaskModel("anthropic", task),max_tokens:maxTokens,stream,system:makeAnthropicSystem(system),messages})});
  if(!r.ok){ const d=await r.json().catch(()=>({})); throw new Error(d.error?.message||r.statusText); }
  if(!stream){ const d=await r.json(); return d.content?.filter(b=>b.type==="text").map(b=>b.text).join("")||""; }
  const reader=r.body.getReader(); const dec=new TextDecoder(); let buf="", full="";
  while(true){
    const {value,done}=await reader.read(); if(done) break;
    buf+=dec.decode(value,{stream:true});
    let nl;
    while((nl=buf.indexOf("\n"))>=0){
      const line=buf.slice(0,nl).trim(); buf=buf.slice(nl+1);
      if(!line.startsWith("data:")) continue;
      const payload=line.slice(5).trim();
      try{ const j=JSON.parse(payload); if(j.type==="content_block_delta"){ const part=j.delta?.text||""; if(part){ full+=part; onChunk(full); } } else if(j.type==="message_stop"){ return full; } }catch{}
    }
  }
  return full;
}

async function callAnthropicJSON(system, content, maxTokens=4096, task="review") {
  const apiKey = getApiKey();
  const r = await fetch("https://api.anthropic.com/v1/messages",{
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "x-api-key":apiKey,
      "anthropic-version":"2023-06-01",
      "anthropic-beta":"prompt-caching-2024-07-31",
      "anthropic-dangerous-direct-browser-access":"true",
    },
    body:JSON.stringify({
      model:getTaskModel("anthropic", task),
      max_tokens:maxTokens,
      system:makeAnthropicSystem(system),
      messages:[{role:"user",content}],
      tools:[{
        name:"emit_json",
        description:"Return the complete QAHub analysis object as valid JSON.",
        input_schema:{ type:"object", additionalProperties:true },
      }],
      tool_choice:{ type:"tool", name:"emit_json" },
    }),
  });
  if(!r.ok){ const d=await r.json().catch(()=>({})); throw new Error(d.error?.message||r.statusText); }
  const d = await r.json();
  const tool = d.content?.find(b=>b.type==="tool_use" && b.name==="emit_json");
  if (!tool?.input || typeof tool.input !== "object") throw new Error("Anthropic returned no structured JSON payload");
  return tool.input;
}

async function callClaudeJSON(system, content, maxTokens=4096, task="review") {
  const provider = getAIProvider();
  if (provider === "anthropic") return callAnthropicJSON(system, content, maxTokens, task);
  const modelOverride = provider==="copilot" ? getAnalysisModel() : null;
  const txt = await callClaude(system,[{role:"user",content}], maxTokens, true, null, null, task, modelOverride);
  const clean = txt.replace(/^```json\s*/m,"").replace(/^```\s*/m,"").replace(/\s*```$/m,"").trim();
  const parse = (value) => JSON.parse(value);
  // Try direct, then extract {...}, then repair common truncation/escape problems.
  const tryParse = (s) => { try { return parse(s); } catch { return undefined; } };
  let out = tryParse(clean); if (out!==undefined) return out;
  const m = clean.match(/\{[\s\S]*\}/);
  let candidate = m ? m[0] : clean;
  out = tryParse(candidate); if (out!==undefined) return out;
  // Repair invalid backslashes and control chars.
  let repaired = candidate.replace(/\\(?!["\\/bfnrtu])/g,"\\\\").replace(/[\u0000-\u001F]+/g," ");
  out = tryParse(repaired); if (out!==undefined) return out;
  // Truncation repair: chop to last good record then close brackets/braces.
  const repairTruncated = (s) => {
    // Find last unambiguous boundary: prefer `},` or `]` at depth >= 1.
    let cut = s.length;
    for (let i = s.length-1; i>0; i--) {
      const c = s[i];
      if (c==="}" || c==="]") { cut = i+1; break; }
    }
    let body = s.slice(0, cut);
    // If we cut inside a string, abort; otherwise close open structures.
    let depthCurly=0, depthSq=0, inStr=false, esc=false;
    for (let i=0;i<body.length;i++){
      const c=body[i];
      if(esc){esc=false;continue;}
      if(c==="\\"){esc=true;continue;}
      if(c==='"'){inStr=!inStr;continue;}
      if(inStr) continue;
      if(c==="{")depthCurly++; else if(c==="}")depthCurly--;
      else if(c==="[")depthSq++; else if(c==="]")depthSq--;
    }
    if(inStr) body += '"';
    // Trim a trailing comma if present.
    body = body.replace(/,\s*$/,"");
    while(depthSq-->0) body+="]";
    while(depthCurly-->0) body+="}";
    return body;
  };
  const truncated = repairTruncated(repaired);
  out = tryParse(truncated); if (out!==undefined) return out;
  throw new Error("Could not parse AI response as JSON");
}

const METALLURGIST_DOMAIN = `You think like a senior metallurgist and steel-plant QA reviewer for **Nucor Steel** mills (NextGen / NBT program). Reason about every feature using the real Nucor steel manufacturing process before reviewing or designing tests.

=== Nucor Steel Manufacturing Process (use this as ground truth) ===
Nucor is an EAF (Electric Arc Furnace) mini-mill operator. The end-to-end flow that almost every QAHub feature touches some part of:
1. **Scrap & DRI charging** — scrap categories, alloys, DRI/HBI charged into the EAF; lot/heat traceability begins here.
2. **Melting (EAF)** — a heat is created (a heat number is the master traceability key). Power-on/off, slag chemistry, tap temperature, deox additions.
3. **Ladle Metallurgy (LMF)** — chemistry trim, alloy additions, desulfurization, temperature staging, argon stir; a chemistry sample (lollipop) is pulled and analyzed by spectro/XRF in the lab.
4. **Casting** — continuous caster produces slabs/blooms/billets stamped with the heat number and a sequence/strand id. Some Nucor mills cast thin-slab (CSP), others bloom/billet for bar/structural.
5. **Reheat & Hot Rolling** — slabs reheated, rolled to plate, sheet, coil, bar, beam, or shape on the appropriate mill (plate mill, hot strip mill, bar mill, structural mill).
6. **Finishing** — pickling, cold rolling, annealing, galvanizing, heat treatment (Q&T, normalizing), cut-to-length, slitting, leveling, blasting, painting depending on product.
7. **Inspection & Testing** — physical sampling per coil/plate/lot per the **Test Plan / Sampling Plan** dictated by grade + customer + standard (ASTM A36/A572/A992, API 2H/2W, ABS, EN, AAR, MIL, customer specs). Tests include:
   - Mechanical: **ZTEN tensile** (yield, UTS, elongation, R/A), Charpy impact at temperature, hardness (Brinell/Rockwell), bend tests, drop-weight (NDT), CTOD.
   - Chemistry: ladle analysis, product analysis (re-check), micro-alloy verification.
   - Dimensional: thickness, width, length, flatness, camber, squareness, surface.
   - Special: ultrasonic (UT) for plate, magnetic particle (MT), grain size, microstructure, hydrogen, inclusion rating.
8. **Spec evaluation & disposition** — results compared against grade-specific limits (min yield, min UTS, min elongation, max C/Mn/P/S, CE/Pcm formulas, average vs individual sample limits). Out-of-spec → retest rules per the standard, then accept / downgrade / scrap / hold for MRB.
9. **MTR / Certificate generation** — a Mill Test Report (Cert) is produced per heat or per lot, signed by the metallurgist, listing chemistry, mechanicals, applicable standards, and traceability (heat, coil/plate id, customer PO).
10. **Shipping** — coils/plates/bundles released to ship only when MTR is approved; tied back to ERP order, BOL, customer PO.
11. **Backbone systems** — ERP (typically SAP / Oracle), MES, Level-2 mill automation, **LIMS** (lab), QMS, scale/weighbridge, scanner/labeling, and downstream EDI to customers. Every QA feature should be considered for upstream/downstream integration impact.

=== What this means for QA reasoning ===
- Material identity is sacred: heat # → coil/plate/bundle/lot → sample id → test result → MTR. Any feature that breaks that chain is a critical defect.
- Sampling rules are dictated by the standard + customer + product; never accept "test once" thinking — verify the per-N-piece / per-heat / per-lot sampling cadence.
- Tolerances are **grade- and standard-specific**; a yield value that passes A36 fails A572 Gr 50. Validate the spec lookup, not just the math.
- Retest behavior: most standards allow 1–2 retests per failing property under defined conditions; the system must enforce, not bypass.
- Average-vs-individual limits matter (e.g. Charpy: avg of 3 ≥ X AND no individual < Y).
- Disposition states (Accept / Downgrade / Hold / Scrap / MRB) drive ERP, inventory, and shipping eligibility — verify state transitions and integration messages.
- MTR/Cert is the customer-facing legal document — accuracy, traceability, signature/approval, and re-issue/correction flows are high-risk.
- Roles to think about: melter, caster operator, roller, lab technician, metallurgist, QA inspector, shipping clerk, customer service, auditor.
- Compliance: ASTM, ASME, ABS, API, EN, AAR, customer specs, NIST-traceable lab calibrations, ISO 9001 / IATF 16949 audit trails.

=== Reviewer mindset ===
- Always anchor scoring and test design in the Nucor process steps the feature touches. Identify: which step? which roles? which integrations (ERP/MES/LIMS/Level-2)? which standards/customer specs?
- Do NOT downgrade the score just because the story omits plant trivia that is obvious from the process above; use this domain knowledge to fill gaps and design tests.
- Lower the score only when the AC is ambiguous, contradictory, missing testable conditions, or when metallurgical rules described in the AC cannot be verified objectively.
- When the story or test plan references heats, coils, grades, ZTEN, MTR, LIMS, ERP, MES, or any of the steps above — assume the full Nucor traceability flow applies and design scenarios end-to-end across it.`;

const REVIEW_SYS = `You are acting as a senior metallurgist + QA reviewer. Read the user story / feature, its acceptance criteria, and any provided test plan or linked context, then evaluate whether the feature can be tested as written.
${METALLURGIST_DOMAIN}

Scoring rules:
- Score each dimension 1-3 (1=missing,2=partial,3=clear and testable).
- Base scores ONLY on what the AC and test plan describe. Do not penalize for omitting plant details that are obvious or implied.
- Lower scores when the AC has metallurgical ambiguity, missing pass/fail criteria, undefined sampling rules, undefined tolerances/limits, missing retest behavior, or missing data needed to verify behavior.
- readyForTesting=true only if overall score>=7 AND no critical metallurgical ambiguity remains.

Return ONLY valid JSON:
{"score":<1-10>,"status":"<insufficient|needs_improvement|acceptable|good|excellent>","summary":"<2-3 sentences>","readyForTesting":<bool>,
"dimensions":{"persona":{"score":<1-3>,"comment":"..."},"action":{"score":<1-3>,"comment":"..."},"value":{"score":<1-3>,"comment":"..."},"acceptanceCriteria":{"score":<1-3>,"comment":"..."},"scope":{"score":<1-3>,"comment":"..."},"edgeCases":{"score":<1-3>,"comment":"..."},"nonFunctional":{"score":<1-3>,"comment":"..."},"testData":{"score":<1-3>,"comment":"..."}},
"issues":[{"severity":"<critical|major|minor>","title":"...","description":"<what is unclear or missing for a metallurgist to test>","impact":"..."}],
"suggestions":[{"area":"...","problem":"...","fix":"<what to add to the AC/test plan>","example":"..."}],
"improvedVersion":"<complete rewritten story addressing all issues>",
"blockers":["<only items that prevent metallurgical/QA validation>"]}`;

const TC_SYS = `You are acting as a senior metallurgist + QA engineer designing tests for the feature.
${METALLURGIST_DOMAIN}

CRITICAL DESIGN RULES — read carefully:
- Produce **end-to-end test SCENARIOS**, not micro-cases. Each test case must represent a complete user/system journey or a meaningful behavior, not a single click or single field check.
- Each test case MUST have **5–15 ordered steps** that walk through the full flow (login/setup → trigger → verify intermediate state → final verification → cleanup if needed). Never emit a test case with only 1–2 steps unless it is intentionally a tiny smoke check.
- **Group related validations** into one scenario. Example: do NOT make 6 separate test cases for "field A validation", "field B validation", "field C validation" — make ONE "Form validation – all required fields" case with steps for each field.
- **Combine UI + API + DB verification** into the same scenario where they belong to the same flow. Use validationPoints in the steps' expected results (e.g. "API returns 200 AND DB row inserted AND UI shows confirmation").
- Aim for **8–15 high-value scenarios total** for an average story, not 30+ tiny ones. Prefer depth over breadth.
- Categories: Functional (happy path E2E flows), Negative (error/rejection flows), Edge Case (boundary/concurrency/retest scenarios), Security, Performance, Accessibility. Each category should have at least one full scenario when applicable.
- For metallurgical features: scenarios should cover heat → coil → test assignment → result entry → spec evaluation → MTR/cert generation → traceability, as one connected flow when the AC describes that journey.

Generate test cases that directly verify the acceptance criteria and any test plan provided. Use metallurgical reasoning (sampling rules, tolerance/spec limits, retest behavior, traceability, MTR/cert reporting, integration with lab/ERP/MES) plus Equivalence Partitioning, BVA, Decision Tables, State Transition, Error Guessing, OWASP security, and WCAG 2.1. Include UI/API/DB validation where applicable. Do not invent rules not implied by the AC; instead, call out missing rules in the test notes.

Return ONLY valid JSON:
{"summary":"<2-3 sentence overview of the test strategy and scenario grouping rationale>","coverage":{"functional":<n>,"negative":<n>,"edge":<n>,"security":<n>,"performance":<n>,"accessibility":<n>},
"testCases":[{"id":"TC001","title":"<scenario name describing the full flow, e.g. 'End-to-end: Assign ZTEN test → enter results → generate MTR for ABS A36 plate'>","category":"<Functional|Negative|Edge Case|Security|Performance|Accessibility>","priority":"<Critical|High|Medium|Low>","automatable":<bool>,"preconditions":"<setup needed: roles, data, environment, related work items>","steps":[{"step":<n>,"action":"<concrete actor + action, e.g. 'Lab tech opens ZTEN entry screen for heat 12345'>","expected":"<verifiable outcome including UI/API/DB checks>"}],"expectedResult":"<final business outcome of the entire scenario>","testData":"<heats, grades, customers, specs, sample IDs needed>","notes":"<edge conditions, regression links, AC references>"}]}`;

const COVERAGE_SYS = `Act as a senior metallurgist + QA Architect analyzing one ADO Feature/User Story for the steel plant.

${METALLURGIST_DOMAIN}

Your job: understand the feature from the AC and test plan, identify what a metallurgist would need to test, compare against loaded ADO context (similar features, existing Test Case work items, linked artifacts), generate optimized test coverage, recommend regression scope, assess unit/automation evidence, and provide QA readiness scoring. Do not score down for unstated plant trivia; only flag genuine gaps that block metallurgical validation.

Use the provided existing/similar work items, existing ADO Test Case work items, and linked artifact signals. Before proposing new tests, identify reusable existing test cases and regression cases already available in ADO. If existing test evidence is not available in the loaded context, say so clearly instead of assuming coverage exists.

Return ONLY valid JSON with this exact shape:
{"featureSummary":{"featureId":"","featureName":"","businessArea":"","businessFlow":"","functionalitySummary":"","impactedSystems":[""],"similarExistingFeatures":[{"id":"","title":"","reuseOpportunity":""}],"regressionRisk":"<High|Medium|Low>"},
"requirementQualityScore":{"businessDescription":0,"acceptanceCriteria":0,"testability":0,"dataDetails":0,"edgeCases":0,"integrationDetails":0,"errorHandling":0,"nonFunctional":0,"regressionImpact":0,"dependencyClarity":0,"overallScore":0,"qaReadinessStatus":"<Ready|Needs Clarification|Not Ready>"},
"gapsAndClarifications":[""],
"testScenarios":[{"scenarioId":"SC001","scenarioName":"","businessFlowMapping":"","testType":"<UI|API|DB|Integration|E2E|Security|Performance|Regression|Accessibility>","priority":"<Critical|High|Medium|Low>","riskLevel":"<High|Medium|Low>"}],
"detailedTestCases":[{"testCaseId":"TC001","title":"","objective":"","preconditions":"","testData":"","steps":[{"step":1,"action":"","expected":""}],"expectedResult":"","validationPoints":["UI","API","DB"],"testType":"","priority":"","automationFeasibility":"<High|Medium|Low>","regressionCandidate":"<Yes|No>","reusable":"<Yes|No>","riskTag":""}],
"regressionCoverage":{"existingRegressionCasesImpacted":["include existing ADO test case IDs/titles when available"],"newRegressionCasesRequired":[""],"smokeTestRecommendations":[""],"highRiskAreas":[""],"mediumRiskAreas":[""],"lowRiskAreas":[""]},
"unitAutomationCoverage":{"unitTestCoverageStatus":"<High|Medium|Low|None|Unknown>","evidence":[""],"areasLackingUnitTests":[""],"existingAutomationCoverage":"<High|Medium|Low|None|Unknown>","missingAutomationAreas":[""],"suggestedUnitTests":[""],"suggestedAutomationCandidates":[""]},
"finalQARecommendation":{"status":"<Ready for QA|Needs Clarification|Blocked>","reason":"","nextAction":""}}`;

function buildChatSystemPrompt(item) {
  return `You are a senior metallurgist and QA Test Strategist for steel-plant enterprise systems. Reason about the feature, its acceptance criteria, and any test plan as a metallurgist would, and answer the QA team's questions in that voice.

${METALLURGIST_DOMAIN}

You are helping a QA team analyze the following Azure DevOps work item:

━━━ WORK ITEM DETAILS ━━━
ID: #${item.id}
Title: ${item.title}
Type: ${item.type}
Priority: ${item.priority}
State: ${item.state}
Assigned To: ${item.assignedTo||"Unassigned"}
Iteration: ${item.iterationPath||"—"}
Area: ${item.areaPath||"—"}
${item.points ? `Story Points: ${item.points}` : ""}
${item.tags ? `Tags: ${item.tags}` : ""}

━━━ DESCRIPTION / STORY CONTENT ━━━
${item.description || item.editedContent || "(no description provided)"}

━━━ ACCEPTANCE CRITERIA ━━━
${item.acceptanceCriteria || "(no acceptance criteria provided)"}
━━━━━━━━━━━━━━━━━━━━━━━━━

As a QA expert, help the team understand:
1. The FULL SCOPE of testing required — what is in scope, what is out of scope
2. Which TYPES of testing are needed: functional, regression, integration, performance, security, accessibility, UAT, etc.
3. RISK AREAS that deserve extra test coverage and attention
4. EDGE CASES, boundary conditions, and negative scenarios to cover
5. Whether similar features might have EXISTING TEST CASES that could be reused or adapted
6. KEY DEPENDENCIES and integration points that need verification
7. AUTOMATION recommendations — what should be automated vs manual
8. ENVIRONMENT and data requirements for testing
9. Anything in the story that is AMBIGUOUS or missing that could cause testing gaps

Be specific, reference the actual feature details, and give actionable recommendations. When the user asks follow-up questions, maintain context from the entire conversation.`;
}

const QUICK_PROMPTS = [
  { label:"📋 Full scope analysis",   text:"Give me a complete analysis of the testing scope for this work item. What is in scope, what is out of scope, and what types of testing do I need to plan?" },
  { label:"⚠️ Risk & edge cases",     text:"What are the highest-risk areas and most important edge cases I should focus on? Include boundary conditions and negative scenarios." },
  { label:"🔄 Existing test coverage",text:"Are there likely existing test cases or regression suites that might already cover parts of this feature? What should I check before writing new tests?" },
  { label:"🤖 Automation strategy",   text:"What parts of this feature can be automated with Playwright or Selenium? What should stay as manual testing and why?" },
  { label:"🔗 Dependencies & integrations", text:"What dependencies, integrations, and external systems need to be tested as part of this feature? What could break in other areas?" },
  { label:"✅ Acceptance criteria gaps", text:"Review the acceptance criteria. Are there obvious gaps, ambiguities, or untestable conditions? What's missing that a QA engineer would need?" },
  { label:"🔐 Security & performance", text:"What security vulnerabilities and performance risks should I test for? Include OWASP Top 10 considerations and load/response time requirements." },
];

// ─── Tiny UI Atoms ────────────────────────────────────────────────────────────
const Btn = ({children,onClick,variant="primary",disabled,size="md",title,style:sx={}}) => {
  const sz={sm:{padding:"4px 10px",fontSize:11},md:{padding:"7px 14px",fontSize:12},lg:{padding:"9px 18px",fontSize:13}}[size];
  const vs={
    primary:{background:T.accent,color:"#fff",border:"none"},
    secondary:{background:T.bgCard,color:T.text,border:`1px solid ${T.border}`},
    ghost:{background:"transparent",color:T.textMuted,border:`1px solid ${T.border}`},
    navy:{background:T.navy,color:"#fff",border:"none"},
    navyLight:{background:T.navyLight,color:"#fff",border:"none"},
    success:{background:T.greenBg,color:T.green,border:`1px solid ${T.greenBd}`},
    violet:{background:T.violetBg,color:T.violet,border:`1px solid ${T.violetBd}`},
    danger:{background:T.redBg,color:T.red,border:`1px solid ${T.redBd}`},
    amber:{background:T.amberBg,color:T.amber,border:`1px solid ${T.amberBd}`},
  }[variant]||{};
  return <button onClick={!disabled?onClick:undefined} disabled={disabled} title={title}
    style={{...sz,...vs,display:"inline-flex",alignItems:"center",gap:5,borderRadius:T.r,fontFamily:"inherit",fontWeight:600,cursor:disabled?"not-allowed":"pointer",opacity:disabled?0.5:1,transition:"opacity 0.15s",...sx}}>{children}</button>;
};

const Inp = ({label,value,onChange,multiline,rows=4,placeholder,hint,required,type="text",readOnly,style:sx={}}) => (
  <div style={{display:"flex",flexDirection:"column",gap:4,...sx}}>
    {label&&<label style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:"0.05em",textTransform:"uppercase"}}>{label}{required&&<span style={{color:T.accent,marginLeft:2}}>*</span>}</label>}
    {multiline
      ?<textarea value={value||""} onChange={e=>onChange?.(e.target.value)} placeholder={placeholder} rows={rows} readOnly={readOnly}
          style={{padding:"8px 10px",border:`1.5px solid ${T.border}`,borderRadius:T.r,fontFamily:"inherit",fontSize:12,color:T.text,background:readOnly?T.bgMuted:T.bgCard,resize:"vertical",outline:"none",lineHeight:1.65}}
          onFocus={e=>{if(!readOnly)e.target.style.borderColor=T.accent;}} onBlur={e=>e.target.style.borderColor=T.border}/>
      :<input type={type} value={value||""} onChange={e=>onChange?.(e.target.value)} placeholder={placeholder} readOnly={readOnly}
          style={{padding:"7px 10px",border:`1.5px solid ${T.border}`,borderRadius:T.r,fontFamily:"inherit",fontSize:12,color:T.text,background:readOnly?T.bgMuted:T.bgCard,outline:"none"}}
          onFocus={e=>{if(!readOnly)e.target.style.borderColor=T.accent;}} onBlur={e=>e.target.style.borderColor=T.border}/>
    }
    {hint&&<span style={{fontSize:10,color:T.textFaint}}>{hint}</span>}
  </div>
);

const Sel = ({label,value,onChange,options,style:sx={}}) => (
  <div style={{display:"flex",flexDirection:"column",gap:4,...sx}}>
    {label&&<label style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:"0.05em",textTransform:"uppercase"}}>{label}</label>}
    <select value={value||""} onChange={e=>onChange(e.target.value)}
      style={{padding:"6px 10px",border:`1.5px solid ${T.border}`,borderRadius:T.r,fontFamily:"inherit",fontSize:12,color:T.text,background:T.bgCard,outline:"none",cursor:"pointer"}}>
      {options.map(o=><option key={o.v??o} value={o.v??o}>{o.l??o}</option>)}
    </select>
  </div>
);

const Spin = ({label="Loading…",size=14}) => (
  <span style={{display:"inline-flex",alignItems:"center",gap:6,color:T.textMuted,fontSize:12}}>
    <svg width={size} height={size} viewBox="0 0 24 24" style={{animation:"spin 0.7s linear infinite",flexShrink:0}}>
      <circle cx="12" cy="12" r="10" fill="none" stroke={T.border} strokeWidth="3"/>
      <path d="M12 2a10 10 0 0 1 10 10" fill="none" stroke={T.accent} strokeWidth="3" strokeLinecap="round"/>
    </svg>{label}
  </span>
);

// ─── Icon set (Lucide-inspired, inline SVG) ──────────────────────────────────
const _ic = (size, children) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,display:"inline-block",verticalAlign:"middle"}}>{children}</svg>;
const Ic = {
  Refresh: ({size=14}) => _ic(size, <><path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/></>),
  Settings: ({size=14}) => _ic(size, <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>),
  Search: ({size=14}) => _ic(size, <><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>),
  Close: ({size=14}) => _ic(size, <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>),
  Copy: ({size=14}) => _ic(size, <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>),
  Check: ({size=14}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,display:"inline-block",verticalAlign:"middle"}}><polyline points="20 6 9 17 4 12"/></svg>,
  Send: ({size=14}) => _ic(size, <><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></>),
  ExternalLink: ({size=14}) => _ic(size, <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>),
  Beaker: ({size=14}) => _ic(size, <><path d="M9 3h6v5l5 11a2 2 0 0 1-1.8 3H5.8A2 2 0 0 1 4 19l5-11V3z"/><path d="M9 3h6"/></>),
  Factory: ({size=14}) => _ic(size, <><path d="M2 22h20V11l-7 4V11l-7 4V3H2z"/><line x1="6" y1="22" x2="6" y2="18"/><line x1="10" y1="22" x2="10" y2="18"/><line x1="14" y1="22" x2="14" y2="18"/><line x1="18" y1="22" x2="18" y2="18"/></>),
  Bot: ({size=14}) => _ic(size, <><rect x="3" y="8" width="18" height="12" rx="2"/><path d="M12 2v6"/><circle cx="9" cy="14" r="1"/><circle cx="15" cy="14" r="1"/></>),
  Message: ({size=14}) => _ic(size, <><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></>),
  FileText: ({size=14}) => _ic(size, <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></>),
  Microscope: ({size=14}) => _ic(size, <><path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h2"/><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2"/><path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/></>),
  Sparkles: ({size=14}) => _ic(size, <><path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z"/><path d="M19 17l.7 2.3L22 20l-2.3.7L19 23l-.7-2.3L16 20l2.3-.7z"/></>),
  Sun: ({size=14}) => _ic(size, <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></>),
  Moon: ({size=14}) => _ic(size, <><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></>),
  Plug: ({size=14}) => _ic(size, <><path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v4a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8z"/></>),
  ArrowRight: ({size=14}) => _ic(size, <><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></>),
  ArrowDown: ({size=14}) => _ic(size, <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>),
  Stop: ({size=14}) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" style={{flexShrink:0,display:"inline-block"}}><rect x="6" y="6" width="12" height="12" rx="1"/></svg>,
};

const StateBadge = ({state}) => {
  const m={New:{c:"#0369a1",bg:"#f0f9ff"},Active:{c:"#1d4ed8",bg:"#eff6ff"},"In Progress":{c:"#1d4ed8",bg:"#eff6ff"},Committed:{c:"#7c3aed",bg:"#f5f3ff"},Approved:{c:"#0891b2",bg:"#ecfeff"},Ready:{c:"#15803d",bg:"#f0fdf4"},"Ready for Testing":{c:"#7c3aed",bg:"#f5f3ff"},Resolved:{c:"#15803d",bg:"#f0fdf4"},Done:{c:"#15803d",bg:"#f0fdf4"},Closed:{c:"#475569",bg:"#f1f5f9"}}[state]||{c:T.textMuted,bg:T.bgMuted};
  return <span style={{padding:"1px 7px",borderRadius:T.rFull,fontSize:10,fontWeight:600,background:m.bg,color:m.c,whiteSpace:"nowrap"}}>{state||"—"}</span>;
};

const PriChip = ({p}) => {
  const c={Critical:T.red,High:T.amber,Medium:T.green,Low:T.textFaint}[p]||T.textFaint;
  return <span style={{fontSize:10,fontWeight:700,color:c}}>{p}</span>;
};

function ThemeToggle() {
  const [theme, setTheme] = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      onClick={()=>setTheme(dark ? "light" : "dark")}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      style={{width:32,height:32,borderRadius:T.r,border:`1px solid ${T.border}`,background:T.bgCard,color:T.textMuted,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center"}}
    >
      {dark ? <Ic.Sun size={15}/> : <Ic.Moon size={15}/>}
    </button>
  );
}

function ProviderModelHint({provider}) {
  if (provider === "copilot") return null;
  const route = MODEL_ROUTE[provider] || {};
  return (
    <div style={{padding:"8px 10px",border:`1px solid ${T.border}`,borderRadius:T.r,background:T.bgMuted,fontSize:11,color:T.textMuted,lineHeight:1.7}}>
      <div style={{fontWeight:700,color:T.text,marginBottom:3}}>Task routing</div>
      <div>Chat: <code>{route.chat}</code></div>
      <div>Review: <code>{route.review}</code></div>
      <div>Tests/Coverage: <code>{route.tests}</code> / <code>{route.coverage}</code></div>
    </div>
  );
}


// ─── GitHub Copilot device-flow login ────────────────────────────────────────
function CopilotAuthSection() {
  const [status, setStatus] = useState({checking:true, authed:false});
  const [device, setDevice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [models, setModels] = useState([]);
  const [chatModel, setChatModel] = useState(getCopilotModel());
  const [analysisModel, setAnalysisModelState] = useState(getAnalysisModel());
  const pollRef = useRef(null);

  useEffect(()=>{
    fetch("/api/copilot/auth/status").then(r=>r.json()).then(d=>setStatus({checking:false, authed:!!d.authenticated}))
      .catch(()=>setStatus({checking:false, authed:false}));
    return ()=>{ if(pollRef.current) clearInterval(pollRef.current); };
  },[]);

  useEffect(()=>{
    if(!status.authed) return;
    fetch("/api/copilot/models").then(r=>r.json()).then(d=>{
      const arr = Array.isArray(d?.data)?d.data:[];
      const ids = arr.filter(m=> m && (m.capabilities?.type==="chat" || !m.capabilities) && (m.model_picker_enabled!==false)).map(m=>m.id).filter(Boolean);
      setModels(Array.from(new Set(ids)));
    }).catch(()=>{});
  },[status.authed]);

  const start = async () => {
    setErr(null); setBusy(true);
    try {
      const r = await fetch("/api/copilot/auth/start",{method:"POST"});
      const d = await r.json();
      if(!r.ok || d.error) throw new Error(d.error || d.message || "Failed to start device flow");
      setDevice(d);
      setBusy(false);
    } catch(e){ setErr(e.message); setBusy(false); }
  };

  if(status.checking) return <div style={{fontSize:11,color:T.textMuted}}>Checking Copilot status…</div>;
  return (
    <div style={{display:"flex",flexDirection:"column",gap:8}}>
      <div style={{fontSize:11,color:T.textMuted,lineHeight:1.6}}>
        Routes through your <code>server.js</code> using the GitHub Copilot Chat API. Requires <code>GITHUB_CLIENT_ID</code> in <code>.env</code> (or <code>COPILOT_TOKEN</code>) and an active Copilot subscription on the GitHub account you sign in with.
      </div>
      {status.authed ? (
        <>
          <div style={{padding:"8px 10px",background:"#dcfce7",border:"1px solid #bbf7d0",color:"#166534",borderRadius:T.r,fontSize:12,fontWeight:700}}>✓ Connected to GitHub Copilot</div>
          {models.length>0 && (
            <div style={{display:"flex",flexDirection:"column",gap:6,fontSize:11,color:T.textMuted}}>
              <label style={{display:"flex",flexDirection:"column",gap:3}}>
                <span style={{fontWeight:700,color:T.text}}>Chat model <span style={{color:T.textFaint,fontWeight:400}}>(used in 🤖 panel)</span></span>
                <select value={chatModel} onChange={e=>{ setChatModel(e.target.value); setCopilotModel(e.target.value); }}
                  style={{fontSize:12,padding:"5px 8px",border:`1px solid ${T.border}`,borderRadius:4,background:T.bgCard,fontFamily:"monospace"}}>
                  {models.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <label style={{display:"flex",flexDirection:"column",gap:3}}>
                <span style={{fontWeight:700,color:T.text}}>Analysis model <span style={{color:T.textFaint,fontWeight:400}}>(Review / Generate Tests / Coverage)</span></span>
                <select value={analysisModel} onChange={e=>{ setAnalysisModelState(e.target.value); setAnalysisModel(e.target.value); }}
                  style={{fontSize:12,padding:"5px 8px",border:`1px solid ${T.border}`,borderRadius:4,background:T.bgCard,fontFamily:"monospace"}}>
                  {models.map(m=><option key={m} value={m}>{m}</option>)}
                </select>
              </label>
              <div style={{fontSize:10,color:T.textFaint,lineHeight:1.5}}>
                <strong>Recommendations:</strong> Chat → <code>gpt-4o</code> or <code>claude-sonnet-4.6</code> (fast). Analysis → <code>claude-opus-4.7</code> or <code>gpt-5</code> (deeper reasoning, longer JSON output).
              </div>
            </div>
          )}
        </>
      ) : device ? (
        <div style={{padding:"10px 12px",background:T.blueBg,border:`1px solid ${T.blueBd}`,borderRadius:T.r,fontSize:12,lineHeight:1.6}}>
          <div>1. Open <a href={device.verification_uri} target="_blank" rel="noopener" style={{color:T.blue,fontWeight:700}}>{device.verification_uri}</a></div>
          <div>2. Enter code: <code style={{fontSize:14,fontWeight:700,letterSpacing:"0.1em",background:"#fff",padding:"2px 6px",borderRadius:4}}>{device.user_code}</code></div>
          <div style={{marginTop:6,color:T.textMuted}}>Waiting for confirmation…</div>
          <button onClick={async ()=>{
            setErr(null);
            try {
              const pr = await fetch("/api/copilot/auth/poll",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({device_code:device.device_code})});
              const pd = await pr.json();
              if(pd.ok){ if(pollRef.current) clearInterval(pollRef.current); setStatus({checking:false,authed:true}); setDevice(null); setBusy(false); }
              else if(pd.error==="authorization_pending"){ setErr("Not authorized yet — finish the GitHub page first."); }
              else { setErr(pd.error_description||pd.error||"Unknown error"); }
            } catch(e){ setErr(e.message); }
          }} style={{marginTop:8,padding:"6px 10px",border:"none",background:T.blue,color:"#fff",borderRadius:4,cursor:"pointer",fontSize:11,fontWeight:700}}>I've authorized — check now</button>
        </div>
      ) : (
        <button onClick={start} disabled={busy} style={{padding:"8px 12px",border:"none",background:T.navy,color:"#fff",borderRadius:T.r,cursor:busy?"default":"pointer",fontSize:12,fontWeight:700}}>{busy?"Starting…":"Sign in with GitHub"}</button>
      )}
      {err && <div style={{fontSize:11,color:T.accent}}>{err}</div>}
    </div>
  );
}

// ─── Settings Panel (API key management) ─────────────────────────────────────
function SettingsPanel({ onClose, onSaved }) {
  const [provider, setProvider] = useState(getAIProvider());
  const [key, setKey] = useState(getApiKey());
  const [saved, setSaved] = useState(false);
  const save = () => {
    localStorage.setItem("qa-hub-ai-provider", provider);
    if(provider==="copilot") { /* nothing to save — token lives on server */ }
    else localStorage.setItem(provider==="openai"?"qa-hub-openai-key":"qa-hub-anthropic-key", key.trim());
    onSaved?.(provider==="copilot" || !!key.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };
  const changeProvider = (next) => {
    setProvider(next);
    setKey(next==="openai" ? (localStorage.getItem("qa-hub-openai-key")||"") : next==="anthropic" ? (localStorage.getItem("qa-hub-anthropic-key")||localStorage.getItem("qa-hub-apikey")||"") : "");
  };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}} onClick={onClose}>
      <div style={{background:T.bgCard,borderRadius:T.rLg,padding:28,width:460,boxShadow:"0 20px 60px rgba(0,0,0,0.2)"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <h3 style={{fontSize:T.fs.xl,fontWeight:T.fw.bold,color:T.text,fontFamily:T.fontDisplay,margin:0,display:"flex",alignItems:"center",gap:8}}><Ic.Settings size={18}/> Settings</h3>
          <button onClick={onClose} aria-label="Close settings" style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:T.textFaint,display:"inline-flex",alignItems:"center",justifyContent:"center"}}><Ic.Close size={18}/></button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:16}}>
          <label style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:"0.05em",textTransform:"uppercase"}}>AI Provider <span style={{color:T.accent}}>*</span></label>
          <div style={{display:"flex",gap:8,marginBottom:8,flexWrap:"wrap"}}>
            <button type="button" onClick={()=>changeProvider("copilot")} style={{flex:"1 1 45%",padding:"8px 10px",border:`1.5px solid ${provider==="copilot"?T.blue:T.border}`,borderRadius:T.r,background:provider==="copilot"?T.blueBg:T.bgCard,color:provider==="copilot"?T.blue:T.text,fontSize:12,fontWeight:700,cursor:"pointer"}}>GitHub Copilot</button>
            <button type="button" onClick={()=>changeProvider("openai")} style={{flex:"1 1 45%",padding:"8px 10px",border:`1.5px solid ${provider==="openai"?T.blue:T.border}`,borderRadius:T.r,background:provider==="openai"?T.blueBg:T.bgCard,color:provider==="openai"?T.blue:T.text,fontSize:12,fontWeight:700,cursor:"pointer"}}>OpenAI</button>
            <button type="button" onClick={()=>changeProvider("anthropic")} style={{flex:"1 1 45%",padding:"8px 10px",border:`1.5px solid ${provider==="anthropic"?T.blue:T.border}`,borderRadius:T.r,background:provider==="anthropic"?T.blueBg:T.bgCard,color:provider==="anthropic"?T.blue:T.text,fontSize:12,fontWeight:700,cursor:"pointer"}}>Anthropic</button>
          </div>
          {provider==="copilot"? <CopilotAuthSection/> : <>
            <label style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:"0.05em",textTransform:"uppercase"}}>{provider==="openai"?"OpenAI":"Anthropic"} API Key <span style={{color:T.accent}}>*</span></label>
            <input type="password" value={key} onChange={e=>setKey(e.target.value)}
              placeholder={provider==="openai"?"sk-...":"sk-ant-..."}
              style={{padding:"8px 11px",border:`1.5px solid ${T.border}`,borderRadius:T.r,fontFamily:"monospace",fontSize:12,color:T.text,background:T.bgCard,outline:"none"}}
              onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
            <ProviderModelHint provider={provider}/>
          </>}
          <span style={{fontSize:10,color:T.textFaint}}>
            {provider==="openai"?<>Get yours at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" style={{color:T.blue}}>platform.openai.com/api-keys ↗</a>.</>:provider==="anthropic"?<>Get yours at <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener" style={{color:T.blue}}>console.anthropic.com/settings/keys ↗</a>.</>:<>Sign in with your GitHub account that has Copilot access — token stays on the server.</>}
            {provider!=="copilot"&&" Stored only in this browser (localStorage), never sent anywhere except the selected AI provider."}
          </span>
        </div>
        <div style={{padding:"9px 12px",background:T.amberBg,border:`1px solid ${T.amberBd}`,borderRadius:T.r,fontSize:11,color:"#78350f",marginBottom:16,lineHeight:1.6}}>
          <strong>Security note:</strong> For personal/team-internal use, storing the key in the browser is fine.
          For a shared or public deployment, run the included <code>server.js</code> proxy instead — it keeps the key server-side.
        </div>
        <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={save}>{saved ? "✓ Saved!" : "Save Key"}</Btn>
        </div>
      </div>
    </div>
  );
}

// ─── Connection Screen ────────────────────────────────────────────────────────
function ConnectScreen({onConnect}) {
  const [org,setOrg]=useState(""); const [pat,setPat]=useState("");
  const [projs,setProjs]=useState([]); const [loading,setLoading]=useState(false);
  const [err,setErr]=useState(null); const [tested,setTested]=useState(false);
  const [usingProxy,setUsingProxy]=useState(false);

  const handleTest=async()=>{
    if(!org||!pat){setErr("Both fields required.");return;}
    setLoading(true);setErr(null);setProjs([]);setTested(false);setUsingProxy(false);
    try{
      const list=await adoListProjects(org,pat);
      setProjs(list);setTested(true);
      setUsingProxy(isProxyMode());
    }catch(e){
      // Give a much clearer message for the common CORS case
      if(e.message.includes("Both direct and proxy")){
        setErr("Connection blocked. Try: (1) check your org name is correct, (2) verify your PAT has Work Items: Read scope, (3) try a different browser or disable browser extensions.");
      } else {
        setErr(e.message);
      }
    }
    setLoading(false);
  };

  return (
    <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:T.bg,overflowY:"auto",padding:"20px 0",position:"relative",fontFamily:T.font}}>
      <div style={{position:"fixed",top:14,right:14,zIndex:5}}><ThemeToggle/></div>
      <div style={{width:520,display:"flex",flexDirection:"column",gap:0}}>
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{width:48,height:48,borderRadius:12,background:T.accent,display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,margin:"0 auto 12px",color:"#fff"}}><Ic.Beaker size={25}/></div>
          <h1 style={{fontSize:T.fs.xxl,fontWeight:T.fw.bold,color:T.text,fontFamily:T.fontDisplay,margin:"0 0 6px"}}>QA Intelligence Hub</h1>
          <p style={{fontSize:13,color:T.textMuted,margin:0,lineHeight:1.6}}>Connect to Azure DevOps to browse work items, review stories, generate test cases, and research testing scope with AI.</p>
        </div>

        <div style={{background:T.bgCard,borderRadius:T.rLg,border:`1px solid ${T.border}`,padding:24,boxShadow:T.shMd,display:"flex",flexDirection:"column",gap:14}}>
          <Inp label="Organization URL or Name" required value={org} onChange={v=>setOrg(v)}
            placeholder="Nucor-NBT  or  https://dev.azure.com/Nucor-NBT"
            hint="Paste the full URL or just the org name — both work"/>
          <div style={{display:"flex",flexDirection:"column",gap:4}}>
            <label style={{fontSize:11,fontWeight:700,color:T.textMuted,letterSpacing:"0.05em",textTransform:"uppercase"}}>Personal Access Token <span style={{color:T.accent}}>*</span></label>
            <input type="password" value={pat} onChange={e=>setPat(e.target.value)} placeholder="Paste your PAT here"
              style={{padding:"7px 10px",border:`1.5px solid ${T.border}`,borderRadius:T.r,fontFamily:"monospace",fontSize:12,color:T.text,background:T.bgCard,outline:"none"}}
              onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
            <span style={{fontSize:10,color:T.textFaint}}>ADO → top-right avatar → Personal Access Tokens → New Token → scope: <strong>Work Items: Read</strong> (+ Write to post comments back)</span>
          </div>

          {err&&(
            <div style={{padding:"10px 12px",background:T.redBg,border:`1px solid ${T.redBd}`,borderRadius:T.r}}>
              <div style={{fontSize:12,fontWeight:700,color:T.red,marginBottom:4}}>Connection failed</div>
              <div style={{fontSize:11,color:"#991b1b",lineHeight:1.6}}>{err}</div>
            </div>
          )}

          {usingProxy&&!err&&(
            <div style={{padding:"7px 10px",background:"#f0fdf4",border:"1px solid #86efac",borderRadius:T.r,fontSize:11,color:"#166534"}}>
              ✓ Connected through bundled QAHub ADO proxy
            </div>
          )}

          {tested&&projs.length>0&&(
            <div style={{display:"flex",flexDirection:"column",gap:6}}>
              <div style={{fontSize:12,color:T.green,fontWeight:600}}>✓ {projs.length} project{projs.length!==1?"s":""} found — select one to open:</div>
              <div style={{display:"flex",flexDirection:"column",gap:4,maxHeight:220,overflowY:"auto"}}>
                {projs.map(p=>(
                  <button key={p.id} onClick={()=>onConnect({org:parseOrg(org),pat,projectId:p.id,projectName:p.name,connectedAt:now()})}
                    style={{textAlign:"left",padding:"10px 14px",borderRadius:T.r,border:`1.5px solid ${T.border}`,background:T.bgCard,cursor:"pointer",display:"flex",alignItems:"center",gap:10,transition:"all 0.15s"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=T.accent;e.currentTarget.style.background=T.accentLight;}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.background=T.bgCard;}}>
                    <span style={{fontSize:18}}>📋</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:T.text}}>{p.name}</div>
                      <div style={{fontSize:10,color:T.textMuted}}>{p.description?.slice(0,80)||"Click to open this project →"}</div>
                    </div>
                    <span style={{color:T.accent,fontSize:18,flexShrink:0}}>→</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <Btn variant="navy" onClick={handleTest} disabled={loading||!org||!pat} style={{width:"100%",justifyContent:"center"}}>
            {loading?<Spin label="Connecting…"/>:<><Ic.Plug size={14}/> Connect & List Projects</>}
          </Btn>
        </div>

        <div style={{marginTop:12,padding:10,background:T.amberBg,border:`1px solid ${T.amberBd}`,borderRadius:T.r,fontSize:11,color:"#78350f",lineHeight:1.7}}>
          <strong>Creating a PAT:</strong> Azure DevOps → top-right avatar → Personal Access Tokens → New Token → Organization: All accessible orgs → Scope: <strong>Work Items: Read</strong> (optionally add Write) → set an expiry → Create → copy the token immediately
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Work Item List (Left Panel) ──────────────────────────────────────────────
function WorkItemList({conn, items, loading, err, lastWiql, filters, setFilters, onFetch, onResetFilters, areas, iters, selectedId, onSelect}) {
  const [search,setSearch]=useState("");
  const [showDebug,setShowDebug]=useState(false);

  const displayed = items.filter(item=> {
    if (!search) return true;
    const s = search.toLowerCase();
    return String(item.id).includes(s) || item.title.toLowerCase().includes(s) || item.type.toLowerCase().includes(s);
  });

  const togType  = t => { const nt=filters.types.includes(t)?filters.types.filter(x=>x!==t):[...filters.types,t]; setFilters(f=>({...f,types:nt})); };
  const togState = s => { const ns=filters.states.includes(s)?filters.states.filter(x=>x!==s):[...filters.states,s]; setFilters(f=>({...f,states:ns})); };
  const pc={Critical:T.red,High:T.amber,Medium:T.green,Low:T.textFaint};

  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",background:T.bgCard}}>
      {/* Header */}
      <div style={{padding:"10px 12px",background:T.navy,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:2}}>
          <span style={{fontSize:16,color:T.accent,display:"inline-flex"}}><Ic.Beaker size={16}/></span>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontSize:12,fontWeight:700,color:"#eeedf0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{conn.projectName}</div>
            <div style={{fontSize:9,color:"#5a5e7e"}}>{conn.org} {isProxyMode()&&<span style={{color:"#6fcf97",marginLeft:4}}>· via proxy</span>}</div>
          </div>
          <button onClick={()=>onFetch()} disabled={loading} title="Refresh"
            style={{background:"none",border:"1px solid #3d4468",borderRadius:5,padding:"3px 7px",cursor:"pointer",color:"#8890b0",fontSize:11}}>
            {loading?"…":<Ic.Refresh size={13}/>}
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{padding:"8px 10px",borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="🔍 Search title or ID…"
          style={{width:"100%",padding:"5px 8px",border:`1.5px solid ${T.border}`,borderRadius:T.r,fontFamily:"inherit",fontSize:11,color:T.text,background:T.bg,outline:"none"}}
          onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
      </div>

      {/* Filters */}
      <div style={{padding:"8px 10px",borderBottom:`1px solid ${T.border}`,flexShrink:0,display:"flex",flexDirection:"column",gap:7,background:T.bgMuted}}>
        {/* Area + Iteration */}
        <div style={{display:"flex",gap:5}}>
          {areas.length>0
            ?<select value={filters.areaPath} onChange={e=>setFilters(f=>({...f,areaPath:e.target.value}))}
                style={{flex:1,padding:"4px 6px",border:`1px solid ${T.border}`,borderRadius:T.r,fontFamily:"inherit",fontSize:10,color:T.text,background:T.bgCard,cursor:"pointer"}}>
                <option value="">All Areas</option>
                {areas.map(a=><option key={a} value={a}>{a.split("\\").pop()}</option>)}
              </select>
            :<input value={filters.areaPath} onChange={e=>setFilters(f=>({...f,areaPath:e.target.value}))} placeholder="Area path…"
                style={{flex:1,padding:"4px 6px",border:`1px solid ${T.border}`,borderRadius:T.r,fontFamily:"inherit",fontSize:10,background:T.bgCard,outline:"none"}}/>
          }
          {iters.length>0
            ?<select value={filters.iterPath} onChange={e=>setFilters(f=>({...f,iterPath:e.target.value}))}
                style={{flex:1,padding:"4px 6px",border:`1px solid ${T.border}`,borderRadius:T.r,fontFamily:"inherit",fontSize:10,color:T.text,background:T.bgCard,cursor:"pointer"}}>
                <option value="">All Sprints</option>
                {iters.map(i=><option key={i} value={i}>{i.split("\\").pop()}</option>)}
              </select>
            :<input value={filters.iterPath} onChange={e=>setFilters(f=>({...f,iterPath:e.target.value}))} placeholder="Iteration…"
                style={{flex:1,padding:"4px 6px",border:`1px solid ${T.border}`,borderRadius:T.r,fontFamily:"inherit",fontSize:10,background:T.bgCard,outline:"none"}}/>
          }
        </div>
        <input value={filters.assignedTo} onChange={e=>setFilters(f=>({...f,assignedTo:e.target.value}))} placeholder="Assigned to…"
          style={{width:"100%",padding:"4px 6px",border:`1px solid ${T.border}`,borderRadius:T.r,fontFamily:"inherit",fontSize:10,color:T.text,background:T.bgCard,outline:"none"}}/>

        {/* Type chips */}
        <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
          <span style={{fontSize:9,color:T.textFaint,alignSelf:"center",marginRight:2}}>TYPE:</span>
          <button onClick={()=>setFilters(f=>({...f,types:[]}))} style={{padding:"2px 6px",fontSize:9,fontWeight:700,cursor:"pointer",borderRadius:T.rFull,background:!filters.types.length?T.violet:T.bgCard,color:!filters.types.length?"#fff":T.textMuted,border:`1px solid ${!filters.types.length?T.violet:T.border}`,transition:"all 0.12s"}}>All</button>
          {WI_TYPES.map(t=>{const on=filters.types.includes(t);return(
            <button key={t} onClick={()=>togType(t)} style={{padding:"2px 6px",fontSize:9,fontWeight:600,cursor:"pointer",borderRadius:T.rFull,background:on?T.navy:T.bgCard,color:on?"#fff":T.textMuted,border:`1px solid ${on?T.navy:T.border}`,transition:"all 0.12s"}}>
              {WI_ICON[t]||""} {t.replace("Product Backlog Item","PBI")}
            </button>
          );})}
        </div>

        {/* State chips */}
        <div style={{display:"flex",gap:3,flexWrap:"wrap"}}>
          <span style={{fontSize:9,color:T.textFaint,alignSelf:"center",marginRight:2}}>STATE:</span>
          <button onClick={()=>setFilters(f=>({...f,states:[]}))} style={{padding:"2px 6px",fontSize:9,fontWeight:700,cursor:"pointer",borderRadius:T.rFull,background:!filters.states.length?T.violet:T.bgCard,color:!filters.states.length?"#fff":T.textMuted,border:`1px solid ${!filters.states.length?T.violet:T.border}`,transition:"all 0.12s"}}>All</button>
          {ALL_STATES.map(s=>{const on=filters.states.includes(s);return(
            <button key={s} onClick={()=>togState(s)} style={{padding:"2px 6px",fontSize:9,fontWeight:600,cursor:"pointer",borderRadius:T.rFull,background:on?T.navyMid:T.bgCard,color:on?"#fff":T.textMuted,border:`1px solid ${on?T.navyMid:T.border}`,transition:"all 0.12s"}}>{s}</button>
          );})}
        </div>

        {/* Apply / Reset */}
        <div style={{display:"flex",gap:6}}>
          <Btn variant="navy" size="sm" style={{flex:1}} onClick={()=>onFetch()} disabled={loading}>
            {loading?<Spin label="Fetching…"/>:"Apply Filters"}
          </Btn>
          <Btn variant="ghost" size="sm" onClick={onResetFilters} title="Clear all filters"><Ic.Close size={12}/> Reset</Btn>
          <button onClick={()=>setShowDebug(v=>!v)} style={{fontSize:10,color:T.textFaint,background:"none",border:"none",cursor:"pointer",padding:"0 4px"}}>SQL</button>
        </div>
      </div>

      {/* Debug WIQL */}
      {showDebug&&lastWiql&&(
        <div style={{padding:"6px 10px",background:"#1e1e2e",flexShrink:0}}>
          <div style={{fontSize:9,color:"#888",marginBottom:2,letterSpacing:"0.06em",textTransform:"uppercase"}}>WIQL</div>
          <pre style={{fontSize:9,color:"#a8d8a8",margin:0,whiteSpace:"pre-wrap",wordBreak:"break-all",fontFamily:"monospace"}}>{lastWiql}</pre>
        </div>
      )}

      {/* Error */}
      {err&&(
        <div style={{padding:"10px 12px",background:T.redBg,borderBottom:`1px solid ${T.redBd}`,flexShrink:0}}>
          <div style={{fontSize:12,fontWeight:700,color:T.red,marginBottom:3}}>⚠ Fetch failed</div>
          <div style={{fontSize:11,color:"#991b1b",lineHeight:1.6,marginBottom:6}}>{err}</div>
          <Btn variant="danger" size="sm" onClick={onResetFilters}>Reset & Retry</Btn>
        </div>
      )}

      {/* Count bar */}
      <div style={{padding:"4px 10px",borderBottom:`1px solid ${T.border}`,fontSize:10,color:T.textFaint,flexShrink:0,display:"flex",justifyContent:"space-between"}}>
        <span>{displayed.length} item{displayed.length!==1?"s":""}{items.length!==displayed.length?` (${items.length} total)`:""}</span>
        {loading&&<Spin label="" size={10}/>}
      </div>

      {/* Item list */}
      <div style={{flex:1,overflowY:"auto"}}>
        {!loading&&!err&&items.length===0&&(
          <div style={{textAlign:"center",padding:"28px 12px",color:T.textMuted}}>
            <div style={{fontSize:24,marginBottom:6}}>📭</div>
            <div style={{fontSize:12,fontWeight:600,color:T.text,marginBottom:4}}>No work items found</div>
            <div style={{fontSize:10,marginBottom:10,lineHeight:1.6}}>Try clearing all filters — make sure "All States" is selected.</div>
            <Btn variant="navy" size="sm" onClick={onResetFilters}>Reset Filters</Btn>
          </div>
        )}
        {displayed.map(item=>{
          const isSel=item.id===selectedId;
          return(
            <div key={item.id} onClick={()=>onSelect(item)}
              style={{padding:"9px 12px",borderBottom:`1px solid ${T.border}`,cursor:"pointer",background:isSel?T.accentLight:"transparent",borderLeft:isSel?`3px solid ${T.accent}`:"3px solid transparent",transition:"all 0.1s"}}
              onMouseEnter={e=>{if(!isSel)e.currentTarget.style.background=T.bgMuted;}} onMouseLeave={e=>{if(!isSel)e.currentTarget.style.background="transparent";}}>
              <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
                <span style={{fontSize:11,color:T.textFaint,fontFamily:"monospace",fontWeight:600,flexShrink:0}}>#{item.id}</span>
                <span style={{fontSize:9,color:T.textMuted,fontWeight:600,flexShrink:0}}>{WI_ICON[item.type]||"📋"}</span>
                <StateBadge state={item.state}/>
                <PriChip p={item.priority}/>
                {item.hasAC?<span style={{fontSize:9,color:T.green,fontWeight:700}}>✓AC</span>:<span style={{fontSize:9,color:T.amber,fontWeight:700}}>!AC</span>}
              </div>
              <div style={{fontSize:12,fontWeight:600,color:isSel?T.accent:T.text,lineHeight:1.4,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>{item.title}</div>
              {item.assignedTo&&<div style={{fontSize:10,color:T.textFaint,marginTop:2}}>👤 {item.assignedTo}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── AI Research Chat ─────────────────────────────────────────────────────────
function ChatPanel({item}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const bottomRef = useRef(null);
  const prevItemId = useRef(null);

  // Reset chat when item changes
  useEffect(()=>{
    if(prevItemId.current !== item?.id) {
      setMessages([]);
      setInput("");
      setErr(null);
      prevItemId.current = item?.id;
    }
  },[item?.id]);

  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages]);

  const send = async(text) => {
    const userMsg = text || input.trim();
    if (!userMsg || loading) return;
    setInput("");
    setErr(null);
    const newMessages = [...messages, {role:"user", content:userMsg}];
    setMessages(newMessages);
    setLoading(true);
    try {
      const system = buildChatSystemPrompt(item);
      // Keep only last 6 turns to limit prompt size for local models
      const history = newMessages.slice(-6).map(m=>({role:m.role, content:m.content}));
      // Insert a streaming placeholder, then update it as chunks arrive
      setMessages(prev=>[...prev, {role:"assistant", content:""}]);
      const reply = await callClaude(
        system,
        history,
        800,
        false,
        (partial)=>{
          setMessages(prev=>{
            const copy=prev.slice();
            copy[copy.length-1]={role:"assistant", content:partial};
            return copy;
          });
        }
      );
      setMessages(prev=>{
        const copy=prev.slice();
        copy[copy.length-1]={role:"assistant", content:reply||copy[copy.length-1].content};
        return copy;
      });
    } catch(e) {
      setErr(e.message);
    }
    setLoading(false);
  };

  const handleKey = e => { if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();} };

  if (!item) return (
    <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",color:T.textMuted,flexDirection:"column",gap:8,padding:24}}>
      <span style={{fontSize:32,color:T.accent}}><Ic.Message size={32}/></span>
      <div style={{fontSize:13,fontWeight:600,color:T.text,fontFamily:T.fontDisplay}}>AI Research Chat</div>
      <div style={{fontSize:12,textAlign:"center",maxWidth:260,lineHeight:1.7}}>Select a work item to start researching testing scope, risks, and edge cases with AI.</div>
    </div>
  );

  return (
    <div style={{height:"100%",display:"flex",flexDirection:"column"}}>
      {/* Quick prompt buttons */}
      <div style={{padding:"8px 12px",borderBottom:`1px solid ${T.border}`,background:T.bgMuted,flexShrink:0}}>
        <div style={{fontSize:10,fontWeight:700,color:T.textFaint,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:5}}>Quick Research</div>
        <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
          {QUICK_PROMPTS.map(qp=>(
            <button key={qp.label} onClick={()=>send(qp.text)} disabled={loading}
              style={{padding:"3px 8px",fontSize:10,fontWeight:600,cursor:loading?"not-allowed":"pointer",borderRadius:T.rFull,background:T.bgCard,color:T.navy,border:`1px solid ${T.border}`,transition:"all 0.12s",opacity:loading?0.5:1}}
              onMouseEnter={e=>{if(!loading){e.target.style.background=T.navy;e.target.style.color="#fff";}}} onMouseLeave={e=>{e.target.style.background=T.bgCard;e.target.style.color=T.navy;}}>
              {qp.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:12}}>
        {messages.length===0&&(
          <div style={{textAlign:"center",padding:"32px 16px",color:T.textMuted}}>
          <div style={{fontSize:28,marginBottom:8,color:T.accent}}><Ic.Microscope size={28}/></div>
            <div style={{fontSize:13,fontWeight:600,color:T.text,marginBottom:6,fontFamily:T.fontDisplay}}>Research #{item.id}: {item.title}</div>
            <div style={{fontSize:11,lineHeight:1.7,maxWidth:340,margin:"0 auto"}}>Ask anything about testing scope, risks, edge cases, or existing test coverage. Use the quick prompts above or type your own question.</div>
          </div>
        )}
        {messages.map((msg,i)=>(
          <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",flexDirection:msg.role==="user"?"row-reverse":"row"}}>
            <div style={{width:28,height:28,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,
              background:msg.role==="user"?T.accent:T.navy,color:"#fff"}}>
              {msg.role==="user"?"U":"AI"}
            </div>
            <div style={{maxWidth:"82%",padding:"10px 13px",borderRadius:msg.role==="user"?`${T.rLg} ${T.rLg} 4px ${T.rLg}`:`${T.rLg} ${T.rLg} ${T.rLg} 4px`,
              background:msg.role==="user"?T.accent:T.bgCard,color:msg.role==="user"?"#fff":T.text,
              fontSize:12,lineHeight:1.7,border:msg.role==="assistant"?`1px solid ${T.border}`:"none",
              boxShadow:msg.role==="assistant"?T.sh:"none",
              whiteSpace:"pre-wrap",wordBreak:"break-word"}}>
              {msg.content}
            </div>
          </div>
        ))}
        {loading&&(
          <div style={{display:"flex",gap:8,alignItems:"flex-start"}}>
            <div style={{width:28,height:28,borderRadius:"50%",background:T.navy,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0}}>AI</div>
            <div style={{padding:"10px 14px",borderRadius:`${T.rLg} ${T.rLg} ${T.rLg} 4px`,background:T.bgCard,border:`1px solid ${T.border}`}}>
              <Spin label="Thinking…"/>
            </div>
          </div>
        )}
        {err&&<div style={{padding:"8px 12px",background:T.redBg,border:`1px solid ${T.redBd}`,borderRadius:T.r,fontSize:11,color:T.red}}>⚠ {err}</div>}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div style={{padding:"10px 12px",borderTop:`1px solid ${T.border}`,background:T.bgCard,flexShrink:0}}>
        <div style={{display:"flex",gap:6}}>
          <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={handleKey}
            placeholder="Ask about testing scope, risks, edge cases, existing coverage… (Enter to send, Shift+Enter for new line)"
            rows={2}
            style={{flex:1,padding:"8px 10px",border:`1.5px solid ${T.border}`,borderRadius:T.r,fontFamily:"inherit",fontSize:12,color:T.text,background:T.bg,resize:"none",outline:"none",lineHeight:1.6}}
            onFocus={e=>e.target.style.borderColor=T.accent} onBlur={e=>e.target.style.borderColor=T.border}/>
          <Btn variant="navy" onClick={()=>send()} disabled={!input.trim()||loading} style={{alignSelf:"flex-end",padding:"8px 14px"}}>
            {loading?<Spin label="" size={12}/>:"Send ↑"}
          </Btn>
        </div>
        {messages.length>0&&<div style={{marginTop:6,display:"flex",gap:6}}>
          <button onClick={()=>setMessages([])} style={{fontSize:10,color:T.textFaint,background:"none",border:"none",cursor:"pointer"}}>🗑 Clear chat</button>
          <span style={{fontSize:10,color:T.textFaint}}>{messages.length} messages</span>
        </div>}
      </div>
    </div>
  );
}

// ─── Review Panel ─────────────────────────────────────────────────────────────
function ReviewPanel({review, onApplyImproved, loading}) {
  const [tab,setTab]=useState("overview");
  if(loading) return <div style={{padding:32,textAlign:"center"}}><Spin label="Analyzing with Claude AI…" size={16}/></div>;
  if(!review) return <div style={{padding:40,textAlign:"center",color:T.textMuted}}><div style={{fontSize:32,marginBottom:10,color:T.accent}}><Ic.Search size={32}/></div><div style={{fontSize:14,fontWeight:600,color:T.text,fontFamily:T.fontDisplay,marginBottom:5}}>Review this work item</div><div style={{fontSize:12,maxWidth:280,margin:"0 auto",lineHeight:1.7}}>Click <strong>Review</strong> to score 8 quality dimensions and get improvement suggestions before generating test cases.</div></div>;
  const sc=review.score; const scC=sc>=8?T.green:sc>=6?T.amber:T.red;
  const sv={critical:T.red,major:T.amber,minor:T.textMuted};
  const DL={persona:"👤 Persona",action:"⚡ Action",value:"💡 Value",acceptanceCriteria:"✅ Acceptance Criteria",scope:"📐 Scope",edgeCases:"🔀 Edge Cases",nonFunctional:"⚙ Non-Functional",testData:"🗃 Test Data"};
  const tS=t=>({padding:"6px 12px",fontSize:12,fontWeight:600,cursor:"pointer",border:"none",background:tab===t?T.bgCard:"transparent",color:tab===t?T.accent:T.textMuted,borderRadius:T.r,transition:"all 0.15s"});
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:12,background:T.bgCard,flexShrink:0}}>
        <div style={{width:52,height:52,borderRadius:"50%",border:`3px solid ${scC}`,display:"flex",alignItems:"center",justifyContent:"center",background:scC+"12",flexShrink:0}}>
          <span style={{fontSize:18,fontWeight:700,color:scC,fontFamily:T.fontDisplay}}>{sc}</span>
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:12,color:T.text,lineHeight:1.6,marginBottom:4}}>{review.summary}</div>
          {review.readyForTesting
            ?<span style={{fontSize:11,color:T.green,fontWeight:700,background:T.greenBg,padding:"2px 8px",borderRadius:T.rFull,border:`1px solid ${T.greenBd}`}}>✓ Ready for test generation</span>
            :<span style={{fontSize:11,color:T.red,fontWeight:700,background:T.redBg,padding:"2px 8px",borderRadius:T.rFull,border:`1px solid ${T.redBd}`}}>⚠ Score &lt; 7 — improve story first</span>}
        </div>
      </div>
      <div style={{display:"flex",gap:4,padding:"6px 12px",background:T.bgMuted,borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
        {[["overview","Overview"],["issues",`Issues (${review.issues?.length||0})`],["improve","Improved"],["dims","Dimensions"]].map(([t,l])=>
          <button key={t} style={tS(t)} onClick={()=>setTab(t)}>{l}</button>)}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"12px 16px"}}>
        {tab==="overview"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
          {review.blockers?.length>0&&<div style={{background:T.redBg,border:`1px solid ${T.redBd}`,borderRadius:T.rLg,padding:10}}><div style={{fontSize:11,fontWeight:700,color:T.red,marginBottom:5}}>🚫 BLOCKERS</div>{review.blockers.map((b,i)=><div key={i} style={{fontSize:11,color:"#991b1b",padding:"1px 0"}}>• {b}</div>)}</div>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
            {Object.entries(review.dimensions||{}).map(([k,d])=>{const c=d.score===3?T.green:d.score===2?T.amber:T.red;return(
              <div key={k} style={{padding:"8px 10px",borderRadius:T.r,border:`1px solid ${c}30`,background:c+"08"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:11,fontWeight:700,color:T.text}}>{DL[k]||k}</span><span style={{fontSize:9,fontWeight:700,color:c}}>{["","Poor","Partial","Clear"][d.score]}</span></div>
                <div style={{height:3,background:T.bgMuted,borderRadius:2,overflow:"hidden",marginBottom:3}}><div style={{height:"100%",width:`${(d.score/3)*100}%`,background:c,transition:"width 0.6s"}}/></div>
                <div style={{fontSize:10,color:T.textMuted,lineHeight:1.5}}>{d.comment}</div>
              </div>);})}
          </div>
        </div>}
        {tab==="issues"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>
          {!review.issues?.length&&<div style={{color:T.textMuted,textAlign:"center",padding:20,fontSize:13}}>✓ No issues found</div>}
          {review.issues?.map((iss,i)=><div key={i} style={{borderLeft:`3px solid ${sv[iss.severity]||T.textMuted}`,paddingLeft:10,paddingTop:1,paddingBottom:2}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}><span style={{fontSize:9,fontWeight:700,color:sv[iss.severity]||T.textMuted,textTransform:"uppercase",letterSpacing:"0.07em"}}>{iss.severity}</span><span style={{fontSize:12,fontWeight:600,color:T.text}}>{iss.title}</span></div>
            <div style={{fontSize:11,color:T.textMuted,lineHeight:1.6,marginBottom:iss.impact?2:0}}>{iss.description}</div>
            {iss.impact&&<div style={{fontSize:10,color:T.textFaint,fontStyle:"italic"}}>QA Impact: {iss.impact}</div>}
          </div>)}
          {review.suggestions?.length>0&&<><div style={{height:1,background:T.border,margin:"4px 0"}}/>{review.suggestions.map((s,i)=><div key={i} style={{padding:"8px 10px",borderRadius:T.r,background:T.amberBg,border:`1px solid ${T.amberBd}`,marginBottom:5}}><div style={{fontSize:11,fontWeight:700,color:T.amber,marginBottom:2}}>{s.area}</div><div style={{fontSize:11,color:"#78350f",marginBottom:s.example?2:0}}><strong>Fix:</strong> {s.fix}</div>{s.example&&<div style={{fontSize:10,fontStyle:"italic",color:"#92400e",background:"#fef3c7",padding:"2px 6px",borderRadius:4,marginTop:2}}>e.g. {s.example}</div>}</div>)}</>}
        </div>}
        {tab==="improve"&&<div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:T.textMuted}}>AI-rewritten version:</span><Btn variant="success" size="sm" onClick={()=>onApplyImproved(review.improvedVersion)}>↓ Apply</Btn></div>
          <div style={{background:T.bgMuted,borderRadius:T.rLg,padding:14,fontSize:12,color:T.text,lineHeight:1.8,whiteSpace:"pre-wrap",border:`1px solid ${T.border}`,fontFamily:T.font}}>{review.improvedVersion}</div>
        </div>}
        {tab==="dims"&&Object.entries(review.dimensions||{}).map(([k,d])=>{const c=d.score===3?T.green:d.score===2?T.amber:T.red;return(
          <div key={k} style={{marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:12,fontWeight:600}}>{DL[k]||k}</span><span style={{fontSize:10,fontWeight:700,color:c,background:c+"15",padding:"1px 7px",borderRadius:T.rFull}}>{["","Poor","Partial","Clear"][d.score]}</span></div>
            <div style={{height:4,background:T.bgMuted,borderRadius:2,marginBottom:4,overflow:"hidden"}}><div style={{height:"100%",width:`${(d.score/3)*100}%`,background:c,transition:"width 0.6s"}}/></div>
            <div style={{fontSize:11,color:T.textMuted,lineHeight:1.6}}>{d.comment}</div>
          </div>);})}
      </div>
    </div>
  );
}

// ─── Test Case Panel ──────────────────────────────────────────────────────────
function TCPanel({testCases, loading, onExportCSV, onExportJSON, onPostAdo}) {
  const [cat,setCat]=useState("All"); const [expSet,setExpSet]=useState(()=>new Set()); const [copied,setCopied]=useState(null);
  const toggleExp=(id)=>setExpSet(prev=>{ const n=new Set(prev); if(n.has(id)) n.delete(id); else n.add(id); return n; });
  if(loading) return <div style={{padding:32,textAlign:"center"}}><Spin label="Generating test cases…" size={16}/></div>;
  if(!testCases) return <div style={{padding:40,textAlign:"center",color:T.textMuted}}><div style={{fontSize:32,marginBottom:10,color:T.accent}}><Ic.Beaker size={32}/></div><div style={{fontSize:14,fontWeight:600,color:T.text,fontFamily:T.fontDisplay,marginBottom:5}}>No test cases yet</div><div style={{fontSize:12,maxWidth:280,margin:"0 auto",lineHeight:1.7}}>Review the story first (score ≥ 7), then click <strong>Generate Test Cases</strong>.</div></div>;
  const CATS=["All","Functional","Negative","Edge Case","Security","Performance","Accessibility"];
  const pc={Critical:T.red,High:T.amber,Medium:T.green,Low:T.textFaint};
  const auto=testCases.testCases?.filter(t=>t.automatable).length||0;
  const filtered=(testCases.testCases||[]).filter(tc=>cat==="All"||tc.category===cat);
  const copyTC=(tc,e)=>{e.stopPropagation();const txt=`${tc.id}: ${tc.title}\nPriority: ${tc.priority} | ${tc.category}\nPreconditions: ${tc.preconditions||"None"}\n${tc.steps?.map(s=>`${s.step}. ${s.action}\n   → ${s.expected||""}`).join("\n")}\nExpected: ${tc.expectedResult}\nTest Data: ${tc.testData||"N/A"}`;navigator.clipboard.writeText(txt).then(()=>{setCopied(tc.id);setTimeout(()=>setCopied(null),1500);}).catch(()=>{});};
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{padding:"7px 12px",background:T.bgCard,borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",flexShrink:0}}>
        <span style={{fontSize:12,fontWeight:600,color:T.text}}>{testCases.testCases?.length} tests</span>
        <span style={{fontSize:11,color:T.violet,fontWeight:600}}>⚡ {auto} auto</span>
        {Object.entries(testCases.coverage||{}).map(([k,v])=>v>0&&<span key={k} style={{fontSize:10,color:T.textMuted}}><b style={{color:T.text}}>{v}</b> {k}</span>)}
        <div style={{marginLeft:"auto",display:"flex",gap:4}}>
          <Btn variant="ghost" size="sm" onClick={()=>setExpSet(new Set((testCases.testCases||[]).map(t=>t.id)))}>Expand all</Btn>
          <Btn variant="ghost" size="sm" onClick={()=>setExpSet(new Set())}>Collapse all</Btn>
          {onPostAdo&&<Btn variant="navy" size="sm" onClick={onPostAdo}><Ic.Send size={13}/> Post to ADO</Btn>}
          <Btn variant="ghost" size="sm" onClick={onExportCSV}>⬇ CSV</Btn>
          <Btn variant="ghost" size="sm" onClick={onExportJSON}>⬇ JSON</Btn>
        </div>
      </div>
      <div style={{display:"flex",gap:3,padding:"5px 10px",background:T.bgMuted,borderBottom:`1px solid ${T.border}`,overflowX:"auto",flexShrink:0}}>
        {CATS.map(c=><button key={c} onClick={()=>setCat(c)} style={{padding:"2px 8px",fontSize:10,fontWeight:600,cursor:"pointer",border:"none",borderRadius:T.rFull,background:cat===c?T.navy:"transparent",color:cat===c?"#fff":T.textMuted,whiteSpace:"nowrap",transition:"all 0.12s"}}>{c}</button>)}
      </div>
      <div style={{flex:1,overflowY:"auto",padding:8,display:"flex",flexDirection:"column",gap:6}}>
        {filtered.map(tc=>{ const isOpen=expSet.has(tc.id); return (
          <div key={tc.id} onClick={()=>toggleExp(tc.id)} style={{flexShrink:0,borderRadius:T.r,border:`1px solid ${isOpen?T.accent:T.border}`,background:T.bgCard,overflow:"hidden",cursor:"pointer",transition:"border 0.12s"}}>
            <div style={{padding:"10px 12px",display:"flex",alignItems:"center",gap:8,minHeight:40}}>
              <span style={{fontSize:10,fontFamily:"monospace",color:T.textFaint,fontWeight:700,minWidth:46}}>{tc.id}</span>
              <div style={{flex:1,fontSize:13,color:T.text,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{tc.title}</div>
              <span style={{fontSize:10,padding:"2px 7px",borderRadius:T.rFull,background:(pc[tc.priority]||T.textMuted)+"18",color:pc[tc.priority]||T.textMuted,fontWeight:700,flexShrink:0}}>{tc.priority}</span>
              <span style={{fontSize:10,padding:"2px 7px",borderRadius:T.rFull,background:T.bgMuted,color:T.textMuted,flexShrink:0}}>{tc.category}</span>
              {tc.automatable&&<span style={{fontSize:10,color:T.violet,fontWeight:700,flexShrink:0}}>⚡</span>}
              <button onClick={e=>copyTC(tc,e)} title="Copy" style={{background:"none",border:"none",cursor:"pointer",color:copied===tc.id?T.green:T.textFaint,fontSize:12,padding:"2px 4px",flexShrink:0}}>{copied===tc.id?"✓":"⎘"}</button>
              <span style={{color:T.textFaint,fontSize:10,flexShrink:0}}>{isOpen?"▲":"▼"}</span>
            </div>
            {isOpen&&<div onClick={e=>e.stopPropagation()} style={{borderTop:`1px solid ${T.border}`,padding:"10px 12px",background:T.bg,display:"flex",flexDirection:"column",gap:8}}>
              {tc.preconditions&&<div><div style={{fontSize:9,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>Preconditions</div><div style={{fontSize:11,color:T.text,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{tc.preconditions}</div></div>}
              <div><div style={{fontSize:9,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:4}}>Steps</div>
                {(tc.steps||[]).filter(s=>s && (typeof s==="string"?s.trim():(s.action||s.expected))).map((s,i)=><div key={i} style={{display:"flex",gap:6,marginBottom:4}}><span style={{width:18,height:18,borderRadius:"50%",background:T.navy,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,flexShrink:0}}>{(typeof s==="object"&&s.step)||i+1}</span><div style={{flex:1,fontSize:11}}><span style={{color:T.text}}>{typeof s==="string"?s:s.action}</span>{typeof s==="object"&&s.expected&&<div style={{color:T.green,marginTop:1,fontSize:10}}>→ {s.expected}</div>}</div></div>)}
              </div>
              {tc.expectedResult&&<div><div style={{fontSize:9,fontWeight:700,color:T.textMuted,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:2}}>Expected Result</div><div style={{fontSize:11,color:T.green,fontWeight:500,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{tc.expectedResult}</div></div>}
              {tc.testData&&<div style={{background:T.bgMuted,padding:"4px 8px",borderRadius:5,fontSize:11,fontFamily:"monospace",color:T.text,whiteSpace:"pre-wrap"}}>{tc.testData}</div>}
              {tc.notes&&<div style={{fontSize:10,color:T.textFaint,fontStyle:"italic",whiteSpace:"pre-wrap"}}>{tc.notes}</div>}
            </div>}
          </div>
        ); })}
        {filtered.length===0&&<div style={{textAlign:"center",padding:24,color:T.textMuted,fontSize:12}}>No {cat} tests.</div>}
      </div>
    </div>
  );
}

function CoverageAgentPanel({coverage, loading}) {
  const [tab,setTab]=useState("summary");
  if(loading) return <div style={{padding:32,textAlign:"center"}}><Spin label="Running Steel QA Coverage Agent…" size={16}/></div>;
  if(!coverage) return <div style={{padding:40,textAlign:"center",color:T.textMuted}}><div style={{fontSize:32,marginBottom:10,color:T.accent}}><Ic.Factory size={32}/></div><div style={{fontSize:14,fontWeight:600,color:T.text,fontFamily:T.fontDisplay,marginBottom:5}}>No coverage analysis yet</div><div style={{fontSize:12,maxWidth:360,margin:"0 auto",lineHeight:1.7}}>Click <strong>Run Coverage Agent</strong> to analyze the ADO item, compare loaded similar functionality, score requirements, and generate steel-domain test coverage.</div></div>;
  const q=coverage.requirementQualityScore||{};
  const fs=coverage.featureSummary||{};
  const rec=coverage.finalQARecommendation||{};
  const score=q.overallScore||0;
  const scoreColor=score>=80?T.green:score>=60?T.amber:T.red;
  const tS=t=>({padding:"6px 11px",fontSize:12,fontWeight:600,cursor:"pointer",border:"none",background:tab===t?T.bgCard:"transparent",color:tab===t?T.accent:T.textMuted,borderRadius:T.r,transition:"all 0.15s"});
  const arr=v=>Array.isArray(v)?v.filter(Boolean):[];
  const ScoreRow=({label,value})=><div style={{display:"grid",gridTemplateColumns:"160px 1fr 34px",gap:8,alignItems:"center",fontSize:11}}><span style={{color:T.textMuted}}>{label}</span><div style={{height:5,background:T.bgMuted,borderRadius:3,overflow:"hidden"}}><div style={{height:"100%",width:`${Math.min(Number(value)||0,10)*10}%`,background:(value>=8?T.green:value>=6?T.amber:T.red)}}/></div><b style={{color:T.text}}>{value||0}</b></div>;
  return <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
    <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,background:T.bgCard,display:"flex",gap:12,alignItems:"center",flexShrink:0}}>
      <div style={{width:58,height:58,borderRadius:"50%",border:`3px solid ${scoreColor}`,display:"flex",alignItems:"center",justifyContent:"center",background:scoreColor+"12",flexShrink:0}}><span style={{fontSize:17,fontWeight:800,color:scoreColor,fontFamily:T.fontDisplay}}>{score}</span></div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:700,color:T.text,fontFamily:T.fontDisplay,marginBottom:3}}>{fs.featureName||"Coverage analysis"}</div>
        <div style={{fontSize:11,color:T.textMuted,lineHeight:1.55}}>{fs.functionalitySummary||rec.reason||"Steel-domain QA coverage generated from ADO context."}</div>
        <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
          <span style={{fontSize:10,fontWeight:700,color:scoreColor,background:scoreColor+"14",border:`1px solid ${scoreColor}55`,borderRadius:T.rFull,padding:"2px 8px"}}>{q.qaReadinessStatus||"Unscored"}</span>
          <span style={{fontSize:10,fontWeight:700,color:fs.regressionRisk==="High"?T.red:fs.regressionRisk==="Medium"?T.amber:T.green,background:T.bgMuted,borderRadius:T.rFull,padding:"2px 8px"}}>Regression: {fs.regressionRisk||"Unknown"}</span>
          <span style={{fontSize:10,color:T.textMuted,background:T.bgMuted,borderRadius:T.rFull,padding:"2px 8px"}}>{rec.status||"Recommendation pending"}</span>
        </div>
      </div>
    </div>
    <div style={{display:"flex",gap:4,padding:"6px 12px",background:T.bgMuted,borderBottom:`1px solid ${T.border}`,flexShrink:0,overflowX:"auto"}}>
      {[ ["summary","Summary"], ["scores","Scores"], ["gaps",`Gaps (${arr(coverage.gapsAndClarifications).length})`], ["scenarios",`Scenarios (${arr(coverage.testScenarios).length})`], ["cases",`Cases (${arr(coverage.detailedTestCases).length})`], ["regression","Regression"], ["automation","Unit/Automation"] ].map(([t,l])=><button key={t} style={tS(t)} onClick={()=>setTab(t)}>{l}</button>)}
    </div>
    <div style={{flex:1,overflowY:"auto",padding:"12px 16px"}}>
      {tab==="summary"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div style={{padding:12,border:`1px solid ${T.border}`,borderRadius:T.rLg,background:T.bgCard}}><div style={{fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:5}}>BUSINESS FLOW</div><div style={{fontSize:12,lineHeight:1.7,color:T.text}}>{fs.businessFlow||"Not identified"}</div></div>
        <div style={{padding:12,border:`1px solid ${T.border}`,borderRadius:T.rLg,background:T.bgCard}}><div style={{fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:5}}>IMPACTED SYSTEMS</div><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{arr(fs.impactedSystems).map(x=><span key={x} style={{fontSize:10,padding:"2px 7px",borderRadius:T.rFull,background:T.blueBg,color:T.blue}}>{x}</span>)}</div></div>
        <div style={{gridColumn:"1 / -1",padding:12,border:`1px solid ${T.border}`,borderRadius:T.rLg,background:T.bgCard}}><div style={{fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:6}}>SIMILAR EXISTING FEATURES</div>{arr(fs.similarExistingFeatures).length?arr(fs.similarExistingFeatures).map((x,i)=><div key={i} style={{fontSize:11,lineHeight:1.6,marginBottom:4}}><b>#{x.id}</b> {x.title} <span style={{color:T.textMuted}}>— {x.reuseOpportunity}</span></div>):<div style={{fontSize:11,color:T.textMuted}}>No similar loaded ADO functionality was detected.</div>}</div>
        <div style={{gridColumn:"1 / -1",padding:12,border:`1px solid ${T.border}`,borderRadius:T.rLg,background:T.bgCard}}><div style={{fontSize:11,fontWeight:700,color:T.textMuted,marginBottom:5}}>FINAL QA RECOMMENDATION</div><div style={{fontSize:12,lineHeight:1.7}}><b>{rec.status}</b> — {rec.reason}<br/><span style={{color:T.accent,fontWeight:600}}>Next:</span> {rec.nextAction}</div></div>
      </div>}
      {tab==="scores"&&<div style={{display:"flex",flexDirection:"column",gap:8,maxWidth:620}}>{[
        ["Business description",q.businessDescription],["Acceptance criteria",q.acceptanceCriteria],["Testability",q.testability],["Data details",q.dataDetails],["Edge cases",q.edgeCases],["Integration details",q.integrationDetails],["Error handling",q.errorHandling],["Non-functional",q.nonFunctional],["Regression impact",q.regressionImpact],["Dependency clarity",q.dependencyClarity]
      ].map(([l,v])=><ScoreRow key={l} label={l} value={v}/>)}</div>}
      {tab==="gaps"&&<div style={{display:"flex",flexDirection:"column",gap:7}}>{arr(coverage.gapsAndClarifications).map((g,i)=><div key={i} style={{padding:"8px 10px",borderRadius:T.r,border:`1px solid ${T.amberBd}`,background:T.amberBg,fontSize:12,lineHeight:1.6,color:"#78350f"}}>{g}</div>)}</div>}
      {tab==="scenarios"&&<div style={{display:"flex",flexDirection:"column",gap:7}}>{arr(coverage.testScenarios).map(s=><div key={s.scenarioId} style={{padding:"9px 11px",border:`1px solid ${T.border}`,borderRadius:T.r,background:T.bgCard}}><div style={{display:"flex",gap:7,alignItems:"center",marginBottom:3}}><b style={{fontSize:10,color:T.textFaint,fontFamily:"monospace"}}>{s.scenarioId}</b><span style={{fontSize:12,fontWeight:700,color:T.text}}>{s.scenarioName}</span><span style={{marginLeft:"auto",fontSize:9,color:T.violet,fontWeight:700}}>{s.testType}</span></div><div style={{fontSize:11,color:T.textMuted,lineHeight:1.6}}>{s.businessFlowMapping}</div></div>)}</div>}
      {tab==="cases"&&<div style={{display:"flex",flexDirection:"column",gap:8}}>{arr(coverage.detailedTestCases).map(tc=><div key={tc.testCaseId} style={{border:`1px solid ${T.border}`,borderRadius:T.r,background:T.bgCard,padding:11}}><div style={{display:"flex",gap:7,alignItems:"center",marginBottom:5}}><b style={{fontSize:10,color:T.textFaint,fontFamily:"monospace"}}>{tc.testCaseId}</b><span style={{fontSize:12,fontWeight:700,color:T.text}}>{tc.title}</span><span style={{marginLeft:"auto",fontSize:9,color:T.green,fontWeight:700}}>Auto: {tc.automationFeasibility}</span></div><div style={{fontSize:11,color:T.textMuted,lineHeight:1.6,marginBottom:6}}>{tc.objective}</div>{arr(tc.steps).map((s,i)=><div key={i} style={{display:"flex",gap:6,fontSize:11,marginBottom:3}}><span style={{width:17,height:17,borderRadius:"50%",background:T.navy,color:"#fff",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:8,flexShrink:0}}>{s.step||i+1}</span><span><b>{s.action}</b><br/><span style={{color:T.green}}>→ {s.expected}</span></span></div>)}</div>)}</div>}
      {tab==="regression"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{Object.entries(coverage.regressionCoverage||{}).map(([k,v])=><div key={k} style={{padding:11,border:`1px solid ${T.border}`,borderRadius:T.r,background:T.bgCard}}><div style={{fontSize:10,fontWeight:700,color:T.textMuted,textTransform:"uppercase",marginBottom:5}}>{k.replace(/([A-Z])/g," $1")}</div>{arr(v).map((x,i)=><div key={i} style={{fontSize:11,lineHeight:1.6,marginBottom:2}}>• {x}</div>)}</div>)}</div>}
      {tab==="automation"&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>{Object.entries(coverage.unitAutomationCoverage||{}).map(([k,v])=><div key={k} style={{padding:11,border:`1px solid ${T.border}`,borderRadius:T.r,background:T.bgCard}}><div style={{fontSize:10,fontWeight:700,color:T.textMuted,textTransform:"uppercase",marginBottom:5}}>{k.replace(/([A-Z])/g," $1")}</div>{Array.isArray(v)?v.map((x,i)=><div key={i} style={{fontSize:11,lineHeight:1.6,marginBottom:2}}>• {x}</div>):<div style={{fontSize:12,fontWeight:700,color:T.text}}>{v}</div>}</div>)}</div>}
    </div>
  </div>;
}

// ─── Work Item Detail (Right Panel) ──────────────────────────────────────────
function WorkItemDetail({item, qaData, onUpdateQA, conn, allItems, hasAI, onOpenSettings}) {
  const [tab, setTab] = useState("chat");
  const [editContent, setEditContent] = useState(item?.editedContent||item?.description||"");
  const [editAC, setEditAC] = useState(item?.acceptanceCriteria||"");
  // QA Notes defaults to locally-saved notes; if empty, fall back to the ADO "test plan" field
  const [notes, setNotes] = useState(item?.notes||item?.testPlan||"");
  const [rLoading, setRLoading] = useState(false);
  const [tcLoading, setTcLoading] = useState(false);
  const [covLoading, setCovLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [adoMsg, setAdoMsg] = useState(null);
  const dirty = useRef(false);
  const qaRef = useRef(qaData);
  qaRef.current = qaData;

  // Reset editors when item changes
  useEffect(()=>{
    setEditContent(item?.editedContent||item?.description||"");
    setEditAC(item?.acceptanceCriteria||"");
    setNotes(item?.notes||item?.testPlan||"");
    setErr(null); setAdoMsg(null);
    dirty.current = false;
  },[item?.id]);

  // Auto-save edits
  useEffect(()=>{
    if(!dirty.current||!item) return;
    const t=setTimeout(()=>{
      onUpdateQA({...qaRef.current, editedContent:editContent, acceptanceCriteria:editAC, notes, updatedAt:now()});
      dirty.current=false;
    },700);
    return()=>clearTimeout(t);
  },[editContent,editAC,notes]);

  const sf=(setter)=>(v)=>{dirty.current=true;setter(v);};

  const handleReview=async()=>{
    if(!hasAI){setErr("Sign in to GitHub Copilot or add an AI API key to run review.");onOpenSettings?.();return;}
    if(!editContent.trim()&&!item.description){setErr("Add description content first.");return;}
    setErr(null);setRLoading(true);setTab("review");
    try{
      const prompt=`TITLE: ${item.title}\nTYPE: ${item.type}\nPRIORITY: ${item.priority}\nSTATE: ${item.state}\n\nSTORY CONTENT:\n${editContent||item.description}\n\nACCEPTANCE CRITERIA:\n${editAC||"(none)"}\n\nNOTES:\n${notes||"(none)"}`;
      const r=await callClaudeJSON(REVIEW_SYS,prompt,5000,"review");
      onUpdateQA({...qaRef.current,review:r,status:r.readyForTesting?"ready":"reviewed",updatedAt:now()});
    }catch(e){setErr(e.message);}
    setRLoading(false);
  };

  const handleGenTC=async()=>{
    if(!hasAI){setErr("Sign in to GitHub Copilot or add an AI API key to generate tests.");onOpenSettings?.();return;}
    if(!qaData?.review?.readyForTesting){setErr("Review first and achieve score ≥ 7.");return;}
    setErr(null);setTcLoading(true);setTab("tests");
    try{
      const rev=qaData.review;
      const prompt=`TITLE: ${item.title}\nTYPE: ${item.type}\n\nSTORY:\n${editContent||item.description}\n\nACCEPTANCE CRITERIA:\n${editAC||""}\n\nNOTES:\n${notes||""}\n\nREVIEW SCORE: ${rev.score}/10\nSUMMARY: ${rev.summary}\nWEAK AREAS: ${Object.entries(rev.dimensions||{}).filter(([,d])=>d.score<3).map(([k,d])=>`${k}(${d.comment})`).join("; ")||"none"}`;
      const r=await callClaudeJSON(TC_SYS,prompt,9000,"tests");
      onUpdateQA({...qaRef.current,testCases:r,status:"generated",updatedAt:now()});
    }catch(e){setErr(e.message);}
    setTcLoading(false);
  };

  const handleCoverageAgent=async()=>{
    if(!hasAI){setErr("Sign in to GitHub Copilot or add an AI API key to run coverage analysis.");onOpenSettings?.();return;}
    if(!editContent.trim()&&!item.description){setErr("Add description content first.");return;}
    setErr(null);setCovLoading(true);setTab("coverage");
    try{
      const context=buildCoverageContext({...item, editedContent:editContent, acceptanceCriteria:editAC, notes}, allItems||[]);
      const prompt=`ADO PROJECT: ${conn?.projectName||"Unknown"}
WORK ITEM ID: ${item.id}
TITLE: ${item.title}
TYPE: ${item.type}
STATE: ${item.state}
PRIORITY: ${item.priority}
AREA PATH: ${item.areaPath||""}
ITERATION: ${item.iterationPath||""}
TAGS: ${item.tags||""}

DESCRIPTION / STORY CONTENT:
${editContent||item.description||"(none)"}

ACCEPTANCE CRITERIA:
${editAC||"(none)"}

QA NOTES:
${notes||"(none)"}

LOADED ADO CONTEXT:
${JSON.stringify(context,null,2)}`;
      const r=await callClaudeJSON(COVERAGE_SYS,prompt,10000,"coverage");
      onUpdateQA({...qaRef.current,coverage:r,status:"coverage",updatedAt:now()});
    }catch(e){setErr(e.message);}
    setCovLoading(false);
  };

  const handlePostAdo=async()=>{
    if(!conn||!item.id){return;}
    setAdoMsg(null);
    try{
      const parts=[`<h3>🤖 AI QA Analysis — Work Item #${item.id}</h3>`];
      if(qaData?.review){const r=qaData.review;const c=r.score>=8?"#16a34a":r.score>=6?"#d97706":"#dc2626";parts.push(`<p><strong>Review Score: <span style="color:${c}">${r.score}/10</span></strong> — ${r.status}</p><p>${r.summary}</p>`);if(r.blockers?.length)parts.push(`<p><strong>⚠️ Blockers:</strong></p><ul>${r.blockers.map(b=>`<li>${b}</li>`).join("")}</ul>`);}
      if(qaData?.testCases){const tc=qaData.testCases.testCases||[];parts.push(`<hr/><p><strong>Test Cases: ${tc.length}</strong></p><ul>${tc.slice(0,10).map(t=>`<li>[${t.priority}] ${t.id}: ${t.title} (${t.category})</li>`).join("")}${tc.length>10?`<li>…and ${tc.length-10} more</li>`:""}</ul>`);}
      parts.push(`<p><em>QA Intelligence Hub · ${new Date().toLocaleString()}</em></p>`);
      await adoAddComment(conn.org,conn.projectName,conn.pat,item.id,parts.join("\n"));
      setAdoMsg({ok:true,msg:`✓ Posted to #${item.id}`});
    }catch(e){setAdoMsg({ok:false,msg:e.message});}
  };

  const exportCSV=()=>{
    const tc=qaData?.testCases;if(!tc?.testCases)return;
    const h=["ID","Title","Category","Priority","Automatable","Preconditions","Steps","Expected Result","Test Data","Notes"];
    const esc=v=>`"${String(v||"").replace(/"/g,'""')}"`;
    const rows=tc.testCases.map(t=>[t.id,t.title,t.category,t.priority,t.automatable?"Yes":"No",t.preconditions||"",(t.steps||[]).map(s=>typeof s==="string"?s:`${s.action}→${s.expected||""}`).join("|"),t.expectedResult||"",t.testData||"",t.notes||""].map(esc).join(","));
    const csv=[h.map(esc).join(","),...rows].join("\n");
    const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv);a.download=`${item.title||"tests"}.csv`;a.click();
  };
  const exportJSON=()=>{
    const out=JSON.stringify({exportedAt:now(),workItem:{id:item.id,title:item.title,type:item.type},reviewScore:qaData?.review?.score,...qaData?.testCases},null,2);
    const a=document.createElement("a");a.href="data:application/json;charset=utf-8,"+encodeURIComponent(out);a.download=`${item.title||"tests"}.json`;a.click();
  };

  if(!item) return <div style={{height:"100%",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10,color:T.textMuted,padding:40}}>
    <span style={{fontSize:40}}>←</span>
    <div style={{fontSize:14,fontWeight:600,color:T.text,fontFamily:T.fontDisplay}}>Select a work item</div>
    <div style={{fontSize:12,textAlign:"center",maxWidth:280,lineHeight:1.7}}>Choose any work item from the list to view details, run AI analysis, generate test cases, and research testing scope.</div>
  </div>;

  const tS=t=>({padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer",border:"none",background:tab===t?T.bgCard:"transparent",color:tab===t?T.accent:T.textMuted,borderBottom:tab===t?`2px solid ${T.accent}`:"2px solid transparent",transition:"all 0.15s",display:"inline-flex",alignItems:"center",gap:6,whiteSpace:"nowrap"});

  // Merge item with qaData
  const mergedItem = {...item, editedContent:editContent, acceptanceCriteria:editAC, notes};

  return(
    <div style={{height:"100%",display:"flex",flexDirection:"column"}}>
      {/* Header */}
      <div style={{padding:"10px 16px",background:T.bgCard,borderBottom:`1px solid ${T.border}`,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap"}}>
          <a href={item.url} target="_blank" rel="noopener" style={{fontSize:12,color:T.blue,fontWeight:600,textDecoration:"none",background:T.blueBg,padding:"2px 8px",borderRadius:T.r,border:`1px solid ${T.blueBd}`}}>↗ #{item.id}</a>
          <StateBadge state={item.state}/>
          <PriChip p={item.priority}/>
          {item.points&&<span style={{fontSize:10,color:T.cyan,fontWeight:600}}>{item.points}sp</span>}
          {qaData?.status&&<span style={{fontSize:10,padding:"2px 7px",borderRadius:T.rFull,background:{draft:"#f1f5f9",reviewed:"#fef9c3",improved:"#fff7ed",ready:"#dcfce7",generated:"#ede9fe",coverage:"#fffbeb"}[qaData.status]||"#f1f5f9",color:{draft:"#64748b",reviewed:"#854d0e",improved:"#9a3412",ready:"#166534",generated:"#4c1d95",coverage:"#92400e"}[qaData.status]||"#64748b",fontWeight:700}}>{qaData.status}</span>}
          <div style={{marginLeft:"auto",display:"flex",gap:5,flexShrink:0}}>
            {err&&<span style={{fontSize:11,color:T.red,maxWidth:180,overflow:"hidden",textOverflow:"ellipsis"}} title={err}>{err}</span>}
            {adoMsg&&<span style={{fontSize:11,color:adoMsg.ok?T.green:T.red,fontWeight:500}}>{adoMsg.ok?"✓":"✗"} {adoMsg.msg}</span>}
            <Btn variant={hasAI?"ghost":"amber"} size="sm" onClick={onOpenSettings}>{hasAI?<><Ic.Settings size={13}/> AI Settings</>:<>Add AI Key</>}</Btn>
            {conn&&<Btn variant="ghost" size="sm" onClick={handlePostAdo}><Ic.Send size={13}/> ADO</Btn>}
            <Btn variant="secondary" size="sm" onClick={handleReview} disabled={rLoading||tcLoading||covLoading}><Ic.Search size={13}/> Review</Btn>
            <Btn variant="amber" size="sm" onClick={handleCoverageAgent} disabled={rLoading||tcLoading||covLoading}>
              {covLoading?"Analyzing…":<><Ic.Factory size={13}/> Run Coverage Agent</>}
            </Btn>
            <Btn variant={qaData?.review?.readyForTesting?"violet":"ghost"} size="sm" onClick={handleGenTC} disabled={tcLoading||rLoading||covLoading||!qaData?.review?.readyForTesting} title={!qaData?.review?.readyForTesting?"Review first, score ≥ 7 required":""}>
              {tcLoading?"Generating…":<><Ic.Beaker size={13}/> Generate Tests</>}
            </Btn>
          </div>
        </div>
        <div style={{fontSize:14,fontWeight:700,color:T.text,fontFamily:T.fontDisplay,lineHeight:1.3}}>{item.title}</div>
        <div style={{display:"flex",gap:10,marginTop:4,flexWrap:"wrap"}}>
          {item.assignedTo&&<span style={{fontSize:10,color:T.textMuted}}>👤 {item.assignedTo}</span>}
          {item.iterationPath&&<span style={{fontSize:10,color:T.textMuted}}>🗓 {item.iterationPath.split("\\").pop()}</span>}
          {item.areaPath&&<span style={{fontSize:10,color:T.textMuted}}>📂 {item.areaPath.split("\\").pop()}</span>}
          {item.tags&&<span style={{fontSize:10,color:T.textMuted}}>🏷 {item.tags.split(";").slice(0,3).map(t=>t.trim()).filter(Boolean).join(", ")}</span>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${T.border}`,background:T.bgMuted,flexShrink:0}}>
        <button style={tS("chat")}     onClick={()=>setTab("chat")}><Ic.Message size={13}/> AI Research</button>
        <button style={tS("details")}  onClick={()=>setTab("details")}><Ic.FileText size={13}/> Details</button>
        <button style={tS("coverage")} onClick={()=>setTab("coverage")}><Ic.Factory size={13}/> Coverage {qaData?.coverage?.requirementQualityScore?.overallScore?`· ${qaData.coverage.requirementQualityScore.overallScore}`:""}</button>
        <button style={tS("review")}   onClick={()=>setTab("review")}><Ic.Search size={13}/> Review {qaData?.review?`· ${qaData.review.score}/10`:""}</button>
        <button style={tS("tests")}    onClick={()=>setTab("tests")}><Ic.Beaker size={13}/> Tests {qaData?.testCases?`· ${qaData.testCases.testCases?.length}`:""}</button>
      </div>

      {/* Tab content */}
      <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        {tab==="chat"&&<ChatPanel item={mergedItem}/>}
        {tab==="details"&&(
          <div style={{flex:1,overflowY:"auto",padding:"14px 16px",display:"flex",flexDirection:"column",gap:12}}>
            <Inp label="Story Content / Description" multiline rows={8} value={editContent} onChange={sf(setEditContent)}
              placeholder={"As a [user role],\nI want to [action],\nSo that [business value].\n\nDescription from ADO…"}
              hint="Pulled from ADO — enrich to improve AI review quality"/>
            <Inp label="Acceptance Criteria" multiline rows={7} value={editAC} onChange={sf(setEditAC)}
              placeholder={"GIVEN [context]\nWHEN [action]\nTHEN [expected result]\n\n1. Condition…"}
              hint="GIVEN/WHEN/THEN or numbered list — add missing conditions"/>
            <Inp label="QA Notes" multiline rows={3} value={notes} onChange={sf(setNotes)}
              placeholder="Constraints, dependencies, out-of-scope, test data requirements, environment notes…"/>
          </div>
        )}
        {tab==="coverage"&&<CoverageAgentPanel coverage={qaData?.coverage} loading={covLoading}/>} 
        {tab==="review"&&<ReviewPanel review={qaData?.review} loading={rLoading} onApplyImproved={v=>{
          sf(setEditContent)(v);
          onUpdateQA({...qaRef.current,editedContent:v,status:"improved",updatedAt:now()});
          setAdoMsg({type:"success",text:"Applied AI-rewritten story to Details. Click 📤 ADO to push to Azure DevOps."});
          setTab("details");
          setTimeout(()=>setAdoMsg(null),4000);
        }}/>}
        {tab==="tests"&&<TCPanel testCases={qaData?.testCases} loading={tcLoading} onExportCSV={exportCSV} onExportJSON={exportJSON} onPostAdo={conn&&item.id?handlePostAdo:null}/>}
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
const SK_V = "qa-ado-v6";

// Minimal markdown-ish renderer with code fences + copy buttons.
function MarkdownView({text}) {
  if(!text) return null;
  const parts=[];
  const re=/```(\w+)?\n([\s\S]*?)```/g;
  let last=0, m, i=0;
  while((m=re.exec(text))){
    if(m.index>last) parts.push({type:"p",content:text.slice(last,m.index),k:i++});
    parts.push({type:"code",lang:m[1]||"",content:m[2],k:i++});
    last=m.index+m[0].length;
  }
  if(last<text.length) parts.push({type:"p",content:text.slice(last),k:i++});
  const renderInline=(s)=>{
    const out=[]; let buf=""; let n=0;
    const flush=()=>{ if(buf){ out.push(<span key={`t${n++}`}>{buf}</span>); buf=""; } };
    const tokens=s.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
    tokens.forEach((tok,idx)=>{
      if(/^`[^`]+`$/.test(tok)){ flush(); out.push(<code key={`c${idx}`} style={{background:"#f1f5f9",padding:"1px 5px",borderRadius:4,fontSize:12,fontFamily:"monospace"}}>{tok.slice(1,-1)}</code>); }
      else if(/^\*\*[^*]+\*\*$/.test(tok)){ flush(); out.push(<strong key={`b${idx}`}>{tok.slice(2,-2)}</strong>); }
      else if(/^\*[^*]+\*$/.test(tok)){ flush(); out.push(<em key={`i${idx}`}>{tok.slice(1,-1)}</em>); }
      else buf+=tok;
    });
    flush();
    return out;
  };
  return (
    <div style={{lineHeight:1.65,fontSize:13,color:T.text,whiteSpace:"normal"}}>
      {parts.map(p=>p.type==="code"?(
        <div key={p.k} style={{position:"relative",margin:"8px 0",border:`1px solid ${T.border}`,borderRadius:T.r,overflow:"hidden"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 10px",background:"#f8fafc",fontSize:10,color:T.textMuted,fontFamily:"monospace"}}>
            <span>{p.lang||"code"}</span>
            <button onClick={()=>navigator.clipboard?.writeText(p.content)} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:T.blue,display:"inline-flex",alignItems:"center",gap:4}}><Ic.Copy size={12}/> Copy</button>
          </div>
          <pre style={{margin:0,padding:"10px 12px",background:"#0f172a",color:"#e2e8f0",fontSize:12,fontFamily:"monospace",overflow:"auto"}}><code>{p.content}</code></pre>
        </div>
      ):(
        <div key={p.k} style={{whiteSpace:"pre-wrap"}}>{p.content.split("\n").map((ln,li)=>(
          <div key={li}>{renderInline(ln)}</div>
        ))}</div>
      ))}
    </div>
  );
}

// Persisted history per (work-item id || "global")
const CHAT_HIST_KEY = "qa-hub-copilot-history-v1";
function loadAllHistory() { try { return JSON.parse(localStorage.getItem(CHAT_HIST_KEY)||"{}"); } catch { return {}; } }
function saveAllHistory(h) { try { localStorage.setItem(CHAT_HIST_KEY, JSON.stringify(h)); } catch {} }

function GlobalCopilotPanel({open, onClose, contextItem, conn, onOpenSettings, hasAI}) {
  const histKey = contextItem?.id ? `wi-${contextItem.id}` : "global";
  const [allHist, setAllHist] = useState(loadAllHistory);
  const messages = allHist[histKey] || [];
  const setMessages = (updater) => {
    setAllHist(prev=>{
      const next={...prev}; const cur=prev[histKey]||[];
      next[histKey]=typeof updater==="function"?updater(cur):updater;
      saveAllHistory(next); return next;
    });
  };
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [provider, setProvider] = useState(getAIProvider());
  const [modelName, setModelName] = useState(()=> getAIProvider()==="copilot"?getCopilotModel():"");
  const [agentMode, setAgentMode] = useState(()=> localStorage.getItem("qa-hub-agent-mode")==="1");
  useEffect(()=>{ localStorage.setItem("qa-hub-agent-mode", agentMode?"1":"0"); },[agentMode]);
  const [copilotModels, setCopilotModels] = useState([]);
  useEffect(()=>{
    if(provider!=="copilot") return;
    let stop=false;
    fetch("/api/copilot/models").then(r=>r.json()).then(d=>{
      if(stop) return;
      const arr = Array.isArray(d?.data) ? d.data : [];
      const ids = arr.filter(m=> m && (m.capabilities?.type==="chat" || !m.capabilities) && (m.model_picker_enabled!==false)).map(m=>m.id).filter(Boolean);
      const uniq = Array.from(new Set(ids));
      if(uniq.length) setCopilotModels(uniq);
    }).catch(()=>{});
    return ()=>{ stop=true; };
  },[provider, open]);
  const abortRef = useRef(null);
  const bottomRef = useRef(null);
  useEffect(()=>{ bottomRef.current?.scrollIntoView({behavior:"smooth"}); },[messages,open]);

  const SLASH = {
    "/review":"Review the current work item for testability as a metallurgist.",
    "/tests":"Generate metallurgist-grade test cases for the current work item.",
    "/coverage":"Identify coverage gaps and reusable existing test cases for the current work item.",
    "/risk":"What are the top metallurgical risks and edge cases for this feature?",
    "/clear":"__clear__"
  };

  const stop = () => { try{ abortRef.current?.abort(); }catch{} };

  const send = async (textArg, regen=false) => {
    if(!hasAI){ onOpenSettings?.(); return; }
    let text = (textArg ?? input).trim();
    if(!text && !regen) return;
    if(SLASH[text]==="__clear__"){ setMessages([]); setInput(""); return; }
    if(SLASH[text]) text = SLASH[text];

    setErr(null); setInput("");
    let history = messages;
    if(regen){
      // Drop last assistant turn and resend the prior user message
      const lastUserIdx = [...messages].map((m,i)=>m.role==="user"?i:-1).filter(i=>i>=0).pop();
      if(lastUserIdx==null) return;
      history = messages.slice(0, lastUserIdx+1);
      text = messages[lastUserIdx].content;
      setMessages(history);
    } else {
      history = [...messages, {role:"user",content:text}];
      setMessages(history);
    }
    setMessages(prev=>[...prev,{role:"assistant",content:"",toolCalls:[]}]);
    setLoading(true);
    const ac = new AbortController(); abortRef.current = ac;
    try {
      const ctx = contextItem ? `\n\n[Active ADO context]\n#${contextItem.id} ${contextItem.title}\nType: ${contextItem.type} | State: ${contextItem.state} | Area: ${contextItem.areaPath||""}\n${(contextItem.acceptanceCriteria||"").slice(0,2000)}` : "";
      const sys = `You are QAHub Copilot — a senior metallurgist + QA engineer for steel-plant systems. Answer concisely in markdown. Use code blocks for SQL/JSON/code. Prefer concrete steps and acceptance criteria.${agentMode?" You have MCP tools available; call them whenever they would help (filesystem, ado_*, etc).":""}${ctx}`;

      if (agentMode && provider==="copilot") {
        // Tool-calling agent loop via /api/agent/chat (NDJSON)
        const r = await fetch("/api/agent/chat",{method:"POST",headers:{"Content-Type":"application/json"},signal:ac.signal,body:JSON.stringify({
          model:getCopilotModel(),
          system:sys,
          messages: history.slice(-12).map(m=>({role:m.role,content:m.content}))
        })});
        if(!r.ok){ throw new Error(await r.text()); }
        const reader=r.body.getReader(); const dec=new TextDecoder(); let buf="", finalText="";
        while(true){
          const {value,done}=await reader.read(); if(done) break;
          buf+=dec.decode(value,{stream:true});
          let nl;
          while((nl=buf.indexOf("\n"))>=0){
            const line=buf.slice(0,nl).trim(); buf=buf.slice(nl+1);
            if(!line) continue;
            let evt; try { evt=JSON.parse(line); } catch { continue; }
            if(evt.type==="tool_call"){
              setMessages(prev=>{ const c=prev.slice(); const last={...c[c.length-1]}; last.toolCalls=[...(last.toolCalls||[]),{name:evt.name,args:evt.args,result:null,running:true}]; c[c.length-1]=last; return c; });
            } else if(evt.type==="tool_result"){
              setMessages(prev=>{ const c=prev.slice(); const last={...c[c.length-1]}; const tcs=[...(last.toolCalls||[])]; for(let j=tcs.length-1;j>=0;j--){ if(tcs[j].name===evt.name && tcs[j].running){ tcs[j]={...tcs[j],result:evt.content,running:false}; break; } } last.toolCalls=tcs; c[c.length-1]=last; return c; });
            } else if(evt.type==="delta"){
              finalText += evt.text;
              setMessages(prev=>{ const c=prev.slice(); c[c.length-1]={...c[c.length-1],content:finalText}; return c; });
            } else if(evt.type==="error"){
              throw new Error(evt.error);
            } else if(evt.type==="done"){
              break;
            }
          }
        }
      } else {
        const reply = await callClaude(
          sys,
          history.slice(-12).map(m=>({role:m.role,content:m.content})),
          1500,
          false,
          (partial)=> setMessages(prev=>{ const c=prev.slice(); c[c.length-1]={...c[c.length-1],content:partial}; return c; }),
          ac.signal
        );
        setMessages(prev=>{ const c=prev.slice(); c[c.length-1]={...c[c.length-1],content:reply||c[c.length-1].content||""}; return c; });
      }
    } catch(e){
      if(e.name==="AbortError"){ /* user stopped */ }
      else { setErr(e.message); setMessages(prev=>{ const c=prev.slice(); if(c[c.length-1]?.role==="assistant" && !c[c.length-1].content && !(c[c.length-1].toolCalls||[]).length) c.pop(); return c; }); }
    }
    setLoading(false); abortRef.current=null;
  };

  if(!open) return null;
  return (
    <div style={{position:"fixed",top:0,right:0,bottom:0,width:460,background:T.bgCard,borderLeft:`1px solid ${T.border}`,boxShadow:"-12px 0 32px rgba(0,0,0,0.08)",display:"flex",flexDirection:"column",zIndex:990}}>
      {/* Header */}
      <div style={{padding:"10px 14px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:16,color:T.accent,display:"inline-flex"}}><Ic.Bot size={16}/></span>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,fontWeight:700,color:T.text,fontFamily:T.fontDisplay}}>QAHub Copilot</div>
          <div style={{fontSize:10,color:T.textFaint,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
            {contextItem ? `#${contextItem.id} ${contextItem.title}` : "No work item selected"}
          </div>
        </div>
        <button onClick={onClose} aria-label="Close Copilot" style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:T.textFaint,display:"inline-flex",alignItems:"center",justifyContent:"center"}} title="Close"><Ic.Close size={18}/></button>
      </div>

      {/* Provider/model row */}
      <div style={{padding:"6px 14px",borderBottom:`1px solid ${T.border}`,display:"flex",gap:6,alignItems:"center",fontSize:11,color:T.textMuted,background:T.bgMuted}}>
        <select value={provider} onChange={e=>{ setProvider(e.target.value); localStorage.setItem("qa-hub-ai-provider",e.target.value); setModelName(e.target.value==="copilot"?getCopilotModel():""); }}
          style={{fontSize:11,padding:"3px 6px",border:`1px solid ${T.border}`,borderRadius:4,background:T.bgCard}}>
          <option value="copilot">GitHub Copilot</option>
          <option value="openai">OpenAI</option>
          <option value="anthropic">Anthropic</option>
        </select>
        {provider==="copilot" && (
          copilotModels.length>0 ? (
            <select value={modelName||"gpt-4o"} onChange={e=>{ setModelName(e.target.value); setCopilotModel(e.target.value); }}
              style={{fontSize:11,padding:"3px 6px",border:`1px solid ${T.border}`,borderRadius:4,background:T.bgCard,fontFamily:"monospace",maxWidth:180}}>
              {(copilotModels.includes(modelName)?copilotModels:[modelName||"gpt-4o",...copilotModels]).filter(Boolean).map(m=>(
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          ) : (
            <input value={modelName} onChange={e=>{ setModelName(e.target.value); setCopilotModel(e.target.value); }}
              placeholder="gpt-4o"
              style={{fontSize:11,padding:"3px 6px",border:`1px solid ${T.border}`,borderRadius:4,background:T.bgCard,fontFamily:"monospace",width:130}}/>
          )
        )}
        <span style={{flex:1}}/>
        <label style={{display:"flex",alignItems:"center",gap:4,fontSize:11,color:agentMode?T.blue:T.textMuted,cursor:provider==="copilot"?"pointer":"not-allowed",opacity:provider==="copilot"?1:0.5}} title={provider==="copilot"?"Agent mode: model can call MCP tools":"Agent mode requires GitHub Copilot provider"}>
          <input type="checkbox" checked={agentMode} disabled={provider!=="copilot"} onChange={e=>setAgentMode(e.target.checked)} style={{margin:0}}/>
          <span style={{fontWeight:700}}>Agent</span>
        </label>
        <button onClick={()=>{ setMessages([]); setErr(null); }} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:T.blue}}>Clear</button>
        <button onClick={onOpenSettings} aria-label="Open AI settings" style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:T.textMuted,display:"inline-flex",alignItems:"center"}}><Ic.Settings size={14}/></button>
      </div>

      {/* Messages */}
      <div style={{flex:1,overflowY:"auto",padding:"12px 14px"}}>
        {messages.length===0 && (
          <div style={{fontSize:12,color:T.textMuted,lineHeight:1.7}}>
            <div style={{fontWeight:700,color:T.text,marginBottom:8}}>Try a slash command:</div>
            {Object.keys(SLASH).map(s=>(
              <div key={s} style={{cursor:"pointer",padding:"4px 8px",borderRadius:4,fontFamily:"monospace",fontSize:12,color:T.blue}} onClick={()=>send(s)}>{s}</div>
            ))}
            <div style={{marginTop:10,fontSize:11,color:T.textFaint}}>Tip: type <code>#</code> to reference the active work item.</div>
          </div>
        )}
        {messages.map((m,i)=>(
          <div key={i} style={{marginBottom:14,display:"flex",gap:8,alignItems:"flex-start"}}>
            <div style={{width:24,height:24,borderRadius:"50%",background:m.role==="user"?T.accent:T.navy,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>
              {m.role==="user"?"U":"AI"}
            </div>
            <div style={{flex:1,minWidth:0}}>
              {(m.toolCalls||[]).map((tc,ti)=>(
                <div key={ti} style={{margin:"4px 0",border:`1px solid ${T.border}`,borderRadius:T.r,background:T.bgMuted,fontSize:11}}>
                  <div style={{padding:"4px 8px",fontFamily:"monospace",color:T.navy,fontWeight:700,display:"flex",alignItems:"center",gap:6}}>
                    <span>{tc.running?"⏳":"✓"}</span>
                    <span>🔧 {tc.name}</span>
                  </div>
                  <pre style={{margin:0,padding:"4px 8px",fontSize:10,color:T.textMuted,whiteSpace:"pre-wrap",borderTop:`1px dashed ${T.border}`,maxHeight:120,overflow:"auto"}}>{JSON.stringify(tc.args||{},null,2)}</pre>
                  {tc.result && <pre style={{margin:0,padding:"4px 8px",fontSize:10,color:T.text,whiteSpace:"pre-wrap",borderTop:`1px dashed ${T.border}`,background:T.bgCard,maxHeight:160,overflow:"auto"}}>{tc.result.slice(0,2000)}{tc.result.length>2000?"…":""}</pre>}
                </div>
              ))}
              <MarkdownView text={m.content || (loading && i===messages.length-1 && !(m.toolCalls||[]).length ? "▍" : "")}/>
              {m.role==="assistant" && !loading && m.content && (
                <div style={{display:"flex",gap:8,marginTop:4}}>
                  <button onClick={()=>navigator.clipboard?.writeText(m.content)} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:T.textMuted,display:"inline-flex",alignItems:"center",gap:4}}><Ic.Copy size={12}/> Copy</button>
                  {i===messages.length-1 && (
                    <button onClick={()=>send(null,true)} style={{background:"none",border:"none",cursor:"pointer",fontSize:11,color:T.textMuted}}>↻ Regenerate</button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        {err && <div style={{fontSize:12,color:T.accent,padding:"8px 10px",background:T.amberBg,border:`1px solid ${T.amberBd}`,borderRadius:T.r}}>{err}</div>}
        <div ref={bottomRef}/>
      </div>

      {/* Input */}
      <div style={{borderTop:`1px solid ${T.border}`,padding:"8px 10px",background:T.bgCard}}>
        <div style={{display:"flex",gap:6,alignItems:"flex-end"}}>
          <textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ e.preventDefault(); send(); } }}
            placeholder={contextItem?`Ask about #${contextItem.id}… (/ for commands, # to attach)`:"Ask anything… (/ for commands)"}
            rows={2}
            style={{flex:1,resize:"none",padding:"8px 10px",border:`1px solid ${T.border}`,borderRadius:T.r,fontSize:12,fontFamily:"inherit",outline:"none",background:T.bgCard,color:T.text}}/>
          {loading
            ? <button onClick={stop} style={{padding:"8px 12px",border:`1px solid ${T.accent}`,background:T.bgCard,color:T.accent,borderRadius:T.r,cursor:"pointer",fontSize:12,fontWeight:700,display:"inline-flex",alignItems:"center",gap:5}}><Ic.Stop size={12}/> Stop</button>
            : <button onClick={()=>send()} disabled={!input.trim()} style={{padding:"8px 14px",border:"none",background:input.trim()?T.blue:T.border,color:"#fff",borderRadius:T.r,cursor:input.trim()?"pointer":"default",fontSize:12,fontWeight:700,display:"inline-flex",alignItems:"center",gap:5}}>Send <Ic.Send size={13}/></button>}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  migrateProviderOnce();
  useTheme();
  const [conn,    setConn]    = useState(null);
  const [items,   setItems]   = useState([]);
  const [qaStore, setQaStore] = useState({});   // keyed by work item ID
  const [selId,   setSelId]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [err,     setErr]     = useState(null);
  const [lastWiql,setLastWiql]= useState("");
  const [areas,   setAreas]   = useState([]);
  const [iters,   setIters]   = useState([]);
  const [filters, setFilters] = useState({ types:[], states:[], areaPath:"", iterPath:"", assignedTo:"" });
  const [booting, setBooting] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [hasAI, setHasAI] = useState(hasAIConfig());
  const [showCopilot, setShowCopilot] = useState(false);

  // Load persisted state
  useEffect(()=>{
    loadDB().then(db=>{
      if(db){
        if(db.conn?.pat) setConn(db.conn);
        if(db.qaStore)  setQaStore(db.qaStore);
        if(db.filters)  setFilters(db.filters);
      }
      setBooting(false);
    });
  },[]);

  // Persist
  useEffect(()=>{
    if(!booting) saveDB({conn,qaStore,filters});
  },[conn,qaStore,filters,booting]);

  // Keep PAT in memory only and clear it after inactivity.
  useEffect(()=>{
    if(!conn?.pat) return;
    let t;
    const arm = () => {
      clearTimeout(t);
      t = setTimeout(()=>setConn(c=>c?.pat ? null : c), 30 * 60 * 1000);
    };
    const events = ["click","keydown","mousemove","touchstart"];
    events.forEach(e=>window.addEventListener(e, arm, { passive:true }));
    arm();
    return () => {
      clearTimeout(t);
      events.forEach(e=>window.removeEventListener(e, arm));
    };
  },[conn?.pat]);

  // Load area/iter paths when connected
  useEffect(()=>{
    if(!conn) return;
    adoAreaPaths(conn.org,conn.projectName,conn.pat).then(setAreas).catch(()=>{});
    adoIterPaths(conn.org,conn.projectName,conn.pat).then(setIters).catch(()=>{});
  },[conn?.projectName]);

  // Fetch work items
  const doFetch = useCallback(async(overrides={})=>{
    if(!conn) return;
    const f={...filters,...overrides};
    setLoading(true);setErr(null);
    try{
      const {ids,wiql}=await adoQueryWI(conn.org,conn.projectName,conn.pat,f);
      setLastWiql(wiql);
      if(!ids.length){setItems([]);setLoading(false);return;}
      const details=await adoGetDetails(conn.org,conn.projectName,conn.pat,ids);
      setItems(details.map(wiToItem));
    }catch(e){setErr(e.message);}
    setLoading(false);
  },[conn,filters]);

  const resetFilters=()=>{
    const cleared={types:[],states:[],areaPath:"",iterPath:"",assignedTo:""};
    setFilters(cleared);
    doFetch(cleared);
  };

  // Fetch on connect
  useEffect(()=>{ if(conn&&!booting) doFetch(); },[conn?.projectId,booting]);

  const selectedItem = items.find(i=>i.id===selId)||null;
  const selectedQA   = selId ? (qaStore[selId]||{}) : {};

  const updateQA = (data) => {
    if(!selId) return;
    setQaStore(prev=>({...prev,[selId]:data}));
  };

  const disconnect = () => {
    setConn(null); setItems([]); setSelId(null); setQaStore({}); setFilters({types:[],states:[],areaPath:"",iterPath:"",assignedTo:""});
  };

  if(booting) return (
    <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:T.bg,fontFamily:T.font,fontSize:14,color:T.textMuted}}>
      <Spin label="Loading…" size={16}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  if(!conn) return (
    <>
      <ConnectScreen onConnect={c=>{setConn(c);}}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );

  return (
    <div style={{height:"100vh",display:"grid",gridTemplateColumns:"300px 1fr",overflow:"hidden",background:T.bg,color:T.text,fontFamily:T.font}}>
      {showSettings && <SettingsPanel onClose={()=>setShowSettings(false)} onSaved={setHasAI}/>} 
      <GlobalCopilotPanel
        open={showCopilot}
        onClose={()=>setShowCopilot(false)}
        contextItem={selectedItem}
        conn={conn}
        hasAI={hasAI}
        onOpenSettings={()=>setShowSettings(true)}/>
      {/* Floating launcher */}
      <button onClick={()=>setShowCopilot(v=>!v)}
        title={showCopilot?"Close Copilot":"Open Copilot Chat"}
        aria-label={showCopilot?"Close Copilot":"Open Copilot Chat"}
        style={{position:"fixed",bottom:18,right:18,zIndex:980,width:48,height:48,borderRadius:"50%",border:"none",background:T.navy,color:"#fff",fontSize:22,cursor:"pointer",boxShadow:"0 6px 18px rgba(0,0,0,0.18)",display:"inline-flex",alignItems:"center",justifyContent:"center"}}>
        {showCopilot?<Ic.Close size={20}/>:<Ic.Bot size={21}/>}
      </button>
      {/* Left — Work Item List */}
      <div style={{borderRight:`1px solid ${T.border}`,overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <WorkItemList
          conn={conn} items={items} loading={loading} err={err} lastWiql={lastWiql}
          filters={filters} setFilters={setFilters}
          onFetch={doFetch} onResetFilters={resetFilters}
          areas={areas} iters={iters}
          selectedId={selId} onSelect={item=>setSelId(item.id)}/>
        {/* Disconnect footer */}
        <div style={{padding:"6px 10px",borderTop:`1px solid ${T.border}`,background:T.bgMuted,flexShrink:0,display:"flex",gap:6,alignItems:"center"}}>
          <button onClick={disconnect} style={{flex:1,fontSize:10,color:T.textFaint,background:"none",border:"none",cursor:"pointer",textAlign:"left",padding:"2px 0"}}>
            ⟵ Disconnect / switch project
          </button>
          <ThemeToggle/>
          <button onClick={()=>setShowSettings(true)} style={{height:32,width:32,color:T.textMuted,background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:T.r,padding:0,cursor:"pointer",display:"inline-flex",alignItems:"center",justifyContent:"center"}} title="API Key Settings" aria-label="API key settings">
            <Ic.Settings size={14}/>
          </button>
        </div>
      </div>

      {/* Right — Detail Panel */}
      <div style={{overflow:"hidden",display:"flex",flexDirection:"column"}}>
        <WorkItemDetail
          item={selectedItem}
          qaData={selId?{...selectedItem,...selectedQA}:null}
          onUpdateQA={updateQA}
          conn={conn}
          allItems={items}
          hasAI={hasAI}
          onOpenSettings={()=>setShowSettings(true)}/>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
