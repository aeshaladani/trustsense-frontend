// ── Mock data ─────────────────────────────────────────────────────────────────

const DEMO_USERS = [
  { id: 'u001', name: 'Priya Sharma',   account: 'SB-4821-7734', role: 'Customer',       email: 'priya@demo.com' },
  { id: 'u002', name: 'Rajan Mehta',    account: 'SB-2293-1156', role: 'Customer',       email: 'rajan@demo.com' },
  { id: 'u003', name: 'Anita Desai',    account: 'CB-9910-3342', role: 'Customer',       email: 'anita@demo.com' },
  { id: 'u004', name: 'Vivek Joshi',    account: 'SB-6672-8891', role: 'Employee (RM)',  email: 'vivek@demo.com' },
  { id: 'u005', name: 'Sneha Kulkarni', account: 'SB-3384-5529', role: 'Customer',       email: 'sneha@demo.com' },
];

const RISK_EVENT_CATALOG = {
  new_device:      { type: 'new_device',      label: 'New device detected',                impact: -22 },
  geo_anomaly:     { type: 'geo_anomaly',      label: 'Login from new location',            impact: -18 },
  velocity:        { type: 'velocity',         label: 'High transaction velocity',          impact: -15 },
  odd_hours:       { type: 'odd_hours',        label: 'Access outside normal hours',        impact: -12 },
  vpn_detected:    { type: 'vpn_detected',     label: 'VPN / proxy detected',               impact: -10 },
  failed_attempts: { type: 'failed_attempts',  label: 'Multiple failed OTP attempts',       impact: -25 },
  sim_swap:        { type: 'sim_swap',         label: 'SIM swap signal detected',           impact: -30 },
  large_transfer:  { type: 'large_transfer',   label: 'Unusually large transfer',           impact: -14 },
  privileged_bulk: { type: 'privileged_bulk',  label: 'Bulk record access by employee',     impact: -28 },
  typing_anomaly:  { type: 'typing_anomaly',   label: 'Typing pattern mismatch',            impact: -8  },
};

const BASE_SCORE_MAP = {
  known_known:     88,
  known_unknown:   72,
  unknown_known:   65,
  unknown_unknown: 58,
};

const KYC_SCENARIOS = {
  clean:        { liveness: 96, selfie: 94, doc: 88 },
  low_liveness: { liveness: 45, selfie: 88, doc: 82 },
  doc_mismatch: { liveness: 88, selfie: 72, doc: 61 },
  all_fail:     { liveness: 40, selfie: 55, doc: 48 },
};

// ── In-memory mock state ──────────────────────────────────────────────────────

let mockSessions    = [];
let mockKYCStore    = [];
let mockFlagged     = [];
let mockSessionScore = 85;
let mockSessionEvents = [];
let mockCurrentSessionId = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockGetUser(userId) {
  return DEMO_USERS.find(u => u.id === userId) || DEMO_USERS[0];
}

function mockComputeScore(baseScore, events) {
  const total = events.reduce((sum, e) => sum + (e.impact || 0), 0);
  return Math.round(Math.max(0, Math.min(100, baseScore + total)) * 10) / 10;
}

function mockGetRisk(score) {
  if (score >= 85) return { level: 'low',      label: 'Trusted',    action: 'allow',   color: 'green' };
  if (score >= 60) return { level: 'guarded',  label: 'Guarded',    action: 'monitor', color: 'blue'  };
  if (score >= 40) return { level: 'elevated', label: 'Elevated',   action: 'stepup',  color: 'amber' };
  if (score >= 20) return { level: 'high',     label: 'High Risk',  action: 'freeze',  color: 'coral' };
  return              { level: 'critical', label: 'Critical',   action: 'block',   color: 'red'   };
}

function mockNow() {
  return new Date().toISOString();
}

function mockSessionId() {
  return 'demo-' + Math.random().toString(36).slice(2, 6);
}

// ── Mock API functions ────────────────────────────────────────────────────────

function mockLogin(userId, deviceId, ipAddress) {
  const user       = mockGetUser(userId);
  const knownDevice = deviceId.startsWith('known-');
  const knownIp     = ipAddress.startsWith('192.168') || ipAddress.startsWith('10.');

  const scoreKey = `${knownDevice ? 'known' : 'unknown'}_${knownIp ? 'known' : 'unknown'}`;
  const baseScore = BASE_SCORE_MAP[scoreKey];

  const events = [];

  if (!knownDevice) {
    events.push({ ...RISK_EVENT_CATALOG.new_device, timestamp: mockNow() });
  }

  if (!knownIp) {
    events.push({ ...RISK_EVENT_CATALOG.geo_anomaly, timestamp: mockNow() });
  }

  mockSessionScore   = mockComputeScore(baseScore, events);
  mockSessionEvents  = events;
  mockCurrentSessionId = mockSessionId();

  const risk = mockGetRisk(mockSessionScore);

  const session = {
    session_id:   mockCurrentSessionId,
    user,
    trust_score:  mockSessionScore,
    risk,
    events,
    mfa_required: ['stepup', 'freeze', 'block'].includes(risk.action),
    mfa_verified: false,
    status:       'active',
    created_at:   mockNow(),
  };

  // Store for dashboard
  mockSessions.push({
    session_id:  mockCurrentSessionId,
    user,
    trust_score: mockSessionScore,
    risk,
    event_count: events.length,
    mfa_verified: false,
    created_at:  mockNow(),
  });

  return session;
}

function mockInjectEvent(eventType) {
  const template = RISK_EVENT_CATALOG[eventType];
  if (!template) return null;

  const event = { ...template, timestamp: mockNow() };
  mockSessionEvents.push(event);

  // Recalculate from base — avoids stacking issues
  const baseScore = BASE_SCORE_MAP['unknown_unknown']; // conservative
  mockSessionScore = mockComputeScore(
    mockSessions.at(-1)?.trust_score || 85,
    [event]
  );

  // Simpler approach — just apply delta
  mockSessionScore = Math.max(0, mockSessionScore + template.impact);
  const risk = mockGetRisk(mockSessionScore);

  // Auto-flag if elevated+
  if (['elevated', 'high', 'critical'].includes(risk.level)) {
    const alreadyFlagged = mockFlagged.some(f => f.session_id === mockCurrentSessionId);
    if (!alreadyFlagged) {
      mockFlagged.push({
        session_id: mockCurrentSessionId,
        user: mockSessions.at(-1)?.user,
        trust_score: mockSessionScore,
        risk,
        top_event: event.label,
        flagged_at: mockNow(),
      });
    }
  }

  return {
    trust_score:  mockSessionScore,
    risk,
    event_added:  event,
    mfa_required: ['stepup', 'freeze', 'block'].includes(risk.action),
  };
}

function mockVerifyOTP(otp) {
  const success = otp === '123456';

  if (success) {
    mockSessionScore = Math.min(100, mockSessionScore + 15);
    mockSessionEvents = mockSessionEvents.filter(
      e => !['new_device', 'geo_anomaly', 'odd_hours'].includes(e.type)
    );
  }

  return {
    success,
    trust_score: mockSessionScore,
    risk: mockGetRisk(mockSessionScore),
    message: success ? 'Verified successfully' : 'Incorrect OTP',
  };
}

function mockKYCSubmit(name, docType, scenario) {
  const scores = KYC_SCENARIOS[scenario] || KYC_SCENARIOS.clean;
  const flags  = [];

  if (scores.doc < 75)      flags.push({ label: 'Low document quality score',          severity: 'medium' });
  if (scores.liveness < 70) flags.push({ label: 'Liveness check uncertain',            severity: 'high'   });
  if (scores.selfie < 72)   flags.push({ label: 'Face match below threshold',          severity: 'high'   });

  const overall = scores.doc * 0.3 + scores.liveness * 0.4 + scores.selfie * 0.3;
  const hasHighFlag = flags.some(f => f.severity === 'high');

  const verdict = overall >= 72 && !hasHighFlag ? 'approved'
                : overall >= 55                 ? 'review'
                :                                 'rejected';

  const submission = {
    id:             'kyc-' + Date.now(),
    name,
    document_type:  docType,
    doc_score:      scores.doc,
    liveness_score: scores.liveness,
    selfie_score:   scores.selfie,
    overall_score:  Math.round(overall),
    flags,
    verdict,
    submitted_at:   mockNow(),
  };

  mockKYCStore.push(submission);
  return submission;
}

function mockGetDashboard() {
  const sessions = [...mockSessions].sort((a, b) => a.trust_score - b.trust_score);

  return {
    stats: {
      total_sessions:  mockSessions.length,
      flagged:         mockFlagged.length,
      mfa_triggered:   mockSessions.filter(s => s.mfa_verified).length,
      kyc_submissions: mockKYCStore.length,
      kyc_approved:    mockKYCStore.filter(k => k.verdict === 'approved').length,
      kyc_review:      mockKYCStore.filter(k => k.verdict === 'review').length,
      kyc_rejected:    mockKYCStore.filter(k => k.verdict === 'rejected').length,
    },
    sessions,
    flagged_sessions: mockFlagged.slice(-10),
    kyc_submissions:  mockKYCStore.slice(-10),
  };
}

// Live score jitter for WebSocket simulation in demo mode
function mockLiveScore() {
  const jitter = (Math.random() - 0.5) * 3;
  mockSessionScore = Math.max(0, Math.min(100, mockSessionScore + jitter));
  return {
    trust_score: Math.round(mockSessionScore * 10) / 10,
    risk: mockGetRisk(mockSessionScore),
  };
}