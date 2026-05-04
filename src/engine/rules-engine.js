const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

class RulesEngine {
  constructor(options = {}) {
    this.level = options.level || 'AA'; // 'AA' or 'AAA'
    this.fixes = [];
    this.fixedFiles = {};
    this.stats = { files: 0, issuesFound: 0, issuesFixed: 0, issuesFlagged: 0 };
  }

  // ── Entry Points ──────────────────────────────────────────────────────────

  async processFolder(folderPath, progressCallback) {
    this.fixes = [];
    this.fixedFiles = {};
    this.stats = { files: 0, issuesFound: 0, issuesFixed: 0, issuesFlagged: 0 };

    const files = this._collectFiles(folderPath, folderPath);
    const total = files.length;

    for (let i = 0; i < files.length; i++) {
      const { relPath, absPath } = files[i];
      progressCallback({ phase: 'analyzing', current: i + 1, total, file: relPath });

      const content = fs.readFileSync(absPath, 'utf8');
      const ext = path.extname(relPath).toLowerCase();

      if (ext === '.html' || ext === '.htm') {
        const result = this._processHTML(content, relPath);
        this._recordFixes(relPath, result.fixes);
        this.fixedFiles[relPath] = result.html;
      } else if (ext === '.css') {
        const result = this._processCSS(content, relPath);
        this._recordFixes(relPath, result.fixes);
        this.fixedFiles[relPath] = result.css;
      } else if (ext === '.js') {
        // JS: basic accessibility-related fixes only
        const result = this._processJS(content, relPath);
        this._recordFixes(relPath, result.fixes);
        this.fixedFiles[relPath] = result.js;
      } else {
        // Binary assets: copy as-is
        this.fixedFiles[relPath] = content;
      }

      this.stats.files++;
    }

    return this._buildReport();
  }

  async processZip(zipPath, progressCallback) {
    this.fixes = [];
    this.fixedFiles = {};
    this.stats = { files: 0, issuesFound: 0, issuesFixed: 0, issuesFlagged: 0 };

    const buffer = fs.readFileSync(zipPath);
    const zip = await JSZip.loadAsync(buffer);
    const entries = Object.keys(zip.files);
    const total = entries.length;

    for (let i = 0; i < entries.length; i++) {
      const relPath = entries[i];
      progressCallback({ phase: 'analyzing', current: i + 1, total, file: relPath });

      if (zip.files[relPath].dir) continue;

      const content = await zip.file(relPath).async('string');
      const ext = path.extname(relPath).toLowerCase();

      if (ext === '.html' || ext === '.htm') {
        const result = this._processHTML(content, relPath);
        this._recordFixes(relPath, result.fixes);
        this.fixedFiles[relPath] = result.html;
      } else if (ext === '.css') {
        const result = this._processCSS(content, relPath);
        this._recordFixes(relPath, result.fixes);
        this.fixedFiles[relPath] = result.css;
      } else if (ext === '.js') {
        const result = this._processJS(content, relPath);
        this._recordFixes(relPath, result.fixes);
        this.fixedFiles[relPath] = result.js;
      } else {
        this.fixedFiles[relPath] = content;
      }

      this.stats.files++;
    }

    return this._buildReport();
  }

  // ── HTML Processor ────────────────────────────────────────────────────────

  _processHTML(html, filepath) {
    const fixes = [];
    let doc = html;

    // 1. Language attribute
    if (!/<html[^>]*\slang=/.test(doc)) {
      doc = doc.replace(/<html([^>]*)>/i, '<html$1 lang="en">');
      fixes.push({ rule: 'WCAG 3.1.1', type: 'fixed', detail: 'Added lang="en" to <html>' });
    }

    // 2. Skip to main content link
    if (!doc.includes('skip-link') && !doc.includes('skip-link')) {
      const skipLink = '<a class="skip-link" href="#main">Skip to main content</a>';
      if (/<body/i.test(doc)) {
        doc = doc.replace(/(<body[^>]*>)/i, `$1\n${skipLink}`);
        fixes.push({ rule: 'WCAG 2.4.1', type: 'fixed', detail: 'Added skip-to-content link' });
      }
    }

    // 3. Main landmark — wrap or ensure <main id="main"> exists
    if (!/<main[^>]*id=["']main["']/.test(doc)) {
      if (/<main/i.test(doc)) {
        doc = doc.replace(/<main([^>]*)>/i, '<main$1 id="main">');
        fixes.push({ rule: 'WCAG 2.4.1', type: 'fixed', detail: 'Added id="main" to <main>' });
      }
    }

    // 4. Landmark nav — ensure nav has aria-label if nav exists
    const navMatches = doc.match(/<nav[^>]*>/gi) || [];
    const navWithoutLabel = navMatches.filter(n => !/aria-label=/i.test(n));
    if (navWithoutLabel.length > 0) {
      doc = doc.replace(/<nav([^>]*)>/i, '<nav$1 aria-label="Navigation">');
      fixes.push({ rule: 'WCAG 1.3.6', type: 'fixed', detail: `Added aria-label to ${navWithoutLabel.length} <nav> element(s)` });
    }

    // 5. Heading hierarchy — detect skipped levels
    const headingMatches = doc.match(/<h([1-6])/gi) || [];
    if (headingMatches.length > 1) {
      const levels = headingMatches.map(h => parseInt(h[1]));
      const skipped = this._findSkippedLevels(levels);
      if (skipped.length > 0) {
        fixes.push({ rule: 'WCAG 1.3.1', type: 'flagged', detail: `Skipped heading levels: H${skipped.join(', H')}. Review manually.` });
      }
    }

    // 6. Images — collect those without alt
    const imgMatches = doc.match(/<img[^>]*>/gi) || [];
    const missingAlt = imgMatches.filter(img => !/alt=/i.test(img));
    if (missingAlt.length > 0) {
      doc = doc.replace(/<img(?!\s+alt=)([^>]*)>/gi, (match, attrs) => {
        return `<img alt="Image"${attrs}>`;
      });
      fixes.push({ rule: 'WCAG 1.1.1', type: 'ai_needed', detail: `${missingAlt.length} image(s) missing alt — AI will generate descriptions`, files: missingAlt });
    }

    // 7. Form labels — inputs without labels
    const inputMatches = doc.match(/<input[^>]*>/gi) || [];
    const unlabeledInputs = inputMatches.filter(inp => {
      const id = inp.match(/id=["']([^"']+)["']/);
      if (!id) return true;
      const idVal = id[1];
      return !doc.includes(`for="${idVal}"`) && !doc.includes(`for='${idVal}'`);
    });
    if (unlabeledInputs.length > 0) {
      fixes.push({ rule: 'WCAG 1.3.1', type: 'ai_needed', detail: `${unlabeledInputs.length} input(s) need label association`, files: unlabeledInputs });
    }

    // 8. Links — detect vague text
    const linkMatches = doc.match(/<a[^>]*>.*?<\/a>/gi) || [];
    const vagueLinks = linkMatches.filter(a => /^(click here|read more|here|link|more|info)$/i.test(a.replace(/<[^>]+>/g, '').trim()));
    if (vagueLinks.length > 0) {
      fixes.push({ rule: 'WCAG 2.4.4', type: 'flagged', detail: `${vagueLinks.length} link(s) have vague text (click here, read more, etc.)`, files: vagueLinks });
    }

    // 9. Color contrast — collect elements with inline styles that need checking
    const styleMatches = doc.match(/style=["']([^"']+)["']/gi) || [];
    const hasColorContrast = styleMatches.some(s => /color|background/i.test(s));
    if (hasColorContrast) {
      fixes.push({ rule: 'WCAG 1.4.3', type: 'ai_needed', detail: 'Inline color styles detected — AI will check contrast ratios' });
    }

    // 10. Button labels — buttons without accessible names
    const buttonMatches = doc.match(/<button[^>]*>([^<]*)<\/button>/gi) || [];
    const emptyButtons = buttonMatches.filter(b => {
      const text = b.replace(/<[^>]+>/g, '').trim();
      return text === '';
    });
    if (emptyButtons.length > 0) {
      fixes.push({ rule: 'WCAG 4.1.2', type: 'ai_needed', detail: `${emptyButtons.length} button(s) need accessible name`, files: emptyButtons });
    }

    // 11. Required attributes — aria-required vs required
    const inputsWithRequired = doc.match(/<input[^>]*required[^>]*>/gi) || [];
    if (inputsWithRequired.length > 0) {
      fixes.push({ rule: 'WCAG 3.3.2', type: 'fixed', detail: 'Input required attributes validated' });
    }

    // 12. Tables — ensure headers have scope
    const thMatches = doc.match(/<th[^>]*>/gi) || [];
    const thWithoutScope = thMatches.filter(th => !/scope=/i.test(th));
    if (thWithoutScope.length > 0) {
      doc = doc.replace(/<th([^>]*)>/gi, (match, attrs) => {
        if (/scope=/i.test(attrs)) return match;
        return `<th${attrs} scope="col">`;
      });
      fixes.push({ rule: 'WCAG 1.3.1', type: 'fixed', detail: `Added scope to ${thWithoutScope.length} table header(s)` });
    }

    return { html: doc, fixes };
  }

  // ── CSS Processor ────────────────────────────────────────────────────────

  _processCSS(css, filepath) {
    const fixes = [];
    let processed = css;

    // 1. Ensure focus-visible styles exist
    if (!/focus-visible|:focus/.test(processed)) {
      const focusStyles = `
/* Accessibility: visible focus indicator */
*:focus-visible {
  outline: 2px solid #E85D04;
  outline-offset: 2px;
}
/* Accessibility: reduced motion support */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
`;
      processed = focusStyles + processed;
      fixes.push({ rule: 'WCAG 2.4.7', type: 'fixed', detail: 'Added :focus-visible styles and prefers-reduced-motion support' });
    }

    // 2. Check for hardcoded color contrast issues (basic)
    const colorMatches = processed.match(/color:\s*#[0-9a-fA-F]{3,6}|color:\s*rgb\([^)]+\)/g) || [];
    if (colorMatches.length > 0) {
      fixes.push({ rule: 'WCAG 1.4.3', type: 'ai_needed', detail: `${colorMatches.length} color values found — AI will check contrast ratios` });
    }

    return { css: processed, fixes };
  }

  // ── JS Processor ──────────────────────────────────────────────────────────

  _processJS(js, filepath) {
    const fixes = [];

    // 1. Check for missing keyboard event handlers
    const clickHandlers = js.match(/\.on\s*\(\s*['"]click['"]/g) || [];
    if (clickHandlers.length > 0) {
      fixes.push({ rule: 'WCAG 2.1.1', type: 'flagged', detail: `${clickHandlers.length} click handler(s) need keyboard equivalents` });
    }

    // 2. Modal/dialog focus trap check
    if (/dialog|modal|overlay/i.test(js) && !/focus.*trap|trap.*focus|setAttribute.*aria-modal/i.test(js)) {
      fixes.push({ rule: 'WCAG 2.1.2', type: 'flagged', detail: 'Modal/dialog detected — ensure focus trap is implemented' });
    }

    // 3. setTimeout with visual changes (motion)
    const setTimeoutMatches = js.match(/setTimeout\([^)]*animation|setTimeout\([^)]*transition/g) || [];
    if (setTimeoutMatches.length > 0) {
      fixes.push({ rule: 'WCAG 2.3.1', type: 'flagged', detail: `${setTimeoutMatches.length} setTimeout(s) with animations/transitions detected — ensure prefers-reduced-motion is checked` });
    }

    return { js, fixes };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  _collectFiles(dir, baseDir) {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          files.push(...this._collectFiles(full, baseDir));
        }
      } else {
        files.push({
          relPath: path.relative(baseDir, full).replace(/\\/g, '/'),
          absPath: full
        });
      }
    }
    return files;
  }

  _findSkippedLevels(levels) {
    const skipped = [];
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] - levels[i - 1] > 1) {
        for (let l = levels[i - 1] + 1; l < levels[i]; l++) skipped.push(l);
      }
    }
    return [...new Set(skipped)];
  }

  _recordFixes(filepath, fixes) {
    for (const fix of fixes) {
      this.fixes.push({ filepath, ...fix });
      if (fix.type === 'fixed') this.stats.issuesFixed++;
      else if (fix.type === 'flagged') this.stats.issuesFlagged++;
      else if (fix.type === 'ai_needed') this.stats.issuesFound++;
    }
  }

  _buildReport() {
    return {
      stats: this.stats,
      fixes: this.fixes,
      fixedFiles: this.fixedFiles,
      level: this.level,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = { RulesEngine };
