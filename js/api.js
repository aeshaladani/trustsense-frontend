// ── Config ────────────────────────────────────────────────────────────────────

// Change this to your Render URL before deploying
const BACKEND_URL = 'https://trustsense-api.onrender.com';

// ── Base fetch wrapper ────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const url      = `${BACKEND_URL}${path}`;
  const defaults = {
    headers: { 'Content-Type': 'application/json' },
  };

  const response = await fetch(url, { ...defaults, ...options });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

// ── Health check ──────────────────────────────────────────────────────────────

async function apiHealth() {
  return apiFetch('/health');
}

// ── Demo mode session endpoints ───────────────────────────────────────────────

async function apiLogin(userId, deviceId, ipAddress, userAgent) {
  return apiFetch('/api/session/login', {
    method: 'POST',
    body: JSON.stringify({
      user_id:    userId,
      device_id:  deviceId,
      ip_address: ipAddress,
      user_agent: userAgent,
    }),
  });
}

async function apiInjectEvent(sessionId, eventType) {
  return apiFetch(`/api/session/${sessionId}/event?event_type=${eventType}`, {
    method: 'POST',
  });
}

async function apiVerifyDemoOTP(sessionId, otp) {
  return apiFetch(`/api/session/${sessionId}/mfa/verify`, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, otp }),
  });
}

async function apiKYCSubmit(payload) {
  return apiFetch('/api/kyc/submit', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function apiGetDashboard() {
  return apiFetch('/api/analyst/dashboard');
}

// ── Real mode endpoints ───────────────────────────────────────────────────────

async function apiRealLogin(userId, deviceId, userAgent, screenRes, timezone, language) {
  // Get actual client IP first
  const ipData = await fetch('https://ipapi.co/json/').then(r => r.json()).catch(() => ({ ip: '0.0.0.0' }));

  return apiFetch('/api/real/session/login', {
    method: 'POST',
    body: JSON.stringify({
      user_id:           userId,
      device_id:         deviceId,
      ip_address:        ipData.ip,
      user_agent:        userAgent,
      screen_resolution: screenRes,
      timezone,
      language,
    }),
  });
}

async function apiSendRealOTP(sessionId, email) {
  return apiFetch('/api/real/mfa/send', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, email }),
  });
}

async function apiVerifyRealOTP(sessionId, otp) {
  return apiFetch('/api/real/mfa/verify', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, otp }),
  });
}

async function apiAnalyzeTyping(sessionId, intervals, avgInterval, variance) {
  return apiFetch('/api/real/typing/analyze', {
    method: 'POST',
    body: JSON.stringify({
      session_id:   sessionId,
      intervals,
      avg_interval: avgInterval,
      variance,
    }),
  });
}

// ── WebSocket factory ─────────────────────────────────────────────────────────

function createSessionWebSocket(sessionId, onMessage) {
  const wsUrl = BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');
  const ws    = new WebSocket(`${wsUrl}/ws/session/${sessionId}`);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (e) {
      console.error('[ws] parse error:', e);
    }
  };

  ws.onerror = (e) => console.error('[ws] error:', e);

  return ws;
}