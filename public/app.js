/* ============================================================
   멀티 리서처 BI — app.js
   SSE stream handler + DOM state machine + Chart.js renderer
   ============================================================ */

'use strict';

// ── CONFIG ────────────────────────────────────────────────────────────────────

const API_ENDPOINT = '/api/query';

const RESEARCHER_IDS = [
  'product_researcher',
  'policy_researcher',
  'loss_ratio_researcher',
  'investment_researcher',
];

const STATUS_LABELS = {
  idle:        '대기',
  researching: '분석중',
  success:     '완료',
  skipped:     '해당없음',
  no_data:     '데이터없음',
  error:       '오류',
};

// ── STATE ─────────────────────────────────────────────────────────────────────

let chartInstance = null;

// ── DOM REFS ──────────────────────────────────────────────────────────────────

const queryInput      = document.getElementById('query-input');
const analyzeBtn      = document.getElementById('analyze-btn');
const btnLabel        = analyzeBtn.querySelector('.btn-label');
const btnSpinner      = analyzeBtn.querySelector('.btn-spinner');

const planSection     = document.getElementById('plan-section');
const planToggle      = document.getElementById('plan-toggle');
const planBody        = document.getElementById('plan-body');
const planJson        = document.getElementById('plan-json');

const researchersSection = document.getElementById('researchers-section');
const welcomeSection  = document.getElementById('welcome-section');

const editorSection   = document.getElementById('editor-section');
const refusalBox      = document.getElementById('refusal-box');
const refusalMsg      = document.getElementById('refusal-msg');
const errorBox        = document.getElementById('error-box');
const errorMsg        = document.getElementById('error-msg');
const synthesizingBar = document.getElementById('synthesizing-bar');
const answerCard      = document.getElementById('answer-card');
const answerBody      = document.getElementById('answer-body');
const chartCard       = document.getElementById('chart-card');
const citationsCard   = document.getElementById('citations-card');
const citationsToggle = document.getElementById('citations-toggle');
const citationsBody   = document.getElementById('citations-body');
const citationsCount  = document.getElementById('citations-count');
const followupSection = document.getElementById('followup-section');
const followupBtns    = document.getElementById('followup-btns');

// ── UTILITIES ─────────────────────────────────────────────────────────────────

function show(el) { el.hidden = false; }
function hide(el) { el.hidden = true; }

function setResearcherState(id, state, summaryText) {
  const card   = document.getElementById(`card-${id}`);
  const badge  = card?.querySelector('.card-status-badge');
  const summary = document.getElementById(`summary-${id}`);
  if (!card) return;

  card.dataset.state = state;
  if (badge) badge.textContent = STATUS_LABELS[state] ?? state;

  if (summaryText && summary) {
    summary.textContent = summaryText;
    show(summary);
  }
}

function resetResearchers() {
  RESEARCHER_IDS.forEach(id => {
    setResearcherState(id, 'idle');
    const summary = document.getElementById(`summary-${id}`);
    if (summary) { summary.textContent = ''; hide(summary); }
  });
}

function setLoading(loading) {
  analyzeBtn.disabled = loading;
  btnLabel.textContent = loading ? '분석중...' : '분석';
  if (loading) {
    show(btnSpinner);
  } else {
    hide(btnSpinner);
  }
}

// ── MARKDOWN RENDERER ─────────────────────────────────────────────────────────

function renderMarkdown(text) {
  if (typeof marked !== 'undefined') {
    marked.setOptions({ breaks: true, gfm: true });
    return marked.parse(text);
  }
  // Fallback: basic regex conversion
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, s => `<ul>${s}</ul>`)
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
    .replace(/^(?!<[h|u|b|p|l])(.+)/, '<p>$1</p>');
}

// ── CHART RENDERER ────────────────────────────────────────────────────────────

const CHART_COLORS = [
  '#0057ff', '#00c48c', '#ff6b35', '#f7b731',
  '#a29bfe', '#fd79a8', '#55efc4', '#fdcb6e',
];

function renderChart(chartSpec) {
  if (!chartSpec || chartSpec.type === 'none' || !chartSpec.labels?.length) {
    hide(chartCard);
    return;
  }

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const canvas = document.getElementById('result-chart');
  const ctx = canvas.getContext('2d');

  const type = chartSpec.type === 'line' ? 'line' :
               chartSpec.type === 'pie'  ? 'pie'  : 'bar';

  const isPie = type === 'pie';

  const datasets = (chartSpec.datasets || []).map((ds, i) => ({
    label: ds.label || '',
    data:  ds.data  || [],
    backgroundColor: isPie
      ? chartSpec.labels.map((_, j) => CHART_COLORS[j % CHART_COLORS.length])
      : CHART_COLORS[i % CHART_COLORS.length] + (type === 'bar' ? 'cc' : ''),
    borderColor: isPie ? '#fff' : CHART_COLORS[i % CHART_COLORS.length],
    borderWidth: isPie ? 2 : 2,
    tension: 0.35,
    fill: false,
    pointRadius: type === 'line' ? 4 : 0,
    pointHoverRadius: type === 'line' ? 6 : 0,
  }));

  chartInstance = new Chart(ctx, {
    type,
    data: { labels: chartSpec.labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 600, easing: 'easeOutQuart' },
      plugins: {
        legend: {
          display: datasets.length > 1 || isPie,
          labels: {
            font: { family: "'Noto Sans KR', sans-serif", size: 12 },
            color: '#3d3a35',
          },
        },
        title: {
          display: !!chartSpec.title,
          text: chartSpec.title || '',
          font: { family: "'Noto Sans KR', sans-serif", size: 14, weight: '700' },
          color: '#1a1814',
          padding: { bottom: 16 },
        },
        tooltip: {
          backgroundColor: '#1a1814',
          titleFont: { family: "'DM Mono', monospace", size: 11 },
          bodyFont: { family: "'Noto Sans KR', sans-serif", size: 12 },
          padding: 10,
          cornerRadius: 6,
        },
      },
      scales: isPie ? {} : {
        x: {
          ticks: {
            font: { family: "'Noto Sans KR', sans-serif", size: 11 },
            color: '#6b6760',
          },
          grid: { color: '#e2dfd9' },
        },
        y: {
          ticks: {
            font: { family: "'DM Mono', monospace", size: 11 },
            color: '#6b6760',
          },
          grid: { color: '#e2dfd9' },
          beginAtZero: true,
        },
      },
    },
  });

  show(chartCard);
}

// ── CITATIONS RENDERER ────────────────────────────────────────────────────────

function renderCitations(citations) {
  if (!citations?.length) { hide(citationsCard); return; }

  citationsCount.textContent = `${citations.length}건`;
  citationsBody.innerHTML = '';

  citations.forEach(c => {
    const item = document.createElement('div');
    item.className = 'citation-item';

    // Header
    const header = document.createElement('div');
    header.className = 'citation-header';
    header.innerHTML = `
      <span class="citation-researcher-id">${escapeHtml(c.researcher || '')}</span>
      <span class="citation-finding">${escapeHtml(c.finding || '')}</span>
    `;
    item.appendChild(header);

    // Table
    const rows = Array.isArray(c.data_rows) ? c.data_rows : [];
    if (rows.length > 0) {
      const cols = Object.keys(rows[0]);
      const table = document.createElement('table');
      table.className = 'citation-table';

      const thead = document.createElement('thead');
      thead.innerHTML = `<tr>${cols.map(k => `<th>${escapeHtml(k)}</th>`).join('')}</tr>`;
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      rows.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = cols.map(k => `<td>${escapeHtml(String(row[k] ?? ''))}</td>`).join('');
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      item.appendChild(table);
    }

    citationsBody.appendChild(item);
  });

  show(citationsCard);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── FOLLOWUP RENDERER ─────────────────────────────────────────────────────────

function renderFollowup(suggestions) {
  if (!suggestions?.length) { hide(followupSection); return; }

  followupBtns.innerHTML = '';
  suggestions.forEach(q => {
    const btn = document.createElement('button');
    btn.className = 'followup-btn';
    btn.textContent = q;
    btn.addEventListener('click', () => {
      queryInput.value = q;
      submitQuery(q);
    });
    followupBtns.appendChild(btn);
  });
  show(followupSection);
}

// ── RESET UI ──────────────────────────────────────────────────────────────────

function resetUI() {
  resetResearchers();

  hide(planSection);
  hide(planBody);
  planToggle.setAttribute('aria-expanded', 'false');
  planToggle.querySelector('.toggle-icon').style.transform = '';
  planJson.textContent = '';

  hide(researchersSection);
  hide(editorSection);
  hide(refusalBox);
  hide(errorBox);
  hide(synthesizingBar);
  hide(answerCard);
  hide(chartCard);
  hide(citationsCard);
  hide(citationsBody);
  citationsToggle.setAttribute('aria-expanded', 'false');
  citationsToggle.querySelector('.toggle-icon').style.transform = '';
  hide(followupSection);

  answerBody.innerHTML = '';
  followupBtns.innerHTML = '';
  citationsBody.innerHTML = '';

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

// ── SSE STREAM HANDLER ────────────────────────────────────────────────────────

/**
 * Reads a ReadableStream line-by-line and calls onLine for each line.
 */
async function readLines(reader, onLine) {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep incomplete last line
    for (const line of lines) {
      onLine(line);
    }
  }

  // flush remainder
  if (buffer) onLine(buffer);
}

/**
 * Parse SSE line pairs into { event, data } objects.
 * Supports:
 *   event: <name>\ndata: <json>
 *   data: <json>  (event defaults to 'message')
 */
function parseSseLine(lines) {
  const events = [];
  let currentEvent = null;
  let currentData = null;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line.startsWith('event:')) {
      currentEvent = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      currentData = line.slice(5).trim();
    } else if (line === '') {
      // dispatch
      if (currentData !== null) {
        events.push({ event: currentEvent || 'message', data: currentData });
      }
      currentEvent = null;
      currentData = null;
    }
  }

  return events;
}

async function submitQuery(question) {
  resetUI();
  setLoading(true);

  // Hide welcome, show researchers immediately
  hide(welcomeSection);
  show(researchersSection);

  const lineBuffer = [];

  try {
    const res = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const reader = res.body.getReader();

    await readLines(reader, (line) => {
      lineBuffer.push(line);

      // Try to dispatch on empty line (SSE message boundary)
      if (line.trim() === '') {
        const events = parseSseLine(lineBuffer.splice(0, lineBuffer.length));
        events.forEach(handleSseEvent);
      }
    });

    // Flush any remaining lines
    if (lineBuffer.length > 0) {
      const events = parseSseLine(lineBuffer);
      events.forEach(handleSseEvent);
    }

  } catch (err) {
    console.error('[SSE] Stream error:', err);
    showStreamError(err);
  } finally {
    setLoading(false);
    hide(synthesizingBar);
  }
}

// ── SSE EVENT DISPATCHER ──────────────────────────────────────────────────────

function handleSseEvent({ event, data }) {
  let payload;
  try {
    payload = JSON.parse(data);
  } catch {
    console.warn('[SSE] Non-JSON data for event', event, ':', data);
    return;
  }

  switch (event) {
    case 'guard':     handleGuard(payload);          break;
    case 'plan':      handlePlan(payload);            break;
    case 'researcher': handleResearcher(payload);     break;
    case 'researcher_result': handleResearcherResult(payload); break;
    case 'editor':    handleEditor(payload);          break;
    case 'result':    handleResult(payload);          break;
    case 'done':      handleDone();                   break;
    case 'error':     showSseError(payload.message); break;
    default:
      console.log('[SSE] Unknown event:', event, payload);
  }
}

// ── EVENT HANDLERS ────────────────────────────────────────────────────────────

function handleGuard(payload) {
  if (!payload.answerable) {
    // Show refusal, mark all researchers as skipped
    RESEARCHER_IDS.forEach(id => setResearcherState(id, 'skipped'));
    refusalMsg.textContent = payload.refusal_message || payload.reason || '답변할 수 없는 질문입니다.';
    show(editorSection);
    show(refusalBox);
    hide(synthesizingBar);
  }
}

function handlePlan(payload) {
  // Show query plan toggle
  planJson.textContent = JSON.stringify(payload, null, 2);
  show(planSection);

  // Pre-activate researchers based on plan
  if (Array.isArray(payload.researchers)) {
    payload.researchers.forEach(r => {
      if (!r.active) {
        setResearcherState(r.id, 'skipped');
      }
    });
  }
}

function handleResearcher(payload) {
  // { researcher_id, status: "researching" }
  if (payload.status === 'researching') {
    setResearcherState(payload.researcher_id, 'researching');
  }
}

function handleResearcherResult(payload) {
  // { researcher_id, status, summary, ... }
  const state = payload.status === 'success'  ? 'success'  :
                payload.status === 'no_data'  ? 'no_data'  :
                payload.status === 'skipped'  ? 'skipped'  :
                payload.status === 'error'    ? 'error'    : 'skipped';

  setResearcherState(payload.researcher_id, state, payload.summary || null);
}

function handleEditor(payload) {
  if (payload.status === 'synthesizing') {
    show(editorSection);
    show(synthesizingBar);
  }
}

function handleResult(payload) {
  show(editorSection);
  hide(synthesizingBar);

  // Answer
  if (payload.answer) {
    answerBody.innerHTML = renderMarkdown(payload.answer);
    show(answerCard);
  }

  // Chart
  renderChart(payload.chart);

  // Citations
  renderCitations(payload.citations);

  // Followup suggestions
  renderFollowup(payload.followup_suggestions);
}

function handleDone() {
  setLoading(false);
  hide(synthesizingBar);
}

function showStreamError(err) {
  hide(synthesizingBar);
  show(editorSection);

  const raw = typeof err === 'string' ? err : (err?.message || '');
  let friendly;
  if (/429/.test(raw)) {
    friendly = '서버가 바쁩니다. 잠시 후 다시 시도해주세요.';
  } else if (/network|fetch|failed to fetch/i.test(raw)) {
    friendly = '네트워크 연결을 확인해주세요.';
  } else {
    friendly = '오류가 발생했습니다. 다시 시도해주세요.';
  }

  errorMsg.textContent = friendly;
  show(errorBox);
}

// SSE-level error event (answerable=false is a guard, not an error)
function showSseError(message) {
  hide(synthesizingBar);
  show(editorSection);
  errorMsg.textContent = message || '오류가 발생했습니다. 다시 시도해주세요.';
  show(errorBox);
}

// ── TOGGLE HANDLERS ───────────────────────────────────────────────────────────

planToggle.addEventListener('click', () => {
  const expanded = planToggle.getAttribute('aria-expanded') === 'true';
  planToggle.setAttribute('aria-expanded', String(!expanded));
  if (!expanded) { show(planBody); } else { hide(planBody); }
});

citationsToggle.addEventListener('click', () => {
  const expanded = citationsToggle.getAttribute('aria-expanded') === 'true';
  citationsToggle.setAttribute('aria-expanded', String(!expanded));
  if (!expanded) { show(citationsBody); } else { hide(citationsBody); }
});

// ── ANALYZE BUTTON ────────────────────────────────────────────────────────────

analyzeBtn.addEventListener('click', () => {
  const q = queryInput.value.trim();
  if (!q) return;
  submitQuery(q);
});

queryInput.addEventListener('keydown', (e) => {
  // Ctrl+Enter or Cmd+Enter to submit
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    const q = queryInput.value.trim();
    if (q) submitQuery(q);
  }
});

// ── SAMPLE QUESTIONS ──────────────────────────────────────────────────────────

document.querySelectorAll('.sample-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const q = btn.dataset.q;
    queryInput.value = q;
    submitQuery(q);
  });
});
