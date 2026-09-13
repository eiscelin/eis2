// Franchise Dashboard — order creation, inventory, tracking
var Pages = window.Pages || {};

Pages.franchiseDashboard = function(el) {
  const user = Auth.currentUser;
  const navItems = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'orders', icon: '🧾', label: 'My Orders' },
    { id: 'create', icon: '➕', label: 'Create Order' },
    { id: 'inventory', icon: '📦', label: 'Inventory' },
    { id: 'supplies', icon: '📋', label: 'Available Supplies' },
    { id: 'announcements', icon: '📢', label: 'Announcements' },
    { id: 'profile', icon: '👤', label: 'My Profile' }
  ];

  dashLayout(el, user, navItems, async (main, tab) => {
    if (tab === 'dashboard') await renderFranchiseDash(main, user);
    else if (tab === 'orders') await renderMyOrders(main, user);
    else if (tab === 'create') await renderCreateOrder(main, user);
    else if (tab === 'inventory') await renderFranchiseInventory(main, user);
    else if (tab === 'supplies') await renderAvailableSupplies(main);
    else if (tab === 'announcements') await renderFranchiseAnnouncements(main, user);
    else if (tab === 'profile') await renderProfile(main, user);
  });
};

async function renderFranchiseDash(main, user) {
  main.innerHTML = UI.header('Franchise Dashboard', 'Your branch overview') + UI.loading();
  try {
    const fid = user.franchise_id;
    const [{ data: orders }, { data: inventory }, { data: anns }] = await Promise.all([
      sb.from('orders').select('*').eq('franchise_id', fid).order('created_at', { ascending: false }),
      sb.from('inventory').select('*, products(name, sku, category, unit)').eq('franchise_id', fid),
      sb.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(3)
    ]);

    const lowStock = (inventory || []).filter(i => (i.current_qty || 0) <= (i.min_stock || 0));
    const myOrders = orders || [];

    let html = UI.header('Franchise Dashboard', 'Your branch overview');
    html += UI.statRow([
      { label: 'Pending Orders', value: myOrders.filter(o => o.status === 'pending_approval').length, icon: '⏳' },
      { label: 'In Production', value: myOrders.filter(o => o.status === 'in_production').length, icon: '🏭' },
      { label: 'Ready for Dispatch', value: myOrders.filter(o => o.status === 'ready_for_dispatch').length, icon: '📦' },
      { label: 'In Transit', value: myOrders.filter(o => o.status === 'in_transit' || o.status === 'dispatched').length, icon: '🚚' },
      { label: 'Delivered', value: myOrders.filter(o => o.status === 'delivered').length, icon: '✅' },
      { label: 'Low Stock Items', value: lowStock.length, accent: lowStock.length > 0, icon: '⚠️' }
    ]);

    // Low stock alert
    if (lowStock.length) {
      html += `<div class="alert alert-warning" style="margin:1rem 0;">
        <strong>⚠️ Low Stock Alert:</strong> ${lowStock.length} item(s) need restocking.
      </div>`;
    }

    // Recent orders
    html += `<div style="margin-top:1rem;">${UI.table(
      ['Order #', 'Date', 'Status', 'Items', 'Total', 'Actions'],
      myOrders.slice(0, 8).map(o => [o.order_number, UI.fmtDate(o.created_at), UI.badge(o.status), o.total_items || 0, UI.fmtPeso(o.total_amount), `<button class="fm-edit-btn" data-order="${o.id}">View</button>`]),
      { title: 'Recent Orders', emptyMsg: 'No orders yet. Create one to get started!' }
    )}</div>`;

    // Latest announcements
    if (anns && anns.length) {
      html += `<div style="margin-top:1rem;"><div class="table-card-header"><h3>Latest Announcements</h3></div>`;
      for (const a of anns) {
        html += `<div style="padding:.75rem 1.25rem;border-bottom:1px solid #f0f0f0;">
          <div style="display:flex;justify-content:space-between;">
            <strong>${a.title}</strong>${UI.badge(a.priority)}
          </div>
          <p style="color:#666;font-size:.9rem;margin:.25rem 0 0;">${(a.content || '').slice(0, 120)}${(a.content || '').length > 120 ? '...' : ''}</p>
          <div style="font-size:.8rem;color:#999;">${UI.fmtDate(a.created_at)}</div>
        </div>`;
      }
      html += `</div>`;
    }

    main.innerHTML = html;
    main.querySelectorAll('[data-order]').forEach(btn => btn.addEventListener('click', () => viewOrderDetails(btn.dataset.order)));
  } catch (e) {
    main.innerHTML = UI.header('Franchise Dashboard') + UI.empty('📊', 'Unable to load dashboard.');
  }
}

async function renderMyOrders(main, user) {
  main.innerHTML = UI.header('My Orders', 'All your branch orders') + UI.loading();
  try {
    const { data: orders } = await sb.from('orders').select('*').eq('franchise_id', user.franchise_id).order('created_at', { ascending: false });
    let html = UI.header('My Orders', 'All your branch orders');
    html += `<div style="display:flex;gap:1rem;margin-bottom:1rem;">
      ${UI.searchBar('myOrderSearch', 'Search by order number...')}
      ${UI.filterSelect('myOrderFilter', [
        { value: 'pending_approval', label: 'Pending Approval' }, { value: 'approved', label: 'Approved' },
        { value: 'in_production', label: 'In Production' }, { value: 'production_completed', label: 'Production Complete' },
        { value: 'ready_for_dispatch', label: 'Ready for Dispatch' }, { value: 'dispatched', label: 'Dispatched' },
        { value: 'in_transit', label: 'In Transit' }, { value: 'delivered', label: 'Delivered' },
        { value: 'received', label: 'Received' }, { value: 'rejected', label: 'Rejected' },
        { value: 'cancelled', label: 'Cancelled' }
      ])}
    </div>`;
    const rows = (orders || []).map(o => [o.order_number, UI.fmtDate(o.created_at), UI.fmtDate(o.requested_delivery_date), o.total_items || 0, UI.fmtPeso(o.total_amount), UI.badge(o.status), `<button class="fm-edit-btn" data-order="${o.id}">View</button>`]);
    html += UI.table(['Order #', 'Date', 'Delivery Date', 'Items', 'Total', 'Status', 'Actions'], rows, { emptyMsg: 'No orders yet' });
    main.innerHTML = html;

    main.querySelectorAll('[data-order]').forEach(btn => btn.addEventListener('click', () => viewOrderDetails(btn.dataset.order)));
  } catch (e) {
    main.innerHTML = UI.header('My Orders') + UI.empty('🧾', 'Unable to load orders.');
  }
}

async function renderCreateOrder(main, user) {
  main.innerHTML = UI.header('Create New Order', 'Select supplies to order') + UI.loading();
  try {
    const { data: products } = await sb.from('products').select('*').eq('available_for_ordering', true).eq('status', 'active').order('name');
    const cart = {};

    let html = UI.header('Create New Order', 'Select supplies to order');
    html += `<div style="display:flex;gap:1rem;margin-bottom:1rem;">
      ${UI.searchBar('coSearch', 'Search products...')}
      ${UI.filterSelect('coCatFilter', [
        { value: 'Chicken', label: 'Chicken' }, { value: 'Marinades', label: 'Marinades' },
        { value: 'Sauces', label: 'Sauces' }, { value: 'Rice', label: 'Rice' },
        { value: 'Packaging', label: 'Packaging' }, { value: 'Beverages', label: 'Beverages' },
        { value: 'Condiments', label: 'Condiments' }, { value: 'Other', label: 'Other' }
      ])}
    </div>`;

    html += `<div id="productGrid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem;">`;
    for (const p of (products || [])) {
      html += `<div class="order-product-card" data-name="${p.name.toLowerCase()}" data-cat="${p.category}">
        <div style="font-weight:600;">${p.name}</div>
        <div style="font-size:.85rem;color:#999;">${p.sku} · ${p.category} · ${UI.fmtPeso(p.unit_price)}/${p.unit}</div>
        <div style="margin-top:.5rem;display:flex;align-items:center;gap:.5rem;">
          <input type="number" min="0" placeholder="0" class="form-input qty-input" data-pid="${p.id}" data-name="${p.name}" data-sku="${p.sku}" data-cat="${p.category}" data-price="${p.unit_price}" data-unit="${p.unit}" style="width:80px;">
          <span style="font-size:.85rem;color:#999;">${p.unit}</span>
        </div>
      </div>`;
    }
    html += `</div>`;

    html += `<div style="margin-top:1.5rem;" id="orderSummary">
      ${UI.formField('Requested Delivery Date', UI.input('deliveryDate', '', 'date'))}
      ${UI.formField('Notes', UI.textarea('orderNotes', 'Special instructions...', 2))}
      <div style="margin-top:1rem;">
        <button class="btn-save" id="submitOrderBtn">Submit Order</button>
      </div>
    </div>`;

    main.innerHTML = html;

    // Search/filter
    const filterProd = () => {
      const q = main.querySelector('#coSearch').value.toLowerCase();
      const c = main.querySelector('#coCatFilter').value;
      main.querySelectorAll('.order-product-card').forEach(card => {
        const matchQ = !q || card.dataset.name.includes(q);
        const matchC = !c || card.dataset.cat === c;
        card.style.display = (matchQ && matchC) ? '' : 'none';
      });
    };
    main.querySelector('#coSearch').addEventListener('input', filterProd);
    main.querySelector('#coCatFilter').addEventListener('change', filterProd);

    // Track cart
    main.querySelectorAll('.qty-input').forEach(inp => {
      inp.addEventListener('input', () => {
        const qty = parseInt(inp.value) || 0;
        if (qty > 0) cart[inp.dataset.pid] = { qty, name: inp.dataset.name, sku: inp.dataset.sku, cat: inp.dataset.cat, price: parseFloat(inp.dataset.price), unit: inp.dataset.unit };
        else delete cart[inp.dataset.pid];
      });
    });

    main.querySelector('#submitOrderBtn').onclick = async () => {
      const items = Object.values(cart);
      if (!items.length) return UI.toast('Select at least one product', 'error');
      const deliveryDate = main.querySelector('#deliveryDate').value;
      if (!deliveryDate) return UI.toast('Please select a delivery date', 'error');

      let summary = items.map(i => `${i.name}: ${i.qty} ${i.unit}`).join('\n');
      UI.confirm('Submit Order', `Review your order:\n\n${summary}\n\nTotal items: ${items.length}\nTotal quantity: ${items.reduce((a, b) => a + b.qty, 0)}`, async () => {
        try {
          const orderNum = await DB.generateOrderId();
          const totalQty = items.reduce((a, b) => a + b.qty, 0);
          const totalAmount = items.reduce((a, b) => a + (b.qty * b.price), 0);

          const { data: order, error } = await sb.from('orders').insert([{
            order_number: orderNum, franchise_id: user.franchise_id, status: 'pending_approval',
            total_items: items.length, total_qty: totalQty, total_amount: totalAmount,
            requested_delivery_date: deliveryDate, notes: main.querySelector('#orderNotes').value,
            created_by: user.id
          }]).select().single();
          if (error) throw error;

          // Insert order items
          for (const i of items) {
            await sb.from('order_items').insert([{
              order_id: order.id, product_id: i.pid, product_name: i.name, sku: i.sku,
              category: i.cat, quantity: i.qty, unit: i.unit, unit_price: i.price, total: i.qty * i.price
            }]);
          }

          await DB.addTimeline(order.id, 'Order Submitted', `Order submitted by ${user.username}`);
          await DB.notifyRole('admin', 'New Order Submitted', `Order ${orderNum} from ${user.full_name || user.username} requires approval.`, 'order', order.id, 'order');
          await DB.log('CREATE_ORDER', 'order', orderNum, `Created order ${orderNum} with ${items.length} items`);

          UI.toast('Order submitted! Pending approval.', 'success');
          renderMyOrders(main, user);
          // Switch to orders tab
          main.parentElement.parentElement.querySelectorAll('.sidebar-nav a').forEach(a => a.classList.remove('active'));
          const ordersTab = Array.from(main.parentElement.parentElement.querySelectorAll('.sidebar-nav a')).find(a => a.dataset.tab === 'orders');
          if (ordersTab) ordersTab.classList.add('active');
        } catch (e) { UI.toast('Failed: ' + e.message, 'error'); }
      }, 'Submit Order');
    };
  } catch (e) {
    main.innerHTML = UI.header('Create New Order') + UI.empty('📦', 'Unable to load products.');
  }
}

async function renderFranchiseInventory(main, user) {
  main.innerHTML = UI.header('My Inventory', 'Current stock levels for your branch') + UI.loading();
  try {
    const { data: inventory } = await sb.from('inventory').select('*, products(name, sku, category, unit)').eq('franchise_id', user.franchise_id);
    const list = inventory || [];
    const lowStock = list.filter(i => (i.current_qty || 0) <= (i.min_stock || 0));

    let html = UI.header('My Inventory', 'Current stock levels for your branch');
    html += UI.statRow([
      { label: 'Total Items', value: list.length, icon: '📦' },
      { label: 'Low Stock', value: lowStock.length, accent: lowStock.length > 0, icon: '⚠️' },
      { label: 'Well Stocked', value: list.length - lowStock.length, accent: true, icon: '✅' }
    ]);

    html += UI.table(['Product', 'SKU', 'Category', 'Current Qty', 'Reserved', 'Available', 'Min Stock', 'Status'],
      list.map(i => {
        const avail = (i.current_qty || 0) - (i.reserved_qty || 0);
        return [i.products?.name || '—', i.products?.sku || '—', i.products?.category || '—',
          `${i.current_qty || 0} ${i.products?.unit || ''}`, i.reserved_qty || 0, `${avail} ${i.products?.unit || ''}`,
          i.min_stock || 0, (i.current_qty || 0) <= (i.min_stock || 0) ? UI.badge('low') : UI.badge('active')];
      }),
      { title: 'Inventory Items', emptyMsg: 'No inventory items' }
    );

    // Inventory transactions
    const { data: transactions } = await sb.from('inventory_transactions').select('*, products(name, sku)').eq('franchise_id', user.franchise_id).order('created_at', { ascending: false }).limit(20);
    if (transactions && transactions.length) {
      html += `<div style="margin-top:1rem;">${UI.table(
        ['Product', 'Type', 'Quantity', 'Previous', 'New Stock', 'Date'],
        transactions.map(t => [t.products?.name || '—', t.transaction_type, (t.quantity > 0 ? '+' : '') + t.quantity, t.previous_stock, t.new_stock, UI.fmtDateTime(t.created_at)]),
        { title: 'Recent Transactions', emptyMsg: 'No transactions' }
      )}</div>`;
    }

    main.innerHTML = html;
  } catch (e) {
    main.innerHTML = UI.header('My Inventory') + UI.empty('📦', 'Unable to load inventory.');
  }
}

async function renderAvailableSupplies(main) {
  main.innerHTML = UI.header('Available Supplies', 'Products available for ordering') + UI.loading();
  try {
    const { data: products } = await sb.from('products').select('*').eq('available_for_ordering', true).eq('status', 'active').order('name');
    let html = UI.header('Available Supplies', 'Products available for ordering');
    html += `<div style="display:flex;gap:1rem;margin-bottom:1rem;">
      ${UI.searchBar('asSearch', 'Search products...')}
      ${UI.filterSelect('asCatFilter', [
        { value: 'Chicken', label: 'Chicken' }, { value: 'Marinades', label: 'Marinades' },
        { value: 'Sauces', label: 'Sauces' }, { value: 'Rice', label: 'Rice' },
        { value: 'Packaging', label: 'Packaging' }, { value: 'Beverages', label: 'Beverages' },
        { value: 'Condiments', label: 'Condiments' }, { value: 'Other', label: 'Other' }
      ])}
    </div>`;
    html += UI.table(['Name', 'SKU', 'Category', 'Unit', 'Price', 'Stock'],
      (products || []).map(p => [p.name, p.sku, p.category, p.unit, UI.fmtPeso(p.unit_price), p.current_stock || 0]),
      { emptyMsg: 'No supplies available' });
    main.innerHTML = html;

    const filterS = () => {
      const q = main.querySelector('#asSearch').value.toLowerCase();
      const c = main.querySelector('#asCatFilter').value;
      main.querySelectorAll('tbody tr').forEach((tr, i) => {
        const p = (products || [])[i]; if (!p) return;
        tr.style.display = (!q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) && (!c || p.category === c) ? '' : 'none';
      });
    };
    main.querySelector('#asSearch')?.addEventListener('input', filterS);
    main.querySelector('#asCatFilter')?.addEventListener('change', filterS);
  } catch (e) {
    main.innerHTML = UI.header('Available Supplies') + UI.empty('📦', 'Unable to load supplies.');
  }
}

async function renderFranchiseAnnouncements(main, user) {
  main.innerHTML = UI.header('Announcements', 'Messages from the main office') + UI.loading();
  try {
    const { data: anns } = await sb.from('announcements').select('*').eq('is_active', true).order('created_at', { ascending: false });
    let html = UI.header('Announcements', 'Messages from the main office');
    if (!anns || !anns.length) {
      html += UI.empty('📢', 'No announcements at this time.');
    } else {
      for (const a of anns) {
        html += `<div class="table-card" style="padding:1.25rem;margin-bottom:1rem;">
          <div style="display:flex;justify-content:space-between;align-items:start;">
            <h3 style="margin:0;">${a.title}</h3>
            ${UI.badge(a.priority)}
          </div>
          <div style="font-size:.85rem;color:#999;margin:.25rem 0 .5rem;">${UI.fmtDate(a.created_at)} · Target: ${a.target_audience}</div>
          <p style="color:#555;margin:0;">${a.content || ''}</p>
        </div>`;
      }
    }
    main.innerHTML = html;
  } catch (e) {
    main.innerHTML = UI.header('Announcements') + UI.empty('📢', 'Unable to load announcements.');
  }
}

window.Pages = Pages;
