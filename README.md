# QA Intelligence Hub

AI-powered QA tool — connects to your Azure DevOps project, reviews user stories,
generates test cases, and lets you research testing scope with a real AI chat.

---

## Prerequisites

- **Node.js 18+** → https://nodejs.org  (check: `node --version`)
- **Anthropic API key** → https://console.anthropic.com/settings/keys
- **Azure DevOps PAT** → ADO → your avatar (top-right) → Personal Access Tokens → New Token
  - Scope needed: **Work Items: Read**  (add Write if you want to post comments back)

---

## Run in VS Code — 3 steps

**Step 1 — Open the folder**
```
File → Open Folder → select the qa-hub folder
```

**Step 2 — Install and start (in the VS Code terminal)**
```bash
npm install
npm run dev
```
The browser opens automatically at **http://localhost:3000**

**Step 3 — Add your Anthropic API key**

When the app loads, click the **⚙ gear icon** (bottom-left of the sidebar) → paste your `sk-ant-...` key → Save.

That's it. Connect to Azure DevOps and start working.

---

## Project files

```
qa-hub/
├── src/
│   ├── App.jsx       ← entire application (single file)
│   └── main.jsx      ← React entry point (do not edit)
├── index.html        ← HTML shell (do not edit)
├── package.json      ← dependencies
├── vite.config.js    ← dev server config
├── server.js         ← optional: Express proxy for team deployments
└── .env.example      ← copy to .env to set keys via environment
```

---

## Optional: set API key via .env (skip the Settings panel)

```bash
cp .env.example .env
# open .env and set:
#   VITE_ANTHROPIC_KEY=sk-ant-your-key-here
npm run dev
```

---

## Optional: team deployment (API key stays on server)

```bash
cp .env.example .env
# set ANTHROPIC_KEY=sk-ant-your-key-here in .env

npm install
npm run build     # builds React app → dist/
npm run server    # starts proxy server at http://localhost:3001
```

Deploy the whole folder to any Node.js host (Render, Railway, Fly.io, your own server).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `node --version` says 16 or below | Install Node 18+ from nodejs.org |
| "No Anthropic API key" error | Click ⚙ gear icon → add your key |
| ADO "connection failed" | Use just the org name: `Nucor-NBT` not the full URL. Check PAT has Work Items: Read scope |
| ADO "Unauthorized (401)" | PAT expired — create a new one in ADO |
| Blank page on `npm run dev` | Delete `node_modules/` → run `npm install` again |
