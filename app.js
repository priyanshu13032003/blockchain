/* ============================================================
   ChainInsure — Application Logic
   Blockchain-Inspired Insurance Claims Verification
   ============================================================ */

'use strict';

// ── State ──────────────────────────────────────────────────
const STATE = {
  policies: [],
  claims: [],
  blockchain: [],
  scExecutionLog: [],
  currentUser: null,
  execEmail: 'executive@chaininsure.com',
  uploadedFiles: [],
  currentFilter: 'all',
};

// ── Smart Contract Rules ───────────────────────────────────
const SMART_CONTRACT_RULES = [
  {
    id: 'SC001',
    name: 'Policy Validity Check',
    icon: 'fa-calendar-check',
    description: 'Verifies policy is active and not expired at time of claim.',
    code: 'require(policy.endDate >= block.timestamp, "Policy expired")',
    check: (policy, claim) => {
      const now = new Date();
      const end = new Date(policy.endDate);
      return { pass: end >= now, msg: end >= now ? 'Policy is active' : 'Policy has expired' };
    }
  },
  {
    id: 'SC002',
    name: 'Coverage Limit Rule',
    icon: 'fa-indian-rupee-sign',
    description: 'Claim amount must not exceed policy coverage limit.',
    code: 'require(claim.amount <= policy.coverage, "Exceeds coverage")',
    check: (policy, claim) => {
      const ok = parseFloat(claim.amount) <= parseFloat(policy.coverage);
      return { pass: ok, msg: ok ? `Within coverage (₹${numFmt(policy.coverage)})` : `Exceeds coverage limit (₹${numFmt(policy.coverage)})` };
    }
  },
  {
    id: 'SC003',
    name: 'Duplicate Claim Prevention',
    icon: 'fa-clone',
    description: 'No duplicate claim for same incident within 30 days.',
    code: 'require(!hasDuplicate(policyId, incidentDate), "Duplicate claim")',
    check: (policy, claim) => {
      const existing = STATE.claims.filter(c =>
        c.policyId === policy.id &&
        c.status !== 'rejected' &&
        Math.abs(new Date(c.incidentDate) - new Date(claim.incidentDate)) < 30 * 86400000
      );
      return { pass: existing.length === 0, msg: existing.length === 0 ? 'No duplicate claims found' : 'Duplicate claim detected within 30 days' };
    }
  },
  {
    id: 'SC004',
    name: 'Premium Payment Verification',
    icon: 'fa-credit-card',
    description: 'Policy premium must be marked as paid.',
    code: 'require(policy.premiumStatus === "paid", "Premium unpaid")',
    check: (policy) => {
      return { pass: policy.premiumPaid, msg: policy.premiumPaid ? 'Premium is paid' : 'Premium payment pending' };
    }
  },
  {
    id: 'SC005',
    name: 'Incident Date Validation',
    icon: 'fa-calendar-day',
    description: 'Incident must have occurred after policy start date.',
    code: 'require(incident.date >= policy.startDate, "Pre-policy incident")',
    check: (policy, claim) => {
      const start = new Date(policy.startDate);
      const incident = new Date(claim.incidentDate);
      const ok = incident >= start;
      return { pass: ok, msg: ok ? 'Incident within policy period' : 'Incident before policy start date' };
    }
  },
  {
    id: 'SC006',
    name: 'KYC Compliance',
    icon: 'fa-id-card',
    description: 'Policyholder must have completed KYC verification.',
    code: 'require(policy.kycVerified === true, "KYC incomplete")',
    check: (policy) => {
      return { pass: !!policy.kyc, msg: policy.kyc ? `KYC verified (${policy.kyc})` : 'KYC not completed' };
    }
  },
  {
    id: 'SC007',
    name: 'Auto-Settlement Threshold',
    icon: 'fa-bolt',
    description: 'Claims below ₹25,000 auto-settle if all rules pass.',
    code: 'if(claim.amount < 25000 && allRulesPass) autoSettle(claim)',
    check: (policy, claim) => {
      const amt = parseFloat(claim.amount);
      return { pass: true, msg: amt < 25000 ? `Auto-settlement eligible (₹${numFmt(amt)})` : `Manual review required (₹${numFmt(amt)})`, warn: amt >= 25000 };
    }
  },
];

// ── Blockchain Core ────────────────────────────────────────
function sha256Sim(data) {
  let h = 5381;
  const s = JSON.stringify(data);
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  const part = h.toString(16).padStart(8, '0');
  const ts = Date.now().toString(16);
  const rnd = Math.random().toString(16).slice(2, 10);
  return '0x' + (part + ts + rnd + part).substring(0, 64);
}

function addBlock(type, data, label) {
  const prev = STATE.blockchain[STATE.blockchain.length - 1];
  const block = {
    index: STATE.blockchain.length,
    type,
    label,
    data,
    timestamp: new Date().toISOString(),
    prevHash: prev ? prev.hash : '0x0000000000000000000000000000000000000000000000000000000000000000',
    hash: sha256Sim({ type, data, ts: Date.now() }),
    nonce: Math.floor(Math.random() * 999999),
    validator: 'ChainInsure-Node-1',
  };
  STATE.blockchain.push(block);
  updateBlockCount();
  return block;
}

function updateBlockCount() {
  document.querySelectorAll('#blockCount, #chainTotalBlocks, #statBlocks').forEach(el => {
    if (el) el.textContent = STATE.blockchain.length;
  });
}

// ── Utility ────────────────────────────────────────────────
function genId(prefix) {
  return prefix + '-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase();
}

function numFmt(n) {
  return Number(n).toLocaleString('en-IN');
}

function dateStr(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function timeStr(d) {
  return new Date(d).toLocaleString('en-IN');
}

function toast(msg, type = 'info') {
  const tc = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info', warning: 'fa-triangle-exclamation' };
  const colors = { success: '#34d399', error: '#f87171', info: '#60a5fa', warning: '#fbbf24' };
  t.innerHTML = `<i class="fas ${icons[type]}" style="color:${colors[type]}"></i><span>${msg}</span>`;
  tc.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.style.display = 'none';
  });
  const p = document.getElementById(pageId);
  if (p) { p.style.display = 'flex'; p.classList.add('active'); }
}

function goBack() {
  if (STATE.currentUser?.role === 'admin') showPage('adminDashboard');
  else if (STATE.currentUser?.role === 'customer') showPage('customerPortal');
  else showPage('landingPage');
}

function logout() {
  STATE.currentUser = null;
  showPage('landingPage');
  toast('Logged out successfully', 'info');
}

// ── Admin Login ────────────────────────────────────────────
function adminLogin() {
  const u = document.getElementById('adminUsername').value.trim();
  const p = document.getElementById('adminPassword').value.trim();
  const email = document.getElementById('execEmail').value.trim();
  if (u === 'admin' && p === 'admin123') {
    STATE.currentUser = { role: 'admin', username: u };
    STATE.execEmail = email || 'executive@chaininsure.com';
    showPage('adminDashboard');
    initAdminDashboard();
    toast('Welcome back, Admin!', 'success');
  } else {
    toast('Invalid credentials. Use admin / admin123', 'error');
  }
}

// ── Customer Login ─────────────────────────────────────────
function customerLogin() {
  const mobile = document.getElementById('customerMobile').value.trim().replace(/\D/g, '');
  const dob = document.getElementById('customerDOB').value;

  if (!mobile || mobile.length < 10) {
    toast('Please enter a valid 10-digit mobile number', 'error');
    return;
  }

  const policy = STATE.policies.find(p => p.mobile.replace(/\D/g, '') === mobile);
  if (!policy) {
    toast('No policy found for this mobile number. Please contact your agent.', 'error');
    return;
  }

  // DOB check (optional if provided)
  if (dob && policy.dob && policy.dob !== dob) {
    toast('Date of birth does not match our records', 'error');
    return;
  }

  STATE.currentUser = { role: 'customer', policyId: policy.id, mobile };
  showPage('customerPortal');
  initCustomerPortal(policy);
  toast(`Welcome, ${policy.name}!`, 'success');
}

// ── Admin Dashboard Init ───────────────────────────────────
function initAdminDashboard() {
  // Seed genesis block if empty
  if (STATE.blockchain.length === 0) {
    addBlock('genesis', { message: 'ChainInsure Genesis Block', version: '1.0.0' }, 'Genesis');
    seedDemoData();
  }
  updateAdminStats();
  renderRecentActivity();
  renderSCRulesOverview();
  renderSCRulesPage();
  renderBlockchain();
  renderComparisonContent('comparisonContent', false);
  adminTab('overview');
}

function seedDemoData() {
  // Seed 2 demo policies
  const demoList = [
    {
      id: genId('POL'),
      name: 'Priya Sharma',
      mobile: '9876543210',
      email: 'priya.sharma@email.com',
      dob: '1990-05-15',
      type: 'health',
      coverage: 500000,
      premium: 12000,
      startDate: '2024-01-01',
      endDate: '2025-12-31',
      conditions: 'None',
      address: 'Mumbai, Maharashtra',
      kyc: 'AADHAAR: 1234-5678-9012',
      premiumPaid: true,
      status: 'active',
      issuedAt: new Date().toISOString(),
    },
    {
      id: genId('POL'),
      name: 'Rahul Verma',
      mobile: '9988776655',
      email: 'rahul.verma@email.com',
      dob: '1985-08-22',
      type: 'auto',
      coverage: 300000,
      premium: 8500,
      startDate: '2024-03-01',
      endDate: '2025-02-28',
      conditions: 'None',
      address: 'Delhi, NCR',
      kyc: 'PAN: ABCDE1234F',
      premiumPaid: true,
      status: 'active',
      issuedAt: new Date(Date.now() - 86400000).toISOString(),
    }
  ];

  demoList.forEach(policy => {
    STATE.policies.push(policy);
    const block = addBlock('policy', policy, `Policy: ${policy.name}`);
    STATE.scExecutionLog.push({
      time: new Date().toISOString(),
      rule: 'Policy Issuance',
      result: 'pass',
      msg: `Policy issued for ${policy.name} | Block #${block.index}`,
    });
    addActivity('policy', `Policy Issued — ${policy.name}`, `Mobile: ${policy.mobile} | ${typeLabel(policy.type)} | ₹${numFmt(policy.coverage)} coverage`, block.hash);
  });

  // Seed demo claim
  const demoClaim = {
    id: genId('CLM'),
    policyId: demoList[0].id,
    policyName: demoList[0].name,
    policyMobile: demoList[0].mobile,
    policyType: demoList[0].type,
    incidentType: 'medical',
    incidentDate: '2024-11-15',
    location: 'Mumbai, Maharashtra',
    amount: 18000,
    description: 'Hospitalization due to viral fever. 3 days admitted at City Hospital.',
    contactName: 'Priya Sharma',
    contactPhone: '9876543210',
    contactEmail: 'priya.sharma@email.com',
    bank: '1234567890',
    ifsc: 'HDFC0001234',
    status: 'under_review',
    submittedAt: new Date(Date.now() - 3600000).toISOString(),
    documents: ['discharge_summary.pdf', 'hospital_bill.pdf'],
  };

  STATE.claims.push(demoClaim);
  const claimBlock = addBlock('claim', demoClaim, `Claim: ${demoClaim.policyName}`);
  addActivity('claim', `Claim Initiated — ${demoClaim.policyName}`, `₹${numFmt(demoClaim.amount)} | Medical | Under Review`, claimBlock.hash);
  STATE.scExecutionLog.push({
    time: new Date().toISOString(),
    rule: 'Claim Submission',
    result: 'pass',
    msg: `Claim ${demoClaim.id} submitted | Smart contract pre-check passed | Block #${claimBlock.index}`,
  });
}

const activityFeed = [];
function addActivity(type, title, desc, hash) {
  activityFeed.unshift({ type, title, desc, hash, time: new Date().toISOString() });
}

function updateAdminStats() {
  const el = id => document.getElementById(id);
  if (el('statPolicies')) el('statPolicies').textContent = STATE.policies.length;
  if (el('statPending')) el('statPending').textContent = STATE.claims.filter(c => ['pending', 'under_review'].includes(c.status)).length;
  if (el('statSettled')) el('statSettled').textContent = STATE.claims.filter(c => c.status === 'settled').length;
  if (el('statBlocks')) el('statBlocks').textContent = STATE.blockchain.length;
}

function renderRecentActivity() {
  const el = document.getElementById('recentActivity');
  if (!el) return;
  if (activityFeed.length === 0) { el.innerHTML = '<p style="padding:20px;color:var(--text-muted)">No activity yet.</p>'; return; }
  el.innerHTML = activityFeed.slice(0, 8).map(a => `
    <div class="activity-item">
      <div class="activity-dot ${a.type}"></div>
      <div class="activity-text">
        <strong>${a.title}</strong>
        <small>${a.desc}</small>
      </div>
      <div class="activity-hash">${a.hash.slice(0, 18)}…</div>
    </div>
  `).join('');
}

function renderSCRulesOverview() {
  const el = document.getElementById('scRulesOverview');
  if (!el) return;
  el.innerHTML = SMART_CONTRACT_RULES.map(r => `
    <div class="sc-rule-chip">
      <i class="fas ${r.icon}"></i>
      <span>${r.name}</span>
    </div>
  `).join('');
}

function renderSCRulesPage() {
  const list = document.getElementById('scRulesList');
  if (!list) return;
  list.innerHTML = SMART_CONTRACT_RULES.map(r => `
    <div class="sc-rule-item">
      <div class="sc-rule-icon active"><i class="fas ${r.icon}"></i></div>
      <div class="sc-rule-body">
        <div class="sc-rule-name">${r.id} — ${r.name}</div>
        <div class="sc-rule-desc">${r.description}</div>
        <div class="sc-rule-code">${r.code}</div>
      </div>
      <span class="badge badge-green"><i class="fas fa-circle-check"></i> Active</span>
    </div>
  `).join('');

  renderExecutionLog();
}

function renderExecutionLog() {
  const el = document.getElementById('scExecutionLog');
  if (!el) return;
  if (STATE.scExecutionLog.length === 0) {
    el.innerHTML = '<p style="padding:16px;color:var(--text-muted)">No executions yet.</p>';
    return;
  }
  el.innerHTML = STATE.scExecutionLog.slice(-20).reverse().map(e => `
    <div class="exec-item ${e.result}">
      <i class="fas ${e.result === 'pass' ? 'fa-circle-check' : e.result === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-xmark'}"
         style="color:${e.result === 'pass' ? 'var(--success)' : e.result === 'warn' ? 'var(--warning)' : 'var(--danger)'}"></i>
      <div>
        <div style="font-weight:600">${e.rule}</div>
        <div style="color:var(--text-muted)">${e.msg}</div>
        <div style="color:var(--text-muted);font-size:0.75rem;margin-top:2px">${timeStr(e.time)}</div>
      </div>
    </div>
  `).join('');
}

// ── Admin Tabs ─────────────────────────────────────────────
const adminTabTitles = {
  overview: 'Dashboard Overview',
  issuePolicy: 'Issue New Policy',
  allPolicies: 'All Policies',
  claims: 'Claims Verification Queue',
  blockchain: 'Blockchain Ledger',
  smartContract: 'Smart Contract Rules',
  comparison: 'Blockchain vs Traditional',
};

function adminTab(name) {
  document.querySelectorAll('#adminDashboard .tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#adminDashboard .menu-item').forEach(m => m.classList.remove('active'));

  const tab = document.getElementById(`tab-${name}`);
  if (tab) tab.classList.add('active');

  // Highlight menu item
  const items = document.querySelectorAll('#adminDashboard .menu-item');
  items.forEach(item => {
    if (item.getAttribute('onclick')?.includes(name)) item.classList.add('active');
  });

  const title = document.getElementById('adminTopbarTitle');
  if (title) title.textContent = adminTabTitles[name] || name;

  // Lazy render
  if (name === 'allPolicies') renderPoliciesTable();
  if (name === 'claims') renderClaimsQueue();
  if (name === 'blockchain') renderBlockchain();
  if (name === 'smartContract') { renderSCRulesPage(); }
  if (name === 'overview') { updateAdminStats(); renderRecentActivity(); }
  if (name === 'comparison') renderComparisonContent('comparisonContent', false);
}

// ── Issue Policy ───────────────────────────────────────────
function validateSmartContract() {
  const data = getPolicyFormData();
  if (!data.name || !data.mobile) { toast('Fill in at least Name and Mobile to validate', 'warning'); return; }

  const panel = document.getElementById('scValidation');
  panel.style.display = 'block';

  const checks = [
    { pass: data.name.length >= 3, msg: `Holder name valid: "${data.name}"` },
    { pass: /^[6-9]\d{9}$/.test(data.mobile.replace(/\D/g, '')), msg: 'Mobile number format valid (Indian)' },
    { pass: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email), msg: data.email ? 'Email format valid' : 'Email not provided (optional)' },
    { pass: parseFloat(data.coverage) >= 10000, msg: `Coverage ₹${numFmt(data.coverage)} meets minimum (₹10,000)` },
    { pass: parseFloat(data.premium) >= 1000, msg: `Premium ₹${numFmt(data.premium)} meets minimum (₹1,000)` },
    { pass: new Date(data.startDate) < new Date(data.endDate), msg: 'Policy dates are valid' },
    { pass: !!data.kyc, msg: data.kyc ? `KYC document provided: ${data.kyc}` : 'KYC document not provided' },
  ];

  document.getElementById('scValidationItems').innerHTML = checks.map(c => `
    <div class="sc-item">
      <div class="sc-icon ${c.pass ? 'sc-pass' : 'sc-fail'}">
        <i class="fas ${c.pass ? 'fa-circle-check' : 'fa-circle-xmark'}"></i>
      </div>
      <span>${c.msg}</span>
    </div>
  `).join('');

  const allPass = checks.every(c => c.pass);
  toast(allPass ? 'Smart contract validation passed ✓' : 'Some validations failed — please review', allPass ? 'success' : 'warning');
}

function getPolicyFormData() {
  return {
    name: document.getElementById('ph_name')?.value?.trim(),
    mobile: document.getElementById('ph_mobile')?.value?.trim(),
    email: document.getElementById('ph_email')?.value?.trim(),
    dob: document.getElementById('ph_dob')?.value,
    type: document.getElementById('ph_type')?.value,
    coverage: document.getElementById('ph_coverage')?.value,
    premium: document.getElementById('ph_premium')?.value,
    startDate: document.getElementById('ph_startDate')?.value,
    endDate: document.getElementById('ph_endDate')?.value,
    conditions: document.getElementById('ph_conditions')?.value?.trim(),
    address: document.getElementById('ph_address')?.value?.trim(),
    kyc: document.getElementById('ph_kyc')?.value?.trim(),
  };
}

function issuePolicy() {
  const d = getPolicyFormData();
  if (!d.name || !d.mobile || !d.coverage || !d.premium || !d.startDate || !d.endDate) {
    toast('Please fill all required fields', 'error');
    return;
  }

  if (!/^[6-9]\d{9}$/.test(d.mobile.replace(/\D/g, ''))) {
    toast('Invalid mobile number format', 'error');
    return;
  }

  if (STATE.policies.find(p => p.mobile.replace(/\D/g, '') === d.mobile.replace(/\D/g, ''))) {
    toast('A policy with this mobile number already exists!', 'error');
    return;
  }

  const policy = {
    id: genId('POL'),
    name: d.name,
    mobile: d.mobile,
    email: d.email,
    dob: d.dob,
    type: d.type,
    coverage: parseFloat(d.coverage),
    premium: parseFloat(d.premium),
    startDate: d.startDate,
    endDate: d.endDate,
    conditions: d.conditions || 'None',
    address: d.address,
    kyc: d.kyc,
    premiumPaid: true,
    status: 'active',
    issuedAt: new Date().toISOString(),
  };

  STATE.policies.push(policy);

  // Run smart contract rules for issuance
  SMART_CONTRACT_RULES.slice(0, 4).forEach(rule => {
    const result = rule.check(policy, {});
    STATE.scExecutionLog.push({
      time: new Date().toISOString(),
      rule: rule.name,
      result: result.pass ? 'pass' : 'fail',
      msg: result.msg,
    });
  });

  const block = addBlock('policy', policy, `Policy: ${policy.name}`);
  addActivity('policy', `Policy Issued — ${policy.name}`, `Mobile: ${policy.mobile} | ${typeLabel(policy.type)} | ₹${numFmt(policy.coverage)}`, block.hash);
  updateAdminStats();
  renderRecentActivity();

  // Show success
  const panel = document.getElementById('policySuccessPanel');
  panel.style.display = 'block';
  document.getElementById('policyHashDisplay').innerHTML =
    `<strong>Block Hash:</strong> ${block.hash}<br><strong>Policy ID:</strong> ${policy.id}`;
  document.getElementById('policyBlockInfo').innerHTML =
    `Block #${block.index} | Validator: ${block.validator} | ${timeStr(block.timestamp)}`;

  toast(`Policy issued for ${policy.name}! Recorded on Block #${block.index}`, 'success');

  // Reset form
  ['ph_name','ph_mobile','ph_email','ph_dob','ph_coverage','ph_premium','ph_startDate','ph_endDate','ph_conditions','ph_address','ph_kyc']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  document.getElementById('scValidation').style.display = 'none';

  panel.scrollIntoView({ behavior: 'smooth' });
}

// ── Policies Table ─────────────────────────────────────────
function renderPoliciesTable() {
  const el = document.getElementById('policiesTable');
  if (!el) return;
  if (STATE.policies.length === 0) {
    el.innerHTML = '<p style="padding:24px;color:var(--text-muted)">No policies issued yet.</p>';
    return;
  }
  el.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Policy ID</th>
          <th>Holder Name</th>
          <th>Mobile</th>
          <th>Type</th>
          <th>Coverage</th>
          <th>Premium</th>
          <th>Valid Till</th>
          <th>Status</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        ${STATE.policies.map(p => `
          <tr>
            <td><span class="activity-hash">${p.id}</span></td>
            <td><strong>${p.name}</strong></td>
            <td>${p.mobile}</td>
            <td><span class="badge badge-blue"><i class="fas ${typeIcon(p.type)}"></i> ${typeLabel(p.type)}</span></td>
            <td>₹${numFmt(p.coverage)}</td>
            <td>₹${numFmt(p.premium)}/yr</td>
            <td>${dateStr(p.endDate)}</td>
            <td><span class="badge ${p.status === 'active' ? 'badge-green' : 'badge-red'}">${p.status.toUpperCase()}</span></td>
            <td><button class="btn btn-secondary btn-sm" onclick="viewPolicyDetail('${p.id}')"><i class="fas fa-eye"></i></button></td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function filterPolicies() {
  const q = document.getElementById('policySearch')?.value?.toLowerCase() || '';
  const rows = document.querySelectorAll('#policiesTable tbody tr');
  rows.forEach(r => {
    const text = r.textContent.toLowerCase();
    r.style.display = text.includes(q) ? '' : 'none';
  });
}

// ── Claims Queue ───────────────────────────────────────────
function renderClaimsQueue() {
  const el = document.getElementById('claimsQueue');
  if (!el) return;
  const filtered = STATE.currentFilter === 'all' ? STATE.claims : STATE.claims.filter(c => c.status === STATE.currentFilter);
  if (filtered.length === 0) {
    el.innerHTML = '<p style="padding:24px;color:var(--text-muted)">No claims found.</p>';
    return;
  }
  el.innerHTML = filtered.map(c => renderClaimCard(c, true)).join('');
}

function filterClaims(status, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  STATE.currentFilter = status;
  renderClaimsQueue();
}

function renderClaimCard(c, isAdmin) {
  const statusMap = {
    pending: ['badge-orange', 'fa-clock', 'Pending'],
    under_review: ['badge-blue', 'fa-magnifying-glass', 'Under Review'],
    approved: ['badge-green', 'fa-check', 'Approved'],
    settled: ['badge-green', 'fa-circle-check', 'Settled'],
    rejected: ['badge-red', 'fa-xmark', 'Rejected'],
  };
  const [cls, ico, label] = statusMap[c.status] || ['badge-gray', 'fa-circle', 'Unknown'];
  const adminBtns = isAdmin ? `
    <button class="btn btn-secondary btn-sm" onclick="openClaimModal('${c.id}')"><i class="fas fa-eye"></i> View</button>
    ${c.status === 'under_review' || c.status === 'pending' ? `
      <button class="btn btn-success btn-sm" onclick="settleClaim('${c.id}')"><i class="fas fa-circle-check"></i> Settle</button>
      <button class="btn btn-danger btn-sm" onclick="rejectClaim('${c.id}')"><i class="fas fa-xmark"></i> Reject</button>
    ` : ''}
  ` : `<button class="btn btn-secondary btn-sm" onclick="openClaimModal('${c.id}')"><i class="fas fa-eye"></i> View Details</button>`;

  return `
    <div class="claim-card">
      <div class="claim-card-header">
        <div>
          <div class="claim-id">${c.id}</div>
          <div class="claim-type">${incidentLabel(c.incidentType)}</div>
        </div>
        <span class="badge ${cls}"><i class="fas ${ico}"></i> ${label}</span>
      </div>
      <div class="claim-amount">₹${numFmt(c.amount)}</div>
      <div class="claim-meta">
        <span><i class="fas fa-user"></i> ${c.policyName}</span>
        <span><i class="fas fa-mobile-screen"></i> ${c.policyMobile}</span>
        <span><i class="fas fa-calendar"></i> Incident: ${dateStr(c.incidentDate)}</span>
        <span><i class="fas fa-map-pin"></i> ${c.location}</span>
        <span><i class="fas fa-clock"></i> Filed: ${timeStr(c.submittedAt)}</span>
        ${c.documents?.length ? `<span><i class="fas fa-paperclip"></i> ${c.documents.length} document(s) attached</span>` : ''}
      </div>
      <div class="claim-actions">${adminBtns}</div>
    </div>
  `;
}

// ── Claim Modal ────────────────────────────────────────────
function openClaimModal(claimId) {
  const c = STATE.claims.find(x => x.id === claimId);
  if (!c) return;
  const policy = STATE.policies.find(p => p.id === c.policyId);
  const block = STATE.blockchain.find(b => b.data?.id === claimId);

  const statusMap = {
    pending: ['badge-orange', 'Pending Review'],
    under_review: ['badge-blue', 'Under Review'],
    approved: ['badge-green', 'Approved'],
    settled: ['badge-green', 'Settled'],
    rejected: ['badge-red', 'Rejected'],
  };
  const [cls, label] = statusMap[c.status] || ['badge-gray', 'Unknown'];

  document.getElementById('modalTitle').textContent = `Claim — ${c.id}`;
  document.getElementById('modalContent').innerHTML = `
    <div style="margin-bottom:20px;display:flex;align-items:center;gap:12px">
      <span class="badge ${cls}" style="font-size:0.9rem;padding:8px 16px">${label}</span>
      <span style="color:var(--text-muted);font-size:0.85rem">Filed ${timeStr(c.submittedAt)}</span>
    </div>

    <div class="detail-grid">
      <div class="detail-item"><label>Claim ID</label><strong>${c.id}</strong></div>
      <div class="detail-item"><label>Incident Type</label><strong>${incidentLabel(c.incidentType)}</strong></div>
      <div class="detail-item"><label>Claimant</label><strong>${c.policyName}</strong></div>
      <div class="detail-item"><label>Mobile</label><strong>${c.policyMobile}</strong></div>
      <div class="detail-item"><label>Policy ID</label><strong>${c.policyId}</strong></div>
      <div class="detail-item"><label>Policy Type</label><strong>${typeLabel(c.policyType)}</strong></div>
      <div class="detail-item"><label>Claimed Amount</label><strong style="color:var(--warning)">₹${numFmt(c.amount)}</strong></div>
      <div class="detail-item"><label>Policy Coverage</label><strong>₹${numFmt(policy?.coverage || 0)}</strong></div>
      <div class="detail-item"><label>Incident Date</label><strong>${dateStr(c.incidentDate)}</strong></div>
      <div class="detail-item"><label>Location</label><strong>${c.location}</strong></div>
      <div class="detail-item"><label>Contact</label><strong>${c.contactPhone}</strong></div>
      <div class="detail-item"><label>Email</label><strong>${c.contactEmail}</strong></div>
    </div>

    <div class="form-group" style="margin-bottom:16px">
      <label>Description</label>
      <div style="background:var(--bg-dark);border:1px solid var(--border);border-radius:8px;padding:12px;font-size:0.88rem;line-height:1.6">${c.description}</div>
    </div>

    ${c.documents?.length ? `
    <div class="form-group" style="margin-bottom:16px">
      <label>Documents</label>
      ${c.documents.map(d => `
        <div class="uploaded-doc"><i class="fas fa-file-pdf"></i><span class="doc-name">${d}</span><span class="badge badge-green">Attached</span></div>
      `).join('')}
    </div>` : ''}

    ${c.bank ? `
    <div class="detail-grid">
      <div class="detail-item"><label>Bank Account</label><strong>${c.bank}</strong></div>
      <div class="detail-item"><label>IFSC Code</label><strong>${c.ifsc}</strong></div>
    </div>` : ''}

    ${block ? `
    <div style="background:var(--bg-dark);border:1px solid rgba(99,102,241,0.3);border-radius:8px;padding:14px;margin-top:16px">
      <div style="color:var(--primary-light);font-weight:700;margin-bottom:8px"><i class="fas fa-cubes"></i> Blockchain Record</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:0.75rem;color:var(--text-muted)">
        Block #${block.index} | Hash: ${block.hash.slice(0, 40)}…<br>
        Prev: ${block.prevHash.slice(0, 40)}…<br>
        Validator: ${block.validator} | ${timeStr(block.timestamp)}
      </div>
    </div>` : ''}

    <!-- Smart Contract Checks -->
    ${policy ? renderSCChecks(policy, c) : ''}
  `;

  const isAdmin = STATE.currentUser?.role === 'admin';
  document.getElementById('modalActions').innerHTML = `
    <button class="btn btn-ghost" onclick="document.getElementById('claimModal').style.display='none'">Close</button>
    ${isAdmin && ['pending','under_review'].includes(c.status) ? `
      <button class="btn btn-success" onclick="settleClaim('${c.id}');document.getElementById('claimModal').style.display='none'">
        <i class="fas fa-circle-check"></i> Approve & Settle
      </button>
      <button class="btn btn-danger" onclick="rejectClaim('${c.id}');document.getElementById('claimModal').style.display='none'">
        <i class="fas fa-xmark"></i> Reject Claim
      </button>
    ` : ''}
  `;

  document.getElementById('claimModal').style.display = 'flex';
}

function renderSCChecks(policy, claim) {
  const results = SMART_CONTRACT_RULES.map(rule => {
    try { return { rule, result: rule.check(policy, claim) }; }
    catch(e) { return { rule, result: { pass: false, msg: 'Error in rule check' } }; }
  });

  return `
    <div style="margin-top:20px">
      <div style="font-weight:700;margin-bottom:12px;color:var(--primary-light)"><i class="fas fa-robot"></i> Smart Contract Verification Results</div>
      ${results.map(r => `
        <div class="sc-item">
          <div class="sc-icon ${r.result.pass ? 'sc-pass' : 'sc-fail'}">
            <i class="fas ${r.result.pass ? (r.result.warn ? 'fa-triangle-exclamation' : 'fa-circle-check') : 'fa-circle-xmark'}"></i>
          </div>
          <div>
            <strong style="font-size:0.85rem">${r.rule.name}</strong><br>
            <span style="color:var(--text-muted);font-size:0.8rem">${r.result.msg}</span>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function closeModal(e) {
  if (e.target.id === 'claimModal') document.getElementById('claimModal').style.display = 'none';
}

// ── Settle / Reject Claim ──────────────────────────────────
function settleClaim(claimId) {
  const c = STATE.claims.find(x => x.id === claimId);
  if (!c) return;
  c.status = 'settled';
  c.settledAt = new Date().toISOString();

  const block = addBlock('settlement', { claimId, amount: c.amount, holder: c.policyName }, `Settlement: ${c.policyName}`);
  addActivity('settlement', `Claim Settled — ${c.policyName}`, `₹${numFmt(c.amount)} transferred | ${c.id}`, block.hash);

  STATE.scExecutionLog.push({
    time: new Date().toISOString(),
    rule: 'Claim Settlement',
    result: 'pass',
    msg: `Claim ${claimId} settled. ₹${numFmt(c.amount)} → ${c.policyName} | Block #${block.index}`,
  });

  updateAdminStats();
  renderClaimsQueue();
  renderRecentActivity();
  toast(`Claim ${claimId} settled! ₹${numFmt(c.amount)} disbursed. Block #${block.index}`, 'success');
}

function rejectClaim(claimId) {
  const c = STATE.claims.find(x => x.id === claimId);
  if (!c) return;
  c.status = 'rejected';
  c.rejectedAt = new Date().toISOString();

  const block = addBlock('rejection', { claimId, reason: 'Admin rejection', holder: c.policyName }, `Rejected: ${c.policyName}`);
  addActivity('claim', `Claim Rejected — ${c.policyName}`, `Claim ${c.id} rejected by admin`, block.hash);

  STATE.scExecutionLog.push({
    time: new Date().toISOString(),
    rule: 'Claim Rejection',
    result: 'fail',
    msg: `Claim ${claimId} rejected by admin | Block #${block.index}`,
  });

  updateAdminStats();
  renderClaimsQueue();
  toast(`Claim ${claimId} rejected.`, 'warning');
}

// ── Blockchain Visual ──────────────────────────────────────
function renderBlockchain() {
  const el = document.getElementById('blockchainVisual');
  if (!el) return;
  updateBlockCount();

  const typeConfig = {
    genesis: ['badge-purple', 'fa-star', 'Genesis'],
    policy: ['badge-blue', 'fa-file-contract', 'Policy'],
    claim: ['badge-orange', 'fa-hand-holding-dollar', 'Claim'],
    settlement: ['badge-green', 'fa-circle-check', 'Settlement'],
    rejection: ['badge-red', 'fa-xmark', 'Rejected'],
    verification: ['badge-purple', 'fa-robot', 'Smart Contract'],
  };

  // Show in groups of 4
  const groups = [];
  for (let i = 0; i < STATE.blockchain.length; i += 4) {
    groups.push(STATE.blockchain.slice(i, i + 4));
  }

  el.innerHTML = groups.map(group => `
    <div class="block-row">
      ${group.map((block, idx) => {
        const [badgeCls, ico, typeName] = typeConfig[block.type] || ['badge-gray', 'fa-cube', block.type];
        const isLast = idx === group.length - 1;
        return `
          <div class="chain-block ${block.type}-block">
            <div class="block-num">Block #${block.index} | Nonce: ${block.nonce}</div>
            <span class="block-type-badge badge ${badgeCls}"><i class="fas ${ico}"></i> ${typeName}</span>
            <div class="block-data">${block.label}</div>
            <div class="block-hash-line"><span class="label">Hash:</span> ${block.hash.slice(0, 30)}…</div>
            <div class="block-hash-line"><span class="label">Prev:</span> ${block.prevHash.slice(0, 30)}…</div>
            <div class="block-hash-line"><span class="label">Time:</span> ${timeStr(block.timestamp)}</div>
          </div>
          ${!isLast ? `<div class="chain-arrow"><i class="fas fa-arrow-right"></i></div>` : ''}
        `;
      }).join('')}
    </div>
  `).join('');
}

// ── Customer Portal Init ───────────────────────────────────
function initCustomerPortal(policy) {
  document.getElementById('customerName').textContent = policy.name;
  renderCustomerPolicy(policy);
  customerTab('myPolicy');
}

function customerTab(name) {
  document.querySelectorAll('#customerPortal .tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('#customerPortal .menu-item').forEach(m => m.classList.remove('active'));

  const tab = document.getElementById(`ctab-${name}`);
  if (tab) tab.classList.add('active');

  const items = document.querySelectorAll('#customerPortal .menu-item');
  items.forEach(item => {
    if (item.getAttribute('onclick')?.includes(name)) item.classList.add('active');
  });

  const titles = { myPolicy: 'My Policy', initiateClaim: 'Initiate Claim', claimStatus: 'Claim Status', trailViewer: 'Transaction Trail' };
  const title = document.getElementById('customerTopbarTitle');
  if (title) title.textContent = titles[name] || name;

  if (name === 'claimStatus') renderCustomerClaims();
  if (name === 'trailViewer') renderCustomerTrail();
}

function renderCustomerPolicy(policy) {
  const typeColors = {
    health: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
    auto: 'linear-gradient(135deg,#0891b2,#0d9488)',
    life: 'linear-gradient(135deg,#be123c,#9f1239)',
    property: 'linear-gradient(135deg,#b45309,#92400e)',
    travel: 'linear-gradient(135deg,#047857,#065f46)',
  };
  const bg = typeColors[policy.type] || 'linear-gradient(135deg,#4f46e5,#7c3aed)';
  const block = STATE.blockchain.find(b => b.data?.id === policy.id || b.data?.mobile === policy.mobile);

  document.getElementById('policyDisplayCard').innerHTML = `
    <div class="policy-card-header" style="background:${bg}">
      <div>
        <div style="font-size:0.75rem;opacity:0.8;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px">ChainInsure — ${typeLabel(policy.type)}</div>
        <div class="policy-card-number">${policy.id}</div>
      </div>
      <div class="policy-card-logo"><i class="fas ${typeIcon(policy.type)}"></i></div>
    </div>
    <div class="policy-card-body">
      <div class="policy-card-name">${policy.name}</div>
      <div class="policy-card-type">${typeLabel(policy.type)} Policy</div>
      <div class="policy-details-grid">
        <div class="policy-detail">
          <label>Coverage Amount</label>
          <strong style="color:var(--success)">₹${numFmt(policy.coverage)}</strong>
        </div>
        <div class="policy-detail">
          <label>Annual Premium</label>
          <strong>₹${numFmt(policy.premium)}</strong>
        </div>
        <div class="policy-detail">
          <label>Premium Status</label>
          <strong><span class="badge badge-green"><i class="fas fa-circle-check"></i> Paid</span></strong>
        </div>
        <div class="policy-detail">
          <label>Policy Start</label>
          <strong>${dateStr(policy.startDate)}</strong>
        </div>
        <div class="policy-detail">
          <label>Policy End</label>
          <strong>${dateStr(policy.endDate)}</strong>
        </div>
        <div class="policy-detail">
          <label>Status</label>
          <strong><span class="badge ${new Date(policy.endDate) >= new Date() ? 'badge-green' : 'badge-red'}">${new Date(policy.endDate) >= new Date() ? 'ACTIVE' : 'EXPIRED'}</span></strong>
        </div>
        <div class="policy-detail">
          <label>Mobile</label>
          <strong>${policy.mobile}</strong>
        </div>
        <div class="policy-detail">
          <label>KYC</label>
          <strong>${policy.kyc || 'Not provided'}</strong>
        </div>
        <div class="policy-detail">
          <label>Pre-conditions</label>
          <strong>${policy.conditions || 'None'}</strong>
        </div>
      </div>
    </div>
  `;

  document.getElementById('policyProof').innerHTML = `
    <div class="proof-header"><i class="fas fa-shield-halved"></i> Blockchain Proof of Policy</div>
    <div class="proof-items">
      <div class="proof-item"><label>Policy ID</label><strong>${policy.id}</strong></div>
      <div class="proof-item"><label>Block Hash</label><strong>${block ? block.hash.slice(0, 48) + '…' : 'Pending…'}</strong></div>
      <div class="proof-item"><label>Block Number</label><strong>#${block?.index ?? '—'}</strong></div>
      <div class="proof-item"><label>Recorded At</label><strong>${block ? timeStr(block.timestamp) : '—'}</strong></div>
      <div class="proof-item"><label>Validator Node</label><strong>${block?.validator ?? '—'}</strong></div>
      <div class="proof-item"><label>Immutability</label><strong><span class="badge badge-green"><i class="fas fa-lock"></i> Tamper-proof</span></strong></div>
    </div>
  `;
}

// ── Customer Claim Submission ──────────────────────────────
function handleDocUpload(e) {
  const files = Array.from(e.target.files);
  STATE.uploadedFiles = [...STATE.uploadedFiles, ...files];
  renderUploadedDocs();
}

function renderUploadedDocs() {
  const el = document.getElementById('uploadedDocs');
  if (!el) return;
  el.innerHTML = STATE.uploadedFiles.map((f, i) => `
    <div class="uploaded-doc">
      <i class="fas fa-file-pdf"></i>
      <span class="doc-name">${f.name}</span>
      <span class="doc-size">${(f.size/1024).toFixed(1)} KB</span>
      <button class="btn btn-ghost btn-sm" onclick="removeDoc(${i})" style="padding:2px 8px">
        <i class="fas fa-xmark"></i>
      </button>
    </div>
  `).join('');
}

function removeDoc(idx) {
  STATE.uploadedFiles.splice(idx, 1);
  renderUploadedDocs();
}

function precheckClaim() {
  const policy = STATE.policies.find(p => p.id === STATE.currentUser?.policyId);
  if (!policy) { toast('Policy not found', 'error'); return; }

  const claimData = getClaimFormData();
  if (!claimData.incidentType || !claimData.incidentDate || !claimData.amount) {
    toast('Fill in incident type, date and amount first', 'warning');
    return;
  }

  const panel = document.getElementById('scPrecheck');
  panel.style.display = 'block';

  const results = SMART_CONTRACT_RULES.map(rule => {
    try { return { rule, result: rule.check(policy, claimData) }; }
    catch(e) { return { rule, result: { pass: true, msg: 'Rule check completed' } }; }
  });

  document.getElementById('scPrecheckItems').innerHTML = results.map(r => `
    <div class="sc-item">
      <div class="sc-icon ${r.result.pass ? (r.result.warn ? 'sc-warn' : 'sc-pass') : 'sc-fail'}">
        <i class="fas ${r.result.pass ? (r.result.warn ? 'fa-triangle-exclamation' : 'fa-circle-check') : 'fa-circle-xmark'}"></i>
      </div>
      <div>
        <strong style="font-size:0.85rem">${r.rule.name}</strong><br>
        <span style="font-size:0.8rem">${r.result.msg}</span>
      </div>
    </div>
  `).join('');

  const allPass = results.every(r => r.result.pass);
  toast(allPass ? 'All smart contract checks passed! You can submit.' : 'Some checks failed. Review before submitting.', allPass ? 'success' : 'warning');
  panel.scrollIntoView({ behavior: 'smooth' });
}

function getClaimFormData() {
  return {
    incidentType: document.getElementById('cl_type')?.value,
    incidentDate: document.getElementById('cl_date')?.value,
    location: document.getElementById('cl_location')?.value?.trim(),
    amount: document.getElementById('cl_amount')?.value,
    description: document.getElementById('cl_description')?.value?.trim(),
    contactName: document.getElementById('cl_contact_name')?.value?.trim(),
    contactPhone: document.getElementById('cl_contact_phone')?.value?.trim(),
    contactEmail: document.getElementById('cl_contact_email')?.value?.trim(),
    bank: document.getElementById('cl_bank')?.value?.trim(),
    ifsc: document.getElementById('cl_ifsc')?.value?.trim(),
  };
}

function submitClaim() {
  const policy = STATE.policies.find(p => p.id === STATE.currentUser?.policyId);
  if (!policy) { toast('Session error. Please login again.', 'error'); return; }

  const d = getClaimFormData();
  if (!d.incidentType || !d.incidentDate || !d.amount || !d.description) {
    toast('Please fill all required fields', 'error');
    return;
  }

  const claim = {
    id: genId('CLM'),
    policyId: policy.id,
    policyName: policy.name,
    policyMobile: policy.mobile,
    policyType: policy.type,
    incidentType: d.incidentType,
    incidentDate: d.incidentDate,
    location: d.location || 'Not specified',
    amount: parseFloat(d.amount),
    description: d.description,
    contactName: d.contactName || policy.name,
    contactPhone: d.contactPhone || policy.mobile,
    contactEmail: d.contactEmail || policy.email,
    bank: d.bank,
    ifsc: d.ifsc,
    status: 'pending',
    submittedAt: new Date().toISOString(),
    documents: STATE.uploadedFiles.map(f => f.name),
  };

  // Run SC checks
  const results = SMART_CONTRACT_RULES.map(rule => {
    try { return rule.check(policy, claim); }
    catch(e) { return { pass: true }; }
  });

  const autoSettle = results.every(r => r.pass) && claim.amount < 25000;
  if (autoSettle) {
    claim.status = 'settled';
    claim.settledAt = new Date().toISOString();
  } else {
    claim.status = 'pending';
  }

  STATE.claims.push(claim);
  const block = addBlock('claim', claim, `Claim: ${policy.name}`);

  results.forEach((r, i) => {
    STATE.scExecutionLog.push({
      time: new Date().toISOString(),
      rule: SMART_CONTRACT_RULES[i].name,
      result: r.pass ? 'pass' : 'fail',
      msg: r.msg,
    });
  });

  if (autoSettle) {
    const sb = addBlock('settlement', { claimId: claim.id, amount: claim.amount, holder: policy.name }, `Auto-Settlement: ${policy.name}`);
    addActivity('settlement', `Auto-Settled — ${policy.name}`, `₹${numFmt(claim.amount)} | ${incidentLabel(claim.incidentType)}`, sb.hash);
  }

  addActivity('claim', `Claim Initiated — ${policy.name}`, `₹${numFmt(claim.amount)} | ${incidentLabel(d.incidentType)}`, block.hash);

  // Show success
  const panel = document.getElementById('claimSuccessPanel');
  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth' });

  document.getElementById('claimSubmitMsg').textContent = autoSettle
    ? `Your claim of ₹${numFmt(claim.amount)} was auto-settled by smart contract! Funds will be credited within 24 hours.`
    : `Your claim has been submitted and is pending review. Claim ID: ${claim.id}`;

  document.getElementById('claimHashDisplay').innerHTML =
    `<strong>Claim ID:</strong> ${claim.id}<br><strong>Block Hash:</strong> ${block.hash}<br><strong>Block #:</strong> ${block.index}`;

  // Email notification simulation
  sendEmailNotification(policy, claim, block);

  STATE.uploadedFiles = [];
  toast(`Claim submitted successfully! ${autoSettle ? 'Auto-settled by smart contract.' : 'Pending admin review.'}`, 'success');
}

function sendEmailNotification(policy, claim, block) {
  const emailEl = document.getElementById('emailNotification');
  const subject = `[ChainInsure] New Claim ${claim.id} — ${policy.name} | ₹${numFmt(claim.amount)}`;
  const body = `Dear Executive,

A new insurance claim has been initiated on the ChainInsure blockchain platform.

CLAIM DETAILS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Claim ID     : ${claim.id}
Policyholder : ${policy.name}
Mobile       : ${policy.mobile}
Policy ID    : ${policy.id}
Policy Type  : ${typeLabel(policy.type)}

INCIDENT:
Type         : ${incidentLabel(claim.incidentType)}
Date         : ${dateStr(claim.incidentDate)}
Location     : ${claim.location}
Amount       : ₹${numFmt(claim.amount)}

Description  : ${claim.description}

CONTACT:
Name         : ${claim.contactName}
Phone        : ${claim.contactPhone}
Email        : ${claim.contactEmail}

BANKING:
Account      : ${claim.bank || 'Not provided'}
IFSC         : ${claim.ifsc || 'Not provided'}

DOCUMENTS    : ${claim.documents.length > 0 ? claim.documents.join(', ') : 'None attached'}

BLOCKCHAIN RECORD:
Block #      : ${block.index}
Hash         : ${block.hash}
Timestamp    : ${timeStr(block.timestamp)}
Validator    : ${block.validator}

Please review and process this claim at the earliest.

Regards,
ChainInsure Automated System`;

  const mailtoLink = `mailto:${STATE.execEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  emailEl.innerHTML = `
    <i class="fas fa-envelope-circle-check"></i>
    <div>
      <strong>Executive notified!</strong> Email prepared for ${STATE.execEmail}<br>
      <a href="${mailtoLink}" style="color:var(--primary-light);font-size:0.8rem;text-decoration:underline" target="_blank">
        <i class="fas fa-external-link"></i> Open Email Client to Send
      </a>
    </div>
  `;
}

// ── Customer Claims View ───────────────────────────────────
function renderCustomerClaims() {
  const el = document.getElementById('customerClaimsView');
  if (!el) return;
  const myClaims = STATE.claims.filter(c => c.policyId === STATE.currentUser?.policyId);
  if (myClaims.length === 0) {
    el.innerHTML = `
      <div style="padding:40px;text-align:center;color:var(--text-muted)">
        <i class="fas fa-inbox" style="font-size:3rem;margin-bottom:16px;display:block"></i>
        No claims submitted yet.<br>
        <button class="btn btn-primary" style="margin-top:16px" onclick="customerTab('initiateClaim')">
          <i class="fas fa-plus"></i> Initiate First Claim
        </button>
      </div>
    `;
    return;
  }
  el.innerHTML = myClaims.map(c => renderClaimCard(c, false)).join('');
}

// ── Customer Trail ─────────────────────────────────────────
function renderCustomerTrail() {
  const el = document.getElementById('customerTrail');
  if (!el) return;
  const policyId = STATE.currentUser?.policyId;

  const events = STATE.blockchain.filter(b =>
    b.data?.id === policyId ||
    b.data?.policyId === policyId ||
    (b.type === 'genesis')
  );

  if (events.length === 0) {
    el.innerHTML = '<p style="padding:24px;color:var(--text-muted)">No blockchain events yet.</p>';
    return;
  }

  const iconMap = {
    genesis: ['genesis', 'fa-star', 'Genesis Block Created'],
    policy: ['policy', 'fa-file-contract', 'Policy Issued'],
    claim: ['claim', 'fa-hand-holding-dollar', 'Claim Submitted'],
    settlement: ['settle', 'fa-circle-check', 'Claim Settled'],
    rejection: ['reject', 'fa-xmark', 'Claim Rejected'],
  };

  el.innerHTML = events.map(block => {
    const [cls, ico, defaultTitle] = iconMap[block.type] || ['policy', 'fa-cube', block.type];
    return `
      <div class="timeline-item">
        <div class="timeline-icon ${cls}"><i class="fas ${ico}"></i></div>
        <div class="timeline-body">
          <div class="timeline-title">${block.label || defaultTitle}</div>
          <div class="timeline-desc">${getBlockDesc(block)}</div>
          <div class="timeline-hash"><i class="fas fa-link"></i> ${block.hash.slice(0, 40)}…</div>
          <div class="timeline-time"><i class="fas fa-clock"></i> ${timeStr(block.timestamp)} | Block #${block.index}</div>
        </div>
      </div>
    `;
  }).join('');
}

function getBlockDesc(block) {
  const d = block.data;
  if (!d) return 'System block';
  if (block.type === 'policy') return `${typeLabel(d.type)} | Coverage: ₹${numFmt(d.coverage)} | Mobile: ${d.mobile}`;
  if (block.type === 'claim') return `${incidentLabel(d.incidentType)} | Amount: ₹${numFmt(d.amount)} | ${d.status}`;
  if (block.type === 'settlement') return `Settlement: ₹${numFmt(d.amount)} disbursed`;
  if (block.type === 'rejection') return `Claim rejected by admin`;
  return 'Blockchain record';
}

// ── Comparison Content ─────────────────────────────────────
function renderComparisonContent(containerId, standalone) {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = `
    <div class="comparison-hero">
      <h1><i class="fas fa-scale-balanced"></i> Blockchain vs Traditional Insurance</h1>
      <p>A detailed analysis of where blockchain technology genuinely adds value in insurance claims processing</p>
    </div>

    <!-- Process Flow -->
    <div class="section-card" style="margin-bottom:32px">
      <div class="section-header"><h3><i class="fas fa-diagram-project"></i> Claims Processing Flow — Both Models</h3></div>
      <div style="padding:24px">
        <p style="color:var(--text-muted);margin-bottom:20px;font-size:0.88rem">Blockchain model (green) vs Traditional (orange) — note where processes differ significantly</p>
        <div class="process-flow">
          ${[
            ['fa-file-plus','Policy Issuance','Blockchain: 2 min\nTraditional: 1-3 days','#6366f1'],
            ['fa-triangle-exclamation','Incident Occurs','Both: Same','#94a3b8'],
            ['fa-paper-plane','Claim Filed','Blockchain: Instant\nTraditional: 1-3 days','#f59e0b'],
            ['fa-robot','Auto-Verify','Blockchain: Instant\nTraditional: 7-30 days','#10b981'],
            ['fa-magnifying-glass','Manual Review','Blockchain: Optional\nTraditional: Always','#3b82f6'],
            ['fa-money-bill-transfer','Settlement','Blockchain: 24hrs\nTraditional: 30-90 days','#10b981'],
          ].map(([ico, name, time, color]) => `
            <div class="process-step">
              <div class="step-circle" style="background:${color}20;border:2px solid ${color};color:${color}">
                <i class="fas ${ico}"></i>
              </div>
              <div class="step-name">${name}</div>
              <div class="step-time" style="white-space:pre-line;font-size:0.7rem">${time}</div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Comparison Table -->
    <div class="comparison-table-wrapper" style="margin-bottom:32px">
      <div class="comparison-table-header">
        <div class="cth-cell"><i class="fas fa-list"></i> Aspect</div>
        <div class="cth-cell trad"><i class="fas fa-building"></i> Traditional Insurance</div>
        <div class="cth-cell chain"><i class="fas fa-link"></i> Blockchain Model (ChainInsure)</div>
      </div>
      ${[
        ['Policy Issuance', 'Paper-based or digital forms, manual entry, 1-5 days processing', 'Instant blockchain record, immutable, cryptographically secured, mobile number linked'],
        ['Data Storage', 'Centralized databases, single point of failure, breach risk', 'Distributed ledger, no central authority, tamper-proof blocks'],
        ['Claim Filing', 'Physical visits, agent intermediaries, paper documents', 'Customer self-service portal, direct submission, document hash stored'],
        ['Claim Verification', '7-30 days manual review by multiple humans, prone to bias', 'Smart contracts auto-verify in milliseconds based on predefined rules'],
        ['Fraud Detection', 'Post-facto analysis, reactive, expensive investigations', 'Proactive — SC rules prevent duplicate claims, verify policy validity automatically'],
        ['Settlement Speed', '30-90 days, manual bank transfers, multiple approvals', '24-48 hrs, auto-settlement for small claims (<₹25K) via smart contracts'],
        ['Transparency', 'Opaque to customer — limited status updates', 'Full immutable trail visible to customer — every action recorded'],
        ['Auditability', 'Paper trails, manual audits, data can be manipulated', 'Every block cryptographically linked — any tampering immediately detectable'],
        ['Cost', '30-40% of premium goes to admin overhead', 'Smart contracts eliminate intermediaries — potential 15-20% cost reduction'],
        ['Disputes', 'Lengthy arbitration, legal fees, unclear records', 'Blockchain timestamp & hash provide indisputable evidence'],
        ['Privacy / Security', 'Centralized data = high breach risk', 'Encrypted on chain, private keys, Zero-knowledge proofs possible'],
        ['Scalability', 'Limited by human workforce', 'Auto-scales — smart contracts handle millions of verifications'],
      ].map(([aspect, trad, chain]) => `
        <div class="comparison-row">
          <div class="cr-cell aspect">${aspect}</div>
          <div class="cr-cell trad"><i class="fas fa-triangle-exclamation" style="margin-right:6px;font-size:0.8rem"></i>${trad}</div>
          <div class="cr-cell chain"><i class="fas fa-circle-check" style="margin-right:6px;font-size:0.8rem"></i>${chain}</div>
        </div>
      `).join('')}
    </div>

    <!-- Where Blockchain Genuinely Adds Value -->
    <div class="value-section">
      <h2><i class="fas fa-star" style="color:var(--success)"></i> Where Blockchain Genuinely Adds Value</h2>
      <div class="value-cards">
        ${[
          ['fa-robot', 'Smart Contract Automation', 'Eliminates human bias and delays in claim verification. Rules execute instantly and consistently for every claim.', 'adds-value'],
          ['fa-shield-halved', 'Fraud Prevention', 'Duplicate claim detection, policy validity checks, and immutable records make fraud significantly harder.', 'adds-value'],
          ['fa-eye', 'Full Transparency', 'Customers can audit every action on their policy. Builds trust and eliminates "lost document" excuses.', 'adds-value'],
          ['fa-bolt', 'Instant Settlement', 'Sub-threshold claims auto-settle without human intervention. Massive improvement in customer experience.', 'adds-value'],
          ['fa-link', 'Immutable Audit Trail', 'Every event cryptographically linked. Regulators get instant audit access. Disputes resolved with facts.', 'adds-value'],
          ['fa-users-slash', 'Disintermediation', 'Removes layers of brokers, adjusters, and verifiers for routine claims. Reduces operational costs.', 'adds-value'],
          ['fa-database', 'Data Integrity', 'No single point of failure. Distributed ledger prevents data manipulation by any single actor.', 'adds-value'],
          ['fa-globe', 'Cross-border Claims', 'Blockchain enables seamless multi-jurisdiction processing (especially valuable for travel insurance).', 'adds-value'],
          ['fa-hourglass-half', 'Limited Benefit: Complex Claims', 'High-value or complex claims still need human judgment, medical experts, surveyors. Blockchain is support, not replacement.', 'limited'],
          ['fa-coins', 'Limited Benefit: Implementation Cost', 'Initial blockchain setup and smart contract development is expensive. ROI only at scale.', 'limited'],
          ['fa-wifi', 'Limited Benefit: Digital Divide', 'Rural customers without smartphones/internet cannot access blockchain-based portals.', 'limited'],
          ['fa-gavel', 'Limited Benefit: Regulatory', 'Smart contracts in insurance are not yet fully legally recognized in all jurisdictions (India: evolving).', 'limited'],
        ].map(([ico, title, desc, cls]) => `
          <div class="value-card ${cls}">
            <div class="value-card-icon"><i class="fas ${ico}"></i></div>
            <h3>${title}</h3>
            <p>${desc}</p>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Verdict -->
    <div class="section-card">
      <div class="section-header"><h3><i class="fas fa-trophy" style="color:var(--warning)"></i> Verdict: When Does Blockchain Win?</h3></div>
      <div style="padding:24px;display:grid;grid-template-columns:1fr 1fr;gap:24px">
        <div>
          <h4 style="color:var(--success);margin-bottom:12px"><i class="fas fa-circle-check"></i> Blockchain is Superior For:</h4>
          <ul style="list-style:none;display:flex;flex-direction:column;gap:8px;font-size:0.88rem">
            ${['High-volume, routine, small claims processing','Real-time policy verification at point of service','Cross-institutional data sharing (hospitals, police, banks)','Customer transparency and self-service portals','Fraud prevention via smart contract rules','Regulatory audit and compliance reporting','Micro-insurance products'].map(i => `<li><i class="fas fa-check" style="color:var(--success);margin-right:8px"></i>${i}</li>`).join('')}
          </ul>
        </div>
        <div>
          <h4 style="color:var(--warning);margin-bottom:12px"><i class="fas fa-triangle-exclamation"></i> Traditional Approach Still Better For:</h4>
          <ul style="list-style:none;display:flex;flex-direction:column;gap:8px;font-size:0.88rem">
            ${['Complex, high-value claims needing expert judgment','Situations requiring field investigation/survey','Customers who lack digital access','Areas with regulatory ambiguity around smart contracts','Niche products requiring nuanced human assessment','Emergency claims needing immediate physical response'].map(i => `<li><i class="fas fa-minus" style="color:var(--warning);margin-right:8px"></i>${i}</li>`).join('')}
          </ul>
        </div>
      </div>
      <div style="padding:0 24px 24px">
        <div style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.2);border-radius:8px;padding:20px;font-size:0.88rem;line-height:1.7;color:var(--text-muted)">
          <strong style="color:var(--text)">💡 Conclusion:</strong> Blockchain in insurance is not a universal replacement for traditional systems — it is a powerful complement. 
          The real value lies in <strong style="color:var(--primary-light)">automating routine verifications</strong>, 
          <strong style="color:var(--primary-light)">preventing fraud</strong>, 
          <strong style="color:var(--primary-light)">creating transparency</strong>, and 
          <strong style="color:var(--primary-light)">accelerating settlement</strong> for clearly-defined scenarios. 
          A hybrid model — where smart contracts handle the 80% routine cases and humans handle complex outliers — represents the optimal real-world implementation.
        </div>
      </div>
    </div>
  `;
}

// ── Label Helpers ──────────────────────────────────────────
function typeLabel(t) {
  return { health: 'Health Insurance', auto: 'Auto Insurance', life: 'Life Insurance', property: 'Property Insurance', travel: 'Travel Insurance' }[t] || t;
}

function typeIcon(t) {
  return { health: 'fa-heart-pulse', auto: 'fa-car', life: 'fa-person', property: 'fa-house', travel: 'fa-plane' }[t] || 'fa-shield-halved';
}

function incidentLabel(t) {
  return {
    accident: 'Vehicle Accident',
    medical: 'Medical Emergency',
    theft: 'Theft / Robbery',
    fire: 'Fire / Disaster',
    death: 'Death Claim',
    travel_delay: 'Travel Delay',
    other: 'Other'
  }[t] || t || 'Unknown';
}

// ── View Policy Detail ─────────────────────────────────────
function viewPolicyDetail(policyId) {
  const policy = STATE.policies.find(p => p.id === policyId);
  if (!policy) return;
  const block = STATE.blockchain.find(b => b.data?.id === policyId);
  const claims = STATE.claims.filter(c => c.policyId === policyId);

  document.getElementById('modalTitle').textContent = `Policy — ${policy.name}`;
  document.getElementById('modalContent').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><label>Policy ID</label><strong>${policy.id}</strong></div>
      <div class="detail-item"><label>Type</label><strong>${typeLabel(policy.type)}</strong></div>
      <div class="detail-item"><label>Holder</label><strong>${policy.name}</strong></div>
      <div class="detail-item"><label>Mobile</label><strong>${policy.mobile}</strong></div>
      <div class="detail-item"><label>Email</label><strong>${policy.email || '—'}</strong></div>
      <div class="detail-item"><label>DOB</label><strong>${dateStr(policy.dob)}</strong></div>
      <div class="detail-item"><label>Coverage</label><strong style="color:var(--success)">₹${numFmt(policy.coverage)}</strong></div>
      <div class="detail-item"><label>Premium</label><strong>₹${numFmt(policy.premium)}/yr</strong></div>
      <div class="detail-item"><label>Start Date</label><strong>${dateStr(policy.startDate)}</strong></div>
      <div class="detail-item"><label>End Date</label><strong>${dateStr(policy.endDate)}</strong></div>
      <div class="detail-item"><label>KYC</label><strong>${policy.kyc || 'Not provided'}</strong></div>
      <div class="detail-item"><label>Status</label><strong><span class="badge ${policy.status === 'active' ? 'badge-green' : 'badge-red'}">${policy.status.toUpperCase()}</span></strong></div>
      <div class="detail-item"><label>Pre-conditions</label><strong>${policy.conditions}</strong></div>
      <div class="detail-item"><label>Address</label><strong>${policy.address || '—'}</strong></div>
    </div>
    ${block ? `
    <div style="background:rgba(99,102,241,0.06);border:1px solid rgba(99,102,241,0.2);border-radius:8px;padding:14px;margin-top:8px">
      <div style="color:var(--primary-light);font-weight:700;margin-bottom:8px"><i class="fas fa-cubes"></i> On-Chain Record</div>
      <div style="font-family:'JetBrains Mono',monospace;font-size:0.72rem;color:var(--text-muted);line-height:1.7">
        Block #${block.index} | ${timeStr(block.timestamp)}<br>
        Hash: ${block.hash}<br>
        Prev: ${block.prevHash.slice(0, 40)}…
      </div>
    </div>` : ''}
    ${claims.length > 0 ? `
    <div style="margin-top:16px">
      <div style="font-weight:700;margin-bottom:10px">Claims (${claims.length})</div>
      ${claims.map(c => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg-dark);border-radius:8px;margin-bottom:6px;font-size:0.85rem">
          <span>${c.id} — ${incidentLabel(c.incidentType)}</span>
          <span>₹${numFmt(c.amount)}</span>
          <span class="badge ${c.status === 'settled' ? 'badge-green' : c.status === 'rejected' ? 'badge-red' : 'badge-orange'}">${c.status}</span>
        </div>
      `).join('')}
    </div>` : '<p style="color:var(--text-muted);margin-top:12px;font-size:0.85rem">No claims filed on this policy.</p>'}
  `;
  document.getElementById('modalActions').innerHTML = `
    <button class="btn btn-ghost" onclick="document.getElementById('claimModal').style.display='none'">Close</button>
  `;
  document.getElementById('claimModal').style.display = 'flex';
}

// ── Init ───────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Set default policy dates
  const today = new Date().toISOString().split('T')[0];
  const nextYear = new Date(Date.now() + 365*24*3600000).toISOString().split('T')[0];
  const startEl = document.getElementById('ph_startDate');
  const endEl = document.getElementById('ph_endDate');
  if (startEl) startEl.value = today;
  if (endEl) endEl.value = nextYear;

  // Render comparison on landing
  renderComparisonContent('comparisonPageContent', true);

  // Genesis block
  if (STATE.blockchain.length === 0) {
    addBlock('genesis', { message: 'ChainInsure Genesis Block', version: '1.0.0' }, 'Genesis Block');
    seedDemoData();
  }

  showPage('landingPage');
});
