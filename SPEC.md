# Web A11y — Product Specification

> **Project:** Open source, under the Ethos GitHub organization.  
> **License:** Apache 2.0  
> **Repository:** `web-a11y` (https://github.com/Eythos/web-a11y)

## 1. Concept & Vision

**What it is:**
A single desktop application called **Web A11y** that takes a website's source files and makes them fully accessible — WCAG 2.2 AAA compliant — while preserving brand and visual design exactly. One drag. One button. Done. Runs on Windows, macOS, and Linux.

**What it is not:**
A auditor that tells you what's wrong. A cloud service. A command-line tool. A plugin. Anything that requires the user to understand what accessibility means.

**The promise to the user:**
> "Drop in your website. Get it back accessible. It will look identical. It will work for everyone."

**The north star:**
Non-technical people responsible for websites — a solo pastor at a small church, a volunteer at a nonprofit, a small business owner who inherited their company's site — can make their website work for disabled people without hiring a specialist, without learning what ARIA means, and without their site looking any different to anyone who visits it.

---

## 2. Who It's For

**Primary user:**
Someone at a small organization who is smart and capable but wears many hats. They built or maintain their organization's website. They have enough technical comfort to use a drag-and-drop app and press a button. They do not know what WCAG stands for and should never need to.

**Secondary user:**
A freelance web developer who inherited an inaccessible site and needs a tool that does the mechanical work fast so they can focus on design and custom fixes.

**What they have:**
- A folder of HTML, CSS, JS, and assets
- A target WCAG level (default: 2.2 AA, option for AAA)
- No accessibility expertise required

**What they get:**
- A fixed version of their website
- A plain-English report explaining what was changed and why
- Confidence that their site now works for people with disabilities

---

## 3. UX — The Flow

### First Launch

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│              [Logo] A11y Studio                      │
│                                                      │
│         Make any website accessible                  │
│         in minutes — not days.                       │
│                                                      │
│    [Drag your website folder here]                   │
│                                                      │
│    ─────────────── OR ───────────────               │
│                                                      │
│    [Enter website URL]  →  fetches site files        │
│                                                      │
│    ┌─────────────────────────────────────────┐       │
│    │  Target level:  ○ WCAG 2.2 AA (default)│       │
│    │                 ○ WCAG 2.2 AAA         │       │
│    │  Neurodiversity mode: [✓]              │       │
│    └─────────────────────────────────────────┘       │
│                                                      │
│             [ Make Accessible →]                     │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Processing Screen

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│              Processing your website...              │
│                                                      │
│    [████████████████████░░░░░░░░]  12 / 47 files   │
│                                                      │
│    ✓ Analyzing HTML structure                        │
│    ✓ Checking color contrast                         │
│    → Generating alt text (AI)                        │
│    ○ Testing keyboard navigation                     │
│    ○ Verifying focus order                           │
│    ○ Building accessibility report                   │
│                                                      │
│         Model: qwen3:4b-instruct-2507                │
│         Running locally — nothing sent to cloud      │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Results Screen

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│         ✓ Accessibility complete                     │
│                                                      │
│    47 issues found and fixed                         │
│    2 issues need manual review                       │
│    Brand preserved ✓                                 │
│                                                      │
│    ┌─────────────────────────────────────────┐       │
│    │  WCAG 2.2 AA Compliance                 │       │
│    │  ████████████████████████████  98%     │       │
│    └─────────────────────────────────────────┘       │
│                                                      │
│    [Download Fixed Website]  ← zip of full project   │
│    [View Full Report]       ← human-readable        │
│    [Open in Browser]        ← preview fixed site    │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Manual Review Screen (for the 2 flagged items)

```
┌──────────────────────────────────────────────────────┐
│                                                      │
│    2 items need your attention                       │
│                                                      │
│    ┌─────────────────────────────────────────┐       │
│    │  1.  Contact form — error message       │       │
│    │      "This field is invalid"            │       │
│    │      Suggested: "Please enter a valid    │       │
│    │      email address, like                  │       │
│    │      name@example.com"                  │       │
│    │                                          │       │
│    │      [ Accept Suggestion ]               │       │
│    │      [ Edit Manually ]                   │       │
│    │      [ Skip ]                           │       │
│    └─────────────────────────────────────────┘       │
│                                                      │
│    ┌─────────────────────────────────────────┐       │
│    │  2.  Video — missing captions           │       │
│    │      videos/annual-meeting.mp4           │       │
│    │      Add captions file: [Choose File]   │       │
│    │      [ Skip — add later ]               │       │
│    └─────────────────────────────────────────┘       │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 4. Architecture

### Overview

```
┌──────────────────────────────────────────────────────┐
│                   A11y Studio App                    │
│                   (Electron wrapper)                 │
│                                                       │
│  ┌──────────────────────────────────────────────┐   │
│  │              Local Web UI                    │   │
│  │  (served at localhost:port)                  │   │
│  │  - Drag/drop zone                            │   │
│  │  - Progress display                          │   │
│  │  - Report viewer                             │   │
│  └──────────────────────────────────────────────┘   │
│                                                       │
│  ┌──────────────────────────────────────────────┐   │
│  │           Accessibility Engine                │   │
│  │                                              │   │
│  │  File Parser                                 │   │
│  │    → HTML, CSS, JS, assets                   │   │
│  │                                              │   │
│  │  Rules Engine (deterministic)                │   │
│  │    → Color contrast math                     │   │
│  │    → Heading hierarchy                       │   │
│  │    → Form labels                             │   │
│  │    → Skip links                              │   │
│  │    → Focus order                             │   │
│  │    → ARIA patterns                           │   │
│  │    → Media captions/transcripts              │   │
│  │                                              │   │
│  │  AI Review Layer (Ollama + Qwen3-4B)         │   │
│  │    → Alt text generation                     │   │
│  │    → Error message improvement               │   │
│  │    → Reading level check                     │   │
│  │    → Edge case judgment                      │   │
│  │    → Animation/vestibular risk assessment    │   │
│  │    → Final quality gate                      │   │
│  └──────────────────────────────────────────────┘   │
│                                                       │
│  ┌──────────────────────────────────────────────┐   │
│  │           Ollama (bundled)                   │   │
│  │  Model: qwen3:4b-instruct-2507-q4_K_M       │   │
│  │  Runs entirely on-device                      │   │
│  │  No internet required after install           │   │
│  └──────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### The Model's Role — Deliberately Narrow

The Qwen3-4B model is **not** the primary worker. The rules engine handles everything it can deterministically. The model is called only for:

1. **Alt text generation** — given an image with no alt, the model generates a descriptive alt string
2. **Error message improvement** — form error messages that are vague ("invalid") get rewritten to be specific and helpful ("Please enter a valid email address, like name@example.com")
3. **Reading level check** — flags content above grade 8 reading level for the user's review
4. **Animation risk assessment** — identifies animations that may trigger vestibular issues and recommends `prefers-reduced-motion` wrapping
5. **Final quality gate** — model reviews the rules engine's output and flags anything that looks wrong

**The model is never asked to make structural decisions.** It follows rules, it doesn't invent.

### No Thinking Mode

The model runs in **inference-only mode**. Thinking/reasoning is disabled at the system prompt level and via control tokens. The model produces fast, consistent, rule-following outputs. This is intentional — thinking adds latency and inconsistency for no benefit in this use case.

---

## 5. Technical Decisions

### Framework: Electron

**Why:** Single installer for Windows and Mac. Serves a local web UI. Bundles Ollama as a subprocess. Complete offline capability once installed.

**Alternatives considered:**
- Python TUI — too intimidating for non-technical users
- Web app (local server) — requires the user to know how to run a server
- Native (Swift, .NET) — more work for cross-platform, less web UI flexibility

### Ollama: Bundled, Not System-Installed

**Why:** The app manages Ollama internally. The user never needs to have Ollama installed separately. On first run, the app downloads the model (2.5GB) automatically. If the user already has Ollama with the right model, it uses that instead.

### File Processing

- **Input:** ZIP file, folder, or URL (fetched via curl if URL entered)
- **Supported formats:** HTML, HTM, XHTML, CSS, SCSS, JS, TS, JSON (manifests), media files (flagged, not processed)
- **CMS support:** WordPress, Webflow, and Squarespace exports (ZIP of export)
- **Output:** ZIP of fixed project, or optional in-place overwrite with backup first

### Backup Before Changes

The app **always creates a backup ZIP** before modifying anything. The user can restore from the backup at any time. Backups are clearly named with timestamp.

### Report Format

The accessibility report is generated as:
1. **In-app HTML view** — styled, searchable, expandable changelog
2. **Downloadable Markdown file** — for developers who want the raw changelog
3. **Summary JSON** — for automation tools that want structured output

---

## 6. Accessibility Standards Compliance

### Standards Applied

| Standard | Level | Notes |
|----------|-------|-------|
| WCAG 2.2 | AA | Default target |
| WCAG 2.2 | AAA | Optional toggle |
| ATAG 2.0 | Part A | If CMS detected, tool itself is accessible |

### Rules Engine — What Gets Fixed Automatically

| Category | Fixes Applied |
|----------|-------------|
| **Headings** | Correct H1→H2→H3 hierarchy, no skipped levels |
| **Landmarks** | Replace non-semantic divs with nav, main, section, article, aside |
| **Forms** | Associate labels with inputs, generate error IDs, link errors to fields |
| **Color contrast** | Adjust lightness/saturation only — same hue, AA-compliant |
| **Skip links** | Inject hidden skip-to-content, visible on focus |
| **Focus indicators** | Ensure visible focus ring on all interactive elements |
| **Images** | Add alt (via AI) or flag as decorative |
| **Links** | Detect vague link text ("click here", "read more") and fix |
| **Language** | Add `lang` attribute if missing |
| **Tables** | Ensure headers + scope, no nested tables unless complex |
| **Keyboard** | Trapped focus in modals, logical tab order |
| **Motion** | Wrap animations in `prefers-reduced-motion` query |
| **Media** | Flag video without captions, audio without transcript |

### AI-Assisted Fixes (Model Required)

| Category | Fix Applied |
|----------|-------------|
| **Alt text** | Generate descriptive alt for images without it |
| **Error messages** | Rewrite generic errors to be specific and actionable |
| **Reading level** | Flag content above grade 8; suggest simplifications |
| **Animation risk** | Identify animations likely to cause vestibular issues |

### What Is Flagged (Not Auto-Fixed)

- Video captions — requires human-provided caption file
- Audio transcripts — requires human-provided transcript
- Complex dynamic content — requires human review
- Multi-language sites — requires human to verify `lang` attributes

---

## 7. Model Specification

### Model: Qwen3-4B-Instruct-2507 (Q4_K_M Quantized)

**Ollama tag:** `qwen3:4b-instruct-2507-q4_K_M`

**Spec:**
- Parameters: 4 billion
- Quantization: Q4_K_M (high quality, good size balance)
- Download size: ~2.5GB
- RAM usage: ~6-8GB at runtime
- Context window: 32K tokens
- Architecture: Dense transformer, non-thinking

**Why this model:**
- Best instruction-following in its size class (IFEval benchmark)
- Clean JSON output — critical for structured AI requests
- Strong HTML/CSS comprehension — understands structure
- Fast inference — no reasoning overhead
- Actively maintained by Alibaba (July 2025 update)
- Available in Ollama, runs on modest hardware

**System prompt (fixed, non-editable by user):**
```
You are an accessibility assistant. You strictly follow WCAG 2.2 guidelines.
You output ONLY valid JSON. Never output explanation outside the JSON structure.
You do not think — you respond directly and precisely.
...
```

**Control tokens:** Thinking mode disabled via `--no-think` equivalent in Ollama API call.

**Fallback:** If Ollama is not available or model fails to load, the app uses the rules engine only and notes in the report which AI-assisted items could not be processed.

---

## 8. Privacy & Security

- **No internet required** after installation and model download
- **No data leaves the device** — ever
- **Files are processed locally** — source files never uploaded
- **No telemetry** — no usage data collected
- **No accounts** — nothing to sign in to
- **Files deleted from memory** after processing — not retained

---

## 9. Installation & Onboarding

**Distribution:** Open source under the Ethos GitHub organization. Releases published on GitHub with signed binaries for macOS and Linux. No accounts, no telemetry, no cloud dependency.

### First Run Flow

1. User downloads the installer for their platform (.exe for Windows, .dmg for macOS, .AppImage or .deb for Linux)
2. Runs installer — standard next/next/finish
3. App launches → shows welcome screen with one-sentence explanation
4. First-time model setup:
   - "This app uses a local AI model to make accessibility fixes. We need to download it first. [Download Model] → shows progress bar
   - Download size: ~2.5GB
   - On fast connection: ~2 minutes
   - On slow connection: up to 15 minutes with resume capability
5. Model ready → shown brief animated tutorial (30 seconds) of drag → button → done
6. Ready to use

### System Requirements

| | Minimum | Recommended |
|-|---------|-------------|
| OS | macOS 11+, Windows 10+, Ubuntu 18.04+, Debian 10+ | macOS 13+, Windows 11, Ubuntu 22.04+, Debian 12+ |
| RAM | 8GB | 16GB |
| Storage | 5GB free | 10GB free |
| Internet | Required for install + model download only | Same |
| GPU | Not required | Optional (makes processing faster) |

---

**Pricing:** Open source, free forever. Published under the Ethos GitHub organization.

**Updates:** Automatic. On app startup, the app checks if a newer version of the Qwen3-4B-Instruct-2507 model is available in Ollama and downloads it if so. User is shown a notification when an update is available with one-click install. No manual intervention required.

**Input/output format:** The app preserves the source format exactly. Whatever file format the user provides — raw HTML/CSS/JS, WordPress XML export, Webflow JSON export, or any other CMS export format — the fixed output is delivered in the same format. Files are parsed, accessibility fixes are applied, and the result is packaged in the same structure and format as the input. The user continues working in the same tools they always have.

**ZIP output:** Default. The fixed website is downloaded as a ZIP file, preserving the exact directory structure and file formats of the original. In-place editing is available as an optional setting, with automatic timestamped backup created before any changes are made.

**Platforms:** macOS, Windows, and Linux. Built with Electron for cross-platform consistency. All three platforms share the same UI, same engine, and same capabilities.

**Report sharing:** Not in scope.

**Languages:** English only at launch. The app itself must be fully accessible — screen reader tested (NVDA, VoiceOver), keyboard-only navigable, meets WCAG 2.2 AA internally. This is a core requirement, not an afterthought: the people building this tool are the same people who care most that it works for disabled users. Localization to additional languages should be deferred until after v1 launch.

---

## 10. Open Questions

1. **Windows native** — Confirmed: Windows native support in addition to Mac + Linux.
2. **CMS-specific exports** — Auto-detect format. The engine examines the input structure and processes accordingly. Raw HTML/CSS/JS folders, WordPress XML exports, Webflow JSON exports, and any other CMS export format are all handled by parsing the structure, applying accessibility fixes, and outputting in the same format. The user always gets back exactly what they put in, just accessible.

---

## 11. Out of Scope (This Version)

- Cloud processing (no API key option in this spec)
- Real-time website scanning (URL input is a one-time fetch)
- CMS plugin integration (WordPress plugin, etc.)
- Continuous monitoring / scheduled rescans
- Team collaboration features
- Generated captions/transcripts (requires human content)
- Automated testing integration (Selenium, Playwright)

---

*Last updated: 2025-05-29*
