// ── Recovery page HTML ────────────────────────────────────────────────────────

function buildRecoveryHTML() {
  return `
    <div class="grid-2" style="gap:24px">

      <!-- Left: request form -->
      <div class="card">
        <div class="card-title" style="margin-bottom:16px">Recovery Request</div>

        <div class="input-group">
          <label class="input-label">Account Identifier</label>
          <input class="input" id="rec-account" value="SB-4821-7734"/>
        </div>

        <div class="input-group">
          <label class="input-label">Recovery Method</label>
          <select class="input select" id="rec-method">
            <option value="otp">OTP to registered mobile</option>
            <option value="email">Email verification link</option>
            <option value="biometric">Biometric re-authentication</option>
            <option value="branch">Branch visit required</option>
          </select>
        </div>

        <div class="input-group">
          <label class="input-label">Simulate Risk Signal</label>
          <select class="input select" id="rec-signal">
            <option value="normal">Normal — same device, usual location</option>
            <option value="sim_swap">SIM swap — carrier changed 2hr ago</option>
            <option value="new_device">New device + unknown IP</option>
            <option value="multiple_fail">3 failed OTP attempts</option>
            <option value="social_eng">Possible social engineering (call centre)</option>
          </select>
        </div>

        <button class="btn btn-primary w-full btn-lg" onclick="runRecovery()">
          Evaluate Recovery Request
        </button>
      </div>

      <!-- Right: assessment -->
      <div class="card">
        <div class="card-title" style="margin-bottom:16px">Risk Assessment & Response</div>

        <div id="rec-empty" style="padding:48px 0;text-align:center;
                                   color:var(--text-muted);font-size:13px">
          Submit a recovery request to see the risk assessment
        </div>

        <div id="rec-result" style="display:none">
          <div id="rec-banner" style="padding:16px;border-radius:var(--r);
                                      text-align:center;margin-bottom:20px"></div>
          <div class="timeline" id="rec-timeline"></div>
        </div>
      </div>

    </div>
  `;
}

// ── Recovery configs ──────────────────────────────────────────────────────────

const RECOVERY_SCENARIOS = {
  normal: {
    score:  82,
    label:  'Low Risk',
    color:  'var(--green)',
    bg:     'var(--green-light)',
    border: '#A7F3D0',
    icon:   '✅',
    msg:    'Recovery request looks legitimate.',
    steps: [
      { label: 'Request received',   sub: 'Account matched — SB-4821-7734',         color: 'var(--green)' },
      { label: 'Device check passed', sub: 'Recognized device from usual location',  color: 'var(--green)' },
      { label: 'OTP dispatched',      sub: '6-digit code sent to registered mobile', color: 'var(--blue)'  },
      { label: 'Recovery permitted',  sub: 'Standard flow — low risk',               color: 'var(--green)' },
    ],
  },
  sim_swap: {
    score:  18,
    label:  'Critical Risk',
    color:  'var(--red)',
    bg:     'var(--red-light)',
    border: '#FECACA',
    icon:   '🚨',
    msg:    'SIM swap signal detected — OTP channel compromised.',
    steps: [
      { label: 'Request received',   sub: 'Account matched',                                   color: 'var(--green)' },
      { label: 'Telecom API check',  sub: '⚠ SIM changed 2hrs ago — carrier: Jio → Airtel',   color: 'var(--red)'   },
      { label: 'OTP channel blocked', sub: 'Mobile OTP disabled — SIM swap risk',              color: 'var(--red)'   },
      { label: 'Escalated to branch', sub: 'Customer must visit branch with Aadhaar',          color: 'var(--amber)' },
      { label: 'Security alert raised', sub: 'Fraud team notified — case opened',              color: 'var(--red)'   },
    ],
  },
  new_device: {
    score:  42,
    label:  'Elevated Risk',
    color:  'var(--amber)',
    bg:     'var(--amber-light)',
    border: '#FDE68A',
    icon:   '⚠️',
    msg:    'New device detected — step-up verification triggered.',
    steps: [
      { label: 'Request received',        sub: 'Account matched',                               color: 'var(--green)' },
      { label: 'Device fingerprint unknown', sub: 'Never seen this device before',             color: 'var(--amber)' },
      { label: 'Geo anomaly flagged',     sub: 'IP from unrecognized region',                   color: 'var(--amber)' },
      { label: 'Step-up MFA triggered',   sub: 'Video selfie + knowledge question required',   color: 'var(--blue)'  },
      { label: 'Pending verification',    sub: 'Awaiting customer response',                    color: 'var(--text-muted)' },
    ],
  },
  multiple_fail: {
    score:  25,
    label:  'High Risk',
    color:  'var(--coral)',
    bg:     'var(--coral-light)',
    border: '#FED7AA',
    icon:   '🔒',
    msg:    'Multiple OTP failures — possible brute-force attack.',
    steps: [
      { label: 'Request received',        sub: 'Account matched',                  color: 'var(--green)' },
      { label: 'OTP attempt 1 failed',    sub: 'Wrong code entered',               color: 'var(--amber)' },
      { label: 'OTP attempt 2 failed',    sub: 'Wrong code — velocity alert',      color: 'var(--coral)' },
      { label: 'OTP attempt 3 failed',    sub: 'Brute-force pattern detected',     color: 'var(--red)'   },
      { label: 'Account frozen',          sub: 'Unlock via biometric or branch',   color: 'var(--red)'   },
    ],
  },
  social_eng: {
    score:  35,
    label:  'High Risk',
    color:  'var(--coral)',
    bg:     'var(--coral-light)',
    border: '#FED7AA',
    icon:   '📞',
    msg:    'Possible social engineering via call centre detected.',
    steps: [
      { label: 'Call centre request',     sub: 'Caller claims to be account holder',              color: 'var(--blue)'  },
      { label: 'Voice pattern mismatch',  sub: 'AI voiceprint differs from stored baseline',      color: 'var(--amber)' },
      { label: 'Urgency signals flagged', sub: 'Script analysis flagged social engineering',      color: 'var(--coral)' },
      { label: 'Agent prompted to verify', sub: 'Additional KBA questions enforced',             color: 'var(--amber)' },
      { label: 'Supervisor escalation',   sub: 'Case flagged for fraud team review',              color: 'var(--red)'   },
    ],
  },
};

// ── Recovery logic ────────────────────────────────────────────────────────────

function runRecovery() {
  const signal = document.getElementById('rec-signal')?.value;
  const config = RECOVERY_SCENARIOS[signal];
  if (!config) return;

  document.getElementById('rec-empty').style.display  = 'none';
  document.getElementById('rec-result').style.display = 'block';

  // Banner
  const banner = document.getElementById('rec-banner');
  banner.style.cssText = `
    padding:16px;border-radius:var(--r);text-align:center;
    margin-bottom:20px;background:${config.bg};
    border:1px solid ${config.border}
  `;
  banner.innerHTML = `
    <div style="font-size:24px;margin-bottom:6px">${config.icon}</div>
    <div style="font-size:15px;font-weight:700;color:${config.color}">
      ${config.label} — Score: ${config.score}
    </div>
    <div style="font-size:12px;color:var(--text-muted);margin-top:4px">
      ${config.msg}
    </div>
  `;

  // Timeline
  document.getElementById('rec-timeline').innerHTML = config.steps.map((step, i) => `
    <div class="tl-item">
      <div class="tl-left">
        <div class="tl-dot" style="color:${step.color};background:${step.color}"></div>
        ${i < config.steps.length - 1 ? '<div class="tl-line"></div>' : ''}
      </div>
      <div style="padding-bottom:4px">
        <div class="tl-label">${step.label}</div>
        <div class="tl-sub">${step.sub}</div>
      </div>
    </div>
  `).join('');

  toast(`Recovery assessed: ${config.label}`, config.score < 40 ? 'error' : 'warning');
}