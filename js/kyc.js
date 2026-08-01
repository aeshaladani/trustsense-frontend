// ── KYC page HTML ─────────────────────────────────────────────────────────────

function buildKYCHTML() {
  return `
    <div class="steps-wrap">
      <div class="step-item active">
        <div class="step-num">1</div> Personal Details
      </div>
      <div class="step-line"></div>
      <div class="step-item">
        <div class="step-num">2</div> Document Upload
      </div>
      <div class="step-line"></div>
      <div class="step-item">
        <div class="step-num">3</div> Liveness Check
      </div>
      <div class="step-line"></div>
      <div class="step-item">
        <div class="step-num">4</div> AI Verdict
      </div>
    </div>

    <div class="grid-2" style="gap:24px">

      <!-- Left: form -->
      <div>
        <div class="card mb-16">
          <div class="card-title" style="margin-bottom:16px">Personal Information</div>
          <div class="input-group">
            <label class="input-label">Full Name</label>
            <input class="input" id="kyc-name" value="Arjun Sharma"/>
          </div>
          <div class="input-group">
            <label class="input-label">Date of Birth</label>
            <input class="input" id="kyc-dob" type="date" value="1990-06-15"/>
          </div>
        </div>

        <div class="card mb-16">
          <div class="card-title" style="margin-bottom:16px">Document Verification</div>
          <div class="input-group">
            <label class="input-label">Document Type</label>
            <select class="input select" id="kyc-doctype">
              <option value="aadhaar">Aadhaar Card</option>
              <option value="pan">PAN Card</option>
              <option value="passport">Passport</option>
              <option value="driving">Driving Licence</option>
            </select>
          </div>
          <div class="input-group">
            <label class="input-label">Document Number</label>
            <input class="input" id="kyc-docnum" value="ABCDE1234F"/>
          </div>
          <div style="padding:20px;border:1px dashed var(--border-strong);
                      border-radius:var(--r);text-align:center;color:var(--text-muted)">
            <div style="font-size:28px;margin-bottom:8px">📄</div>
            <div style="font-size:13px;font-weight:500">Document upload simulated</div>
            <div style="font-size:11px;margin-top:4px">
              AI scans authenticity, holograms & metadata
            </div>
          </div>
        </div>

        <div class="card mb-16">
          <div class="card-title" style="margin-bottom:16px">Liveness & Face Match</div>
          <div style="display:flex;gap:12px;margin-bottom:16px">
            <div style="flex:1;padding:20px;border:1px dashed var(--border-strong);
                        border-radius:var(--r);text-align:center;color:var(--text-muted)">
              <div style="font-size:28px;margin-bottom:6px">🤳</div>
              <div style="font-size:12px">Selfie captured</div>
            </div>
            <div style="flex:1;padding:20px;border:1px dashed var(--border-strong);
                        border-radius:var(--r);text-align:center;color:var(--text-muted)">
              <div style="font-size:28px;margin-bottom:6px">👁️</div>
              <div style="font-size:12px">Liveness check</div>
            </div>
          </div>
          <div class="input-group" style="margin-bottom:0">
            <label class="input-label">Simulate Scenario</label>
            <select class="input select" id="kyc-scenario">
              <option value="clean">Genuine applicant — all checks pass</option>
              <option value="low_liveness">Liveness failure — possible deepfake</option>
              <option value="doc_mismatch">Document anomaly detected</option>
              <option value="all_fail">High-risk — multiple failures</option>
            </select>
          </div>
        </div>

        <button class="btn btn-primary w-full btn-lg" onclick="runKYC()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2">
            <polyline points="9 11 12 14 22 4"/>
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
          </svg>
          Run AI Verification
        </button>
      </div>

      <!-- Right: results -->
      <div class="card">
        <div class="card-title" style="margin-bottom:16px">Verification Analysis</div>
        <div id="kyc-result-empty" style="padding:48px 0;text-align:center;color:var(--text-muted);font-size:13px">
          Submit the form to see AI verification results
        </div>
        <div id="kyc-result" style="display:none">
          <div id="kyc-scores" style="display:flex;flex-direction:column;gap:14px"></div>
          <div id="kyc-flags"  style="margin-top:12px"></div>
          <div id="kyc-verdict"></div>
        </div>
      </div>

    </div>
  `;
}

// ── KYC logic ─────────────────────────────────────────────────────────────────

async function runKYC() {
  const name     = document.getElementById('kyc-name')?.value;
  const dob      = document.getElementById('kyc-dob')?.value;
  const docType  = document.getElementById('kyc-doctype')?.value;
  const docNum   = document.getElementById('kyc-docnum')?.value;
  const scenario = document.getElementById('kyc-scenario')?.value;

  if (!name || !docNum) {
    toast('Fill in all required fields', 'error');
    return;
  }

  try {
    let result;

    if (DEMO_MODE || !isBackendLive) {
      result = mockKYCSubmit(name, docType, scenario);
    } else {
      const scores = {
        clean:        { liveness: 0.96, selfie: 0.94 },
        low_liveness: { liveness: 0.45, selfie: 0.88 },
        doc_mismatch: { liveness: 0.88, selfie: 0.72 },
        all_fail:     { liveness: 0.40, selfie: 0.55 },
      }[scenario] || { liveness: 0.9, selfie: 0.9 };

      result = await apiKYCSubmit({
        full_name:       name,
        dob,
        document_type:   docType,
        document_number: scenario === 'all_fail' ? '000FAKE999' : docNum,
        liveness_score:  scores.liveness,
        selfie_score:    scores.selfie,
      });
    }

    renderKYCResult(result);
    toast('KYC verification complete', 'success');

  } catch (e) {
    toast('KYC failed — ' + e.message, 'error');
  }
}

function renderKYCResult(data) {
  document.getElementById('kyc-result-empty').style.display = 'none';
  document.getElementById('kyc-result').style.display       = 'block';

  // Score bars
  document.getElementById('kyc-scores').innerHTML = [
    { label: 'Document Authenticity', score: data.doc_score      },
    { label: 'Liveness Detection',    score: data.liveness_score },
    { label: 'Face Match Score',       score: data.selfie_score   },
    { label: 'Overall Confidence',     score: data.overall_score  },
  ].map(item => `
    <div>
      <div style="font-size:12px;color:var(--text-muted);
                  font-weight:500;margin-bottom:5px">
        ${item.label}
      </div>
      ${buildScoreBar(item.score)}
    </div>
  `).join('');

  // Flags
  document.getElementById('kyc-flags').innerHTML = (data.flags || []).map(f => `
    <div class="kyc-flag ${f.severity === 'medium' ? 'medium' : ''}">
      ⚑ ${f.label}
    </div>
  `).join('');

  // Verdict
  const verdictMap = {
    approved: {
      icon:  '✅',
      title: 'Approved',
      sub:   'Identity verified — account creation permitted',
      cls:   'approved',
    },
    review: {
      icon:  '⚠️',
      title: 'Manual Review Required',
      sub:   'Flagged signals require human analyst review',
      cls:   'review',
    },
    rejected: {
      icon:  '❌',
      title: 'Rejected',
      sub:   'Multiple high-risk signals — application blocked',
      cls:   'rejected',
    },
  };

  const v = verdictMap[data.verdict] || verdictMap.review;
  document.getElementById('kyc-verdict').innerHTML = `
    <div class="verdict-box ${v.cls}">
      <div class="verdict-icon">${v.icon}</div>
      <div class="verdict-title">${v.title}</div>
      <div class="verdict-sub">${v.sub}</div>
    </div>
  `;
}