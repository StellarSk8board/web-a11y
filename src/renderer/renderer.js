/**
 * Web A11y — Renderer Process (UI Logic)
 */

(function () {
  'use strict';

  // ── State ─────────────────────────────────────────────────────────────────

  let selectedPath = null;
  let selectedType = null; // 'folder' or 'zip'
  let currentReport = null;

  // ── DOM Elements ──────────────────────────────────────────────────────────

  const $ = (id) => document.getElementById(id);
  const screenWelcome = $('screen-welcome');
  const screenProgress = $('screen-progress');
  const screenResults = $('screen-results');
  const btnStart = $('btn-start');
  const dropZone = $('drop-zone');
  const dropZip = $('drop-zip');
  const ollamaStatus = $('ollama-status');
  const ollamaMsg = $('ollama-msg');
  const progressBar = $('progress-bar');
  const progressSubtitle = $('progress-subtitle');

  // ── Screen Navigation ─────────────────────────────────────────────────────

  function showScreen(name) {
    [screenWelcome, screenProgress, screenResults].forEach(s => s.classList.remove('active'));
    const map = { welcome: screenWelcome, progress: screenProgress, results: screenResults };
    if (map[name]) map[name].classList.add('active');
  }

  // ── Ollama Status ─────────────────────────────────────────────────────────

  async function checkOllama() {
    try {
      const status = await window.webA11y.checkOllama();
      const dot = ollamaStatus.querySelector('.dot');

      if (status.available) {
        dot.className = 'dot green';
        ollamaMsg.textContent = `AI model ready — running locally (${status.host})`;
      } else {
        dot.className = 'dot yellow';
        ollamaMsg.textContent = `AI features need Ollama: ${status.hint || 'run: ollama run qwen3:4b-instruct-2507-q4_K_M'}`;
      }
    } catch {
      const dot = ollamaStatus.querySelector('.dot');
      dot.className = 'dot yellow';
      ollamaMsg.textContent = 'AI features unavailable — rules engine will still work';
    }
  }

  // ── File Selection ────────────────────────────────────────────────────────

  dropZone.addEventListener('click', async () => {
    const path = await window.webA11y.selectFolder();
    if (path) {
      selectedPath = path;
      selectedType = 'folder';
      dropZone.querySelector('h3').textContent = `Selected: ${path.split(/[/\\]/).pop()}`;
      dropZone.style.borderColor = 'var(--green)';
      dropZip.style.borderColor = '';
      dropZip.querySelector('h3').textContent = 'Drop a website ZIP file here';
      btnStart.disabled = false;
    }
  });

  dropZip.addEventListener('click', async () => {
    const path = await window.webA11y.selectZip();
    if (path) {
      selectedPath = path;
      selectedType = 'zip';
      dropZip.querySelector('h3').textContent = `Selected: ${path.split(/[/\\]/).pop()}`;
      dropZip.style.borderColor = 'var(--green)';
      dropZone.style.borderColor = '';
      dropZone.querySelector('h3').textContent = 'Drop your website folder here';
      btnStart.disabled = false;
    }
  });

  // Drag and drop for folder
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    // folders can't be dropped via web API in Electron easily, so rely on click
  });

  // Drag and drop for ZIP
  dropZip.addEventListener('dragover', (e) => { e.preventDefault(); dropZip.classList.add('drag-over'); });
  dropZip.addEventListener('dragleave', () => dropZip.classList.remove('drag-over'));
  dropZip.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZip.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.zip')) {
      selectedPath = file.path;
      selectedType = 'zip';
      dropZip.querySelector('h3').textContent = `Selected: ${file.name}`;
      dropZip.style.borderColor = 'var(--green)';
      btnStart.disabled = false;
    }
  });

  // ── Keyboard Nav for Drop Zones ──────────────────────────────────────────

  [dropZone, dropZip].forEach(zone => {
    zone.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        zone.click();
        e.preventDefault();
      }
    });
  });

  // ── Progress Step Updates ─────────────────────────────────────────────────

  function setStep(name, state) {
    const step = document.querySelector(`[data-step="${name}"]`);
    if (!step) return;
    const icon = step.querySelector('.step-icon');
    if (state === 'done') {
      icon.textContent = '✓';
      icon.className = 'step-icon done';
    } else if (state === 'active') {
      icon.textContent = '→';
      icon.className = 'step-icon active';
    } else {
      icon.textContent = '○';
      icon.className = 'step-icon pending';
    }
  }

  function setAllSteps(state) {
    ['analyzing', 'rules', 'ai', 'quality_gate', 'packaging'].forEach(s => setStep(s, state));
  }

  // ── Start Processing ──────────────────────────────────────────────────────

  btnStart.addEventListener('click', async () => {
    if (!selectedPath) return;

    const level = document.querySelector('input[name="level"]:checked').value;
    const neuroMode = $('neuro-mode').checked;
    const options = { level, neuroMode };

    showScreen('progress');
    setAllSteps('pending');
    setStep('analyzing', 'active');
    progressBar.style.width = '0%';
    progressSubtitle.textContent = 'Analyzing file structure...';

    let total = 0;
    let current = 0;

    // Listen for progress updates
    window.webA11y.onEngineProgress((progress) => {
      if (progress.total) total = progress.total;
      current = progress.current || 0;
      const pct = total > 0 ? Math.round((current / total) * 60) : 0;
      progressBar.style.width = pct + '%';
      progressSubtitle.textContent = `Processing: ${progress.file || ''}`;
      if (progress.phase === 'analyzing' && current > 0) {
        setStep('analyzing', 'done');
        setStep('rules', 'active');
      }
    });

    window.webA11y.onAiProgress((progress) => {
      progressBar.style.width = '60%';
      progressSubtitle.textContent = `AI review: ${progress.step || 'working'}...`;
      setStep('rules', 'done');
      setStep('ai', 'active');
      if (progress.step === 'quality_gate') {
        setStep('ai', 'done');
        setStep('quality_gate', 'active');
      }
    });

    try {
      let result;
      if (selectedType === 'folder') {
        result = await window.webA11y.processFolder(selectedPath, options);
      } else {
        result = await window.webA11y.processZip(selectedPath, options);
      }

      if (!result.success) throw new Error(result.error);

      setStep('quality_gate', 'done');
      setStep('packaging', 'active');
      progressBar.style.width = '95%';
      progressSubtitle.textContent = 'Finalizing...';

      currentReport = result.report;
      showResults(currentReport);

    } catch (err) {
      alert('Processing failed: ' + err.message);
      showScreen('welcome');
    }
  });

  // ── Show Results ──────────────────────────────────────────────────────────

  function showResults(report) {
    showScreen('results');

    const fixed = report.stats.issuesFixed || 0;
    const flagged = report.stats.issuesFlagged || 0;
    const ai = report.stats.issuesFound || 0;

    $('stat-fixed').textContent = fixed;
    $('stat-flagged').textContent = flagged;
    $('stat-ai').textContent = ai;

    $('results-summary').textContent =
      report.qualityGate && report.qualityGate.passed === false
        ? `${fixed + flagged} issues found — 2 need your review`
        : `${fixed} issues fixed. Your website is more accessible.`;

    // AI status banner
    const banner = $('ai-banner');
    if (report.aiStatus && !report.aiStatus.available) {
      banner.className = 'ai-status-banner error';
      banner.textContent = `AI features skipped — Ollama not running. Start it with: ollama run qwen3:4b-instruct-2507-q4_K_M`;
    } else if (report.qualityGate && report.qualityGate.notes) {
      banner.className = 'ai-status-banner';
      banner.textContent = `Quality gate: ${report.qualityGate.notes}`;
    } else {
      banner.className = 'ai-status-banner';
      banner.textContent = 'AI model ran successfully — all enhancements applied locally.';
    }

    // Build report list
    const list = $('report-list');
    list.innerHTML = '';

    const allFixes = report.fixes || [];
    if (allFixes.length === 0) {
      list.innerHTML = '<p style="color: var(--text-dim); text-align: center; padding: 20px;">No issues found. Your site may already be accessible!</p>';
      return;
    }

    allFixes.forEach(fix => {
      const item = document.createElement('div');
      item.className = 'fix-item';

      const typeLabel = { fixed: 'Fixed', flagged: 'Flagged', ai_needed: 'AI Needed' }[fix.type] || fix.type;
      const typeClass = fix.type === 'fixed' ? 'fixed' : fix.type === 'flagged' ? 'flagged' : 'ai_needed';

      item.innerHTML = `
        <div class="fix-rule">${fix.rule || 'WCAG'}</div>
        <div>
          <span class="fix-type ${typeClass}">${typeLabel}</span>
          <span class="fix-detail">${fix.detail || ''}</span>
        </div>
        ${fix.filepath ? `<div class="fix-file">File: ${fix.filepath}</div>` : ''}
      `;
      list.appendChild(item);
    });

    progressBar.style.width = '100%';
    setStep('packaging', 'done');
  }

  // ── Download ──────────────────────────────────────────────────────────────

  $('btn-download').addEventListener('click', async () => {
    if (!currentReport) return;
    $('btn-download').disabled = true;
    $('btn-download').textContent = '⏳ Packaging...';

    try {
      const result = await window.webA11y.saveFixedZip(currentReport);
      if (result.success) {
        $('btn-download').textContent = '✓ Downloaded!';
        setTimeout(() => {
          $('btn-download').disabled = false;
          $('btn-download').textContent = '⬇  Download Accessible Website';
        }, 2000);
      } else if (result.canceled) {
        $('btn-download').disabled = false;
        $('btn-download').textContent = '⬇  Download Accessible Website';
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      alert('Download failed: ' + err.message);
      $('btn-download').disabled = false;
      $('btn-download').textContent = '⬇  Download Accessible Website';
    }
  });

  // ── New Session ───────────────────────────────────────────────────────────

  $('btn-new').addEventListener('click', () => {
    selectedPath = null;
    selectedType = null;
    currentReport = null;
    btnStart.disabled = true;
    dropZone.style.borderColor = '';
    dropZone.querySelector('h3').textContent = 'Drop your website folder here';
    dropZip.style.borderColor = '';
    dropZip.querySelector('h3').textContent = 'Drop a website ZIP file here';
    $('report-content').classList.remove('open');
    $('btn-report').setAttribute('aria-expanded', 'false');
    $('report-arrow').textContent = '▼';
    showScreen('welcome');
  });

  // ── Report Toggle ──────────────────────────────────────────────────────────

  $('btn-report').addEventListener('click', () => {
    const open = $('report-content').classList.toggle('open');
    $('btn-report').setAttribute('aria-expanded', open ? 'true' : 'false');
    $('report-arrow').textContent = open ? '▲' : '▼';
  });

  // ── Init ──────────────────────────────────────────────────────────────────

  checkOllama();

})();
