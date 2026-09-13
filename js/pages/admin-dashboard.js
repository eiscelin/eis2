// Admin Dashboard — matches original app navigation
var Pages = window.Pages || {};

Pages.adminDashboard = function(el) {
  const user = Auth.currentUser;
  const navItems = [
    { id: 'dashboard', icon: '📊', label: 'Admin Dashboard' },
    { id: 'franchises', icon: '🏪', label: 'Franchise Management' },
    { id: 'orders', icon: '🧾', label: 'All Orders' },
    { id: 'products', icon: '📦', label: 'Available Supplies' },
    { id: 'production', icon: '🏭', label: 'Production', navigate: '/ProductionDashboard' },
    { id: 'dispatch', icon: '🚚', label: 'Dispatch', navigate: '/DispatchDashboard' },
    { id: 'announcements', icon: '📢', label: 'Announcements' },
    { id: 'profile', icon: '👤', label: 'My Profile' }
  ];

  dashLayout(el, user, navItems, async (main, tab) => {
    if (tab === 'dashboard') {
      main.innerHTML = mainHeader('Admin Overview', 'Central franchise management dashboard');
      try {
        const [{ data: franchisees }, { data: orders }, { data: sales }] = await Promise.all([
          sb.from('users').select('*').eq('role', 'franchisee'),
          sb.from('orders').select('*'),
          sb.from('sales').select('*')
        ]);
        const totalSales = (sales || []).reduce((s, x) => s + Number(x.amount || 0), 0);
        const royalty = totalSales * 0.05;
        main.innerHTML += statCards([
          { label: 'Active Branches', value: (franchisees || []).length, accent: true },
          { label: 'Total Orders', value: (orders || []).length },
          { label: 'Total Sales', value: fmtPeso(totalSales), accent: true },
          { label: 'Royalty Collected', value: fmtPeso(royalty) }
        ]);
        main.innerHTML += tableCard('Recent Orders', ['Order #', 'Date', 'Status', 'Total'],
          (orders || []).slice(0, 8).map(o => [o.order_number || o.id, fmtDate(o.created_at), statusBadge(o.status), fmtPeso(o.total)]));
      } catch { main.innerHTML += '<div class="loading">Unable to load data.</div>'; }
    }

    else if (tab === 'franchises') {
      main.innerHTML = `
        <div class="fm-toolbar">
          <div>
            <h1>Franchise Management</h1>
            <div class="subtitle">Onboard and monitor every Chookee Inasal franchisee</div>
          </div>
          <button class="fm-add-btn" id="addFranchiseBtn">+ Add Franchise</button>
        </div>
        <div class="fm-subtabs">
          <button class="fm-subtab active" data-subtab="franchises">Franchises</button>
          <button class="fm-subtab" data-subtab="profiles">Profiles</button>
          <button class="fm-subtab" data-subtab="production">Production</button>
        </div>
        <div id="fmContent" class="loading">Loading...</div>`;

      const loadFranchises = async () => {
        const content = main.querySelector('#fmContent');
        try {
          const [{ data: franchisees }, { data: allUsers }] = await Promise.all([
            sb.from('users').select('*').eq('role', 'franchisee').order('created_at', { ascending: false }),
            sb.from('users').select('*').order('created_at', { ascending: false })
          ]);
          const list = franchisees || [];
          const users = allUsers || [];
          const active = list.filter(f => (f.status || 'active') === 'active').length;
          const pending = list.filter(f => f.status === 'pending').length;
          const expired = list.filter(f => f.status === 'expired').length;

          const cardHtml = (f) => {
            const status = f.status || 'active';
            const initial = (f.full_name || f.username || '?')[0].toUpperCase();
            const badgeClass = status === 'active' ? 'fm-badge-green' : status === 'pending' ? 'fm-badge-orange' : 'fm-badge-red';
            return `<div class="fm-card" data-name="${(f.full_name || f.username || '').toLowerCase()}" data-status="${status}">
              <div class="fm-card-header">
                <div class="fm-card-avatar">${initial}</div>
                <div class="fm-card-info">
                  <div class="fm-card-name">${f.full_name || f.username}</div>
                  <div class="fm-card-pkg">Standard Package</div>
                </div>
                <span class="fm-badge-sm ${badgeClass}">${status}</span>
              </div>
              <div class="fm-card-details">
                <span>📍 ${f.contact_number || '—'}</span>
                <span>📞 ${f.contact_number || '—'}</span>
                <span>Expires: —</span>
              </div>
              <div class="fm-card-fin">
                <div><div class="fm-fin-label">Franchise Fee</div><div class="fm-fin-val">₱0.00</div></div>
                <div><div class="fm-fin-label">Outstanding</div><div class="fm-fin-val">₱0.00</div></div>
                <div><div class="fm-fin-label">Royalty Due</div><div class="fm-fin-val">₱0.00</div></div>
              </div>
              <div class="fm-card-actions">
                <button class="fm-edit-btn">Edit Catalog</button>
                <span class="fm-badge-sm fm-badge-red">Unpaid</span>
                <span class="fm-card-edit">Editable · Edit</span>
              </div>
            </div>`;
          };

          content.innerHTML = `
            <div class="fm-stats">
              <div class="fm-stat"><div class="fm-stat-num">${list.length}</div><div class="fm-stat-label">Total Franchises</div></div>
              <div class="fm-stat"><div class="fm-stat-num">${active}</div><div class="fm-stat-label">Active</div></div>
              <div class="fm-stat"><div class="fm-stat-num">${pending}</div><div class="fm-stat-label">Pending</div></div>
              <div class="fm-stat"><div class="fm-stat-num">${expired}</div><div class="fm-stat-label">Expired</div></div>
            </div>
            <div class="fm-search-row">
              <div class="fm-search">
                <span>🔍</span>
                <input type="text" id="fmSearch" placeholder="Search by name or location...">
              </div>
              <select id="fmStatusFilter" class="fm-filter">
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <div class="fm-cards" id="fmCards">
              ${list.map(cardHtml).join('') || '<div class="empty-state"><div class="icon">🏪</div><p>No franchises yet.</p></div>'}
            </div>
            <div class="fm-section">
              <div class="fm-section-header">
                <span style="font-size:1.25rem">🕐</span>
                <h3>Pending Franchisee Approvals</h3>
                <span class="fm-badge-orange-pill">${pending} pending</span>
              </div>
              <p class="fm-section-desc">New signups awaiting admin approval before they can log in.</p>
              ${pending === 0 ? '<div class="fm-empty"><div class="fm-empty-icon">👤</div><strong>No pending approvals</strong><p>New franchisee signups will appear here for approval.</p></div>' : ''}
            </div>
            <div class="fm-section">
              <div class="fm-section-header">
                <span style="font-size:1.25rem">🛡️</span>
                <h3>Member Access &amp; Roles</h3>
                <span class="fm-badge-dark-pill">${users.length} accounts</span>
              </div>
              <p class="fm-section-desc">Assign roles: Admin, Franchisee, Production, or Dispatch teams.</p>
              <div class="fm-roles">
                ${users.map(u => {
                  const initial = (u.username || '?')[0].toUpperCase();
                  const avatarColor = u.role === 'admin' ? '#FF5722' : '#bbb';
                  return `<div class="fm-role-row">
                    <div class="fm-role-avatar" style="background:${avatarColor}">${initial}</div>
                    <div class="fm-role-info">
                      <div class="fm-role-name">${u.full_name || u.username}</div>
                      <div class="fm-role-meta">@${u.username}</div>
                    </div>
                    <div class="fm-role-pw">🔑 ${u.password || '—'}</div>
                    <select class="fm-role-select" data-uid="${u.id}">
                      <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                      <option value="franchisee" ${u.role === 'franchisee' ? 'selected' : ''}>Franchisee</option>
                      <option value="production" ${u.role === 'production' ? 'selected' : ''}>Production</option>
                      <option value="dispatch" ${u.role === 'dispatch' ? 'selected' : ''}>Dispatch</option>
                    </select>
                  </div>`;
                }).join('')}
              </div>
            </div>`;

          content.querySelectorAll('.fm-role-select').forEach(sel => {
            sel.addEventListener('change', async () => {
              try { await sb.from('users').update({ role: sel.value }).eq('id', sel.dataset.uid); showToast('Role updated', 'success'); }
              catch { showToast('Failed to update role', 'error'); }
            });
          });

          const searchInput = content.querySelector('#fmSearch');
          const statusFilter = content.querySelector('#fmStatusFilter');
          const filterCards = () => {
            const q = searchInput.value.toLowerCase();
            const s = statusFilter.value;
            content.querySelectorAll('.fm-card').forEach(card => {
              const matchQ = !q || card.dataset.name.includes(q);
              const matchS = !s || card.dataset.status === s;
              card.style.display = (matchQ && matchS) ? '' : 'none';
            });
          };
          searchInput.addEventListener('input', filterCards);
          statusFilter.addEventListener('change', filterCards);
        } catch { main.querySelector('#fmContent').innerHTML = emptyState('🏪', 'No franchises yet.'); }
      };

      loadFranchises();

      main.querySelectorAll('.fm-subtab').forEach(tab => {
        tab.addEventListener('click', () => {
          main.querySelectorAll('.fm-subtab').forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
        });
      });

      main.querySelector('#addFranchiseBtn').addEventListener('click', () => {
        const content = main.querySelector('#fmContent');
        content.innerHTML = `
          <div class="table-card">
            <div class="table-card-header"><h3>Add New Franchise</h3></div>
            <div style="padding:1.25rem;">
              <div class="form-group"><label>Full Name</label><input type="text" id="fName" placeholder="Franchisee full name"></div>
              <div class="form-group"><label>Username</label><input type="text" id="fUsername" placeholder="Username"></div>
              <div class="form-group"><label>Contact Number</label><input type="text" id="fContact" placeholder="Contact number"></div>
              <div class="form-group"><label>Password</label><input type="password" id="fPassword" placeholder="Password" minlength="6"></div>
              <button class="btn-save" id="saveFranchiseBtn">Save Franchise</button>
              <button class="btn-cancel" id="cancelFranchiseBtn" style="margin-left:.5rem;">Cancel</button>
            </div>
          </div>`;
        content.querySelector('#saveFranchiseBtn').addEventListener('click', async () => {
          const full_name = content.querySelector('#fName').value;
          const username = content.querySelector('#fUsername').value;
          const password = content.querySelector('#fPassword').value;
          if (!full_name || !username || !password) return showToast('Name, username, and password required', 'error');
          try {
            await sb.from('users').insert([{ full_name, username, contact_number: content.querySelector('#fContact').value, password, role: 'franchisee' }]);
            showToast('Franchise added!', 'success');
            loadFranchises();
          } catch (e) { showToast('Failed: ' + e.message, 'error'); }
        });
        content.querySelector('#cancelFranchiseBtn').addEventListener('click', loadFranchises);
      });
    }

    else if (tab === 'orders') {
      main.innerHTML = mainHeader('All Orders', 'Orders across all branches');
      try {
        const { data: orders } = await sb.from('orders').select('*').order('created_at', { ascending: false });
        main.innerHTML += tableCard('All Orders', ['Order #', 'Date', 'Status', 'Total', 'Items'],
          (orders || []).map(o => [o.order_number || o.id, fmtDate(o.created_at), statusBadge(o.status), fmtPeso(o.total), (o.items || []).length + ' items']));
      } catch { main.innerHTML += emptyState('🧾', 'No orders found.'); }
    }

    else if (tab === 'products') {
      main.innerHTML = mainHeader('Available Supplies', 'Manage the supplies franchisees can order');
      main.innerHTML += `<div style="margin-bottom:1rem;"><button class="btn-save" id="addProductBtn">+ Add Supply</button></div>
        <div id="productsList" class="loading">Loading...</div>`;

      const loadProducts = async () => {
        try {
          const { data: products } = await sb.from('products').select('*').order('name');
          main.querySelector('#productsList').innerHTML = tableCard('Supplies', ['Name', 'Category', 'Price', 'Stock', 'Status'],
            (products || []).map(p => [p.name, p.category || '—', fmtPeso(p.price), p.stock || 0,
              (p.stock || 0) < (p.reorder_level || 10) ? statusBadge('unpaid') : statusBadge('active')]));
        } catch { main.querySelector('#productsList').innerHTML = emptyState('📦', 'No supplies yet. Add supplies for franchisees to order.'); }
      };
      loadProducts();

      main.querySelector('#addProductBtn').addEventListener('click', () => {
        main.querySelector('#productsList').innerHTML = `
          <div class="table-card">
            <div class="table-card-header"><h3>Add New Supply</h3></div>
            <div style="padding:1.25rem;">
              <div class="form-group"><label>Name</label><input type="text" id="pName" placeholder="Product name"></div>
              <div class="form-group"><label>Category</label><input type="text" id="pCategory" placeholder="Category"></div>
              <div class="form-group"><label>Price (₱)</label><input type="number" id="pPrice" placeholder="0.00" min="0"></div>
              <div class="form-group"><label>Stock</label><input type="number" id="pStock" placeholder="0" min="0"></div>
              <button class="btn-save" id="saveProductBtn">Save Supply</button>
              <button class="btn-cancel" id="cancelProductBtn" style="margin-left:.5rem;">Cancel</button>
            </div>
          </div>`;
        main.querySelector('#saveProductBtn').addEventListener('click', async () => {
          const name = main.querySelector('#pName').value;
          const price = Number(main.querySelector('#pPrice').value);
          if (!name) return showToast('Name is required', 'error');
          try {
            await sb.from('products').insert([{ name, category: main.querySelector('#pCategory').value, price, stock: Number(main.querySelector('#pStock').value) }]);
            showToast('Supply added!', 'success');
            loadProducts();
          } catch (e) { showToast('Failed: ' + e.message, 'error'); }
        });
        main.querySelector('#cancelProductBtn').addEventListener('click', loadProducts);
      });
    }

    else if (tab === 'announcements') {
      main.innerHTML = mainHeader('Announcements & Memos', 'Broadcast messages to all franchisees');
      main.innerHTML += `
        <div class="table-card">
          <div class="table-card-header"><h3>New Announcement</h3></div>
          <div style="padding:1.25rem;">
            <div class="form-group"><label>Title</label><input type="text" id="annTitle" placeholder="Announcement title"></div>
            <div class="form-group"><label>Content</label><textarea id="annContent" rows="3" placeholder="Write your message..." style="width:100%;padding:.6rem;border:1px solid #e5e7eb;border-radius:.5rem;font-family:inherit;"></textarea></div>
            <div class="form-group"><label>Priority</label>
              <select id="annPriority" style="padding:.5rem;border:1px solid #e5e7eb;border-radius:.5rem;">
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
            <button class="btn-save" id="postAnnBtn">Post Announcement</button>
          </div>
        </div>
        <div id="annList" class="loading" style="margin-top:1rem;">Loading...</div>`;

      const loadAnnouncements = async () => {
        try {
          const { data: anns } = await sb.from('announcements').select('*').order('created_at', { ascending: false });
          main.querySelector('#annList').innerHTML = (anns || []).length ? tableCard('Recent Announcements', ['Title', 'Priority', 'Date', 'Status'],
            (anns || []).map(a => [a.title, a.priority === 'high' ? '<span class="badge badge-red">HIGH</span>' : '<span class="badge badge-gray">Normal</span>', fmtDate(a.date), a.is_active ? statusBadge('active') : statusBadge('inactive')])) : emptyState('📢', 'No announcements yet.');
        } catch { main.querySelector('#annList').innerHTML = emptyState('📢', 'No announcements from the main office.'); }
      };
      loadAnnouncements();

      main.querySelector('#postAnnBtn').addEventListener('click', async () => {
        const title = main.querySelector('#annTitle').value;
        const content = main.querySelector('#annContent').value;
        if (!title || !content) return showToast('Title and content required', 'error');
        try {
          await sb.from('announcements').insert([{ title, content, priority: main.querySelector('#annPriority').value, is_active: true }]);
          showToast('Announcement posted!', 'success');
          main.querySelector('#annTitle').value = '';
          main.querySelector('#annContent').value = '';
          loadAnnouncements();
        } catch (e) { showToast('Failed: ' + e.message, 'error'); }
      });
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

  // Customize sidebar for admin
  el.querySelector('.dashboard')?.classList.add('dashboard-admin');
  const header = el.querySelector('.sidebar-header');
  if (header) {
    header.innerHTML = '<div class="logo">CI</div><div><div style="font-weight:700;font-size:1rem">Chookee Inasal</div><div style="font-size:.7rem;color:#999;font-weight:400">Central System</div></div>';
  }
};

window.Pages = Pages;
