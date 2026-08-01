// ── Dashboard page HTML ───────────────────────────────────────────────────────

function buildDashboardHTML() {
  return `
    <div class="grid-4 mb-20">
      <div class="metric-card">
        <div class="metric-val" id="d-total">—</div>
        <div class="metric-label">Total Sessions</div>
      </div>
      <div class="metric-card">
        <div class="metric-val danger" id="d-flagged">—</div>
        <div class="metric-label">High Risk Flagged</div>
      </div>
      <div class="metric-card">
        <div class="metric-val warning" id="d-mfa">—</div>
        <div class="metric-label">MFA Triggered</div>
      </div>
      <div class="metric-card">
        <div class="metric-val success" id="d-kyc">—</div>
        <div class="metric-label">KYC Submissions</div>
      </div>
    </div>

    <div class="grid-2 mb-20">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Active Sessions — Risk Distribution</span>
          <div class="live-badge">
            <span class="live-dot pulse"></span> Live
          </div>
        </div>
        <div id="d-sessions-list">
          ${emptyState('No sessions yet — start a login flow')}
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">Recent Flagged Events</span>
        </div>
        <div id="d-flagged-list">
          ${emptyState('No flagged events yet')}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <span class="card-title">KYC Submissions Log</span>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Document</th>
              <th>Doc Score</th>
              <th>Liveness</th>
              <th>Face Match</th>
              <th>Overall</th>
              <th>Verdict</th>
            </tr>
          </thead>
          <tbody id="d-kyc-tbody">
            <tr>
              <td colspan="7" class="text-center text-muted" style="padding:24px">
                No KYC submissions yet
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// ── Dashboard data loader ─────────────────────────────────────────────────────

async function loadDashboard() {
  let data;

  if (DEMO_MODE || !isBackendLive) {
    data = mockGetDashboard();
  } else {
    try {
      data = await apiGetDashboard();
    } catch (e) {
      data = mockGetDashboard();
      console.warn('[dashboard] fell back to mock:', e.message);
    }
  }

  renderDashboard(data);
}

function renderDashboard(data) {
  const { stats, sessions, flagged_sessions, kyc_submissions } = data;

  // Metric cards
  setEl('d-total',   stats.total_sessions);
  setEl('d-flagged', stats.flagged);
  setEl('d-mfa',     stats.mfa_triggered);
  setEl('d-kyc',     stats.kyc_submissions);

  // Sessions list
  const sessionsList = document.getElementById('d-sessions-list');
  if (sessionsList) {
    sessionsList.innerHTML = !sessions.length
      ? emptyState('No sessions yet — start a login flow')
      : sessions.map(s => `
          <div style="display:flex;align-items:center;justify-content:space-between;
                      padding:12px 14px;background:var(--surface2);
                      border-radius:var(--r);margin-bottom:8px;
                      border-left:3px solid ${getScoreColor(s.trust_score)}">
            <div>
              <div style="font-size:13px;font-weight:600;color:var(--navy)">
                ${s.user.name}
              </div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px">
                ${s.user.account} &nbsp;·&nbsp; ${s.event_count} event(s)
                &nbsp;·&nbsp; ${s.user.role}
              </div>
            </div>
            <div style="text-align:right">
              ${getRiskBadge(s.risk)}
              <div class="font-mono fw-700 mt-8"
                   style="font-size:20px;color:${getScoreColor(s.trust_score)}">
                ${Math.round(s.trust_score)}
              </div>
            </div>
          </div>
        `).join('');
  }

  // Flagged list
  const flaggedList = document.getElementById('d-flagged-list');
  if (flaggedList) {
    flaggedList.innerHTML = !flagged_sessions.length
      ? emptyState('No flagged events yet')
      : [...flagged_sessions].reverse().map(f => `
          <div style="padding:12px 14px;background:var(--red-light);
                      border:1px solid #FECACA;border-radius:var(--r);
                      margin-bottom:8px">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span style="font-size:13px;font-weight:600;color:var(--navy)">
                ${f.user?.name || 'Unknown'}
              </span>
              ${getRiskBadge(f.risk)}
            </div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px">
              ${f.top_event || ''}
            </div>
          </div>
        `).join('');
  }

  // KYC table
  const tbody = document.getElementById('d-kyc-tbody');
  if (tbody) {
    if (!kyc_submissions.length) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="text-center text-muted" style="padding:24px">
            No KYC submissions yet
          </td>
        </tr>`;
    } else {
      const verdictClass = { approved: 'badge-green', review: 'badge-amber', rejected: 'badge-red' };
      tbody.innerHTML = [...kyc_submissions].reverse().map(k => `
        <tr>
          <td style="font-weight:500">${k.name}</td>
          <td class="text-muted">${k.document_type}</td>
          <td>
            <span class="font-mono" style="color:${getScoreColor(k.doc_score)}">
              ${k.doc_score}%
            </span>
          </td>
          <td>
            <span class="font-mono" style="color:${getScoreColor(k.liveness_score)}">
              ${k.liveness_score}%
            </span>
          </td>
          <td>
            <span class="font-mono" style="color:${getScoreColor(k.selfie_score)}">
              ${k.selfie_score}%
            </span>
          </td>
          <td>
            <strong class="font-mono" style="color:${getScoreColor(k.overall_score)}">
              ${k.overall_score}%
            </strong>
          </td>
          <td>
            <span class="badge ${verdictClass[k.verdict] || 'badge-navy'}">
              ${k.verdict}
            </span>
          </td>
        </tr>
      `).join('');
    }
  }
}

// ── Utility ───────────────────────────────────────────────────────────────────

function emptyState(text) {
  return `
    <div class="text-center text-muted" style="padding:28px 0;font-size:13px">
      ${text}
    </div>
  `;
}

function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? '—';
}