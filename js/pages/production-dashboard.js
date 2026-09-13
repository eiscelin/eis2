// Production Dashboard — matches original app navigation
var Pages = window.Pages || {};

Pages.productionDashboard = function(el) {
  const user = Auth.currentUser;
  const navItems = [
    { id: 'dashboard', icon: '🏭', label: 'Production Dashboard' },
    { id: 'profile', icon: '👤', label: 'My Profile' }
  ];

  dashLayout(el, user, navItems, async (main, tab) => {
    if (tab === 'dashboard') {
      let activeView = 'production';
      const renderDashboard = async () => {
        main.innerHTML = `${mainHeader('Production Dashboard', "Today's consolidated production & inventory monitoring")}
          <div style="margin-bottom:1rem;"><button class="btn-save" id="consolidateBtn">🔄 Consolidate Today's Orders</button></div>
          <div id="prodStats" class="loading">Loading...</div>
          <div class="tab-toggle" style="margin:1rem 0;">
            <button class="tab-btn ${activeView === 'production' ? 'active' : ''}" data-view="production">Today's Production</button>
            <button class="tab-btn ${activeView === 'inventory' ? 'active' : ''}" data-view="inventory">Inventory Monitoring</button>
          </div>
          <div id="prodContent"></div>`;

        try {
          const [{ data: orders }, { data: products }] = await Promise.all([
            sb.from('orders').select('*').order('created_at', { ascending: false }),
            sb.from('products').select('*')
          ]);
          const pending = (orders || []).filter(o => o.status === 'pending').length;
          const processing = (orders || []).filter(o => o.status === 'processing').length;
          const ready = (orders || []).filter(o => o.status === 'ready').length;
          const lowStock = (products || []).filter(p => (p.stock || 0) < (p.reorder_level || 10)).length;

          main.querySelector('#prodStats').innerHTML = statCards([
            { label: "Today's Batches", value: pending, accent: true },
            { label: 'Ready for Dispatch', value: ready },
            { label: 'In Progress', value: processing },
            { label: 'Low Stock Items', value: lowStock }
          ]);

          main.querySelector('#consolidateBtn').addEventListener('click', async () => {
            try {
              const pendingOrders = (orders || []).filter(o => o.status === 'pending');
              for (const o of pendingOrders) {
                await sb.from('orders').update({ status: 'processing' }).eq('id', o.id);
              }
              showToast(`Consolidated ${pendingOrders.length} orders into production batches!`, 'success');
              renderDashboard();
            } catch (e) { showToast('Failed to consolidate: ' + e.message, 'error'); }
          });

          const renderView = () => {
            const content = main.querySelector('#prodContent');
            if (activeView === 'production') {
              content.innerHTML = tableCard('All Orders', ['Order #', 'Date', 'Status', 'Total', 'Update Status'],
                (orders || []).map(o => [`<strong>${o.order_number || o.id}</strong>`, fmtDate(o.created_at), statusBadge(o.status), fmtPeso(o.total),
                  `<select class="btn-cancel" data-oid="${o.id}" style="padding:.3rem .5rem;font-size:.8rem;">
                    ${['pending', 'processing', 'ready', 'dispatched', 'in_transit', 'delivered', 'cancelled'].map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
                  </select>`]));
              content.querySelectorAll('select[data-oid]').forEach(sel => {
                sel.addEventListener('change', async () => {
                  try { await sb.from('orders').update({ status: sel.value }).eq('id', sel.dataset.oid); showToast('Status updated', 'success'); renderDashboard(); }
                  catch { showToast('Update failed', 'error'); }
                });
              });
            } else {
              content.innerHTML = tableCard('Inventory Monitoring', ['Product', 'Category', 'Price', 'Stock', 'Status'],
                (products || []).map(p => [p.name, p.category || '—', fmtPeso(p.price), p.stock || 0,
                  (p.stock || 0) < (p.reorder_level || 10) ? statusBadge('unpaid') : statusBadge('active')]));
            }
          };
          renderView();

          main.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
              activeView = btn.dataset.view;
              main.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
              btn.classList.add('active');
              renderView();
            });
          });
        } catch { main.querySelector('#prodStats').innerHTML = emptyState('📦', 'No production batches for today yet.'); }
      };
      renderDashboard();
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
};

window.Pages = Pages;
