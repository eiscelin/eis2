// Dispatch Dashboard — matches original app navigation
var Pages = window.Pages || {};

Pages.dispatchDashboard = function(el) {
  const user = Auth.currentUser;
  const navItems = [
    { id: 'dashboard', icon: '🚚', label: 'Dispatch Dashboard' },
    { id: 'profile', icon: '👤', label: 'My Profile' }
  ];

  dashLayout(el, user, navItems, async (main, tab) => {
    if (tab === 'dashboard') {
      main.innerHTML = mainHeader('Dispatch & Delivery', 'Ready orders, in-transit tracking, and delivery confirmation');
      try {
        const { data: orders } = await sb.from('orders').select('*').order('created_at', { ascending: false });
        const ready = (orders || []).filter(o => o.status === 'ready').length;
        const inTransit = (orders || []).filter(o => o.status === 'in_transit').length;
        const delivered = (orders || []).filter(o => o.status === 'delivered').length;

        main.innerHTML += statCards([
          { label: 'Ready to Dispatch', value: ready, accent: true },
          { label: 'In Transit', value: inTransit },
          { label: 'Delivered', value: delivered }
        ]);

        const readyOrders = (orders || []).filter(o => o.status === 'ready');
        const transitOrders = (orders || []).filter(o => o.status === 'in_transit' || o.status === 'dispatched');
        const deliveredOrders = (orders || []).filter(o => o.status === 'delivered');

        main.innerHTML += `
          <div id="dispatchSections">
            <div class="table-card" style="margin-bottom:1rem;">
              <div class="table-card-header"><h3>Ready to Dispatch (${readyOrders.length})</h3></div>
              ${readyOrders.length ? `<table><thead><tr><th>Order #</th><th>Date</th><th>Total</th><th>Action</th></tr></thead>
                <tbody>${readyOrders.map(o => `<tr><td><strong>${o.order_number || o.id}</strong></td><td>${fmtDate(o.created_at)}</td><td>${fmtPeso(o.total)}</td>
                  <td><button class="btn-save" data-dispatch="${o.id}">Dispatch</button></td></tr>`).join('')}</tbody></table>` : '<p style="text-align:center;color:#999;padding:2rem;">No orders here.</p>'}
            </div>
            <div class="table-card" style="margin-bottom:1rem;">
              <div class="table-card-header"><h3>In Transit (${transitOrders.length})</h3></div>
              ${transitOrders.length ? `<table><thead><tr><th>Order #</th><th>Date</th><th>Total</th><th>Action</th></tr></thead>
                <tbody>${transitOrders.map(o => `<tr><td><strong>${o.order_number || o.id}</strong></td><td>${fmtDate(o.created_at)}</td><td>${fmtPeso(o.total)}</td>
                  <td><button class="btn-save" data-deliver="${o.id}">Mark Delivered</button></td></tr>`).join('')}</tbody></table>` : '<p style="text-align:center;color:#999;padding:2rem;">No orders here.</p>'}
            </div>
            <div class="table-card">
              <div class="table-card-header"><h3>Delivered (Completed) (${deliveredOrders.length})</h3></div>
              ${deliveredOrders.length ? `<table><thead><tr><th>Order #</th><th>Date</th><th>Total</th></tr></thead>
                <tbody>${deliveredOrders.map(o => `<tr><td><strong>${o.order_number || o.id}</strong></td><td>${fmtDate(o.created_at)}</td><td>${fmtPeso(o.total)}</td></tr>`).join('')}</tbody></table>` : '<p style="text-align:center;color:#999;padding:2rem;">No orders here.</p>'}
            </div>
          </div>`;

        main.querySelectorAll('[data-dispatch]').forEach(btn => {
          btn.addEventListener('click', async () => {
            try { await sb.from('orders').update({ status: 'in_transit', dispatch_date: new Date().toISOString().slice(0, 10) }).eq('id', btn.dataset.dispatch); showToast('Order dispatched!', 'success'); Pages.dispatchDashboard(el); }
            catch { showToast('Failed to dispatch', 'error'); }
          });
        });
        main.querySelectorAll('[data-deliver]').forEach(btn => {
          btn.addEventListener('click', async () => {
            try { await sb.from('orders').update({ status: 'delivered' }).eq('id', btn.dataset.deliver); showToast('Order delivered!', 'success'); Pages.dispatchDashboard(el); }
            catch { showToast('Failed to update', 'error'); }
          });
        });
      } catch { main.innerHTML += emptyState('🚚', 'No orders to dispatch.'); }
    }

    else if (tab === 'profile') {
      main.innerHTML = mainHeader('My Profile', 'Manage your account');
      main.innerHTML += `
        <div class="table-card">
          <div class="table-card-header"><h3>Account Information</h3></div>
          <div style="padding:1.25rem;">
            <div class="form-group"><label>Full Name</label><input type="text" value="${user.full_name || ''}" disabled></div>
            <div class="form-group"><label>Username</label><input type="text" value="${user.username}" disabled></div>
            <div class="form-group"><label>Contact Number</label><input type="text" value="${user.contact_number || '—'}" disabled></div>
            <div class="form-group"><label>Role</label><input type="text" value="${user.role}" disabled></div>
          </div>
        </div>`;
    }
  });

  // Back to Admin link
  const nav = el.querySelector('#sidebarNav');
  if (nav) {
    const back = document.createElement('a');
    back.href = '#/AdminDashboard';
    back.innerHTML = '← Back to Admin';
    back.style.cssText = 'padding:.7rem 1.5rem;color:#FF5722;font-size:.85rem;font-weight:600;cursor:pointer;display:block;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:.5rem;';
    nav.insertBefore(back, nav.firstChild);
  }
};

window.Pages = Pages;
