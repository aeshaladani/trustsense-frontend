// ── Global state ──────────────────────────────────────────────────────────────

let DEMO_MODE      = true;   // false = real mode
let isBackendLive  = false;
let currentSession = null;   // active session data
let scoreChart     = null;   // Chart.js instance
let wsConnection   = null;   // WebSocket connection
let mockWsInterval = null;   // setInterval handle for mock WS

// ── Page registry ─────────────────────────────────────────────────────────────

const PAGE_META = {
  dashboard: { title: 'Analyst Dashboard',       sub: 'Real-time identity risk overview across all sessions'       },
  session:   { title: 'Live Session Monitor',    sub: 'Simulate a login and watch the trust score respond live'    },
  kyc:       { title: 'KYC Onboarding Shield',   sub: 'AI-powered document verification and fraud screening'       },
  recovery:  { title: 'Account Recovery',        sub: 'Suspicious recovery attempts trigger elevated risk checks'  },
  insider:   { title: 'Insider Threat (PAM)',     sub: 'Privileged access behavior analysis — detect misuse'       },
};

// Page HTML templates — inline so no extra fetch needed
const PAGE_TEMPLATES = {
  dashboard: buildDashboardHTML,
  session:   buildSessionHTML,
  kyc:       buildKYCHTML,
  recovery:  buildRecoveryHTML,
  insider:   buildInsiderHTML,
};

// ── Navigation ────────────────────────────────────────────────────────────────

function showPage(pageId, navEl) {
  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  if (navEl) navEl.classList.add('active');

  // Update topbar text
  const meta = PAGE_META[pageId] || {};
  document.getElementById('topbar-title').textContent = meta.title || pageId;
  document.getElementById('topbar-sub').textContent   = meta.sub   || '';

  // Render page HTML
  const builder = PAGE_TEMPLATES[pageId];
  if (builder) {
    document.getElementById('page-content').innerHTML = builder();
  }

  // Run page-specific init
  if (pageId === 'dashboard') loadDashboard();
}

// ── Mode toggle ───────────────────────────────────────────────────────────────

function handleModeToggle(checkbox) {
  DEMO_MODE = !checkbox.checked;

  const badge   = document.getElementById('mode-badge');
  const banner  = document.getElementById('real-mode-banner');
  const hint    = document.getElementById('mfa-hint');
  const emailWrap = document.getElementById('mfa-email-wrap');

  if (!DEMO_MODE) {
    // Switched to real mode
    badge.textContent = 'Real';
    badge.className   = 'mode-badge real';
    banner.classList.add('visible');
    if (hint)      hint.textContent = 'OTP will be sent to your email';
    if (emailWrap) emailWrap.style.display = 'block';
    toast('Real Mode activated — device and IP detection enabled', 'warning');
  } else {
    // Switched to demo mode
    badge.textContent = 'Demo';
    badge.className   = 'mode-badge demo';
    banner.classList.remove('visible');
    if (hint)      hint.textContent = 'Demo OTP: 123456';
    if (emailWrap) emailWrap.style.display = 'none';
    toast('Demo Mode activated — using simulated data', 'success');
  }

  // Save preference
  localStorage.setItem('trustsense_mode', DEMO_MODE ? 'demo' : 'real');
}

// ── Shared score helpers ──────────────────────────────────────────────────────

function getScoreColor(score) {
  if (score >= 85) return 'var(--green)';
  if (score >= 60) return 'var(--blue)';
  if (score >= 40) return 'var(--amber)';
  if (score >= 20) return 'var(--coral)';
  return 'var(--red)';
}

function getRiskBadge(risk) {
  const classMap = {
    low:      'badge-green',
    guarded:  'badge-blue',
    elevated: 'badge-amber',
    high:     'badge-coral',
    critical: 'badge-red',
  };
  const cls = classMap[risk.level] || 'badge-navy';
  return `<span class="badge ${cls}">${risk.label}</span>`;
}

function updateScoreRing(ringCircleId, scoreNumId, score) {
  const circumference = 427; // 2 * π * 68
  const offset = circumference - (score / 100) * circumference;
  const circle = document.getElementById(ringCircleId);
  const numEl  = document.getElementById(scoreNumId);

  if (circle) {
    circle.style.strokeDashoffset = offset;
    circle.style.stroke = getScoreColor(score);
  }

  if (numEl) {
    numEl.textContent = Math.round(score);
    numEl.style.color = getScoreColor(score);
  }
}

// ── Chart helpers ─────────────────────────────────────────────────────────────

function initScoreChart(canvasId, initialScore) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (scoreChart) scoreChart.destroy();

  scoreChart = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels: [0],
      datasets: [{
        data: [initialScore],
        borderColor:     '#E8470A',
        backgroundColor: 'rgba(232,71,10,0.06)',
        borderWidth:     2,
        pointRadius:     0,
        tension:         0.4,
        fill:            true,
      }],
    },
    options: {
      responsive:          true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => `Score: ${Math.round(ctx.parsed.y)}` },
          backgroundColor: '#1B2A6B',
          titleColor:      'rgba(255,255,255,0.6)',
          bodyColor:       '#fff',
          borderColor:     '#E8470A',
          borderWidth:     1,
        },
      },
      scales: {
        x: { display: false },
        y: {
          min: 0,
          max: 100,
          grid:  { color: 'rgba(0,0,0,0.04)' },
          ticks: { color: '#9CA3AF', font: { size: 10 } },
        },
      },
      animation: { duration: 300 },
    },
  });
}

function pushChartScore(score) {
  if (!scoreChart) return;
  const labels = scoreChart.data.labels;
  const data   = scoreChart.data.datasets[0].data;

  labels.push(labels.length);
  data.push(score);

  // Keep last 40 points
  if (labels.length > 40) {
    labels.shift();
    data.shift();
  }

  scoreChart.update('none');
}

// ── Score bar (for KYC) ───────────────────────────────────────────────────────

function buildScoreBar(score) {
  const color = getScoreColor(score);
  return `
    <div class="score-bar-wrap">
      <div class="score-bar-track">
        <div class="score-bar-fill" style="width:${score}%;background:${color}"></div>
      </div>
      <span class="score-bar-label font-mono" style="color:${color}">${score}%</span>
    </div>
  `;
}

// ── MFA modal ─────────────────────────────────────────────────────────────────

function openMFA() {
  document.getElementById('mfa-modal').classList.add('open');
  // Clear previous inputs
  document.querySelectorAll('.otp-input').forEach(el => {
    el.value = '';
    el.style.borderColor = '';
  });
  document.querySelectorAll('.otp-input')[0]?.focus();
}

function closeMFA() {
  document.getElementById('mfa-modal').classList.remove('open');
}

function otpNext(el, index) {
  if (el.value.length === 1) {
    const inputs = document.querySelectorAll('.otp-input');
    if (index < 5) inputs[index + 1].focus();
  }
}

async function sendRealOTP() {
  const email     = document.getElementById('mfa-email')?.value;
  const sessionId = currentSession?.session_id;

  if (!email || !sessionId) {
    toast('Enter your email address first', 'error');
    return;
  }

  try {
    const result = await apiSendRealOTP(sessionId, email);
    toast(result.message || 'OTP sent', 'success');
  } catch (e) {
    toast('Failed to send OTP — check backend logs', 'error');
  }
}

async function verifyMFA() {
  const inputs = document.querySelectorAll('.otp-input');
  const otp    = Array.from(inputs).map(i => i.value).join('');

  if (otp.length !== 6) {
    toast('Enter all 6 digits', 'error');
    return;
  }

  try {
    let result;

    if (DEMO_MODE) {
      result = mockVerifyOTP(otp);
    } else {
      result = await apiVerifyRealOTP(currentSession.session_id, otp);
    }

    closeMFA();

    if (result.success) {
      updateScoreRing('score-circle', 'score-num', result.trust_score);
      pushChartScore(result.trust_score);
      updateScoreBadge(result.risk);
      toast('✓ MFA verified — trust score restored', 'success');
    } else {
      toast(result.message || result.reason || 'Incorrect OTP', 'error');
      inputs.forEach(el => {
        el.value = '';
        el.style.borderColor = 'var(--red)';
        setTimeout(() => el.style.borderColor = '', 1500);
      });
      inputs[0]?.focus();
    }
  } catch (e) {
    toast('Verification failed — ' + e.message, 'error');
  }
}

function updateScoreBadge(risk) {
  const el = document.getElementById('score-badge');
  if (el) el.innerHTML = getRiskBadge(risk);
}

// ── Toast ─────────────────────────────────────────────────────────────────────

function toast(message, type = 'default', duration = 3000) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.className   = `toast ${type} show`;
  setTimeout(() => el.classList.remove('show'), duration);
}

// ── Backend health check with retry ──────────────────────────────────────────

async function checkBackend() {
  setBootStatus('waking', '⏳ Waking server...');

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await apiHealth();
      isBackendLive = true;
      setBootStatus('online', '● Backend online');
      return true;
    } catch (e) {
      setBootStatus('waking', `⏳ Starting server… (${attempt}/3)`);
      if (attempt < 3) await sleep(5000);
    }
  }

  isBackendLive = false;
  setBootStatus('offline', '● Demo mode');
  return false;
}

function setBootStatus(state, text) {
  const dot   = document.getElementById('status-dot');
  const label = document.getElementById('status-label');
  const url   = document.getElementById('backend-url');

  const colors = {
    online:  'var(--green)',
    waking:  'var(--amber)',
    offline: 'var(--coral)',
  };

  if (dot)   { dot.style.background  = colors[state]; dot.style.boxShadow = `0 0 6px ${colors[state]}`; }
  if (label) { label.style.color     = colors[state]; label.textContent   = text; }
  if (url)   { url.textContent       = state === 'online' ? BACKEND_URL.replace('https://', '') : 'offline mode'; }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function activateBootStep(n, done = false) {
  const el = document.getElementById(`bs-${n}`);
  if (!el) return;

  el.classList.add(done ? 'done' : 'active');
  const dot  = el.querySelector('.boot-step-dot');
  const text = el.querySelector('.boot-step-text');

  if (dot) {
    dot.style.background = done ? 'var(--green)' : 'var(--orange)';
    dot.style.boxShadow  = done ? '0 0 8px var(--green)' : '0 0 8px var(--orange)';
  }

  if (done && text) {
    text.textContent = '✓ ' + text.textContent.replace('✓ ', '');
  }
}

// ── Boot sequence ─────────────────────────────────────────────────────────────

(async () => {
  const overlay = document.getElementById('boot-overlay');
  const bar     = document.getElementById('boot-bar');
  const msg     = document.getElementById('boot-msg');

  // Restore saved mode preference
  const savedMode = localStorage.getItem('trustsense_mode');
  if (savedMode === 'real') {
    DEMO_MODE = false;
    document.getElementById('mode-toggle').checked = true;
    document.getElementById('mode-badge').textContent = 'Real';
    document.getElementById('mode-badge').className   = 'mode-badge real';
    document.getElementById('real-mode-banner').classList.add('visible');
  }

  // Animate boot steps (visual only — runs regardless of backend)
  activateBootStep(1);
  bar.style.width = '15%';
  msg.textContent = 'Contacting identity server...';

  await sleep(700);
  activateBootStep(1, true); activateBootStep(2);
  bar.style.width = '35%';
  msg.textContent = 'Establishing secure channel...';

  await sleep(700);
  activateBootStep(2, true); activateBootStep(3);
  bar.style.width = '60%';
  msg.textContent = 'Loading trust engine...';

  await sleep(700);
  activateBootStep(3, true); activateBootStep(4);
  bar.style.width = '80%';
  msg.textContent = 'Verifying API endpoints...';

  // Actual backend check
  const connected = await checkBackend();

  activateBootStep(4, true);
  bar.style.width = '100%';

  msg.style.fontFamily = 'var(--font-mono)';
  msg.textContent      = connected ? '✓ Connected — launching dashboard' : '✓ Demo mode ready';
  msg.style.color      = connected ? 'rgba(255,255,255,0.8)' : 'rgba(255,165,0,0.8)';

  await sleep(700);

  // Fade out overlay
  overlay.style.opacity = '0';
  await sleep(600);
  overlay.style.display = 'none';

  // Load initial page
  showPage('dashboard', document.querySelector('.nav-item.active'));
})();

// Auto-refresh dashboard every 5 seconds
setInterval(() => {
  const title = document.getElementById('topbar-title')?.textContent;
  if (title === 'Analyst Dashboard') loadDashboard();
}, 5000);