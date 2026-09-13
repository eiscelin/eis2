// Admin Dashboard — matches original app navigation
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
      main.innerHTML = mainHeader('Franchise Management', 'Onboard and monitor every Chookee Inasal franchisee');
      try {
        const { data: franchisees } = await sb.from('users').select('*').eq('role', 'franchisee').order('created_at', { ascending: false });
        main.innerHTML += tableCard('All Franchisees', ['Name', 'Username', 'Contact', 'Role', 'Joined'],
          (franchisees || []).map(f => [f.full_name || '—', f.username, f.contact_number || '—', statusBadge('active'), fmtDate(f.created_at)]));
      } catch { main.innerHTML += emptyState('🏪', 'No franchises yet.'); }
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
};

window.Pages = Pages;
