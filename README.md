<div align="center">

<img src="public/logo.svg" width="64" height="64" alt="COMMONS logo" />

# COMMONS

### The operating system for community attention.

**AI civic intelligence that finds the problems hidden *between* the reports —
the quiet, dangerous issues a community has not started paying attention to yet.**

[![Live on Cloud Run](https://img.shields.io/badge/Live-Cloud%20Run-3ddc97?style=for-the-badge&logo=googlecloud&logoColor=white)](https://commons-33047220516.asia-southeast1.run.app)
&nbsp;
![Built with Gemini](https://img.shields.io/badge/Gemini-3.5%20Flash%20%C2%B7%20Flash--Lite-3ea6ff?style=for-the-badge&logo=google&logoColor=white)
&nbsp;
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?style=for-the-badge&logo=typescript&logoColor=white)
&nbsp;
![License: MIT](https://img.shields.io/badge/License-MIT-eee?style=for-the-badge)

🔗 **[commons-33047220516.asia-southeast1.run.app](https://commons-33047220516.asia-southeast1.run.app)**

</div>

---

## The one-sentence pitch

> Communities don't fail from **under-reporting**. They fail from **fragmented
> attention** — the loudest complaint is rarely the most dangerous one, and the
> dangerous one stays invisible until it's a disaster.

A pothole gets fifty angry upvotes. Two streets away, a choked stormwater drain
near a lake — the one that will flood homes next monsoon — sits with two quiet
reports and no upvotes. Every civic dashboard ranks by volume, so the pothole
wins and the drain is invisible.

**COMMONS measures danger and loudness separately, and surfaces the gap.**

---

## See it

> A dense residential ward in Bengaluru, India — **HSR Layout (BBMP Ward 174)**,
> 63,033 residents — is the worked example throughout.

### 1 · The Contradiction Engine

The core view: every problem plotted by **Impact** (how dangerous) against
**Attention** (how loud). The amber top-left quadrant — high impact, low
attention — is where the **Hidden Crises** live.

![The Attention × Impact matrix](assets/screenshots/01-matrix.png)

The same data, as a native chart — the drain (impact 81) sits far from the crowd,
while the pothole (impact 19) soaks up the attention:

```mermaid
quadrantChart
    title Attention vs Impact — HSR Layout, Ward 174
    x-axis "Low attention" --> "High attention"
    y-axis "Low impact" --> "High impact"
    quadrant-1 "CRITICAL"
    quadrant-2 "HIDDEN CRISIS"
    quadrant-3 "MONITOR"
    quadrant-4 "NOISE"
    "Agara Lake drain": [0.17, 0.81]
    "Wall crack": [0.15, 0.80]
    "Unlit ORR stretch": [0.23, 0.62]
    "Synthesis cluster": [0.40, 0.49]
    "Recurring drain": [0.51, 0.34]
    "Pothole, 17th Cross": [0.78, 0.19]
```

> The pothole is alone in **NOISE** (loud, low impact). Three problems sit silent
> in **HIDDEN CRISIS** (dangerous, ignored). That gap is the product.

### 2 · The overrule, made auditable

Open any problem and the Impact score breaks down into its real, cited factors —
and where the AI overruled the crowd:

![Issue detail drawer](assets/screenshots/02-issue-drawer.png)

### 3 · Seven agents you can watch think

The **Trace** view explains the entire system in plain language, then lets you
click into any single agent step to see exactly what it received, what it did,
and why to trust it:

![The agent trace — plain-language transparency](assets/screenshots/05-step-inspector.png)

Flip on **Explain Mode** and every problem's reasoning expands inline, with the
overrule laid out crowd-vs-impact:

![Explain Mode — the overrule](assets/screenshots/04-trace-explain.png)

### 4 · The Digital Twin

The ward in 3D. Each column is a ~275 m grid cell; height = built exposure
(Google Open Buildings); colour = the quadrant of its worst problem. The amber
columns *are* the hidden crises, in space:

![3D Digital Twin](assets/screenshots/06-twin.png)

### 5 · The Time Machine

Scrub the last months and watch the contradiction unfold over time — the
pothole's attention climbs loud while the drain stays high-impact and ignored:

![Time Machine](assets/screenshots/07-time.png)

---

## How it works — four stages

```mermaid
flowchart LR
    A["📥 Stage 0<br/>Citizen reports<br/>text · photo · location"]
    B["📊 Stage 1<br/>Two scores<br/>Impact + Attention"]
    C["🤖 Stage 2<br/>7-agent pipeline<br/>reason · overrule · escalate"]
    D["🌐 Stage 3<br/>Twin + Time<br/>space · history"]
    A --> B --> C --> D
    style A fill:#1a2332,stroke:#3ea6ff,color:#e6edf3
    style B fill:#1a2332,stroke:#3ea6ff,color:#e6edf3
    style C fill:#2a2010,stroke:#f5a623,color:#e6edf3
    style D fill:#102a1d,stroke:#3ddc97,color:#e6edf3
```

| Stage | What happens | Where to see it |
|-------|--------------|-----------------|
| **0 · Reports** | Citizens report problems with text, a photo, and a Plus Code location. | `/api/reports` |
| **1 · Two scores** | Each problem gets an **Impact** score (real data) and an **Attention** score (the crowd). | Matrix view |
| **2 · Seven agents** | A Gemini pipeline reasons each problem through, end to end. | Trace view |
| **3 · Space & time** | A 3D Digital Twin and a snapshot Time Machine make impact tangible. | Twin & Time views |

---

## The seven agents

The pipeline runs per problem. **Impact and Attention run in parallel** — and the
Hidden-Crisis agent is the one that overrules the crowd.

```mermaid
flowchart TD
    E["1 · Evidence<br/><i>Flash</i>"] --> F{fork}
    F --> I["2 · Impact<br/><i>Flash-Lite</i>"]
    F --> A["3 · Attention<br/><i>Flash-Lite</i>"]
    I --> H["4 · Hidden-Crisis<br/><i>Flash · the overrule</i>"]
    A --> H
    H --> R["5 · Resolution<br/><i>Flash-Lite</i>"]
    R --> AC["6 · Accountability<br/><i>Flash</i>"]
    AC --> M["7 · Memory<br/><i>Flash-Lite</i>"]
    style H fill:#2a2010,stroke:#f5a623,color:#e6edf3,stroke-width:2px
    style E fill:#0d1117,stroke:#3ea6ff,color:#e6edf3
    style AC fill:#0d1117,stroke:#3ea6ff,color:#e6edf3
```

| # | Agent | What it does | Model |
|---|-------|--------------|-------|
| 1 | **Evidence** | Reads the reports and photos; names the real problem. | Flash |
| 2 | **Impact** | Computes Severity × Exposure × Vulnerability — and asserts it. | Flash-Lite |
| 3 | **Attention** | Computes the community-attention signal — and asserts it. | Flash-Lite |
| 4 | **Hidden-Crisis** | Compares the two; **overrules the crowd** when a quiet problem is the dangerous one. | Flash |
| 5 | **Resolution** | Drafts the fix: steps, department, SLA, cost band. | Flash-Lite |
| 6 | **Accountability** | Names the exact authority; writes a ready-to-send escalation brief. | Flash |
| 7 | **Memory** | Builds the occurrence timeline and recurrence narrative. | Flash-Lite |

### The overrule, as a conversation

This is the agentic heart — the moment the system contradicts the crowd:

```mermaid
sequenceDiagram
    participant Crowd as 👥 Community
    participant Att as Attention agent
    participant Imp as Impact agent
    participant HC as Hidden-Crisis agent
    Crowd->>Att: 50 upvotes on the pothole
    Att-->>HC: Pothole #1 by attention (0.78)
    Imp-->>HC: Drain #1 by impact (81)
    Note over HC: impact rank 1 vs attention rank 5<br/>gap ≥ 5 → structural overrule
    HC->>Crowd: ⚠️ The drain is your real #1 risk —<br/>you are looking at the wrong problem.
```

---

## The two scores, spelled out

Every number is **auditable** — reproducible from inputs, never an LLM's gut feel.

#### `Impact = Severity × Exposure × Vulnerability × 100`

```mermaid
flowchart LR
    S["Severity<br/>fixed 1–5 table<br/><b>5/5</b> sewage flooding"] --> X(("×"))
    E["Exposure<br/>Google Open Buildings<br/><b>0.93</b> built density"] --> X
    V["Vulnerability<br/>Google Data Commons<br/><b>0.87</b> at-risk people"] --> X
    X --> R["<b>Impact = 81</b><br/>out of 100"]
    style R fill:#2a2010,stroke:#f5a623,color:#e6edf3,stroke-width:2px
```

- **Severity** — which row of a fixed, published table the problem fits (e.g.
  *"sewage flooding homes"* = 5/5). A lookup, not a guess.
- **Exposure** — how built-up the area is, from **Google Open Buildings 2.5D**.
- **Vulnerability** — how at-risk the people are, from **Google Data Commons**.

Because the table and the data are fixed and inspectable, you can trace every
Impact score back to exactly where it came from.

#### `Attention = ½ Alarm + ⅓ Engagement + ⅕ Recency`

The community's voice only. It deliberately knows *nothing* about how dangerous a
problem is — which is what makes the gap between the two scores meaningful.

---

## Architecture

```mermaid
flowchart TB
    subgraph build["⚙️ Build-time pipeline — run once, frozen to disk"]
        direction LR
        rep["reports"] --> emb["embeddings"] --> iss["issues"] --> run["7-agent run"] --> froz["agentRun.json<br/>+ snapshots"]
    end
    subgraph cloud["☁️ Cloud Run container"]
        direction LR
        spa["React 19 SPA<br/>deck.gl · MapLibre<br/>Matrix · Trace · Twin · Time"] -->|fetch, same origin| api["Express API"]
        api -->|reads| seed[("frozen seed JSON")]
        api -.->|proves key works| g["Gemini /ping"]
    end
    froz --> seed
    style build fill:#0d1117,stroke:#30363d,color:#8b949e
    style cloud fill:#0d1117,stroke:#3ddc97,color:#e6edf3
    style seed fill:#1a2332,stroke:#3ea6ff,color:#e6edf3
```

The read path is **seed-first by design**: every API response is backed by
committed JSON, so reads never depend on Firestore or Gemini being up, and the
live demo spends **≈0 API quota**. A top-level React error boundary means a
render failure degrades to a calm recovery screen — never a blank page.

---

## Built on Google technology

| Technology | Used for |
|------------|----------|
| **Google Cloud Run** | Hosting (containerized Node server + SPA). |
| **Gemini 3.5 Flash** | The reasoning steps — evidence, critique, escalation prose. |
| **Gemini 3.1 Flash-Lite** | The high-volume workhorse steps. |
| **gemini-embedding-001** | Clustering reports into issues (3072-dim). |
| **Google Open Buildings 2.5D** | The Exposure factor (built density + height). |
| **Google Data Commons** | The Vulnerability factor (census deprivation proxy). |
| **Google Plus Codes** | The ~275 m grid cell — the spatial join key. |
| **Gemma** | RPD-wall fallback model (separate free-tier pool). |
| **A2A** | The pipeline is discoverable at `/.well-known/agent.json`. |

---

## Honesty: synthetic data & provenance

This is a hackathon demo, and it is **explicit about what is real**:

```mermaid
flowchart LR
    subgraph synthetic["🧪 Synthetic (and labelled as such in the UI)"]
        r["The reports — a designed corpus<br/>for HSR Layout with planted patterns"]
    end
    subgraph real["✅ Real method & data sources"]
        m["The severity table, the formulas,<br/>the agent pipeline, the embeddings"]
        d["Open Buildings + Data Commons<br/>methodology (marked derived-from-real)"]
    end
    r --> out["The result you see"]
    m --> out
    d --> out
    style synthetic fill:#2a2010,stroke:#f5a623,color:#e6edf3
    style real fill:#102a1d,stroke:#3ddc97,color:#e6edf3
```

- **The reports are synthetic** — a realistic, hand-designed corpus carrying
  deliberately planted patterns (the hidden crises, a recurrence chain, the
  loud-but-low-impact pothole), so the demo is honest and repeatable rather than
  cherry-picked. **The UI says so on every screen.**
- **The method is real** — the formulas, the agent pipeline, the embeddings, and
  the Plus Code grid are exactly what would run on live data.
- **Low-granularity proxies are flagged** (e.g. district-level vulnerability),
  with confidence adjusted accordingly.
- **The demo spends ≈0 quota** — the pipeline runs once and is frozen; the Trace
  view shows, per step, whether it was cached and how much quota was spent (0).

Nothing in the transparency layer invents a number — every value shown is read
straight off the frozen run.

---

## Run it locally

Requires **Node 22+**.

```bash
npm install

# Optional — a Gemini API key only enables /gemini-ping and re-freezing the
# pipeline. The app runs fully on the committed frozen data without one.
echo "GEMINI_API_KEY=your-key" > .env

npm run dev      # http://localhost:5173
```

> **Windows + OneDrive note:** `npm run dev` uses `node --watch`, which can
> restart-loop inside a OneDrive-synced folder (sync re-touches files). If that
> happens, run the stable variant:
> `node --env-file=.env --import tsx server.ts`.

### Production

```bash
npm run build    # vite build + esbuild server → dist/server.cjs
npm start        # serves dist/ on $PORT
```

### Scripts

| Script | What it does |
|--------|--------------|
| `npm run gate` | typecheck + production build (the CI gate). |
| `npm run agents` | Re-run and re-freeze the 7-agent trace (needs a key). |
| `npm run seed:all` | Regenerate the full seed pipeline. |
| `npm test` | Vitest. |

---

## API

| Endpoint | Returns |
|----------|---------|
| `GET /api/health` | Liveness. |
| `GET /api/issues` · `/api/issues/:id` | The issue set / one auditable issue. |
| `GET /api/reports` | The raw citizen reports (Stage 0). |
| `GET /api/neighborhood/:ward` | The Digital Twin + Civic Pulse. |
| `GET /api/agent-run` · `/api/agent-run/usage` | The frozen trace / the live quota counter. |
| `GET /api/snapshots/:ward` | The Time Machine frames. |
| `GET /.well-known/agent.json` | The A2A agent card. |

---

<div align="center">

**COMMONS** — finding the crises hidden between the reports.

[Live demo](https://commons-33047220516.asia-southeast1.run.app) · [MIT License](./LICENSE)

</div>
