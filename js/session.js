// ── Session page HTML ─────────────────────────────────────────────────────────

function buildSessionHTML() {
  return `
    <div class="grid-2" style="gap:24px">

      <!-- Left: login form + risk buttons -->
      <div>
        <div class="card mb-16">
          <div class="card-header">
            <span class="card-title">Simulate Login</span>
            ${DEMO_MODE ? '<span class="badge badge-navy">Demo Mode</span>' : '<span class="badge" style="background:var(--orange-light);color:var(--orange)">Real Mode</span>'}
          </div>

          <div class="input-group">
            <label class="input-label">User</label>
            <select class="input select" id="login-user">
              <option value="u001">Priya Sharma — Customer</option>
              <option value="u002">Rajan Mehta — Customer</option>
              <option value="u003">Anita Desai — Customer</option>
              <option value="u004">Vivek Joshi — Employee (RM)</option>
              <option value="u005">Sneha Kulkarni — Customer</option>
            </select>
          </div>

          <div class="input-group" id="device-group">
            <label class="input-label">Device</label>
            <select class="input select" id="login-device">
              <option value="known-iphone">Known — iPhone (trusted)</option>
              <option value="known-chrome">Known — Chrome laptop</option>
              <option value="new-android">New device — Android (unknown)</option>
              <option value="new-suspicious">New device — suspicious fingerprint</option>
            </select>
          </div>

          <div class="input-group" id="ip-group">
            <label class="input-label">IP / Location</label>
            <select class="input select" id="login-ip">
              <option value="192.168.1.1">192.168.1.1 — Mumbai (usual)</option>
              <option value="45.33.32.156">45.33.32.156 — Delhi</option>
              <option value="198.51.100.22">198.51.100.22 — Unknown foreign IP</option>
              <option value="10.8.0.1">10.8.0.1 — VPN exit node</option>
            </select>
          </div>

          ${!DEMO_MODE ? `
            <div style="padding:10px 12px;background:var(--orange-light);
                        border-radius:var(--r);font-size:12px;color:var(--orange);
                        margin-bottom:16px;font-weight:500">
              ⚡ Real Mode: your actual IP and device will be detected automatically
            </div>
          ` : ''}

          <button class="btn btn-primary w-full" onclick="startSession()">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
              <polyline points="10 17 15 12 10 7"/>
              <line x1="15" y1="12" x2="3" y2="12"/>
            </svg>
            Start Session
          </button>
        </div>

        <div class="card" id="risk-triggers-card" style="display:none">
          <div class="card-header">
            <span class="card-title">Inject Risk Events</span>
            <span style="font-size:11px;color:var(--text-muted)">watch score drop</span>
          </div>
          <div class="risk-triggers" id="risk-triggers-wrap"></div>
        </div>
      </div>

      <!-- Right: trust score + events -->
      <div>
        <div class="card mb-16">
          <div class="card-header">
            <span class="card-title">Trust Score</span>
            <div class="live-badge" id="live-badge" style="display:none">
              <span class="live-dot pulse"></span> Live
            </div>
          </div>

          <div id="score-empty" style="padding:40px 0;text-align:center;color:var(--text-muted);font-size:13px">
            Start a session to see the live trust score
          </div>

          <div id="score-display" style="display:none">
            <div class="score-ring-wrap">
              <div class="score-ring">
                <svg width="160" height="160" viewBox="0 0 160 160">
                  <circle cx="80" cy="80" r="68" fill="none"
                          stroke="var(--border)" stroke-width="14"/>
                  <circle id="score-circle" cx="80" cy="80" r="68"
                          fill="none" stroke="var(--green)" stroke-width="14"
                          stroke-linecap="round" stroke-dasharray="427"
                          stroke-dashoffset="0"
                          style="transition:stroke-dashoffset 0.8s ease,stroke 0.4s"/>
                </svg>
                <div class="score-ring-val">
                  <div class="score-num" id="score-num">—</div>
                  <div class="score-denom">/ 100</div>
                </div>
              </div>
              <div class="score-badge-wrap mt-8" id="score-badge"></div>
            </div>
            <div class="chart-wrap">
              <canvas id="score-chart"></canvas>
            </div>
          </div>
        </div>

        <div class="card" id="events-card" style="display:none">
          <div class="card-header">
            <span class="card-title">Risk Events Detected</span>
          </div>
          <div class="events-feed" id="events-feed"></div>
        </div>
      </div>
    </div>
  `;
}

// ── Session logic ─────────────────────────────────────────────────────────────

async function startSession() {
  // Stop any existing WebSocket or mock interval
  stopLiveScore();

  const userId   = document.getElementById('login-user')?.value;
  const deviceId = document.getElementById('login-device')?.value;
  const ip       = document.getElementById('login-ip')?.value;

  try {
    let data;

    if (DEMO_MODE) {
      data = mockLogin(userId, deviceId, ip);
    } else {
      // Real mode — auto-detect everything
      data = await apiRealLogin(
        userId,
        deviceId,
        navigator.userAgent,
        `${screen.width}x${screen.height}`,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        navigator.language
      );
    }

    currentSession = data;
    showScoreDisplay(data.trust_score, data.risk, data.events);
    buildRiskButtons();
    startLiveScore();

    if (data.mfa_required) {
      setTimeout(() => openMFA(), 600);
    }

    toast(`Session started — ${data.user.name}`, 'success');

    // Start typing analysis in real mode
    if (!DEMO_MODE) setupTypingTracking();

  } catch (e) {
    toast('Login failed — ' + e.message, 'error');
    // Fallback to mock
    const data = mockLogin(userId, deviceId, ip);
    currentSession = data;
    showScoreDisplay(data.trust_score, data.risk, data.events);
    buildRiskButtons();
    startLiveScore();
  }
}

function showScoreDisplay(score, risk, events) {
  document.getElementById('score-empty').style.display  = 'none';
  document.getElementById('score-display').style.display = 'block';
  document.getElementById('live-badge').style.display    = 'flex';
  document.getElementById('events-card').style.display   = 'block';
  document.getElementById('risk-triggers-card').style.display = 'block';

  updateScoreRing('score-circle', 'score-num', score);
  updateScoreBadge(risk);
  initScoreChart('score-chart', score);
  renderEvents(events);
}

function renderEvents(events) {
  const feed = document.getElementById('events-feed');
  if (!feed) return;

  if (!events.length) {
    feed.innerHTML = `
      <div style="font-size:12px;color:var(--text-muted);padding:8px 0">
        No risk events — session looks clean
      </div>`;
    return;
  }

  feed.innerHTML = events.map(e => `
    <div class="event-item fade-in">
      <div style="flex:1">
        <div class="event-label">⚠ ${e.label}</div>
        <div class="event-time">${new Date(e.timestamp).toLocaleTimeString()}</div>
      </div>
      <div class="event-impact">${e.impact}</div>
    </div>
  `).join('');
}

function buildRiskButtons() {
  const wrap = document.getElementById('risk-triggers-wrap');
  if (!wrap) return;

  const events = [
    { type: 'sim_swap',        label: 'SIM Swap'       },
    { type: 'vpn_detected',    label: 'VPN Detected'   },
    { type: 'velocity',        label: 'High Velocity'  },
    { type: 'failed_attempts', label: 'Failed OTPs'    },
    { type: 'large_transfer',  label: 'Large Transfer' },
    { type: 'odd_hours',       label: 'Off-hours'      },
    { type: 'typing_anomaly',  label: 'Typing Mismatch'},
    { type: 'privileged_bulk', label: 'Bulk Access'    },
  ];

  wrap.innerHTML = events.map(e => `
    <button class="risk-btn" onclick="injectRiskEvent('${e.type}')">
      ${e.label}
    </button>
  `).join('');
}

async function injectRiskEvent(eventType) {
  if (!currentSession) return;

  try {
    let result;

    if (DEMO_MODE || !isBackendLive) {
      result = mockInjectEvent(eventType);
    } else {
      result = await apiInjectEvent(currentSession.session_id, eventType);
    }

    if (!result) return;

    updateScoreRing('score-circle', 'score-num', result.trust_score);
    updateScoreBadge(result.risk);
    pushChartScore(result.trust_score);

    // Prepend new event to feed
    const feed = document.getElementById('events-feed');
    if (feed) {
      const item = document.createElement('div');
      item.className = 'event-item fade-in';
      item.innerHTML = `
        <div style="flex:1">
          <div class="event-label">🚨 ${result.event_added.label}</div>
          <div class="event-time">${new Date().toLocaleTimeString()}</div>
        </div>
        <div class="event-impact">${result.event_added.impact}</div>
      `;
      feed.prepend(item);
    }

    if (result.mfa_required) {
      setTimeout(() => openMFA(), 400);
    }

    toast(`Risk event: ${result.event_added.label}`, 'warning');

  } catch (e) {
    toast('Event injection failed — ' + e.message, 'error');
  }
}

// ── Live score streaming ──────────────────────────────────────────────────────

function startLiveScore() {
  if (DEMO_MODE || !isBackendLive) {
    startMockLiveScore();
  } else {
    startWebSocketScore();
  }
}

function stopLiveScore() {
  if (wsConnection) {
    wsConnection.close();
    wsConnection = null;
  }
  if (mockWsInterval) {
    clearInterval(mockWsInterval);
    mockWsInterval = null;
  }
}

function startMockLiveScore() {
  mockWsInterval = setInterval(() => {
    const { trust_score, risk } = mockLiveScore();
    updateScoreRing('score-circle', 'score-num', trust_score);
    updateScoreBadge(risk);
    pushChartScore(trust_score);
  }, 2000);
}

function startWebSocketScore() {
  if (!currentSession) return;

  wsConnection = createSessionWebSocket(currentSession.session_id, (data) => {
    if (data.error) return;
    updateScoreRing('score-circle', 'score-num', data.trust_score);
    updateScoreBadge(data.risk);
    pushChartScore(data.trust_score);
  });

  // Fallback to mock if WS fails
  wsConnection.onerror = () => {
    console.warn('[ws] connection failed — switching to mock');
    startMockLiveScore();
  };
}

// ── Real mode typing tracker ──────────────────────────────────────────────────

let typingIntervals = [];
let lastKeyTime     = null;

function setupTypingTracking() {
  // Track keystrokes on any input in the page
  document.addEventListener('keydown', recordKeystroke);
}

function recordKeystroke() {
  const now = Date.now();
  if (lastKeyTime !== null) {
    typingIntervals.push(now - lastKeyTime);
  }
  lastKeyTime = now;

  // Analyze after 10+ keystrokes
  if (typingIntervals.length >= 10 && typingIntervals.length % 10 === 0) {
    sendTypingAnalysis();
  }
}

async function sendTypingAnalysis() {
  if (!currentSession || DEMO_MODE) return;

  const avg      = typingIntervals.reduce((a, b) => a + b, 0) / typingIntervals.length;
  const variance = typingIntervals.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / typingIntervals.length;

  try {
    const result = await apiAnalyzeTyping(
      currentSession.session_id,
      typingIntervals.slice(-20), // send last 20 intervals
      avg,
      variance
    );

    if (result.risk_event_added) {
      updateScoreRing('score-circle', 'score-num', result.trust_score);
      updateScoreBadge(result.risk);
      pushChartScore(result.trust_score);
      toast('Typing pattern anomaly detected', 'warning');
    }
  } catch (e) {
    console.warn('[typing] analysis failed:', e.message);
  }
}