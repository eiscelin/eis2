// Dashboard pages — franchisee, production, and admin
var Pages = window.Pages || {};

// ===== Shared helpers =====
function dashLayout(el, user, navItems, renderContent) {
  let activeTab = navItems[0].id;
  el.innerHTML = `
    <div class="dashboard">
      <aside class="sidebar">
        <div class="sidebar-header">
          <div class="logo">CI</div> Chookee Inasal
        </div>
        <nav class="sidebar-nav" id="sidebarNav"></nav>
        <div class="sidebar-footer">
          <div class="sidebar-user">
            <div class="name">${user.full_name || user.username}</div>
            <div>${user.role}</div>
          </div>
          <button class="btn-logout" id="btnLogout">Logout</button>
        </div>
      </aside>
      <main class="main-content" id="dashMain"></main>
    </div>
  `;
  const nav = el.querySelector('#sidebarNav');
  navItems.forEach(item => {
    const a = document.createElement('a');
    a.dataset.tab = item.id;
    a.innerHTML = `${item.icon} ${item.label}`;
    if (item.id === activeTab) a.classList.add('active');
    a.addEventListener('click', () => {
      activeTab = item.id;
      nav.querySelectorAll('a').forEach(x => x.classList.remove('active'));
      a.classList.add('active');
      renderContent(el.querySelector('#dashMain'), item.id);
    });
    nav.appendChild(a);
  });
  el.querySelector('#btnLogout').addEventListener('click', () => Auth.logout());
  renderContent(el.querySelector('#dashMain'), activeTab);
}

function statCards(stats) {
  return `<div class="dash-stats">${stats.map(s => `
    <div class="dash-stat-card">
      <div class="label">${s.label}</div>
      <div class="value ${s.accent ? 'accent' : ''}">${s.value}</div>
      ${s.trend ? `<div class="trend">${s.trend}</div>` : ''}
    </div>`).join('')}</div>`;
}

function tableCard(title, headers, rows, extra = '') {
  return `
    <div class="table-card">
      <div class="table-card-header"><h3>${title}</h3>${extra}</div>
      <table>
        <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.length ? rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}" style="text-align:center;color:#999;padding:2rem;">No data available</td></tr>`}</tbody>
      </table>
    </div>`;
}

function statusBadge(status) {
  const map = {
    pending: 'badge-yellow', processing: 'badge-blue',
    shipped: 'badge-blue', delivered: 'badge-green',
    paid: 'badge-green', unpaid: 'badge-red', active: 'badge-green', inactive: 'badge-gray'
  };
  return `<span class="badge ${map[status] || 'badge-gray'}">${status}</span>`;
}

function fmtPeso(n) { return '₱' + Number(n || 0).toLocaleString(); }
function fmtDate(d) { return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }

function showToast(msg, type = '') {
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ===== Franchisee Dashboard =====
Pages.franchiseeDashboard = function(el) {
  const user = Auth.currentUser;
  const navItems = [
    { id: 'overview', icon: '📊', label: 'Overview' },
    { id: 'order', icon: '📦', label: 'Order Supplies' },
    { id: 'orders', icon: '🧾', label: 'My Orders' },
    { id: 'sales', icon: '💰', label: 'Sales Report' }
  ];

  dashLayout(el, user, navItems, async (main, tab) => {
    if (tab === 'overview') {
      main.innerHTML = `<div class="main-header"><div><h1>Dashboard Overview</h1><div class="subtitle">Welcome back, ${user.full_name || user.username}</div></div></div>`;
      try {
        const [{ data: orders }, { data: sales }] = await Promise.all([
          sb.from('orders').select('*').eq('user_id', user.id),
          sb.from('sales').select('*').eq('user_id', user.id)
        ]);
        const pending = (orders || []).filter(o => o.status === 'pending').length;
        const totalSpent = (orders || []).reduce((s, o) => s + Number(o.total || 0), 0);
        const totalSales = (sales || []).reduce((s, x) => s + Number(x.amount || 0), 0);
        main.innerHTML += statCards([
          { label: 'Total Orders', value: (orders || []).length, accent: true },
          { label: 'Pending Orders', value: pending },
          { label: 'Total Spent', value: fmtPeso(totalSpent) },
          { label: 'Total Sales', value: fmtPeso(totalSales), accent: true }
        ]);
        main.innerHTML += tableCard('Recent Orders', ['Order #', 'Date', 'Status', 'Total'],
          (orders || []).slice(0, 5).map(o => [o.order_number || o.id, fmtDate(o.created_at), statusBadge(o.status), fmtPeso(o.total)]));
      } catch { main.innerHTML += '<div class="loading">Unable to load data. Check database connection.</div>'; }
    }

    else if (tab === 'order') {
      main.innerHTML = `<div class="main-header"><div><h1>Order Supplies</h1><div class="subtitle">Browse products and place orders</div></div></div><div id="orderContent" class="loading">Loading products...</div>`;
      try {
        const { data: products } = await sb.from('products').select('*');
        const cart = [];
        const renderProducts = () => {
          const content = main.querySelector('#orderContent');
          content.innerHTML = `
            <div class="table-card">
              <div class="table-card-header"><h3>Available Products</h3></div>
              <table>
                <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Action</th></tr></thead>
                <tbody>${(products || []).map(p => `
                  <tr>
                    <td>${p.name}</td><td>${p.category || '—'}</td><td>${fmtPeso(p.price)}</td>
                    <td>${p.stock || 0}</td>
                    <td><button class="btn-cancel" data-pid="${p.id}" data-pname="${p.name}" data-pprice="${p.price}">Add</button></td>
                  </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;color:#999;padding:2rem;">No products available</td></tr>'}
                </tbody>
              </table>
            </div>
            ${cart.length ? `<div class="table-card"><div class="table-card-header"><h3>Cart (${cart.length})</h3></div>
              <table><thead><tr><th>Product</th><th>Price</th><th>Qty</th><th>Subtotal</th><th></th></tr></thead>
              <tbody>${cart.map((c, i) => `<tr><td>${c.name}</td><td>${fmtPeso(c.price)}</td><td>${c.qty}</td><td>${fmtPeso(c.price * c.qty)}</td><td><button class="btn-cancel" data-rm="${i}">Remove</button></td></tr>`).join('')}</tbody></table>
              <div style="padding:1rem 1.25rem;display:flex;justify-content:space-between;align-items:center;">
                <strong>Total: ${fmtPeso(cart.reduce((s, c) => s + c.price * c.qty, 0))}</strong>
                <button class="btn-save" id="placeOrderBtn">Place Order</button>
              </div></div>` : ''}
          `;
          content.querySelectorAll('[data-pid]').forEach(btn => {
            btn.addEventListener('click', () => {
              cart.push({ id: btn.dataset.pid, name: btn.dataset.pname, price: Number(btn.dataset.pprice), qty: 1 });
              renderProducts();
            });
          });
          content.querySelectorAll('[data-rm]').forEach(btn => {
            btn.addEventListener('click', () => { cart.splice(Number(btn.dataset.rm), 1); renderProducts(); });
          });
          const placeBtn = content.querySelector('#placeOrderBtn');
          if (placeBtn) placeBtn.addEventListener('click', async () => {
            try {
              const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
              const orderNum = 'ORD-' + Date.now().toString().slice(-6);
              await sb.from('orders').insert([{ order_number: orderNum, user_id: user.id, status: 'pending', total, items: cart }]);
              showToast('Order placed successfully!', 'success');
              navItems[0]; // switch to overview
              el.querySelector('[data-tab=overview]').click();
            } catch (e) { showToast('Failed to place order: ' + e.message, 'error'); }
          });
        };
        renderProducts();
      } catch { main.querySelector('#orderContent').innerHTML = '<div class="empty-state"><div class="icon">📦</div>Unable to load products.</div>'; }
    }

    else if (tab === 'orders') {
      main.innerHTML = `<div class="main-header"><div><h1>My Orders</h1><div class="subtitle">Track your supply orders</div></div></div><div id="ordersTable" class="loading">Loading...</div>`;
      try {
        const { data: orders } = await sb.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        main.querySelector('#ordersTable').innerHTML = tableCard('All Orders', ['Order #', 'Date', 'Status', 'Total', 'Items'],
          (orders || []).map(o => [o.order_number || o.id, fmtDate(o.created_at), statusBadge(o.status), fmtPeso(o.total), (o.items || []).length + ' items']));
      } catch { main.querySelector('#ordersTable').innerHTML = '<div class="empty-state"><div class="icon">🧾</div>Unable to load orders.</div>'; }
    }

    else if (tab === 'sales') {
      main.innerHTML = `
        <div class="main-header"><div><h1>Sales Report</h1><div class="subtitle">Report your daily sales</div></div></div>
        <div class="table-card">
          <div class="table-card-header"><h3>Report New Sales</h3></div>
          <div style="padding:1.25rem;">
            <div class="form-group"><label>Date</label><input type="date" id="saleDate" value="${new Date().toISOString().slice(0,10)}"></div>
            <div class="form-group"><label>Amount (₱)</label><input type="number" id="saleAmount" placeholder="0.00" min="0"></div>
            <button class="btn-save" id="reportSaleBtn">Report Sale</button>
          </div>
        </div>
        <div id="salesList" class="loading">Loading...</div>
      `;
      const loadSales = async () => {
        try {
          const { data: sales } = await sb.from('sales').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
          const total = (sales || []).reduce((s, x) => s + Number(x.amount || 0), 0);
          main.querySelector('#salesList').innerHTML = statCards([{ label: 'Total Sales', value: fmtPeso(total), accent: true }]) +
            tableCard('Sales History', ['Date', 'Amount', 'Reported On'],
              (sales || []).map(s => [fmtDate(s.date), fmtPeso(s.amount), fmtDate(s.created_at)]));
        } catch { main.querySelector('#salesList').innerHTML = '<div class="empty-state"><div class="icon">💰</div>No sales reported yet.</div>'; }
      };
      loadSales();
      main.querySelector('#reportSaleBtn').addEventListener('click', async () => {
        const date = main.querySelector('#saleDate').value;
        const amount = Number(main.querySelector('#saleAmount').value);
        if (!amount || amount <= 0) return showToast('Enter a valid amount', 'error');
        try {
          await sb.from('sales').insert([{ user_id: user.id, date, amount }]);
          showToast('Sale reported!', 'success');
          loadSales();
        } catch (e) { showToast('Failed: ' + e.message, 'error'); }
      });
    }
  });
};

// ===== Production Dashboard =====
Pages.productionDashboard = function(el) {
  const user = Auth.currentUser;
  const navItems = [
    { id: 'overview', icon: '📊', label: 'Overview' },
    { id: 'process', icon: '🚚', label: 'Process Orders' },
    { id: 'inventory', icon: '📦', label: 'Inventory' }
  ];

  dashLayout(el, user, navItems, async (main, tab) => {
    if (tab === 'overview') {
      main.innerHTML = `<div class="main-header"><div><h1>Production Overview</h1><div class="subtitle">Daily consolidated production monitoring</div></div></div>`;
      try {
        const { data: orders } = await sb.from('orders').select('*').order('created_at', { ascending: false });
        const { data: products } = await sb.from('products').select('*');
        const pending = (orders || []).filter(o => o.status === 'pending').length;
        const processing = (orders || []).filter(o => o.status === 'processing').length;
        const shipped = (orders || []).filter(o => o.status === 'shipped').length;
        main.innerHTML += statCards([
          { label: 'Pending Orders', value: pending, accent: true },
          { label: 'Processing', value: processing },
          { label: 'Shipped', value: shipped },
          { label: 'Total Products', value: (products || []).length }
        ]);
        main.innerHTML += tableCard('Latest Orders', ['Order #', 'Date', 'Status', 'Total'],
          (orders || []).slice(0, 8).map(o => [o.order_number || o.id, fmtDate(o.created_at), statusBadge(o.status), fmtPeso(o.total)]));
      } catch { main.innerHTML += '<div class="loading">Unable to load data.</div>'; }
    }

    else if (tab === 'process') {
      main.innerHTML = `<div class="main-header"><div><h1>Process Orders</h1><div class="subtitle">Update order status and track shipments</div></div></div><div id="processContent" class="loading">Loading...</div>`;
      const load = async () => {
        try {
          const { data: orders } = await sb.from('orders').select('*').order('created_at', { ascending: false });
          const statuses = ['pending', 'processing', 'shipped', 'delivered'];
          main.querySelector('#processContent').innerHTML = tableCard('All Orders', ['Order #', 'Date', 'Status', 'Total', 'Update Status'],
            (orders || []).map(o => [`<strong>${o.order_number || o.id}</strong>`, fmtDate(o.created_at), statusBadge(o.status), fmtPeso(o.total),
              `<select class="btn-cancel" data-oid="${o.id}" style="padding:.3rem .5rem;font-size:.8rem;">
                ${statuses.map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s}</option>`).join('')}
              </select>`]));
          main.querySelectorAll('select[data-oid]').forEach(sel => {
            sel.addEventListener('change', async () => {
              try {
                await sb.from('orders').update({ status: sel.value }).eq('id', sel.dataset.oid);
                showToast('Order status updated', 'success');
                load();
              } catch (e) { showToast('Update failed', 'error'); }
            });
          });
        } catch { main.querySelector('#processContent').innerHTML = '<div class="empty-state"><div class="icon">🚚</div>No orders to process.</div>'; }
      };
      load();
    }

    else if (tab === 'inventory') {
      main.innerHTML = `<div class="main-header"><div><h1>Inventory</h1><div class="subtitle">Monitor product stock levels</div></div></div><div id="invContent" class="loading">Loading...</div>`;
      try {
        const { data: products } = await sb.from('products').select('*').order('name');
        const lowStock = (products || []).filter(p => (p.stock || 0) < 10).length;
        main.querySelector('#invContent').innerHTML = statCards([
          { label: 'Total Products', value: (products || []).length },
          { label: 'Low Stock', value: lowStock, accent: true },
          { label: 'Total Stock Units', value: (products || []).reduce((s, p) => s + (p.stock || 0), 0) }
        ]) + tableCard('Product Inventory', ['Product', 'Category', 'Price', 'Stock', 'Status'],
          (products || []).map(p => [p.name, p.category || '—', fmtPeso(p.price), p.stock || 0,
            (p.stock || 0) < 10 ? statusBadge('unpaid') : statusBadge('active')]));
      } catch { main.querySelector('#invContent').innerHTML = '<div class="empty-state"><div class="icon">📦</div>No inventory data.</div>'; }
    }
  });
};

// ===== Admin Dashboard =====
Pages.adminDashboard = function(el) {
  const user = Auth.currentUser;
  const navItems = [
    { id: 'overview', icon: '📊', label: 'Overview' },
    { id: 'branches', icon: '🏪', label: 'Branches' },
    { id: 'orders', icon: '🧾', label: 'All Orders' },
    { id: 'sales', icon: '💰', label: 'Sales & Royalties' }
  ];

  dashLayout(el, user, navItems, async (main, tab) => {
    if (tab === 'overview') {
      main.innerHTML = `<div class="main-header"><div><h1>Admin Overview</h1><div class="subtitle">Central franchise management dashboard</div></div></div>`;
      try {
        const [{ data: users }, { data: orders }, { data: sales }] = await Promise.all([
          sb.from('users').select('*').eq('role', 'franchisee'),
          sb.from('orders').select('*'),
          sb.from('sales').select('*')
        ]);
        const totalSales = (sales || []).reduce((s, x) => s + Number(x.amount || 0), 0);
        const royalty = totalSales * 0.05;
        main.innerHTML += statCards([
          { label: 'Active Branches', value: (users || []).length, accent: true },
          { label: 'Total Orders', value: (orders || []).length },
          { label: 'Total Sales', value: fmtPeso(totalSales), accent: true },
          { label: 'Royalty (5%)', value: fmtPeso(royalty) }
        ]);
        main.innerHTML += tableCard('Recent Orders', ['Order #', 'Date', 'Status', 'Total'],
          (orders || []).slice(0, 8).map(o => [o.order_number || o.id, fmtDate(o.created_at), statusBadge(o.status), fmtPeso(o.total)]));
      } catch { main.innerHTML += '<div class="loading">Unable to load data.</div>'; }
    }

    else if (tab === 'branches') {
      main.innerHTML = `<div class="main-header"><div><h1>Franchise Branches</h1><div class="subtitle">Manage all franchisee accounts</div></div></div><div id="branchesContent" class="loading">Loading...</div>`;
      try {
        const { data: franchisees } = await sb.from('users').select('*').eq('role', 'franchisee').order('created_at', { ascending: false });
        main.querySelector('#branchesContent').innerHTML = tableCard('All Franchisees', ['Name', 'Username', 'Contact', 'Joined'],
          (franchisees || []).map(f => [f.full_name || '—', f.username, f.contact_number || '—', fmtDate(f.created_at)]));
      } catch { main.querySelector('#branchesContent').innerHTML = '<div class="empty-state"><div class="icon">🏪</div>No franchisees found.</div>'; }
    }

    else if (tab === 'orders') {
      main.innerHTML = `<div class="main-header"><div><h1>All Orders</h1><div class="subtitle">Orders across all branches</div></div></div><div id="allOrdersContent" class="loading">Loading...</div>`;
      try {
        const { data: orders } = await sb.from('orders').select('*').order('created_at', { ascending: false });
        main.querySelector('#allOrdersContent').innerHTML = tableCard('All Orders', ['Order #', 'Date', 'Status', 'Total', 'Items'],
          (orders || []).map(o => [o.order_number || o.id, fmtDate(o.created_at), statusBadge(o.status), fmtPeso(o.total), (o.items || []).length + ' items']));
      } catch { main.querySelector('#allOrdersContent').innerHTML = '<div class="empty-state"><div class="icon">🧾</div>No orders found.</div>'; }
    }

    else if (tab === 'sales') {
      main.innerHTML = `<div class="main-header"><div><h1>Sales & Royalties</h1><div class="subtitle">Track sales and royalty fees across branches</div></div></div><div id="salesContent" class="loading">Loading...</div>`;
      try {
        const { data: sales } = await sb.from('sales').select('*').order('created_at', { ascending: false });
        const total = (sales || []).reduce((s, x) => s + Number(x.amount || 0), 0);
        const royalty = total * 0.05;
        main.querySelector('#salesContent').innerHTML = statCards([
          { label: 'Total Sales', value: fmtPeso(total), accent: true },
          { label: 'Royalty Collected (5%)', value: fmtPeso(royalty), accent: true },
          { label: 'Total Reports', value: (sales || []).length }
        ]) + tableCard('Sales Records', ['Date', 'Amount', 'Royalty (5%)', 'Reported On'],
          (sales || []).map(s => [fmtDate(s.date), fmtPeso(s.amount), fmtPeso(Number(s.amount) * 0.05), fmtDate(s.created_at)]));
      } catch { main.querySelector('#salesContent').innerHTML = '<div class="empty-state"><div class="icon">💰</div>No sales data.</div>'; }
    }
  });
};

window.Pages = Pages;
