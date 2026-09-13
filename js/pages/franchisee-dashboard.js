// Franchisee Dashboard — matches original app navigation
var Pages = window.Pages || {};

Pages.franchiseeDashboard = function(el) {
  const user = Auth.currentUser;
  const navItems = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'orders', icon: '🧾', label: 'Orders' },
    { id: 'shop', icon: '🛍️', label: 'Shop Catalog' },
    { id: 'supplies', icon: '📦', label: 'Available Supplies' },
    { id: 'profile', icon: '👤', label: 'My Profile' }
  ];

  dashLayout(el, user, navItems, async (main, tab) => {
    if (tab === 'dashboard') {
      main.innerHTML = mainHeader('My Branch', 'Your franchise branch overview');
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
      } catch { main.innerHTML += emptyState('🏪', 'No branch linked. Set up your branch from the Dashboard to start receiving orders.'); }
    }

    else if (tab === 'orders') {
      main.innerHTML = mainHeader('My Orders', 'Track your supply orders');
      try {
        const { data: orders } = await sb.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
        main.innerHTML += tableCard('All Orders', ['Order #', 'Date', 'Status', 'Total', 'Items'],
          (orders || []).map(o => [o.order_number || o.id, fmtDate(o.created_at), statusBadge(o.status), fmtPeso(o.total), (o.items || []).length + ' items']));
      } catch { main.innerHTML += emptyState('🧾', 'No orders yet. Place a supply order to get started.'); }
    }

    else if (tab === 'shop') {
      main.innerHTML = mainHeader('Shop Catalog', 'Manage your branch\'s product catalog');
      try {
        const { data: products } = await sb.from('products').select('*').eq('is_active', true).order('name');
        main.innerHTML += tableCard('Shop Catalog', ['Product', 'Category', 'Price', 'Available'],
          (products || []).map(p => [p.name, p.category || '—', fmtPeso(p.price), p.is_available !== false ? '✅' : '❌']));
      } catch { main.innerHTML += emptyState('🛍️', 'No products in your shop catalog yet.'); }
    }

    else if (tab === 'supplies') {
      main.innerHTML = mainHeader('Available Supplies', 'Order supplies from the main office');
      main.innerHTML += '<div id="suppliesContent" class="loading">Loading...</div>';
      try {
        const { data: products } = await sb.from('products').select('*').order('name');
        const cart = [];
        const renderSupplies = () => {
          const content = main.querySelector('#suppliesContent');
          content.innerHTML = `
            <div class="table-card">
              <div class="table-card-header"><h3>Available Products</h3></div>
              <table>
                <thead><tr><th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Action</th></tr></thead>
                <tbody>${(products || []).map(p => `
                  <tr><td>${p.name}</td><td>${p.category || '—'}</td><td>${fmtPeso(p.price)}</td><td>${p.stock || 0}</td>
                  <td><button class="btn-cancel" data-pid="${p.id}" data-pname="${p.name}" data-pprice="${p.price}">Add</button></td></tr>`).join('') || `<tr><td colspan="5" style="text-align:center;color:#999;padding:2rem;">No supplies available</td></tr>`}</tbody>
              </table>
            </div>
            ${cart.length ? `<div class="table-card"><div class="table-card-header"><h3>Cart (${cart.length})</h3></div>
              <table><thead><tr><th>Product</th><th>Price</th><th>Qty</th><th>Subtotal</th><th></th></tr></thead>
              <tbody>${cart.map((c, i) => `<tr><td>${c.name}</td><td>${fmtPeso(c.price)}</td><td>${c.qty}</td><td>${fmtPeso(c.price * c.qty)}</td><td><button class="btn-cancel" data-rm="${i}">Remove</button></td></tr>`).join('')}</tbody></table>
              <div style="padding:1rem 1.25rem;display:flex;justify-content:space-between;align-items:center;">
                <strong>Total: ${fmtPeso(cart.reduce((s, c) => s + c.price * c.qty, 0))}</strong>
                <button class="btn-save" id="placeOrderBtn">Place Order</button>
              </div></div>` : ''}`;
          content.querySelectorAll('[data-pid]').forEach(btn => {
            btn.addEventListener('click', () => {
              cart.push({ id: btn.dataset.pid, name: btn.dataset.pname, price: Number(btn.dataset.pprice), qty: 1 });
              renderSupplies();
            });
          });
          content.querySelectorAll('[data-rm]').forEach(btn => {
            btn.addEventListener('click', () => { cart.splice(Number(btn.dataset.rm), 1); renderSupplies(); });
          });
          const placeBtn = content.querySelector('#placeOrderBtn');
          if (placeBtn) placeBtn.addEventListener('click', async () => {
            try {
              const total = cart.reduce((s, c) => s + c.price * c.qty, 0);
              const orderNum = 'ORD-' + Date.now().toString().slice(-6);
              await sb.from('orders').insert([{ order_number: orderNum, user_id: user.id, status: 'pending', total, items: cart, franchise_name: user.full_name, branch_location: user.username }]);
              showToast('Order placed successfully!', 'success');
              el.querySelector('[data-tab=dashboard]').click();
            } catch (e) { showToast('Failed to place order: ' + e.message, 'error'); }
          });
        };
        renderSupplies();
      } catch { main.querySelector('#suppliesContent').innerHTML = emptyState('📦', 'No supplies available right now.'); }
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
