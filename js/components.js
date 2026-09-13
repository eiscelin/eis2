// Reusable UI components
const UI = {
  modal(title, bodyHtml, onMount) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" data-close>✕</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('[data-close]').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    if (onMount) onMount(overlay);
    return overlay;
  },

  confirm(title, message, onConfirm, confirmText = 'Confirm', danger = false) {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box" style="max-width:440px;">
        <div class="modal-header"><h3>${title}</h3></div>
        <div class="modal-body">
          <p style="color:#666;margin-bottom:1.5rem;">${message}</p>
          <button class="btn-${danger ? 'danger' : 'save'}" id="confirmBtn">${confirmText}</button>
          <button class="btn-cancel" id="cancelBtn" style="margin-left:.5rem;">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#confirmBtn').onclick = () => { overlay.remove(); onConfirm(); };
    overlay.querySelector('#cancelBtn').onclick = () => overlay.remove();
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    return overlay;
  },

  badge(status) {
    const map = {
      'draft': 'badge-gray', 'submitted': 'badge-blue', 'pending_approval': 'badge-yellow',
      'approved': 'badge-green', 'rejected': 'badge-red', 'in_production': 'badge-blue',
      'production_completed': 'badge-purple', 'ready_for_dispatch': 'badge-blue',
      'preparing_dispatch': 'badge-yellow', 'dispatched': 'badge-purple',
      'in_transit': 'badge-blue', 'delivered': 'badge-green', 'received': 'badge-green',
      'cancelled': 'badge-red', 'issue_reported': 'badge-red',
      'active': 'badge-green', 'inactive': 'badge-gray', 'pending': 'badge-yellow',
      'suspended': 'badge-red', 'completed': 'badge-green', 'in_progress': 'badge-blue',
      'paused': 'badge-yellow', 'open': 'badge-red', 'resolved': 'badge-green',
      'scheduled': 'badge-yellow', 'preparing': 'badge-yellow', 'arrived': 'badge-blue',
      'failed': 'badge-red', 'low': 'badge-yellow', 'normal': 'badge-gray',
      'high': 'badge-orange', 'urgent': 'badge-red', 'important': 'badge-orange',
      'critical': 'badge-red'
    };
    const labels = {
      'pending_approval': 'Pending Approval', 'in_production': 'In Production',
      'production_completed': 'Production Complete', 'ready_for_dispatch': 'Ready for Dispatch',
      'preparing_dispatch': 'Preparing Dispatch', 'in_transit': 'In Transit',
      'issue_reported': 'Issue Reported', 'in_progress': 'In Progress'
    };
    return `<span class="badge ${map[status] || 'badge-gray'}">${labels[status] || status}</span>`;
  },

  table(headers, rows, opts = {}) {
    const emptyMsg = opts.emptyMsg || 'No data available';
    return `
      <div class="table-card">
        ${opts.title ? `<div class="table-card-header"><h3>${opts.title}</h3>${opts.extra || ''}</div>` : ''}
        <div class="table-scroll">
          <table>
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${rows.length ? rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}" class="empty-row">${emptyMsg}</td></tr>`}</tbody>
          </table>
        </div>
      </div>`;
  },

  statCard(label, value, accent, icon, trend) {
    return `<div class="dash-stat-card">
      ${icon ? `<div class="stat-icon">${icon}</div>` : ''}
      <div><div class="label">${label}</div><div class="value ${accent ? 'accent' : ''}">${value}</div>${trend ? `<div class="trend">${trend}</div>` : ''}</div>
    </div>`;
  },

  statRow(cards) {
    return `<div class="dash-stats">${cards.map(c => this.statCard(c.label, c.value, c.accent, c.icon, c.trend)).join('')}</div>`;
  },

  header(title, subtitle, actions) {
    return `<div class="main-header"><div><h1>${title}</h1>${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}</div>${actions || ''}</div>`;
  },

  empty(icon, msg) {
    return `<div class="empty-state"><div class="icon">${icon}</div><p>${msg}</p></div>`;
  },

  loading() {
    return `<div class="loading"><div class="spinner"></div>Loading...</div>`;
  },

  toast(msg, type = '') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  },

  formField(label, inputHtml, required) {
    return `<div class="form-group"><label>${label}${required ? ' <span style="color:#e52e06">*</span>' : ''}</label>${inputHtml}</div>`;
  },

  input(id, placeholder, type = 'text', value = '') {
    return `<input type="${type}" id="${id}" placeholder="${placeholder}" value="${value}" class="form-input">`;
  },

  select(id, options, selected) {
    return `<select id="${id}" class="form-input">${options.map(o => `<option value="${o.value}" ${o.value === selected ? 'selected' : ''}>${o.label}</option>`).join('')}</select>`;
  },

  textarea(id, placeholder, rows = 3) {
    return `<textarea id="${id}" rows="${rows}" placeholder="${placeholder}" class="form-input" style="resize:vertical;"></textarea>`;
  },

  button(text, id, variant = 'save') {
    return `<button class="btn-${variant}" id="${id}">${text}</button>`;
  },

  searchBar(id, placeholder) {
    return `<div class="search-bar"><span>🔍</span><input type="text" id="${id}" placeholder="${placeholder}" class="form-input"></div>`;
  },

  filterSelect(id, options) {
    return `<select id="${id}" class="form-input filter-select"><option value="">All</option>${options.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}</select>`;
  },

  timeline(events) {
    return `<div class="timeline">${events.map((e, i) => `
      <div class="timeline-item ${i === events.length - 1 ? 'latest' : ''}">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <div class="timeline-event">${e.event}</div>
          <div class="timeline-desc">${e.description || ''}</div>
          <div class="timeline-meta">${e.user_name || ''} · ${this.fmtDateTime(e.created_at)}</div>
        </div>
      </div>`).join('')}</div>`;
  },

  fmtDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  fmtDateTime(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  },

  fmtPeso(n) {
    return '₱' + Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  },

  fmtNum(n) {
    return Number(n || 0).toLocaleString('en-US');
  }
};
