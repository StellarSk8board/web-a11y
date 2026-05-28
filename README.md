# Web A11y

**One drag. One button. Accessible.**

Web A11y is a desktop application that makes any website WCAG 2.2 accessible — while preserving brand and visual design exactly. Everything runs locally. Nothing leaves your device.

## What It Does

- Drop in any website folder or ZIP (HTML, CSS, JS, WordPress export, Webflow export, any CMS format)
- Press one button
- Get back an fully accessible version — same format you put in, pixel-identical design
- Download the fixed website as a ZIP

## Features

- **WCAG 2.2 AA/AAA** compliance
- **Brand preservation** — colors, fonts, layout all preserved. Only inaccessible markup changes.
- **Local AI model** — qwen3:4b-instruct runs entirely on your device via Ollama
- **Neurodiversity-friendly mode** — extra consideration for cognitive accessibility
- **No accounts, no cloud, no telemetry** — fully private
- **Cross-platform** — macOS, Windows, Linux

## Installation

### macOS / Linux / Windows

1. Download the latest release for your platform from the [Releases](https://github.com/StellarSk8board/web-a11y/releases) page
2. Install and run

### First Run

On first launch, Web A11y will download the AI model (~2.5GB) if Ollama is not already set up. This happens automatically.

If you already have [Ollama](https://ollama.com) installed with the qwen3 model, Web A11y will use that instead.

### Manual Model Setup (Optional)

```bash
ollama run qwen3:4b-instruct-2507-q4_K_M
```

## Usage

1. **Launch Web A11y**
2. **Drop your website folder** (or a ZIP export from any CMS)
3. **Choose WCAG level** — AA (default) or AAA
4. **Press "Make Accessible"**
5. **Download the fixed website**

## System Requirements

| | Minimum | Recommended |
|-|---------|-------------|
| OS | macOS 11+, Windows 10+, Ubuntu 18.04+ | macOS 13+, Windows 11, Ubuntu 22.04+ |
| RAM | 8GB | 16GB |
| Storage | 5GB free | 10GB free |

No GPU required — the model runs on CPU.

## Development

```bash
# Clone
git clone https://github.com/StellarSk8board/web-a11y.git
cd web-a11y

# Install dependencies
npm install

# Run in development
npm start

# Build distributable
npm run build        # all platforms
npm run build:mac    # macOS only
npm run build:win    # Windows only
npm run build:linux  # Linux only
```

## Architecture

- **Electron** — cross-platform desktop shell
- **Rules Engine** — deterministic WCAG 2.2 fixes (heading hierarchy, form labels, skip links, landmark regions, color contrast, focus indicators)
- **AI Review Layer** — local Ollama model (qwen3:4b-instruct-2507) handles alt text generation, error message improvement, animation risk assessment, and final quality gate
- **No cloud** — everything runs locally, files never leave the device

## License

Apache License 2.0 — see [LICENSE](LICENSE)

---

Built with care by the [Eythos](https://github.com/Eythos) team.
