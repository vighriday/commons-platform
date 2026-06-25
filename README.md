# COMMONS

**The operating system for community attention.**

COMMONS is an AI civic-intelligence platform that finds the problems hidden
*between* the reports — the quiet, dangerous issues a community has not started
paying attention to yet.

🔗 **Live:** <https://commons-33047220516.asia-southeast1.run.app>

---

## The problem

Communities don't fail from *under-reporting*. They fail from **fragmented
attention**. The loudest complaint is rarely the most dangerous one.

A pothole gets fifty angry upvotes. Two streets away, a choked stormwater drain
near a lake — the one that will flood homes in the next monsoon — sits with two
quiet reports and no upvotes. Every civic dashboard ranks by volume, so the
pothole wins and the drain is invisible until it floods.

COMMONS measures two things separately and shows the gap between them:

- **Impact** — how dangerous a problem actually is (from real geospatial and
  census data), scored 0–100.
- **Attention** — how much the community is actually talking about it.

When a problem is **high impact but low attention**, it's a **Hidden Crisis** —
and COMMONS surfaces it, names the responsible authority, and drafts the
escalation.

> Worked example (HSR Layout, Bengaluru — Ward 174): the community's loudest
> issue is a pothole (attention 0.78, impact 19). The AI-assessed top risk is a
> silent stormwater-drain choke near Agara Lake (impact **81**, attention 0.17).
> COMMONS overrules the crowd and promotes the drain to #1.

---

## How it works — four stages

| Stage | What happens | Where to see it |
|-------|--------------|-----------------|
| **0 · Reports** | Citizens report problems with text, a photo, and a location (Plus Code grid cell). | Raw reports served at `/api/reports`. |
| **1 · Two scores** | Each problem gets an **Impact** score (real data) and an **Attention** score (the crowd). Plotting them is the matrix. | **Matrix** view. |
| **2 · Seven agents** | A Gemini agent pipeline reasons each problem through: read evidence → score → check the crowd → overrule when needed → draft the fix → name the authority → recall the history. | **Trace** view (every step inspectable). |
| **3 · Space & time** | A 3D **Digital Twin** shows where the danger physically sits across the ward; a **Time Machine** scrubs the last months to show the loud problem staying loud while the quiet crisis stays ignored. | **Twin** and **Time** views. |

### The two scores, spelled out

#### `Impact = Severity × Exposure × Vulnerability × 100`

- **Severity** — which row of a fixed, published severity table the problem fits
  (e.g. *"sewage flooding homes"* = 5/5). Not a free LLM guess — a lookup.
- **Exposure** — how built-up the area is, from **Google Open Buildings 2.5D**.
- **Vulnerability** — how at-risk the people are, from **Google Data Commons**.

Because the table and the data sources are fixed and inspectable, **every Impact
score is auditable** — you can see exactly where the number came from.

#### `Attention = ½ Alarm + ⅓ Engagement + ⅕ Recency`

The community's voice only. It deliberately knows *nothing* about how dangerous
the problem is — which is what makes the gap between the two scores meaningful.

---

## The seven agents

The pipeline runs per problem; Impact and Attention run in parallel.

```text
Evidence → ( Impact ‖ Attention ) → Hidden-Crisis → Resolution → Accountability → Memory
```

1. **Evidence** — reads the reports and their photos, names the real problem.
2. **Impact** — computes Severity × Exposure × Vulnerability, and asserts it.
3. **Attention** — computes the community-attention signal, and asserts it.
4. **Hidden-Crisis** — compares the two rankings and **overrules the crowd** when
   a quiet problem is the dangerous one.
5. **Resolution** — drafts the fix: the steps, the right department, the SLA.
6. **Accountability** — names the exact authority and writes a ready-to-send
   escalation brief.
7. **Memory** — builds the occurrence timeline and the recurrence narrative.

Every step is **inspectable in the UI**: open the Trace view and click any agent
to see, in plain language, *what it received, what it did, what it concluded, and
why we trust it* — plus the raw input and the evidence behind the conclusion.

---

## Built on Google technology

| Technology | Used for |
|------------|----------|
| **Google Cloud Run** | Hosting (containerized Node server + SPA). |
| **Gemini 3.5 Flash** | The reasoning steps — evidence, critique, escalation prose. |
| **Gemini 3.1 Flash-Lite** | The high-volume workhorse steps. |
| **gemini-embedding-001** | Clustering reports into issues (3072-dim embeddings). |
| **Google Open Buildings 2.5D** | The Exposure factor (built density + height). |
| **Google Data Commons** | The Vulnerability factor (census deprivation proxy). |
| **Google Plus Codes** (Open Location Code) | The ~275 m grid cell — the spatial join key. |
| **Firestore** | Live-submission write seam (seed JSON backs every read). |

---

## Honesty: synthetic data & provenance

This is a hackathon demo, and it is **explicit about what is real**:

- **The reports are synthetic.** They are a realistic, hand-designed corpus for
  HSR Layout (Bengaluru, Ward 174), carrying deliberately planted patterns (the
  hidden crises, a recurrence chain, the loud-but-low-impact pothole). This makes
  the demo honest and repeatable rather than cherry-picked. The UI says so on
  every screen.
- **The method is real.** The severity table, the Impact formula, the agent
  pipeline, the embeddings, and the Plus Code grid are exactly what would run on
  live data.
- **The geospatial/census factors** are derived from the real Google Open
  Buildings and Data Commons methodology; values are marked
  `derived-from-real` and any low-granularity proxy (e.g. district-level
  vulnerability) is flagged in the UI, with confidence adjusted accordingly.
- **The demo spends ≈0 API quota.** The agent pipeline is run once and **frozen**
  to disk; the live app serves that recorded trace. The Trace view shows, per
  step, whether it was cached and how much quota was spent (0).

Nothing in the transparency layer invents a number — every value shown is read
straight off the frozen run.

---

## Architecture

```text
┌─────────────────────────── Cloud Run container ───────────────────────────┐
│                                                                            │
│   React 19 SPA  ──fetch──▶  Express API  ──reads──▶  frozen seed JSON      │
│   (Vite build)              (same origin)            (issues, trace,        │
│      │                          │                     snapshots, reports)   │
│      │                          │                                           │
│   Matrix · Trace · Twin · Time  └─ /gemini-ping proves the live key works   │
│   (deck.gl 3D, MapLibre)                                                    │
│                                                                            │
│   Build-time pipeline (run once, frozen):                                  │
│   reports ─▶ embeddings ─▶ issues ─▶ 7-agent run ─▶ agentRun.json + snapshots│
└────────────────────────────────────────────────────────────────────────────┘
```

The read path is **seed-first by design**: every API response is backed by
committed JSON, so reads never depend on Firestore or Gemini being up and never
burn quota. A top-level React error boundary means a render failure degrades to a
calm recovery screen, never a blank page.

---

## Run it locally

Requires **Node 22+**.

```bash
npm install

# Optional: a Gemini API key only enables the live /gemini-ping and re-freezing
# the pipeline. The app runs fully on the committed frozen data without one.
echo "GEMINI_API_KEY=your-key" > .env

npm run dev      # dev server (Vite middleware) at http://localhost:5173
```

> **Note (Windows + OneDrive):** `npm run dev` uses `node --watch`, which can
> restart-loop if the project sits in a OneDrive-synced folder (sync re-touches
> files). If that happens, run the stable variant:
> `node --env-file=.env --import tsx server.ts`.

### Production build

```bash
npm run build    # vite build + esbuild server → dist/server.cjs
npm start        # serves dist/ on $PORT (default 8080)
```

### Useful scripts

| Script | What it does |
|--------|--------------|
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run gate` | typecheck + production build (the CI gate). |
| `npm run seed:all` | Regenerate the full seed pipeline (needs a Gemini key). |
| `npm run agents` | Re-run and re-freeze the 7-agent trace. |
| `npm test` | Vitest. |

---

## API

| Endpoint | Returns |
|----------|---------|
| `GET /api/health` | Liveness. |
| `GET /api/issues` | The Attention × Impact issue set. |
| `GET /api/issues/:id` | One issue (full auditable breakdown). |
| `GET /api/reports` | The raw citizen reports (Phase 0 inputs). |
| `GET /api/neighborhood/:ward` | The Digital Twin + Civic Pulse. |
| `GET /api/agent-run` | The frozen 7-agent trace. |
| `GET /api/snapshots/:ward` | The Time Machine month-end frames. |

---

## License

[MIT](./LICENSE)
