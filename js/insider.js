// ── Insider page HTML ─────────────────────────────────────────────────────────

function buildInsiderHTML() {
  return `
    <div class="grid-2" style="gap:24px;margin-bottom:24px">

      <!-- Left: action form -->
      <div class="card">
        <div class="card-title" style="margin-bottom:16px">Simulate Employee Action</div>

        <div class="input-group">
          <label class="input-label">Employee</label>
          <select class="input select" id="ins-user">
            <option value="emp001">Vivek Joshi — Relationship Manager</option>
            <option value="emp002">Kavya Reddy — Branch Operations</option>
            <option value="emp003">Suresh Nair — IT Administrator</option>
            <option value="emp004">Meena Patel — Compliance Officer</option>
          </select>
        </div>

        <div class="input-group">
          <label class="input-label">Action Performed</label>
          <select class="input select" id="ins-action">
            <option value="normal_view">View assigned customer profile (normal)</option>
            <option value="bulk_access">Access 80+ customer records in 5 mins</option>
            <option value="offhours">Login at 2:30 AM — off-hours access</option>
            <option value="sensitive">Access flagged / frozen account</option>
            <option value="export">Bulk data export — 500MB CSV</option>
            <option value="lateral">Lateral movement — accessed HR + Finance</option>
          </select>
        </div>

        <div class="input-group" style="margin-bottom:0">
          <label class="input-label">Time Context</label>
          <select class="input select" id="ins-time">
            <option value="business">Business hours — 10 AM Tuesday</option>
            <option value="offhours">Off hours — 2:30 AM Saturday</option>
            <option value="weekend">Weekend — Sunday afternoon</option>
          </select>
        </div>

        <div class="mt-16">
          <button class="btn btn-primary w-full btn-lg" onclick="runInsider()">
            Analyze Behavior
          </button>
        </div>
      </div>

      <!-- Right: risk score -->
      <div class="card">
        <div class="card-title" style="margin-bottom:16px">Behavioral Risk Score</div>

        <div id="ins-empty" style="padding:48px 0;text-align:center;
                                   color:var(--text-muted);font-size:13px">
          Select an employee action to analyze
        </div>

        <div id="ins-result" style="display:none">
          <div class="score-ring-wrap" style="margin-bottom:16px">
            <div class="score-ring">
              <svg width="160" height="160" viewBox="0 0 160 160">
                <circle cx="80" cy="80" r="68" fill="none"
                        stroke="var(--border)" stroke-width="14"/>
                <circle id="ins-circle" cx="80" cy="80" r="68"
                        fill="none" stroke="var(--red)" stroke-width="14"
                        stroke-linecap="round" stroke-dasharray="427"
                        stroke-dashoffset="427"
                        style="transition:stroke-dashoffset 1s ease,stroke 0.4s"/>
              </svg>
              <div class="score-ring-val">
                <div class="score-num" id="ins-score-num">—</div>
                <div class="score-denom">risk</div>
              </div>
            </div>
            <div class="mt-8 text-center fw-600" id="ins-score-label"></div>
          </div>
          <div id="ins-detail"></div>
        </div>
      </div>
    </div>

    <!-- PAM activity log -->
    <div class="card">
      <div class="card-title" style="margin-bottom:16px">PAM Activity Log</div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Action</th>
              <th>Time</th>
              <th>Risk Level</th>
              <th>System Response</th>
            </tr>
          </thead>
          <tbody id="ins-log">
            <tr>
              <td colspan="5" class="text-center text-muted" style="padding:24px">
                No activity logged yet
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ── Insider configs ───────────────────────────────────────────────────────────

const INSIDER_CONFIGS = {
  normal_view: {
    score:    8,
    color:    'var(--green)',
    level:    'Low',
    response: 'Permitted — normal access pattern',
    tags:     ['Within role scope', 'Business hours', 'Known device'],
  },
  bulk_access: {
    score:    78,
    color:    'var(--red)',
    level:    'Critical',
    response: 'Alert raised — security team notified',
    tags:     ['80+ records in 5 mins', 'Far above baseline', 'Auto-escalated'],
  },
  offhours: {
    score:    62,
    color:    'var(--coral)',
    level:    'High',
    response: 'Session flagged — manager alerted',
    tags:     ['2:30 AM access', 'No scheduled task', 'Geo mismatch'],
  },
  sensitive: {
    score:    55,
    color:    'var(--amber)',
    level:    'Elevated',
    response: 'Access logged — compliance notified',
    tags:     ['Frozen account accessed', 'Outside assigned portfolio', 'Requires justification'],
  },
  export: {
    score:    85,
    color:    'var(--red)',
    level:    'Critical',
    response: 'Export blocked — DLP triggered',
    tags:     ['500MB bulk export', 'Unusual file type', 'Data exfiltration risk'],
  },
  lateral: {
    score:    90,
    color:    'var(--red)',
    level:    'Critical',
    response: 'Session terminated — IT security alerted',
    tags:     ['Cross-system access', 'Not in role scope', 'Potential breach indicator'],
  },
};

const TIME_BONUS = { offhours: 15, weekend: 8, business: 0 };

const LEVEL_BADGE = {
  Low:      'badge-green',
  Elevated: 'badge-amber',
  High:     'badge-coral',
  Critical: 'badge-red',
};

// ── Insider logic ─────────────────────────────────────────────────────────────

function runInsider() {
  const actionEl   = document.getElementById('ins-action');
  const action     = actionEl?.value;
  const time       = document.getElementById('ins-time')?.value;
  const empSelect  = document.getElementById('ins-user');
  const empText    = empSelect?.options[empSelect.selectedIndex]?.text || '';
  const empName    = empText.split(' — ')[0];
  const empRole    = empText.split(' — ')[1];
  const actionText = actionEl?.options[actionEl.selectedIndex]?.text || '';

  const config     = INSIDER_CONFIGS[action];
  if (!config) return;

  const bonus      = TIME_BONUS[time] || 0;
  const finalScore = Math.min(100, config.score + bonus);

  // Show result panel
  document.getElementById('ins-empty').style.display  = 'none';
  document.getElementById('ins-result').style.display = 'block';

  // Score ring
  updateScoreRing('ins-circle', 'ins-score-num', finalScore);

  const labelEl = document.getElementById('ins-score-label');
  if (labelEl) {
    labelEl.textContent = `${config.level} Risk`;
    labelEl.style.color = config.color;
  }

  // Detail panel
  const isHighRisk = config.score > 50;
  document.getElementById('ins-detail').innerHTML = `
    <div style="padding:12px;background:var(--surface2);border-radius:var(--r);
                margin-bottom:12px">
      <div style="font-size:11px;font-weight:600;color:var(--text-muted);
                  text-transform:uppercase;letter-spacing:0.07em;margin-bottom:8px">
        Detected Signals
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${config.tags.map(tag => `
          <span style="padding:3px 10px;border-radius:20px;font-size:11px;
                       border:1px solid var(--border-strong);color:var(--text-muted);
                       background:var(--surface)">
            ${tag}
          </span>
        `).join('')}
      </div>
    </div>
    <div style="padding:12px;border-radius:var(--r);
                background:${isHighRisk ? 'var(--red-light)' : 'var(--green-light)'};
                border:1px solid ${isHighRisk ? '#FECACA' : '#A7F3D0'}">
      <div style="font-size:11px;font-weight:600;color:var(--text-muted);
                  text-transform:uppercase;letter-spacing:0.07em;margin-bottom:4px">
        System Response
      </div>
      <div style="font-size:13px;font-weight:600;color:${config.color}">
        ${config.response}
      </div>
    </div>
  `;

  // Add to PAM log
  const tbody   = document.getElementById('ins-log');
  const oldRows = tbody.innerHTML.includes('No activity') ? '' : tbody.innerHTML;

  tbody.innerHTML = `
    <tr class="fade-in">
      <td>
        <div style="font-weight:600;color:var(--navy)">${empName}</div>
        <div style="font-size:11px;color:var(--text-muted)">${empRole}</div>
      </td>
      <td style="font-size:12px;color:var(--text)">${actionText}</td>
      <td style="font-size:11px;color:var(--text-muted)">
        ${new Date().toLocaleTimeString()}
      </td>
      <td>
        <span class="badge ${LEVEL_BADGE[config.level] || 'badge-navy'}">
          ${config.level}
        </span>
      </td>
      <td style="font-size:12px;color:${config.color};font-weight:500">
        ${config.response}
      </td>
    </tr>
    ${oldRows}
  `;

  toast(`Behavior analyzed: ${config.level} risk`, config.score > 50 ? 'error' : 'success');
}