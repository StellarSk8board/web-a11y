/**
 * AI Review Layer — Ollama Integration for Web A11y
 *
 * Uses qwen3:4b-instruct-2507 for:
 * - Alt text generation
 * - Error message improvement
 * - Color contrast assessment
 * - Animation risk detection
 * - Final quality gate
 *
 * Model runs entirely locally via Ollama. No data leaves the device.
 */

const http = require('http');
const https = require('https');

const OLLAMA_HOST = 'localhost';
const OLLAMA_PORT = 11434;
const MODEL = 'qwen3:4b-instruct-2507-q4_K_M';

class OllamaAI {
  constructor() {
    this.available = null; // cached check
  }

  // ── Ollama API Helpers ────────────────────────────────────────────────────

  async _post(endpoint, payload) {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: OLLAMA_HOST,
        port: OLLAMA_PORT,
        path: endpoint,
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      };
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(data);
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(60, () => { req.destroy(); reject(new Error('Ollama request timeout')); });
      req.write(JSON.stringify(payload));
      req.end();
    });
  }

  async checkStatus() {
    try {
      const tags = await this._post('/api/tags', {});
      const hasModel = tags.models && tags.models.some(m =>
        m.name && (m.name.startsWith('qwen3:') || m.name.startsWith('qwen2.5:'))
      );
      this.available = hasModel;
      return {
        available: hasModel,
        models: tags.models ? tags.models.map(m => m.name) : [],
        host: `${OLLAMA_HOST}:${OLLAMA_PORT}`
      };
    } catch (err) {
      this.available = false;
      return {
        available: false,
        error: err.message,
        hint: 'Ollama is not running. Start it with: ollama run qwen3:4b-instruct-2507-q4_K_M'
      };
    }
  }

  async _generate(prompt, systemPrompt) {
    const payload = {
      model: MODEL,
      prompt,
      system: systemPrompt,
      stream: false,
      options: {
        temperature: 0.1,
        num_predict: 512
      }
    };
    // Disable thinking mode via options
    try {
      const response = await this._post('/api/generate', payload);
      return response.response || response.text || '';
    } catch (err) {
      throw new Error(`Ollama generation failed: ${err.message}`);
    }
  }

  // ── System Prompt (Non-Negotiable Instructions) ───────────────────────────

  get SYSTEM_PROMPT() {
    return `You are an accessibility expert working for Web A11y. You strictly follow WCAG 2.2 guidelines.
You output ONLY valid JSON. Never output explanation outside the JSON structure.
You do not think — you respond directly and precisely.
Always output a JSON object with the required fields. No markdown, no code blocks, no preamble.`;
  }

  // ── Enhancement Functions ─────────────────────────────────────────────────

  /**
   * Generate alt text for images missing alt attributes
   * @param {Array} images - Array of {filepath, tag} objects
   * @param {Function} progressCallback
   */
  async generateAltTexts(images, progressCallback) {
    if (!images || images.length === 0) return {};

    const results = {};
    for (const img of images) {
      progressCallback({ step: 'alt_text', file: img.filepath });
      const prompt = `Generate a concise, descriptive alt attribute value for this image tag:
${img.tag}

Return ONLY valid JSON in this exact format:
{"alt": "your generated alt text here"}

Rules:
- Be specific about what the image shows
- If it's a decorative image (purely visual, no content), return {"alt": ""}
- Do not start with "Image of" or "Picture of" — just describe the content
- Maximum 125 characters
- Output ONLY the JSON, nothing else.`;

      try {
        const response = await this._generate(prompt, this.SYSTEM_PROMPT);
        const parsed = this._safeParse(response);
        results[img.filepath] = parsed.alt || '';
      } catch (err) {
        results[img.filepath] = '[Web A11y: alt text could not be generated — please add manually]';
      }
    }
    return results;
  }

  /**
   * Improve form error messages to be specific and actionable
   * @param {Array} errors - Array of {filepath, input, currentError, context} objects
   */
  async improveErrorMessages(errors, progressCallback) {
    if (!errors || errors.length === 0) return {};

    const results = {};
    for (const err of errors) {
      progressCallback({ step: 'error_messages', file: err.filepath });
      const prompt = `Improve this form error message to be specific and actionable.

Input field: ${err.input}
Current error message: "${err.currentError}"
Form context: ${err.context || 'unknown'}

Return ONLY valid JSON in this exact format:
{"improved_error": "your improved error message here", "suggested_fix": "what the user should do to fix this"}

Rules:
- Error messages must tell the user WHAT to do, not just that something is wrong
- Include examples where appropriate (e.g., "like name@example.com")
- Be specific to the type of input (email, phone, date, etc.)
- Maximum 150 characters for the improved error
- Output ONLY the JSON, nothing else.`;

      try {
        const response = await this._generate(prompt, this.SYSTEM_PROMPT);
        const parsed = this._safeParse(response);
        results[err.filepath] = {
          improved: parsed.improved_error || err.currentError,
          suggested: parsed.suggested_fix || ''
        };
      } catch (err) {
        results[err.filepath] = { improved: err.currentError, suggested: '' };
      }
    }
    return results;
  }

  /**
   * Assess animations for vestibular risk and suggest prefers-reduced-motion wrapping
   * @param {Array} animations - Array of {filepath, cssBlock, element} objects
   */
  async assessAnimations(animations, progressCallback) {
    if (!animations || animations.length === 0) return {};

    const results = {};
    const allAnimations = animations.map(a => `${a.element}: ${a.cssBlock}`).join('\n');

    progressCallback({ step: 'animation_assessment' });

    const prompt = `Assess these CSS animations for vestibular motion risk (WCAG 2.3.1, 2.3.2).

CSS animations found:
${allAnimations}

Return ONLY valid JSON in this exact format:
{"risky_animations": [{"element": "...", "risk": "high|medium|low", "reason": "...", "recommendation": "..."}]}

Rules:
- risk "high" = lateral movement, rotation, or zoom effects > 3deg or > 50px
- risk "medium" = color changes with motion, subtle transitions
- risk "low" = opacity fades, no spatial movement
- Each animation in the input must appear in the output
- Output ONLY the JSON, nothing else.`;

    try {
      const response = await this._generate(prompt, this.SYSTEM_PROMPT);
      const parsed = this._safeParse(response);
      return parsed.risky_animations || [];
    } catch (err) {
      return [];
    }
  }

  /**
   * Quality gate — review the rules engine output and catch any missed issues
   * @param {Object} report - The full report from rules engine
   */
  async qualityGate(report, progressCallback) {
    progressCallback({ step: 'quality_gate' });

    const summary = {
      totalFiles: report.stats.files,
      issuesFixed: report.stats.issuesFixed,
      issuesFlagged: report.stats.issuesFlagged,
      issuesNeedingAI: report.stats.issuesFound,
      fixes: report.fixes.slice(0, 50) // send first 50 for context
    };

    const prompt = `You are a final quality gate for web accessibility. Review this accessibility report and identify any remaining WCAG 2.2 AA violations that the automated rules engine may have missed.

Report summary:
${JSON.stringify(summary, null, 2)}

Return ONLY valid JSON in this exact format:
{"passed": true/false, "missed_issues": [{"rule": "WCAG X.X.X", "type": "fixed|flagged", "detail": "...", "file": "..."}], "notes": "overall assessment"}

Rules:
- If passed is true, the site is ready
- Only flag genuine WCAG 2.2 AA violations
- Do not flag AAA-only items unless the target level was set to AAA
- Output ONLY the JSON, nothing else.`;

    try {
      const response = await this._generate(prompt, this.SYSTEM_PROMPT);
      return this._safeParse(response) || { passed: true, missed_issues: [], notes: 'Quality gate could not complete' };
    } catch (err) {
      return { passed: true, missed_issues: [], notes: `Quality gate skipped: ${err.message}` };
    }
  }

  /**
   * Full report enhancement — run all AI steps and return enriched report
   */
  async enhanceReport(report, progressCallback) {
    const status = await this.checkStatus();

    if (!status.available) {
      report.aiStatus = {
        available: false,
        message: 'Ollama not available — install and run: ollama run qwen3:4b-instruct-2507-q4_K_M',
        hint: status.hint || status.error
      };
      report.qualityGate = { passed: null, notes: 'Skipped — Ollama not running' };
      return report;
    }

    report.aiStatus = { available: true, model: MODEL };

    // 1. Quality gate
    progressCallback({ step: 'ai', detail: 'Running quality gate...' });
    const gateResult = await this.qualityGate(report, progressCallback);
    report.qualityGate = gateResult;

    // 2. Alt texts (find images without alt from fixes)
    const aiNeededFixes = report.fixes.filter(f => f.type === 'ai_needed' && f.files);
    const altFixes = aiNeededFixes.filter(f => f.rule === 'WCAG 1.1.1');
    if (altFixes.length > 0) {
      const imageFiles = altFixes.flatMap(f => (f.files || []).map(tag => ({ filepath: f.filepath, tag })));
      report.altTexts = await this.generateAltTexts(imageFiles, progressCallback);
    }

    // 3. Error messages
    const errorFixes = aiNeededFixes.filter(f => f.rule === 'WCAG 1.3.1');
    if (errorFixes.length > 0) {
      report.errorMessages = await this.improveErrorMessages(
        errorFixes.map(f => ({ filepath: f.filepath, input: f.files ? f.files[0] : 'unknown', currentError: 'invalid', context: f.detail })),
        progressCallback
      );
    }

    // 4. Animation assessment
    const animationFixes = report.fixes.filter(f => f.type === 'flagged' && /animation|transition/i.test(f.detail));
    if (animationFixes.length > 0) {
      report.animationRisks = await this.assessAnimations(
        animationFixes.map(f => ({ filepath: f.filepath, cssBlock: '', element: 'animation' })),
        progressCallback
      );
    }

    return report;
  }

  // ── Utility ───────────────────────────────────────────────────────────────

  _safeParse(text) {
    try {
      // Try to extract JSON from the response
      const cleaned = text.trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      return JSON.parse(cleaned);
    } catch {
      return null;
    }
  }
}

module.exports = { OllamaAI };
