// Admin Dashboard — full ERP management
var Pages = window.Pages || {};

Pages.adminDashboard = function(el) {
  const user = Auth.currentUser;
  const navItems = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'franchises', icon: '🏪', label: 'Franchise Management' },
    { id: 'orders', icon: '🧾', label: 'All Orders' },
    { id: 'products', icon: '📦', label: 'Available Supplies' },
    { id: 'production', icon: '🏭', label: 'Production', navigate: '/ProductionDashboard' },
    { id: 'dispatch', icon: '🚚', label: 'Dispatch', navigate: '/DispatchDashboard' },
    { id: 'announcements', icon: '📢', label: 'Announcements' },
    { id: 'reports', icon: '📈', label: 'Reports' },
    { id: 'logs', icon: '📋', label: 'Activity Logs' },
    { id: 'profile', icon: '👤', label: 'My Profile' },
    { id: 'settings', icon: '⚙️', label: 'Settings' }
  ];

  dashLayout(el, user, navItems, async (main, tab) => {
    if (tab === 'dashboard') await renderAdminDashboard(main);
    else if (tab === 'franchises') await renderFranchiseManagement(main);
    else if (tab === 'orders') await renderAllOrders(main);
    else if (tab === 'products') await renderProducts(main);
    else if (tab === 'announcements') await renderAnnouncements(main);
    else if (tab === 'reports') await renderReports(main);
    else if (tab === 'logs') await renderActivityLogs(main);
    else if (tab === 'profile') await renderProfile(main, user);
    else if (tab === 'settings') await renderSettings(main);
  });
};

// ─── ADMIN DASHBOARD ───
async function renderAdminDashboard(main) {
  main.innerHTML = UI.header('Admin Overview', 'Central franchise management dashboard') + UI.loading();
  try {
    const [{ data: franchises }, { data: orders }, { data: products }, { data: prodTasks }, { data: dispatches }, { data: issues }] = await Promise.all([
      sb.from('franchises').select('*'),
      sb.from('orders').select('*').order('created_at', { ascending: false }),
      sb.from('products').select('*'),
      sb.from('production_tasks').select('*'),
      sb.from('dispatches').select('*'),
      sb.from('production_issues').select('*').eq('status', 'open')
    ]);

    const today = new Date().toISOString().slice(0, 10);
    const stats = [
      { label: 'Total Franchises', value: (franchises || []).length, icon: '🏪' },
      { label: 'Active Franchises', value: (franchises || []).filter(f => f.business_status === 'active').length, accent: true, icon: '✅' },
      { label: 'Pending Orders', value: (orders || []).filter(o => o.status === 'pending_approval').length, icon: '⏳' },
      { label: 'Orders Today', value: (orders || []).filter(o => o.created_at?.slice(0, 10) === today).length, icon: '📅' },
      { label: 'In Production', value: (prodTasks || []).filter(t => t.status === 'in_progress').length, icon: '🏭' },
      { label: 'Ready for Dispatch', value: (orders || []).filter(o => o.status === 'ready_for_dispatch').length, icon: '📦' },
      { label: 'In Transit', value: (orders || []).filter(o => o.status === 'in_transit').length, icon: '🚚' },
      { label: 'Delivered', value: (orders || []).filter(o => o.status === 'delivered' || o.status === 'received').length, accent: true, icon: '✅' },
      { label: 'Low Stock Items', value: (products || []).filter(p => (p.current_stock || 0) <= (p.min_stock || 0)).length, icon: '⚠️' },
      { label: 'Open Issues', value: (issues || []).length, icon: '🔴' }
    ];

    let html = UI.header('Admin Overview', 'Central franchise management dashboard');
    html += UI.statRow(stats);

    // Recent orders
    const recentOrders = (orders || []).slice(0, 10);
    html += `<div style="margin-top:1.5rem;">${UI.table(
      ['Order #', 'Franchise', 'Date', 'Status', 'Items', 'Total'],
      await Promise.all(recentOrders.map(async o => {
        const fr = (franchises || []).find(f => f.id === o.franchise_id);
        return [o.order_number, fr?.franchise_name || '—', UI.fmtDate(o.created_at), UI.badge(o.status), o.total_items || 0, UI.fmtPeso(o.total_amount)];
      })),
      { title: 'Recent Orders', emptyMsg: 'No orders yet' }
    )}</div>`;

    // Recent activity
    const { data: logs } = await sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(8);
    html += `<div style="margin-top:1.5rem;">${UI.table(
      ['User', 'Role', 'Action', 'Details', 'Time'],
      (logs || []).map(l => [l.user_name, l.role, l.action, (l.details || '').slice(0, 50), UI.fmtDateTime(l.created_at)]),
      { title: 'Recent Activity', emptyMsg: 'No activity logged' }
    )}</div>`;

    main.innerHTML = html;
  } catch (e) {
    main.innerHTML = UI.header('Admin Overview') + UI.empty('📊', 'Unable to load dashboard data. Make sure the database is set up.');
  }
}

// ─── FRANCHISE MANAGEMENT ───
async function renderFranchiseManagement(main) {
  main.innerHTML = UI.header('Franchise Management', 'Onboard and monitor every Chookee Inasal franchisee',
    `<button class="btn-save" id="addFranchiseBtn">+ Add Franchise</button>`) + UI.loading();

  try {
    const { data: franchises } = await sb.from('franchises').select('*').order('created_at', { ascending: false });
    const list = franchises || [];

    let html = UI.header('Franchise Management', 'Onboard and monitor every Chookee Inasal franchisee',
      `<button class="btn-save" id="addFranchiseBtn">+ Add Franchise</button>`);

    html += UI.statRow([
      { label: 'Total Franchises', value: list.length, icon: '🏪' },
      { label: 'Active', value: list.filter(f => f.business_status === 'active').length, accent: true, icon: '✅' },
      { label: 'Pending', value: list.filter(f => f.business_status === 'pending').length, icon: '⏳' },
      { label: 'Suspended', value: list.filter(f => f.business_status === 'suspended').length, icon: '⏸️' }
    ]);

    html += `<div style="display:flex;gap:1rem;margin-bottom:1rem;">
      ${UI.searchBar('fmSearch', 'Search by name or code...')}
      ${UI.filterSelect('fmStatusFilter', [
        { value: 'active', label: 'Active' }, { value: 'pending', label: 'Pending' },
        { value: 'suspended', label: 'Suspended' }, { value: 'inactive', label: 'Inactive' }
      ])}
    </div>`;

    if (!list.length) {
      html += UI.empty('🏪', 'No franchises yet. Click "Add Franchise" to get started.');
    } else {
      html += `<div id="fmCards" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:1rem;">`;
      for (const f of list) {
        html += `<div class="fm-card" data-name="${(f.franchise_name + ' ' + f.franchise_code).toLowerCase()}" data-status="${f.business_status}">
          <div class="fm-card-header">
            <div class="fm-card-avatar">${(f.franchise_name || '?')[0].toUpperCase()}</div>
            <div class="fm-card-info">
              <div class="fm-card-name">${f.franchise_name}</div>
              <div class="fm-card-pkg">${f.franchise_code}</div>
            </div>
            ${UI.badge(f.business_status)}
          </div>
          <div class="fm-card-details">
            <span>📍 ${f.city || '—'}, ${f.province || ''}</span>
            <span>👤 ${f.owner_name || '—'}</span>
            <span>📞 ${f.phone || '—'}</span>
          </div>
          <div class="fm-card-fin">
            <div><div class="fm-fin-label">Franchise Fee</div><div class="fm-fin-val">${UI.fmtPeso(f.franchise_fee)}</div></div>
            <div><div class="fm-fin-label">Royalty Rate</div><div class="fm-fin-val">${f.royalty_rate}%</div></div>
            <div><div class="fm-fin-label">Opened</div><div class="fm-fin-val">${UI.fmtDate(f.opening_date)}</div></div>
          </div>
          <div class="fm-card-actions">
            <button class="fm-edit-btn" data-view="${f.id}">View Details</button>
            <button class="fm-edit-btn" data-edit="${f.id}">Edit</button>
            <button class="fm-edit-btn" data-toggle="${f.id}" data-status="${f.business_status}">${f.business_status === 'active' ? 'Deactivate' : 'Activate'}</button>
          </div>
        </div>`;
      }
      html += `</div>`;
    }

    main.innerHTML = html;

    // Wire up
    main.querySelector('#addFranchiseBtn')?.addEventListener('click', () => showAddFranchiseModal(main));
    main.querySelector('#fmSearch')?.addEventListener('input', (e) => filterCards(main, e.target.value, main.querySelector('#fmStatusFilter').value));
    main.querySelector('#fmStatusFilter')?.addEventListener('change', (e) => filterCards(main, main.querySelector('#fmSearch').value, e.target.value));

    main.querySelectorAll('[data-view]').forEach(btn => btn.addEventListener('click', () => viewFranchiseDetails(main, btn.dataset.view)));
    main.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => showEditFranchiseModal(main, btn.dataset.edit)));
    main.querySelectorAll('[data-toggle]').forEach(btn => btn.addEventListener('click', () => toggleFranchiseStatus(btn.dataset.toggle, btn.dataset.status, main)));
  } catch (e) {
    main.innerHTML = UI.header('Franchise Management') + UI.empty('🏪', 'Unable to load franchises.');
  }
}

function filterCards(main, query, status) {
  main.querySelectorAll('.fm-card').forEach(card => {
    const matchQ = !query || card.dataset.name.includes(query.toLowerCase());
    const matchS = !status || card.dataset.status === status;
    card.style.display = (matchQ && matchS) ? '' : 'none';
  });
}

function showAddFranchiseModal(main) {
  UI.modal('Add New Franchise', `
    ${UI.formField('Franchise Name', UI.input('fName', 'e.g. Chookee Inasal - Talisay'), true)}
    ${UI.formField('Owner Name', UI.input('fOwner', 'Owner full name'))}
    ${UI.formField('Contact Number', UI.input('fPhone', '0917-xxx-xxxx'))}
    ${UI.formField('Email', UI.input('fEmail', 'email@example.com', 'email'))}
    ${UI.formField('Address', UI.input('fAddress', 'Street address'))}
    ${UI.formField('City', UI.input('fCity', 'City'))}
    ${UI.formField('Province', UI.input('fProvince', 'Province'))}
    ${UI.formField('Region', UI.input('fRegion', 'Region'))}
    ${UI.formField('Franchise Fee', UI.input('fFee', '0.00', 'number'))}
    ${UI.formField('Royalty Rate (%)', UI.input('fRoyalty', '5', 'number'))}
    ${UI.formField('Opening Date', UI.input('fOpening', '', 'date'))}
    <div style="margin-top:1rem;">
      ${UI.button('Create Franchise', 'saveFranchiseBtn')}
      <button class="btn-cancel" data-close style="margin-left:.5rem;">Cancel</button>
    </div>
  `, (modal) => {
    modal.querySelector('#saveFranchiseBtn').onclick = async () => {
      const name = modal.querySelector('#fName').value;
      if (!name) return UI.toast('Franchise name is required', 'error');
      try {
        const code = await DB.generateFranchiseCode();
        const { data, error } = await sb.from('franchises').insert([{
          franchise_code: code, franchise_name: name,
          owner_name: modal.querySelector('#fOwner').value, phone: modal.querySelector('#fPhone').value,
          email: modal.querySelector('#fEmail').value, address: modal.querySelector('#fAddress').value,
          city: modal.querySelector('#fCity').value, province: modal.querySelector('#fProvince').value,
          region: modal.querySelector('#fRegion').value, franchise_fee: Number(modal.querySelector('#fFee').value),
          royalty_rate: Number(modal.querySelector('#fRoyalty').value), opening_date: modal.querySelector('#fOpening').value
        }]).select().single();
        if (error) throw error;
        await DB.log('CREATE_FRANCHISE', 'franchise', code, `Created franchise ${code} - ${name}`);
        UI.toast('Franchise created!', 'success');
        modal.remove();
        renderFranchiseManagement(main);
      } catch (e) { UI.toast('Failed: ' + e.message, 'error'); }
    };
  });
}

function showEditFranchiseModal(main, franchiseId) {
  sb.from('franchises').select('*').eq('id', franchiseId).single().then(({ data: f }) => {
    if (!f) return;
    UI.modal('Edit Franchise — ' + f.franchise_name, `
      ${UI.formField('Franchise Name', UI.input('fName', '', 'text', f.franchise_name), true)}
      ${UI.formField('Owner Name', UI.input('fOwner', '', 'text', f.owner_name || ''))}
      ${UI.formField('Contact Number', UI.input('fPhone', '', 'text', f.phone || ''))}
      ${UI.formField('Email', UI.input('fEmail', '', 'email', f.email || ''))}
      ${UI.formField('Address', UI.input('fAddress', '', 'text', f.address || ''))}
      ${UI.formField('City', UI.input('fCity', '', 'text', f.city || ''))}
      ${UI.formField('Province', UI.input('fProvince', '', 'text', f.province || ''))}
      ${UI.formField('Business Status', UI.select('fStatus', [
        { value: 'active', label: 'Active' }, { value: 'pending', label: 'Pending' },
        { value: 'suspended', label: 'Suspended' }, { value: 'inactive', label: 'Inactive' }
      ], f.business_status))}
      ${UI.formField('Franchise Fee', UI.input('fFee', '', 'number', f.franchise_fee || 0))}
      ${UI.formField('Royalty Rate (%)', UI.input('fRoyalty', '', 'number', f.royalty_rate || 5))}
      <div style="margin-top:1rem;">
        ${UI.button('Save Changes', 'saveEditBtn')}
        <button class="btn-cancel" data-close style="margin-left:.5rem;">Cancel</button>
      </div>
    `, (modal) => {
      modal.querySelector('#saveEditBtn').onclick = async () => {
        try {
          const { error } = await sb.from('franchises').update({
            franchise_name: modal.querySelector('#fName').value, owner_name: modal.querySelector('#fOwner').value,
            phone: modal.querySelector('#fPhone').value, email: modal.querySelector('#fEmail').value,
            address: modal.querySelector('#fAddress').value, city: modal.querySelector('#fCity').value,
            province: modal.querySelector('#fProvince').value, business_status: modal.querySelector('#fStatus').value,
            franchise_fee: Number(modal.querySelector('#fFee').value), royalty_rate: Number(modal.querySelector('#fRoyalty').value),
            updated_at: new Date().toISOString()
          }).eq('id', franchiseId);
          if (error) throw error;
          await DB.log('UPDATE_FRANCHISE', 'franchise', f.franchise_code, `Updated franchise ${f.franchise_code}`);
          UI.toast('Franchise updated!', 'success');
          modal.remove();
          renderFranchiseManagement(main);
        } catch (e) { UI.toast('Failed: ' + e.message, 'error'); }
      };
    });
  });
}

async function viewFranchiseDetails(main, franchiseId) {
  const [{ data: f }, { data: orders }, { data: inventory }] = await Promise.all([
    sb.from('franchises').select('*').eq('id', franchiseId).single(),
    sb.from('orders').select('*').eq('franchise_id', franchiseId).order('created_at', { ascending: false }),
    sb.from('inventory').select('*, products(name, sku, category, unit)').eq('franchise_id', franchiseId)
  ]);

  const lowStock = (inventory || []).filter(i => (i.current_qty || 0) <= (i.min_stock || 0));
  let html = `<div style="display:flex;gap:2rem;flex-wrap:wrap;margin-bottom:1.5rem;">
    <div><strong>Code:</strong> ${f.franchise_code}</div>
    <div><strong>Owner:</strong> ${f.owner_name || '—'}</div>
    <div><strong>Contact:</strong> ${f.phone || '—'}</div>
    <div><strong>Location:</strong> ${f.city || ''}, ${f.province || ''}</div>
    <div><strong>Status:</strong> ${UI.badge(f.business_status)}</div>
  </div>`;

  html += UI.statRow([
    { label: 'Total Orders', value: (orders || []).length, icon: '🧾' },
    { label: 'Low Stock Items', value: lowStock.length, accent: lowStock.length > 0, icon: '⚠️' },
    { label: 'Inventory Items', value: (inventory || []).length, icon: '📦' }
  ]);

  html += `<div style="margin-top:1rem;">${UI.table(
    ['Product', 'SKU', 'Current Qty', 'Min Stock', 'Status'],
    (inventory || []).map(i => [i.products?.name || '—', i.products?.sku || '—', `${i.current_qty} ${i.products?.unit || ''}`, i.min_stock, (i.current_qty || 0) <= (i.min_stock || 0) ? UI.badge('low') : UI.badge('active')]),
    { title: 'Inventory', emptyMsg: 'No inventory items' }
  )}</div>`;

  html += `<div style="margin-top:1rem;">${UI.table(
    ['Order #', 'Date', 'Status', 'Items', 'Total'],
    (orders || []).slice(0, 10).map(o => [o.order_number, UI.fmtDate(o.created_at), UI.badge(o.status), o.total_items || 0, UI.fmtPeso(o.total_amount)]),
    { title: 'Order History', emptyMsg: 'No orders yet' }
  )}</div>`;

  UI.modal('Franchise Details — ' + f.franchise_name, html);
}

async function toggleFranchiseStatus(id, currentStatus, main) {
  const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
  UI.confirm('Confirm Status Change', `Are you sure you want to ${newStatus === 'active' ? 'activate' : 'suspend'} this franchise?`, async () => {
    await sb.from('franchises').update({ business_status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
    await DB.log('TOGGLE_FRANCHISE', 'franchise', id, `Changed franchise status to ${newStatus}`);
    UI.toast(`Franchise ${newStatus === 'active' ? 'activated' : 'suspended'}`, 'success');
    renderFranchiseManagement(main);
  }, newStatus === 'active' ? 'Activate' : 'Suspend', true);
}

// ─── ALL ORDERS ───
async function renderAllOrders(main) {
  main.innerHTML = UI.header('All Orders', 'Orders across all branches') + UI.loading();
  try {
    const [{ data: orders }, { data: franchises }] = await Promise.all([
      sb.from('orders').select('*').order('created_at', { ascending: false }),
      sb.from('franchises').select('*')
    ]);

    let html = UI.header('All Orders', 'Orders across all branches');
    html += `<div style="display:flex;gap:1rem;margin-bottom:1rem;flex-wrap:wrap;">
      ${UI.searchBar('orderSearch', 'Search by order number...')}
      ${UI.filterSelect('orderStatusFilter', [
        { value: 'pending_approval', label: 'Pending Approval' }, { value: 'approved', label: 'Approved' },
        { value: 'in_production', label: 'In Production' }, { value: 'production_completed', label: 'Production Complete' },
        { value: 'ready_for_dispatch', label: 'Ready for Dispatch' }, { value: 'dispatched', label: 'Dispatched' },
        { value: 'in_transit', label: 'In Transit' }, { value: 'delivered', label: 'Delivered' },
        { value: 'received', label: 'Received' }, { value: 'rejected', label: 'Rejected' },
        { value: 'cancelled', label: 'Cancelled' }
      ])}
    </div>`;

    const rows = (orders || []).map(o => {
      const fr = (franchises || []).find(f => f.id === o.franchise_id);
      return [o.order_number, fr?.franchise_name || '—', UI.fmtDate(o.created_at), UI.fmtDate(o.requested_delivery_date), o.total_items || 0, o.total_qty || 0, UI.badge(o.status), `<button class="fm-edit-btn" data-order="${o.id}">View</button>`];
    });

    html += UI.table(['Order #', 'Franchise', 'Order Date', 'Delivery Date', 'Items', 'Qty', 'Status', 'Actions'], rows, { emptyMsg: 'No orders found' });
    main.innerHTML = html;

    // Wire search/filter
    const filterOrders = () => {
      const q = main.querySelector('#orderSearch').value.toLowerCase();
      const s = main.querySelector('#orderStatusFilter').value;
      main.querySelectorAll('tbody tr').forEach((tr, i) => {
        const o = (orders || [])[i];
        if (!o) return;
        const matchQ = !q || o.order_number.toLowerCase().includes(q);
        const matchS = !s || o.status === s;
        tr.style.display = (matchQ && matchS) ? '' : 'none';
      });
    };
    main.querySelector('#orderSearch')?.addEventListener('input', filterOrders);
    main.querySelector('#orderStatusFilter')?.addEventListener('change', filterOrders);

    main.querySelectorAll('[data-order]').forEach(btn => btn.addEventListener('click', () => viewOrderDetails(btn.dataset.order)));
  } catch (e) {
    main.innerHTML = UI.header('All Orders') + UI.empty('🧾', 'Unable to load orders.');
  }
}

async function viewOrderDetails(orderId) {
  const [{ data: order }, { data: items }, { data: timeline }, { data: franchise }, { data: production }, { data: dispatch }] = await Promise.all([
    sb.from('orders').select('*').eq('id', orderId).single(),
    sb.from('order_items').select('*').eq('order_id', orderId),
    sb.from('order_timeline').select('*').eq('order_id', orderId).order('created_at', { ascending: true }),
    sb.from('franchises').select('*'),
    sb.from('production_tasks').select('*').eq('order_id', orderId),
    sb.from('dispatches').select('*').eq('order_id', orderId)
  ]);

  const fr = (franchise || []).find(f => f.id === order?.franchise_id);
  let html = `<div style="display:flex;gap:2rem;flex-wrap:wrap;margin-bottom:1.5rem;">
    <div><strong>Order:</strong> ${order.order_number}</div>
    <div><strong>Franchise:</strong> ${fr?.franchise_name || '—'}</div>
    <div><strong>Status:</strong> ${UI.badge(order.status)}</div>
    <div><strong>Created:</strong> ${UI.fmtDateTime(order.created_at)}</div>
    <div><strong>Delivery Date:</strong> ${UI.fmtDate(order.requested_delivery_date)}</div>
  </div>`;

  if (order.rejection_reason) html += `<div class="alert alert-danger"><strong>Rejection Reason:</strong> ${order.rejection_reason}</div>`;
  if (order.notes) html += `<div class="alert"><strong>Notes:</strong> ${order.notes}</div>`;

  // Order items
  html += UI.table(['Product', 'SKU', 'Category', 'Qty', 'Unit', 'Price', 'Total', 'Prod Status'],
    (items || []).map(i => [i.product_name, i.sku, i.category, i.quantity, i.unit, UI.fmtPeso(i.unit_price), UI.fmtPeso(i.total), UI.badge(i.production_status || 'pending')]),
    { title: 'Order Items', emptyMsg: 'No items' }
  );

  // Admin actions
  if (Auth.isAdmin() && order.status === 'pending_approval') {
    html += `<div style="margin:1rem 0;display:flex;gap:.5rem;">
      <button class="btn-save" data-approve="${orderId}">✓ Approve Order</button>
      <button class="btn-danger" data-reject="${orderId}">✕ Reject Order</button>
    </div>`;
  }

  // Production info
  if (production && production.length) {
    const p = production[0];
    html += `<div style="margin-top:1rem;">${UI.table(['Production #', 'Status', 'Priority', 'Start', 'Completed'],
      [[p.production_number, UI.badge(p.status), p.priority, UI.fmtDateTime(p.start_time), UI.fmtDateTime(p.completion_time)]],
      { title: 'Production Task' })}</div>`;
  }

  // Dispatch info
  if (dispatch && dispatch.length) {
    const d = dispatch[0];
    html += `<div style="margin-top:1rem;">${UI.table(['Dispatch #', 'Driver', 'Vehicle', 'Scheduled', 'Status'],
      [[d.dispatch_number, d.driver_name || '—', d.vehicle || '—', `${UI.fmtDate(d.scheduled_date)} ${d.scheduled_time || ''}`, UI.badge(d.status)]],
      { title: 'Dispatch Record' })}</div>`;
  }

  // Timeline
  if (timeline && timeline.length) {
    html += `<div style="margin-top:1rem;"><div class="table-card-header"><h3>Order Timeline</h3></div>${UI.timeline(timeline)}</div>`;
  }

  UI.modal('Order Details — ' + order.order_number, html, (modal) => {
    modal.querySelector('[data-approve]')?.addEventListener('click', () => approveOrder(orderId, modal));
    modal.querySelector('[data-reject]')?.addEventListener('click', () => showRejectModal(orderId, modal));
  });
}

function approveOrder(orderId, modal) {
  UI.confirm('Approve Order', 'Are you sure you want to approve this order? This will send it to production.', async () => {
    try {
      const result = await DB.updateOrderStatus(orderId, 'approved', { approved_by: Auth.currentUser.id });
      if (result.error) return UI.toast(result.error, 'error');

      // Create production task
      const { data: order } = await sb.from('orders').select('*').eq('id', orderId).single();
      const prdNum = await DB.generateProductionId();
      await sb.from('production_tasks').insert([{
        production_number: prdNum, order_id: orderId, franchise_id: order.franchise_id,
        status: 'pending', priority: 'normal'
      }]);

      // Notify franchise and production
      await DB.notify(order.created_by, 'Order Approved', `Your order ${order.order_number} has been approved and sent to production.`, 'success', orderId, 'order');
      await DB.notifyRole('production', 'New Production Task', `Order ${order.order_number} is ready for production.`, 'info', orderId, 'order');

      await DB.log('APPROVE_ORDER', 'order', order.order_number, `Approved order ${order.order_number}`);
      UI.toast('Order approved and sent to production!', 'success');
      modal.remove();
    } catch (e) { UI.toast('Failed: ' + e.message, 'error'); }
  }, 'Approve Order');
}

function showRejectModal(orderId, parentModal) {
  UI.modal('Reject Order', `
    ${UI.formField('Rejection Reason', UI.textarea('rejectReason', 'Explain why this order is being rejected...', 4), true)}
    <div style="margin-top:1rem;">${UI.button('Reject Order', 'confirmRejectBtn', 'danger')}
    <button class="btn-cancel" data-close style="margin-left:.5rem;">Cancel</button></div>
  `, (modal) => {
    modal.querySelector('#confirmRejectBtn').onclick = async () => {
      const reason = modal.querySelector('#rejectReason').value;
      if (!reason) return UI.toast('Rejection reason is required', 'error');
      try {
        const { data: order } = await sb.from('orders').select('*').eq('id', orderId).single();
        await sb.from('orders').update({ status: 'rejected', rejection_reason: reason, updated_at: new Date().toISOString() }).eq('id', orderId);
        await DB.addTimeline(orderId, 'Order Rejected', `Order rejected: ${reason}`);
        await DB.notify(order.created_by, 'Order Rejected', `Your order ${order.order_number} was rejected: ${reason}`, 'error', orderId, 'order');
        await DB.log('REJECT_ORDER', 'order', order.order_number, `Rejected order: ${reason}`);
        UI.toast('Order rejected', 'success');
        modal.remove(); parentModal.remove();
      } catch (e) { UI.toast('Failed: ' + e.message, 'error'); }
    };
  });
}

// ─── PRODUCTS / SUPPLIES ───
async function renderProducts(main) {
  main.innerHTML = UI.header('Available Supplies', 'Manage the supplies franchisees can order',
    `<button class="btn-save" id="addProductBtn">+ Add Supply</button>`) + UI.loading();

  try {
    const { data: products } = await sb.from('products').select('*').order('name');
    const list = products || [];

    let html = UI.header('Available Supplies', 'Manage the supplies franchisees can order',
      `<button class="btn-save" id="addProductBtn">+ Add Supply</button>`);

    html += `<div style="display:flex;gap:1rem;margin-bottom:1rem;">
      ${UI.searchBar('prodSearch', 'Search by name or SKU...')}
      ${UI.filterSelect('prodCatFilter', [
        { value: 'Chicken', label: 'Chicken' }, { value: 'Marinades', label: 'Marinades' },
        { value: 'Sauces', label: 'Sauces' }, { value: 'Rice', label: 'Rice' },
        { value: 'Vegetables', label: 'Vegetables' }, { value: 'Packaging', label: 'Packaging' },
        { value: 'Beverages', label: 'Beverages' }, { value: 'Condiments', label: 'Condiments' },
        { value: 'Cleaning Supplies', label: 'Cleaning Supplies' }, { value: 'Other', label: 'Other' }
      ])}
    </div>`;

    const rows = list.map(p => [
      p.name, p.sku, p.category, p.unit,
      `${p.current_stock || 0}`, `${p.min_stock || 0}`,
      (p.current_stock || 0) <= (p.min_stock || 0) ? UI.badge('low') : UI.badge('active'),
      UI.fmtPeso(p.unit_price),
      p.available_for_ordering ? '✅' : '❌',
      `<button class="fm-edit-btn" data-edit-prod="${p.id}">Edit</button>`
    ]);

    html += UI.table(['Name', 'SKU', 'Category', 'Unit', 'Stock', 'Min', 'Status', 'Price', 'Orderable', 'Actions'], rows, { emptyMsg: 'No supplies yet' });
    main.innerHTML = html;

    main.querySelector('#addProductBtn').addEventListener('click', () => showAddProductModal(main));
    main.querySelectorAll('[data-edit-prod]').forEach(btn => btn.addEventListener('click', () => showEditProductModal(main, btn.dataset.editProd)));

    const filterProds = () => {
      const q = main.querySelector('#prodSearch').value.toLowerCase();
      const c = main.querySelector('#prodCatFilter').value;
      main.querySelectorAll('tbody tr').forEach((tr, i) => {
        const p = list[i]; if (!p) return;
        const matchQ = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
        const matchC = !c || p.category === c;
        tr.style.display = (matchQ && matchC) ? '' : 'none';
      });
    };
    main.querySelector('#prodSearch')?.addEventListener('input', filterProds);
    main.querySelector('#prodCatFilter')?.addEventListener('change', filterProds);
  } catch (e) {
    main.innerHTML = UI.header('Available Supplies') + UI.empty('📦', 'Unable to load supplies.');
  }
}

function showAddProductModal(main) {
  UI.modal('Add New Supply', `
    ${UI.formField('Product Name', UI.input('pName', 'e.g. Chicken Inasal'), true)}
    ${UI.formField('SKU', UI.input('pSku', 'e.g. CHK-001'), true)}
    ${UI.formField('Category', UI.select('pCategory', [
      { value: 'Chicken', label: 'Chicken' }, { value: 'Marinades', label: 'Marinades' },
      { value: 'Sauces', label: 'Sauces' }, { value: 'Rice', label: 'Rice' },
      { value: 'Vegetables', label: 'Vegetables' }, { value: 'Packaging', label: 'Packaging' },
      { value: 'Beverages', label: 'Beverages' }, { value: 'Condiments', label: 'Condiments' },
      { value: 'Kitchen Supplies', label: 'Kitchen Supplies' }, { value: 'Cleaning Supplies', label: 'Cleaning Supplies' },
      { value: 'Other', label: 'Other' }
    ]))}
    ${UI.formField('Unit', UI.input('pUnit', 'e.g. pcs, kg, bottle'))}
    ${UI.formField('Current Stock', UI.input('pStock', '0', 'number'))}
    ${UI.formField('Minimum Stock', UI.input('pMin', '0', 'number'))}
    ${UI.formField('Maximum Stock', UI.input('pMax', '0', 'number'))}
    ${UI.formField('Unit Price (₱)', UI.input('pPrice', '0.00', 'number'))}
    ${UI.formField('Description', UI.textarea('pDesc', 'Product description...'))}
    <div style="margin-top:1rem;">${UI.button('Save Supply', 'saveProductBtn')}
    <button class="btn-cancel" data-close style="margin-left:.5rem;">Cancel</button></div>
  `, (modal) => {
    modal.querySelector('#saveProductBtn').onclick = async () => {
      const name = modal.querySelector('#pName').value;
      const sku = modal.querySelector('#pSku').value;
      if (!name || !sku) return UI.toast('Name and SKU are required', 'error');
      try {
        const { error } = await sb.from('products').insert([{
          name, sku, category: modal.querySelector('#pCategory').value, unit: modal.querySelector('#pUnit').value || 'pcs',
          current_stock: Number(modal.querySelector('#pStock').value), min_stock: Number(modal.querySelector('#pMin').value),
          max_stock: Number(modal.querySelector('#pMax').value), unit_price: Number(modal.querySelector('#pPrice').value),
          description: modal.querySelector('#pDesc').value, available_for_ordering: true, status: 'active'
        }]);
        if (error) throw error;
        await DB.log('CREATE_PRODUCT', 'product', sku, `Created product ${sku} - ${name}`);
        UI.toast('Supply added!', 'success');
        modal.remove(); renderProducts(main);
      } catch (e) { UI.toast('Failed: ' + e.message, 'error'); }
    };
  });
}

function showEditProductModal(main, prodId) {
  sb.from('products').select('*').eq('id', prodId).single().then(({ data: p }) => {
    if (!p) return;
    UI.modal('Edit Supply — ' + p.name, `
      ${UI.formField('Product Name', UI.input('pName', '', 'text', p.name), true)}
      ${UI.formField('SKU', UI.input('pSku', '', 'text', p.sku), true)}
      ${UI.formField('Category', UI.select('pCategory', [
        { value: 'Chicken', label: 'Chicken' }, { value: 'Marinades', label: 'Marinades' },
        { value: 'Sauces', label: 'Sauces' }, { value: 'Rice', label: 'Rice' },
        { value: 'Vegetables', label: 'Vegetables' }, { value: 'Packaging', label: 'Packaging' },
        { value: 'Beverages', label: 'Beverages' }, { value: 'Condiments', label: 'Condiments' },
        { value: 'Kitchen Supplies', label: 'Kitchen Supplies' }, { value: 'Cleaning Supplies', label: 'Cleaning Supplies' },
        { value: 'Other', label: 'Other' }
      ], p.category))}
      ${UI.formField('Unit', UI.input('pUnit', '', 'text', p.unit))}
      ${UI.formField('Current Stock', UI.input('pStock', '', 'number', p.current_stock))}
      ${UI.formField('Minimum Stock', UI.input('pMin', '', 'number', p.min_stock))}
      ${UI.formField('Maximum Stock', UI.input('pMax', '', 'number', p.max_stock))}
      ${UI.formField('Unit Price (₱)', UI.input('pPrice', '', 'number', p.unit_price))}
      ${UI.formField('Available for Ordering', `<label><input type="checkbox" id="pAvail" ${p.available_for_ordering ? 'checked' : ''}> Available</label>`)}
      <div style="margin-top:1rem;">${UI.button('Save Changes', 'saveEditBtn')}
      <button class="btn-cancel" data-close style="margin-left:.5rem;">Cancel</button></div>
    `, (modal) => {
      modal.querySelector('#saveEditBtn').onclick = async () => {
        try {
          const { error } = await sb.from('products').update({
            name: modal.querySelector('#pName').value, sku: modal.querySelector('#pSku').value,
            category: modal.querySelector('#pCategory').value, unit: modal.querySelector('#pUnit').value,
            current_stock: Number(modal.querySelector('#pStock').value), min_stock: Number(modal.querySelector('#pMin').value),
            max_stock: Number(modal.querySelector('#pMax').value), unit_price: Number(modal.querySelector('#pPrice').value),
            available_for_ordering: modal.querySelector('#pAvail').checked, updated_at: new Date().toISOString()
          }).eq('id', prodId);
          if (error) throw error;
          await DB.log('UPDATE_PRODUCT', 'product', p.sku, `Updated product ${p.sku}`);
          UI.toast('Supply updated!', 'success');
          modal.remove(); renderProducts(main);
        } catch (e) { UI.toast('Failed: ' + e.message, 'error'); }
      };
    });
  });
}

// ─── ANNOUNCEMENTS ───
async function renderAnnouncements(main) {
  main.innerHTML = UI.header('Announcements & Memos', 'Broadcast messages to all users',
    `<button class="btn-save" id="newAnnBtn">+ New Announcement</button>`) + UI.loading();

  try {
    const { data: anns } = await sb.from('announcements').select('*').order('created_at', { ascending: false });
    let html = UI.header('Announcements & Memos', 'Broadcast messages to all users',
      `<button class="btn-save" id="newAnnBtn">+ New Announcement</button>`);

    if (!anns || !anns.length) {
      html += UI.empty('📢', 'No announcements yet.');
    } else {
      html += `<div style="display:grid;gap:1rem;">`;
      for (const a of anns) {
        html += `<div class="table-card" style="padding:1.25rem;">
          <div style="display:flex;justify-content:space-between;align-items:start;">
            <div>
              <h3 style="margin:0 0 .25rem;">${a.title}</h3>
              <div style="font-size:.85rem;color:#999;">${UI.fmtDate(a.created_at)} · ${a.target_audience} · ${UI.badge(a.priority)}</div>
            </div>
            ${a.is_active ? UI.badge('active') : UI.badge('inactive')}
          </div>
          <p style="margin:.75rem 0 0;color:#555;">${a.content || ''}</p>
        </div>`;
      }
      html += `</div>`;
    }
    main.innerHTML = html;

    main.querySelector('#newAnnBtn').addEventListener('click', () => {
      UI.modal('New Announcement', `
        ${UI.formField('Title', UI.input('annTitle', 'Announcement title'), true)}
        ${UI.formField('Content', UI.textarea('annContent', 'Write your message...', 4), true)}
        ${UI.formField('Priority', UI.select('annPriority', [
          { value: 'normal', label: 'Normal' }, { value: 'important', label: 'Important' }, { value: 'urgent', label: 'Urgent' }
        ]))}
        ${UI.formField('Target Audience', UI.select('annAudience', [
          { value: 'all', label: 'All Users' }, { value: 'franchise', label: 'Franchises Only' },
          { value: 'production', label: 'Production Only' }, { value: 'dispatch', label: 'Dispatch Only' },
          { value: 'admin', label: 'Admin Only' }
        ]))}
        <div style="margin-top:1rem;">${UI.button('Post Announcement', 'postAnnBtn')}
        <button class="btn-cancel" data-close style="margin-left:.5rem;">Cancel</button></div>
      `, (modal) => {
        modal.querySelector('#postAnnBtn').onclick = async () => {
          const title = modal.querySelector('#annTitle').value;
          const content = modal.querySelector('#annContent').value;
          if (!title || !content) return UI.toast('Title and content required', 'error');
          try {
            const audience = modal.querySelector('#annAudience').value;
            await sb.from('announcements').insert([{
              title, content, priority: modal.querySelector('#annPriority').value,
              target_audience: audience, is_active: true, created_by: Auth.currentUser.id
            }]);
            // Notify target audience
            if (audience === 'all') {
              await DB.notifyRole('franchisee', title, content, 'announcement');
              await DB.notifyRole('production', title, content, 'announcement');
              await DB.notifyRole('dispatch', title, content, 'announcement');
            } else {
              await DB.notifyRole(audience, title, content, 'announcement');
            }
            await DB.log('CREATE_ANNOUNCEMENT', 'announcement', null, `Posted: ${title}`);
            UI.toast('Announcement posted!', 'success');
            modal.remove(); renderAnnouncements(main);
          } catch (e) { UI.toast('Failed: ' + e.message, 'error'); }
        };
      });
    });
  } catch (e) {
    main.innerHTML = UI.header('Announcements') + UI.empty('📢', 'Unable to load announcements.');
  }
}

// ─── REPORTS ───
async function renderReports(main) {
  main.innerHTML = UI.header('Reports', 'Analytics and insights') + UI.loading();
  try {
    const [{ data: orders }, { data: franchises }, { data: products }, { data: prodTasks }, { data: dispatches }] = await Promise.all([
      sb.from('orders').select('*'),
      sb.from('franchises').select('*'),
      sb.from('products').select('*'),
      sb.from('production_tasks').select('*'),
      sb.from('dispatches').select('*')
    ]);

    let html = UI.header('Reports', 'Analytics and insights');

    // Order stats by status
    const statusCounts = {};
    (orders || []).forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });
    html += UI.statRow([
      { label: 'Total Orders', value: (orders || []).length, icon: '🧾' },
      { label: 'Completed', value: statusCounts['received'] || 0, accent: true, icon: '✅' },
      { label: 'In Progress', value: Object.entries(statusCounts).filter(([s]) => !['received','cancelled','rejected'].includes(s)).reduce((a, [,v]) => a + v, 0), icon: '🔄' },
      { label: 'Cancelled/Rejected', value: (statusCounts['cancelled'] || 0) + (statusCounts['rejected'] || 0), icon: '❌' }
    ]);

    // Orders by franchise
    html += `<div style="margin-top:1rem;">${UI.table(
      ['Franchise', 'Total Orders', 'Received', 'In Progress', 'Cancelled'],
      (franchises || []).map(f => {
        const fOrders = (orders || []).filter(o => o.franchise_id === f.id);
        return [f.franchise_name, fOrders.length, fOrders.filter(o => o.status === 'received').length,
          fOrders.filter(o => !['received','cancelled','rejected'].includes(o.status)).length,
          fOrders.filter(o => ['cancelled','rejected'].includes(o.status)).length];
      }),
      { title: 'Orders by Franchise', emptyMsg: 'No franchises' }
    )}</div>`;

    // Production report
    html += `<div style="margin-top:1rem;">${UI.table(
      ['Metric', 'Count'],
      [
        ['Total Production Tasks', (prodTasks || []).length],
        ['Completed', (prodTasks || []).filter(t => t.status === 'completed').length],
        ['In Progress', (prodTasks || []).filter(t => t.status === 'in_progress').length],
        ['Pending', (prodTasks || []).filter(t => t.status === 'pending').length]
      ],
      { title: 'Production Report' }
    )}</div>`;

    // Dispatch report
    html += `<div style="margin-top:1rem;">${UI.table(
      ['Metric', 'Count'],
      [
        ['Total Dispatches', (dispatches || []).length],
        ['Delivered', (dispatches || []).filter(d => d.status === 'delivered').length],
        ['In Transit', (dispatches || []).filter(d => d.status === 'in_transit' || d.status === 'dispatched').length],
        ['Scheduled', (dispatches || []).filter(d => d.status === 'scheduled' || d.status === 'preparing').length],
        ['Failed', (dispatches || []).filter(d => d.status === 'failed').length]
      ],
      { title: 'Dispatch Report' }
    )}</div>`;

    // Low stock report
    const lowStock = (products || []).filter(p => (p.current_stock || 0) <= (p.min_stock || 0));
    html += `<div style="margin-top:1rem;">${UI.table(
      ['Product', 'SKU', 'Current Stock', 'Min Stock', 'Status'],
      lowStock.map(p => [p.name, p.sku, p.current_stock, p.min_stock, UI.badge('low')]),
      { title: 'Low Stock Report', emptyMsg: 'All products are well stocked' }
    )}</div>`;

    main.innerHTML = html;
  } catch (e) {
    main.innerHTML = UI.header('Reports') + UI.empty('📈', 'Unable to load reports.');
  }
}

// ─── ACTIVITY LOGS ───
async function renderActivityLogs(main) {
  main.innerHTML = UI.header('Activity Logs', 'Complete audit trail of all system actions') + UI.loading();
  try {
    const { data: logs } = await sb.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200);
    let html = UI.header('Activity Logs', 'Complete audit trail of all system actions');
    html += UI.table(['User', 'Role', 'Action', 'Entity', 'Details', 'Time'],
      (logs || []).map(l => [l.user_name, l.role, l.action, l.entity || '—', (l.details || '').slice(0, 60), UI.fmtDateTime(l.created_at)]),
      { emptyMsg: 'No activity logged' });
    main.innerHTML = html;
  } catch (e) {
    main.innerHTML = UI.header('Activity Logs') + UI.empty('📋', 'Unable to load logs.');
  }
}

// ─── PROFILE ───
async function renderProfile(main, user) {
  main.innerHTML = UI.header('My Profile', 'Manage your account') + `
    <div class="table-card">
      <div class="table-card-header"><h3>Account Information</h3></div>
      <div style="padding:1.25rem;">
        ${UI.formField('Full Name', UI.input('profName', '', 'text', user.full_name || ''))}
        ${UI.formField('Username', UI.input('profUser', '', 'text', user.username))}
        ${UI.formField('Email', UI.input('profEmail', '', 'email', user.email || ''))}
        ${UI.formField('Contact Number', UI.input('profContact', '', 'text', user.contact_number || ''))}
        ${UI.formField('Role', `<input type="text" value="${user.role}" disabled class="form-input">`)}
        <div style="margin-top:1rem;">${UI.button('Save Changes', 'saveProfileBtn')}</div>
      </div>
    </div>
    <div class="table-card" style="margin-top:1rem;">
      <div class="table-card-header"><h3>Change Password</h3></div>
      <div style="padding:1.25rem;">
        ${UI.formField('New Password', UI.input('newPass', '', 'password'))}
        ${UI.formField('Confirm Password', UI.input('confirmPass', '', 'password'))}
        <div style="margin-top:1rem;">${UI.button('Update Password', 'updatePassBtn')}</div>
      </div>
    </div>`;

  main.querySelector('#saveProfileBtn').onclick = async () => {
    try {
      await sb.from('users').update({
        full_name: main.querySelector('#profName').value, email: main.querySelector('#profEmail').value,
        contact_number: main.querySelector('#profContact').value, updated_at: new Date().toISOString()
      }).eq('id', user.id);
      user.full_name = main.querySelector('#profName').value;
      user.email = main.querySelector('#profEmail').value;
      user.contact_number = main.querySelector('#profContact').value;
      localStorage.setItem('chookee_user', JSON.stringify(user));
      Auth.currentUser = user;
      await DB.log('UPDATE_PROFILE', 'user', user.id, 'Updated profile');
      UI.toast('Profile updated!', 'success');
    } catch (e) { UI.toast('Failed: ' + e.message, 'error'); }
  };

  main.querySelector('#updatePassBtn').onclick = async () => {
    const np = main.querySelector('#newPass').value;
    const cp = main.querySelector('#confirmPass').value;
    if (!np) return UI.toast('Enter new password', 'error');
    if (np !== cp) return UI.toast('Passwords do not match', 'error');
    if (np.length < 6) return UI.toast('Password must be at least 6 characters', 'error');
    try {
      await sb.from('users').update({ password: np }).eq('id', user.id);
      await DB.log('CHANGE_PASSWORD', 'user', user.id, 'Changed password');
      UI.toast('Password updated!', 'success');
    } catch (e) { UI.toast('Failed: ' + e.message, 'error'); }
  };
}

// ─── SETTINGS ───
async function renderSettings(main) {
  main.innerHTML = UI.header('System Settings', 'Configure system parameters') + UI.loading();
  try {
    const { data: settings } = await sb.from('system_settings').select('*');
    let html = UI.header('System Settings', 'Configure system parameters');
    html += `<div class="table-card"><div style="padding:1.25rem;">`;
    for (const s of (settings || [])) {
      html += UI.formField(s.description || s.key, UI.input(`setting_${s.key}`, '', 'text', s.value || ''));
    }
    html += `<div style="margin-top:1rem;">${UI.button('Save Settings', 'saveSettingsBtn')}</div></div></div>`;
    main.innerHTML = html;
    main.querySelector('#saveSettingsBtn').onclick = async () => {
      for (const s of (settings || [])) {
        const val = main.querySelector(`#setting_${s.key}`).value;
        await sb.from('system_settings').update({ value: val, updated_at: new Date().toISOString() }).eq('id', s.id);
      }
      await DB.log('UPDATE_SETTINGS', 'system_settings', null, 'Updated system settings');
      UI.toast('Settings saved!', 'success');
    };
  } catch (e) {
    main.innerHTML = UI.header('Settings') + UI.empty('⚙️', 'Unable to load settings.');
  }
}

window.Pages = Pages;
