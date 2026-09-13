// Production Dashboard — production queue, active production, issues
var Pages = window.Pages || {};

Pages.productionDashboard = function(el) {
  const user = Auth.currentUser;
  const navItems = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'queue', icon: '📋', label: 'Production Queue' },
    { id: 'active', icon: '🔄', label: 'Active Production' },
    { id: 'completed', icon: '✅', label: 'Completed' },
    { id: 'issues', icon: '⚠️', label: 'Production Issues' },
    { id: 'announcements', icon: '📢', label: 'Announcements' },
    { id: 'profile', icon: '👤', label: 'My Profile' }
  ];

  dashLayout(el, user, navItems, async (main, tab) => {
    if (tab === 'dashboard') await renderProductionDash(main, user);
    else if (tab === 'queue') await renderProductionQueue(main, user);
    else if (tab === 'active') await renderActiveProduction(main, user);
    else if (tab === 'completed') await renderCompletedProduction(main, user);
    else if (tab === 'issues') await renderProductionIssues(main, user);
    else if (tab === 'announcements') await renderFranchiseAnnouncements(main, user);
    else if (tab === 'profile') await renderProfile(main, user);
  });
};

async function renderProductionDash(main, user) {
  main.innerHTML = UI.header('Production Dashboard', 'Manage production tasks') + UI.loading();
  try {
    const [{ data: tasks }, { data: issues }] = await Promise.all([
      sb.from('production_tasks').select('*, orders(order_number, franchise_id, total_items, total_qty), franchises(franchise_name)').order('created_at', { ascending: false }),
      sb.from('production_issues').select('*').eq('status', 'open')
    ]);

    let html = UI.header('Production Dashboard', 'Manage production tasks');
    html += UI.statRow([
      { label: 'Pending', value: (tasks || []).filter(t => t.status === 'pending').length, icon: '⏳' },
      { label: 'In Progress', value: (tasks || []).filter(t => t.status === 'in_progress').length, accent: true, icon: '🔄' },
      { label: 'Completed', value: (tasks || []).filter(t => t.status === 'completed').length, icon: '✅' },
      { label: 'Open Issues', value: (issues || []).length, accent: (issues || []).length > 0, icon: '⚠️' }
    ]);

    // Priority queue
    const pending = (tasks || []).filter(t => t.status === 'pending').sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
      return (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2);
    });

    html += `<div style="margin-top:1rem;">${UI.table(
      ['Production #', 'Order #', 'Franchise', 'Priority', 'Status', 'Items', 'Actions'],
      pending.slice(0, 10).map(t => [
        t.production_number, t.orders?.order_number || '—', t.franchises?.franchise_name || '—',
        UI.badge(t.priority), UI.badge(t.status), t.orders?.total_items || 0,
        `<button class="btn-save" data-start="${t.id}" style="padding:.3rem .75rem;font-size:.85rem;">Start</button>`
      ]),
      { title: 'Production Queue (Priority Order)', emptyMsg: 'No pending production tasks' }
    )}</div>`;

    main.innerHTML = html;
    main.querySelectorAll('[data-start]').forEach(btn => btn.addEventListener('click', () => startProduction(btn.dataset.start, main, user)));
  } catch (e) {
    main.innerHTML = UI.header('Production Dashboard') + UI.empty('🏭', 'Unable to load production data.');
  }
}

async function renderProductionQueue(main, user) {
  main.innerHTML = UI.header('Production Queue', 'Orders awaiting production') + UI.loading();
  try {
    const { data: tasks } = await sb.from('production_tasks').select('*, orders(order_number, franchise_id, total_items, total_qty, requested_delivery_date), franchises(franchise_name)').eq('status', 'pending').order('created_at', { ascending: true });
    let html = UI.header('Production Queue', 'Orders awaiting production');
    html += UI.table(
      ['Production #', 'Order #', 'Franchise', 'Priority', 'Items', 'Delivery Date', 'Actions'],
      (tasks || []).map(t => [
        t.production_number, t.orders?.order_number || '—', t.franchises?.franchise_name || '—',
        UI.badge(t.priority), t.orders?.total_items || 0, UI.fmtDate(t.orders?.requested_delivery_date),
        `<button class="btn-save" data-start="${t.id}" style="padding:.3rem .75rem;font-size:.85rem;">Start Production</button>`
      ]),
      { emptyMsg: 'No pending production tasks' }
    );
    main.innerHTML = html;
    main.querySelectorAll('[data-start]').forEach(btn => btn.addEventListener('click', () => startProduction(btn.dataset.start, main, user)));
  } catch (e) {
    main.innerHTML = UI.header('Production Queue') + UI.empty('📋', 'Unable to load queue.');
  }
}

async function startProduction(taskId, main, user) {
  UI.confirm('Start Production', 'Are you sure you want to start production on this order?', async () => {
    try {
      const { data: task } = await sb.from('production_tasks').select('*, orders(order_number, franchise_id, created_by)').eq('id', taskId).single();
      await sb.from('production_tasks').update({ status: 'in_progress', assigned_to: user.id, start_time: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', taskId);
      await DB.updateOrderStatus(task.order_id, 'in_production');
      await DB.notify(task.orders.created_by, 'Production Started', `Production has started for order ${task.orders.order_number}.`, 'info', task.order_id, 'order');
      await DB.log('START_PRODUCTION', 'production_task', task.production_number, `Started production ${task.production_number}`);
      UI.toast('Production started!', 'success');
      renderActiveProduction(main, user);
    } catch (e) { UI.toast('Failed: ' + e.message, 'error'); }
  }, 'Start Production');
}

async function renderActiveProduction(main, user) {
  main.innerHTML = UI.header('Active Production', 'Orders currently in production') + UI.loading();
  try {
    const { data: tasks } = await sb.from('production_tasks').select('*, orders(order_number, franchise_id, total_items, total_qty), franchises(franchise_name)').eq('status', 'in_progress').order('start_time', { ascending: false });
    let html = UI.header('Active Production', 'Orders currently in production');
    if (!tasks || !tasks.length) {
      html += UI.empty('🔄', 'No active production tasks.');
    } else {
      for (const t of tasks) {
        html += `<div class="table-card" style="padding:1.25rem;margin-bottom:1rem;">
          <div style="display:flex;justify-content:space-between;align-items:start;">
            <div>
              <h3 style="margin:0;">${t.production_number}</h3>
              <div style="font-size:.85rem;color:#999;">Order: ${t.orders?.order_number || '—'} · ${t.franchises?.franchise_name || '—'} · Started: ${UI.fmtDateTime(t.start_time)}</div>
            </div>
            <div style="display:flex;gap:.5rem;">
              <button class="btn-save" data-complete="${t.id}" style="padding:.3rem .75rem;font-size:.85rem;">✓ Complete</button>
              <button class="btn-danger" data-issue="${t.id}" style="padding:.3rem .75rem;font-size:.85rem;">Report Issue</button>
            </div>
          </div>
        </div>`;
      }
    }
    main.innerHTML = html;
    main.querySelectorAll('[data-complete]').forEach(btn => btn.addEventListener('click', () => completeProduction(btn.dataset.complete, main, user)));
    main.querySelectorAll('[data-issue]').forEach(btn => btn.addEventListener('click', () => showProductionIssueModal(btn.dataset.issue, main, user)));
  } catch (e) {
    main.innerHTML = UI.header('Active Production') + UI.empty('🔄', 'Unable to load active production.');
  }
}

async function completeProduction(taskId, main, user) {
  UI.confirm('Complete Production', 'Mark this production task as completed? This will move the order to Ready for Dispatch.', async () => {
    try {
      const { data: task } = await sb.from('production_tasks').select('*, orders(order_number, franchise_id, created_by)').eq('id', taskId).single();
      await sb.from('production_tasks').update({ status: 'completed', completion_time: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', taskId);
      await DB.updateOrderStatus(task.order_id, 'production_completed');
      await DB.notify(task.orders.created_by, 'Production Completed', `Production completed for order ${task.orders.order_number}. Order is now ready for dispatch.`, 'success', task.order_id, 'order');
      await DB.notifyRole('dispatch', 'Order Ready for Dispatch', `Order ${task.orders.order_number} is ready for dispatch.`, 'info', task.order_id, 'order');
      await DB.log('COMPLETE_PRODUCTION', 'production_task', task.production_number, `Completed production ${task.production_number}`);
      UI.toast('Production completed! Order ready for dispatch.', 'success');
      renderActiveProduction(main, user);
    } catch (e) { UI.toast('Failed: ' + e.message, 'error'); }
  }, 'Complete Production');
}

async function renderCompletedProduction(main, user) {
  main.innerHTML = UI.header('Completed Production', 'Finished production tasks') + UI.loading();
  try {
    const { data: tasks } = await sb.from('production_tasks').select('*, orders(order_number), franchises(franchise_name)').eq('status', 'completed').order('completion_time', { ascending: false });
    let html = UI.header('Completed Production', 'Finished production tasks');
    html += UI.table(
      ['Production #', 'Order #', 'Franchise', 'Started', 'Completed', 'Actions'],
      (tasks || []).map(t => [t.production_number, t.orders?.order_number || '—', t.franchises?.franchise_name || '—', UI.fmtDateTime(t.start_time), UI.fmtDateTime(t.completion_time), `<button class="fm-edit-btn" data-order="${t.order_id}">View Order</button>`]),
      { emptyMsg: 'No completed production tasks' }
    );
    main.innerHTML = html;
    main.querySelectorAll('[data-order]').forEach(btn => btn.addEventListener('click', () => viewOrderDetails(btn.dataset.order)));
  } catch (e) {
    main.innerHTML = UI.header('Completed Production') + UI.empty('✅', 'Unable to load completed tasks.');
  }
}

async function renderProductionIssues(main, user) {
  main.innerHTML = UI.header('Production Issues', 'Reported production problems') + UI.loading();
  try {
    const { data: issues } = await sb.from('production_issues').select('*, production_tasks(production_number), orders(order_number)').order('created_at', { ascending: false });
    let html = UI.header('Production Issues', 'Reported production problems');
    html += `<button class="btn-save" id="newIssueBtn" style="margin-bottom:1rem;">+ Report New Issue</button>`;
    html += UI.table(
      ['Issue', 'Production #', 'Order #', 'Type', 'Severity', 'Status', 'Reported'],
      (issues || []).map(i => [i.description?.slice(0, 40) || '—', i.production_tasks?.production_number || '—', i.orders?.order_number || '—', i.issue_type, UI.badge(i.severity), UI.badge(i.status), UI.fmtDate(i.created_at)]),
      { emptyMsg: 'No production issues reported' }
    );
    main.innerHTML = html;

    main.querySelector('#newIssueBtn').addEventListener('click', () => showNewIssueModal(main, user));
  } catch (e) {
    main.innerHTML = UI.header('Production Issues') + UI.empty('⚠️', 'Unable to load issues.');
  }
}

function showNewIssueModal(main, user) {
  sb.from('production_tasks').select('*, orders(order_number)').eq('status', 'in_progress').then(({ data: tasks }) => {
    UI.modal('Report Production Issue', `
      ${UI.formField('Production Task', UI.select('issueTask', (tasks || []).map(t => ({ value: t.id, label: `${t.production_number} — ${t.orders?.order_number || ''}` })) || [{ value: '', label: 'No active tasks' }]), true)}
      ${UI.formField('Issue Type', UI.select('issueType', [
        { value: 'insufficient_materials', label: 'Insufficient Raw Materials' },
        { value: 'equipment_problem', label: 'Equipment Problem' },
        { value: 'quantity_shortage', label: 'Quantity Shortage' },
        { value: 'damaged_materials', label: 'Damaged Materials' },
        { value: 'quality_issue', label: 'Quality Issue' },
        { value: 'production_delay', label: 'Production Delay' },
        { value: 'other', label: 'Other' }
      ]), true)}
      ${UI.formField('Severity', UI.select('issueSeverity', [
        { value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' },
        { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }
      ]))}
      ${UI.formField('Quantity Affected', UI.input('issueQty', '0', 'number'))}
      ${UI.formField('Description', UI.textarea('issueDesc', 'Describe the issue...', 3), true)}
      <div style="margin-top:1rem;">${UI.button('Report Issue', 'submitIssueBtn', 'danger')}
      <button class="btn-cancel" data-close style="margin-left:.5rem;">Cancel</button></div>
    `, (modal) => {
      modal.querySelector('#submitIssueBtn').onclick = async () => {
        const taskId = modal.querySelector('#issueTask').value;
        const desc = modal.querySelector('#issueDesc').value;
        if (!taskId || !desc) return UI.toast('Task and description required', 'error');
        try {
          const { data: task } = await sb.from('production_tasks').select('*, orders(order_number)').eq('id', taskId).single();
          await sb.from('production_issues').insert([{
            production_task_id: taskId, order_id: task.order_id,
            issue_type: modal.querySelector('#issueType').value, description: desc,
            qty_affected: Number(modal.querySelector('#issueQty').value), severity: modal.querySelector('#issueSeverity').value,
            status: 'open', reported_by: user.id
          }]);
          await sb.from('production_tasks').update({ status: 'issue_reported', updated_at: new Date().toISOString() }).eq('id', taskId);
          await DB.updateOrderStatus(task.order_id, 'issue_reported');
          await DB.notifyRole('admin', 'Production Issue Reported', `Issue reported for ${task.production_number}: ${desc}`, 'error', task.order_id, 'order');
          await DB.log('REPORT_ISSUE', 'production_issue', null, `Reported issue: ${desc}`);
          UI.toast('Issue reported! Admin has been notified.', 'success');
          modal.remove(); renderProductionIssues(main, user);
        } catch (e) { UI.toast('Failed: ' + e.message, 'error'); }
      };
    });
  });
}

function showProductionIssueModal(taskId, main, user) {
  sb.from('production_tasks').select('*, orders(order_number)').eq('id', taskId).single().then(({ data: task }) => {
    UI.modal('Report Production Issue', `
      ${UI.formField('Issue Type', UI.select('issueType', [
        { value: 'insufficient_materials', label: 'Insufficient Raw Materials' },
        { value: 'equipment_problem', label: 'Equipment Problem' },
        { value: 'quantity_shortage', label: 'Quantity Shortage' },
        { value: 'damaged_materials', label: 'Damaged Materials' },
        { value: 'quality_issue', label: 'Quality Issue' },
        { value: 'production_delay', label: 'Production Delay' },
        { value: 'other', label: 'Other' }
      ]), true)}
      ${UI.formField('Severity', UI.select('issueSeverity', [
        { value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' },
        { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }
      ]))}
      ${UI.formField('Quantity Affected', UI.input('issueQty', '0', 'number'))}
      ${UI.formField('Description', UI.textarea('issueDesc', 'Describe the issue...', 3), true)}
      <div style="margin-top:1rem;">${UI.button('Report Issue', 'submitIssueBtn', 'danger')}
      <button class="btn-cancel" data-close style="margin-left:.5rem;">Cancel</button></div>
    `, (modal) => {
      modal.querySelector('#submitIssueBtn').onclick = async () => {
        const desc = modal.querySelector('#issueDesc').value;
        if (!desc) return UI.toast('Description is required', 'error');
        try {
          await sb.from('production_issues').insert([{
            production_task_id: taskId, order_id: task.order_id,
            issue_type: modal.querySelector('#issueType').value, description: desc,
            qty_affected: Number(modal.querySelector('#issueQty').value), severity: modal.querySelector('#issueSeverity').value,
            status: 'open', reported_by: user.id
          }]);
          await sb.from('production_tasks').update({ status: 'issue_reported', updated_at: new Date().toISOString() }).eq('id', taskId);
          await DB.updateOrderStatus(task.order_id, 'issue_reported');
          await DB.notifyRole('admin', 'Production Issue Reported', `Issue reported for ${task.production_number}: ${desc}`, 'error', task.order_id, 'order');
          await DB.log('REPORT_ISSUE', 'production_issue', null, `Reported issue: ${desc}`);
          UI.toast('Issue reported! Admin has been notified.', 'success');
          modal.remove(); renderActiveProduction(main, user);
        } catch (e) { UI.toast('Failed: ' + e.message, 'error'); }
      };
    });
  });
}

window.Pages = Pages;
