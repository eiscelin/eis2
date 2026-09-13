// Dispatch Dashboard — delivery management
var Pages = window.Pages || {};

Pages.dispatchDashboard = function(el) {
  const user = Auth.currentUser;
  const navItems = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'ready', icon: '📦', label: 'Ready for Dispatch' },
    { id: 'scheduled', icon: '📅', label: 'Scheduled Deliveries' },
    { id: 'transit', icon: '🚚', label: 'In Transit' },
    { id: 'delivered', icon: '✅', label: 'Delivered' },
    { id: 'issues', icon: '⚠️', label: 'Delivery Issues' },
    { id: 'announcements', icon: '📢', label: 'Announcements' },
    { id: 'profile', icon: '👤', label: 'My Profile' }
  ];

  dashLayout(el, user, navItems, async (main, tab) => {
    if (tab === 'dashboard') await renderDispatchDash(main, user);
    else if (tab === 'ready') await renderReadyForDispatch(main, user);
    else if (tab === 'scheduled') await renderScheduledDeliveries(main, user);
    else if (tab === 'transit') await renderInTransit(main, user);
    else if (tab === 'delivered') await renderDelivered(main, user);
    else if (tab === 'issues') await renderDeliveryIssues(main, user);
    else if (tab === 'announcements') await renderFranchiseAnnouncements(main, user);
    else if (tab === 'profile') await renderProfile(main, user);
  });
};

async function renderDispatchDash(main, user) {
  main.innerHTML = UI.header('Dispatch Dashboard', 'Manage deliveries and shipments') + UI.loading();
  try {
    const [{ data: orders }, { data: dispatches }, { data: issues }] = await Promise.all([
      sb.from('orders').select('*, franchises(franchise_name, address, city)'),
      sb.from('dispatches').select('*'),
      sb.from('delivery_issues').select('*').eq('status', 'open')
    ]);

    const readyOrders = (orders || []).filter(o => o.status === 'ready_for_dispatch');
    const inTransit = (dispatches || []).filter(d => d.status === 'in_transit' || d.status === 'dispatched');
    const delivered = (dispatches || []).filter(d => d.status === 'delivered');
    const scheduled = (dispatches || []).filter(d => d.status === 'scheduled' || d.status === 'preparing');

    let html = UI.header('Dispatch Dashboard', 'Manage deliveries and shipments');
    html += UI.statRow([
      { label: 'Ready for Dispatch', value: readyOrders.length, accent: readyOrders.length > 0, icon: '📦' },
      { label: 'Scheduled', value: scheduled.length, icon: '📅' },
      { label: 'In Transit', value: inTransit.length, icon: '🚚' },
      { label: 'Delivered', value: delivered.length, accent: true, icon: '✅' },
      { label: 'Open Issues', value: (issues || []).length, accent: (issues || []).length > 0, icon: '⚠️' }
    ]);

    // Ready for dispatch list
    html += `<div style="margin-top:1rem;">${UI.table(
      ['Order #', 'Franchise', 'Destination', 'Items', 'Actions'],
      readyOrders.slice(0, 10).map(o => [o.order_number, o.franchises?.franchise_name || '—', `${o.franchises?.city || ''}`, o.total_items || 0, `<button class="btn-save" data-dispatch="${o.id}" style="padding:.3rem .75rem;font-size:.85rem;">Create Dispatch</button>`]),
      { title: 'Ready for Dispatch', emptyMsg: 'No orders ready for dispatch' }
    )}</div>`;

    main.innerHTML = html;
    main.querySelectorAll('[data-dispatch]').forEach(btn => btn.addEventListener('click', () => showCreateDispatchModal(btn.dataset.dispatch, main, user)));
  } catch (e) {
    main.innerHTML = UI.header('Dispatch Dashboard') + UI.empty('🚚', 'Unable to load dispatch data.');
  }
}

async function renderReadyForDispatch(main, user) {
  main.innerHTML = UI.header('Ready for Dispatch', 'Orders ready for delivery') + UI.loading();
  try {
    const { data: orders } = await sb.from('orders').select('*, franchises(franchise_name, address, city, province, phone)').eq('status', 'ready_for_dispatch').order('updated_at', { ascending: false });
    let html = UI.header('Ready for Dispatch', 'Orders ready for delivery');
    if (!orders || !orders.length) {
      html += UI.empty('📦', 'No orders ready for dispatch.');
    } else {
      for (const o of orders) {
        html += `<div class="table-card" style="padding:1.25rem;margin-bottom:1rem;">
          <div style="display:flex;justify-content:space-between;align-items:start;">
            <div>
              <h3 style="margin:0;">${o.order_number}</h3>
              <div style="font-size:.85rem;color:#999;margin:.25rem 0;">
                ${o.franchises?.franchise_name || '—'} · ${o.franchises?.address || ''}, ${o.franchises?.city || ''}<br>
                Items: ${o.total_items || 0} | Qty: ${o.total_qty || 0} | Delivery: ${UI.fmtDate(o.requested_delivery_date)}
              </div>
            </div>
            <button class="btn-save" data-dispatch="${o.id}" style="padding:.3rem .75rem;font-size:.85rem;">Create Dispatch</button>
          </div>
        </div>`;
      }
    }
    main.innerHTML = html;
    main.querySelectorAll('[data-dispatch]').forEach(btn => btn.addEventListener('click', () => showCreateDispatchModal(btn.dataset.dispatch, main, user)));
  } catch (e) {
    main.innerHTML = UI.header('Ready for Dispatch') + UI.empty('📦', 'Unable to load orders.');
  }
}

function showCreateDispatchModal(orderId, main, user) {
  sb.from('orders').select('*, franchises(franchise_name, address, city, province, phone)').eq('id', orderId).single().then(({ data: order }) => {
    if (!order) return;
    const f = order.franchises;
    UI.modal('Create Dispatch — ' + order.order_number, `
      <div style="margin-bottom:1rem;padding:.75rem;background:#f8f9fa;border-radius:.5rem;">
        <strong>Franchise:</strong> ${f?.franchise_name || '—'}<br>
        <strong>Destination:</strong> ${f?.address || ''}, ${f?.city || ''}, ${f?.province || ''}<br>
        <strong>Contact:</strong> ${f?.phone || '—'}
      </div>
      ${UI.formField('Driver Name', UI.input('dDriver', 'Driver name'), true)}
      ${UI.formField('Driver Contact', UI.input('dContact', '0917-xxx-xxxx'))}
      ${UI.formField('Vehicle', UI.input('dVehicle', 'e.g. Van - CEB 1234'))}
      ${UI.formField('Scheduled Date', UI.input('dDate', '', 'date'), true)}
      ${UI.formField('Scheduled Time', UI.input('dTime', '', 'time'))}
      ${UI.formField('Number of Packages', UI.input('dPackages', '1', 'number'))}
      ${UI.formField('Special Instructions', UI.textarea('dInstructions', 'Delivery instructions...', 2))}
      <div style="margin-top:1rem;">${UI.button('Create Dispatch', 'createDispatchBtn')}
      <button class="btn-cancel" data-close style="margin-left:.5rem;">Cancel</button></div>
    `, (modal) => {
      modal.querySelector('#createDispatchBtn').onclick = async () => {
        const driver = modal.querySelector('#dDriver').value;
        const date = modal.querySelector('#dDate').value;
        if (!driver || !date) return UI.toast('Driver name and date are required', 'error');
        try {
          const dispatchNum = await DB.generateDispatchId();
          const { data: dispatch, error } = await sb.from('dispatches').insert([{
            dispatch_number: dispatchNum, order_id: orderId, franchise_id: order.franchise_id,
            delivery_address: `${f?.address || ''}, ${f?.city || ''}, ${f?.province || ''}`,
            driver_name: driver, driver_contact: modal.querySelector('#dContact').value,
            vehicle: modal.querySelector('#dVehicle').value, scheduled_date: date,
            scheduled_time: modal.querySelector('#dTime').value, num_packages: Number(modal.querySelector('#dPackages').value),
            special_instructions: modal.querySelector('#dInstructions').value, status: 'scheduled', created_by: user.id
          }]).select().single();
          if (error) throw error;

          await DB.updateOrderStatus(orderId, 'preparing_dispatch');
          await DB.notify(order.created_by, 'Dispatch Scheduled', `Delivery scheduled for order ${order.order_number}. Dispatch #${dispatchNum}. Driver: ${driver}`, 'info', orderId, 'order');
          await DB.log('CREATE_DISPATCH', 'dispatch', dispatchNum, `Created dispatch ${dispatchNum} for ${order.order_number}`);
          UI.toast('Dispatch created!', 'success');
          modal.remove(); renderScheduledDeliveries(main, user);
        } catch (e) { UI.toast('Failed: ' + e.message, 'error'); }
      };
    });
  });
}

async function renderScheduledDeliveries(main, user) {
  main.innerHTML = UI.header('Scheduled Deliveries', 'Dispatches being prepared') + UI.loading();
  try {
    const { data: dispatches } = await sb.from('dispatches').select('*, orders(order_number), franchises(franchise_name)').in('status', ['scheduled', 'preparing']).order('scheduled_date', { ascending: true });
    let html = UI.header('Scheduled Deliveries', 'Dispatches being prepared');
    if (!dispatches || !dispatches.length) {
      html += UI.empty('📅', 'No scheduled deliveries.');
    } else {
      for (const d of dispatches) {
        html += `<div class="table-card" style="padding:1.25rem;margin-bottom:1rem;">
          <div style="display:flex;justify-content:space-between;align-items:start;">
            <div>
              <h3 style="margin:0;">${d.dispatch_number}</h3>
              <div style="font-size:.85rem;color:#999;margin:.25rem 0;">
                Order: ${d.orders?.order_number || '—'} · ${d.franchises?.franchise_name || '—'}<br>
                Driver: ${d.driver_name || '—'} · Vehicle: ${d.vehicle || '—'}<br>
                Scheduled: ${UI.fmtDate(d.scheduled_date)} ${d.scheduled_time || ''} · ${UI.badge(d.status)}
              </div>
            </div>
            <div style="display:flex;gap:.5rem;">
              <button class="btn-save" data-dispatch-out="${d.id}" style="padding:.3rem .75rem;font-size:.85rem;">Dispatch</button>
            </div>
          </div>
        </div>`;
      }
    }
    main.innerHTML = html;
    main.querySelectorAll('[data-dispatch-out]').forEach(btn => btn.addEventListener('click', () => dispatchOrder(btn.dataset.dispatchOut, main, user)));
  } catch (e) {
    main.innerHTML = UI.header('Scheduled Deliveries') + UI.empty('📅', 'Unable to load scheduled deliveries.');
  }
}

async function dispatchOrder(dispatchId, main, user) {
  UI.confirm('Dispatch Order', 'Mark this order as dispatched? It will be in transit to the franchise.', async () => {
    try {
      const { data: d } = await sb.from('dispatches').select('*, orders(order_number, franchise_id, created_by)').eq('id', dispatchId).single();
      await sb.from('dispatches').update({ status: 'dispatched', updated_at: new Date().toISOString() }).eq('id', dispatchId);
      await DB.updateOrderStatus(d.order_id, 'dispatched');
      await DB.notify(d.orders.created_by, 'Order Dispatched', `Your order ${d.orders.order_number} has been dispatched. Driver: ${d.driver_name}`, 'info', d.order_id, 'order');
      await DB.log('DISPATCH_ORDER', 'dispatch', d.dispatch_number, `Dispatched ${d.dispatch_number}`);
      UI.toast('Order dispatched!', 'success');
      renderInTransit(main, user);
    } catch (e) { UI.toast('Failed: ' + e.message, 'error'); }
  }, 'Dispatch');
}

async function renderInTransit(main, user) {
  main.innerHTML = UI.header('In Transit', 'Orders currently being delivered') + UI.loading();
  try {
    const { data: dispatches } = await sb.from('dispatches').select('*, orders(order_number), franchises(franchise_name)').in('status', ['dispatched', 'in_transit']).order('updated_at', { ascending: false });
    let html = UI.header('In Transit', 'Orders currently being delivered');
    if (!dispatches || !dispatches.length) {
      html += UI.empty('🚚', 'No orders in transit.');
    } else {
      for (const d of dispatches) {
        html += `<div class="table-card" style="padding:1.25rem;margin-bottom:1rem;">
          <div style="display:flex;justify-content:space-between;align-items:start;">
            <div>
              <h3 style="margin:0;">${d.dispatch_number}</h3>
              <div style="font-size:.85rem;color:#999;margin:.25rem 0;">
                Order: ${d.orders?.order_number || '—'} · ${d.franchises?.franchise_name || '—'}<br>
                Driver: ${d.driver_name || '—'} · ${d.driver_contact || ''}<br>
                ${UI.badge(d.status)}
              </div>
            </div>
            <div style="display:flex;gap:.5rem;">
              <button class="btn-save" data-deliver="${d.id}" style="padding:.3rem .75rem;font-size:.85rem;">Mark Delivered</button>
              <button class="btn-danger" data-fail="${d.id}" style="padding:.3rem .75rem;font-size:.85rem;">Report Issue</button>
            </div>
          </div>
        </div>`;
      }
    }
    main.innerHTML = html;
    main.querySelectorAll('[data-deliver]').forEach(btn => btn.addEventListener('click', () => markDelivered(btn.dataset.deliver, main, user)));
    main.querySelectorAll('[data-fail]').forEach(btn => btn.addEventListener('click', () => showDeliveryIssueModal(btn.dataset.fail, main, user)));
  } catch (e) {
    main.innerHTML = UI.header('In Transit') + UI.empty('🚚', 'Unable to load in-transit orders.');
  }
}

async function markDelivered(dispatchId, main, user) {
  UI.confirm('Mark Delivered', 'Confirm this order has been delivered to the franchise?', async () => {
    try {
      const { data: d } = await sb.from('dispatches').select('*, orders(order_number, franchise_id, created_by)').eq('id', dispatchId).single();
      await sb.from('dispatches').update({ status: 'delivered', delivered_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', dispatchId);
      await DB.updateOrderStatus(d.order_id, 'delivered');
      await DB.notify(d.orders.created_by, 'Order Delivered', `Your order ${d.orders.order_number} has been delivered. Please confirm receipt.`, 'success', d.order_id, 'order');
      await DB.log('DELIVER_ORDER', 'dispatch', d.dispatch_number, `Delivered ${d.dispatch_number}`);
      UI.toast('Order marked as delivered!', 'success');
      renderDelivered(main, user);
    } catch (e) { UI.toast('Failed: ' + e.message, 'error'); }
  }, 'Mark Delivered');
}

async function renderDelivered(main, user) {
  main.innerHTML = UI.header('Delivered', 'Completed deliveries') + UI.loading();
  try {
    const { data: dispatches } = await sb.from('dispatches').select('*, orders(order_number, status), franchises(franchise_name)').in('status', ['delivered']).order('delivered_at', { ascending: false });
    let html = UI.header('Delivered', 'Completed deliveries');
    html += UI.table(
      ['Dispatch #', 'Order #', 'Franchise', 'Driver', 'Delivered At', 'Order Status'],
      (dispatches || []).map(d => [d.dispatch_number, d.orders?.order_number || '—', d.franchises?.franchise_name || '—', d.driver_name || '—', UI.fmtDateTime(d.delivered_at), UI.badge(d.orders?.status || '—')]),
      { emptyMsg: 'No delivered orders' }
    );
    main.innerHTML = html;
  } catch (e) {
    main.innerHTML = UI.header('Delivered') + UI.empty('✅', 'Unable to load delivered orders.');
  }
}

async function renderDeliveryIssues(main, user) {
  main.innerHTML = UI.header('Delivery Issues', 'Reported delivery problems') + UI.loading();
  try {
    const { data: issues } = await sb.from('delivery_issues').select('*, dispatches(dispatch_number), orders(order_number)').order('created_at', { ascending: false });
    let html = UI.header('Delivery Issues', 'Reported delivery problems');
    html += UI.table(
      ['Dispatch #', 'Order #', 'Type', 'Severity', 'Status', 'Description', 'Reported'],
      (issues || []).map(i => [i.dispatches?.dispatch_number || '—', i.orders?.order_number || '—', i.issue_type, UI.badge(i.severity), UI.badge(i.status), (i.description || '').slice(0, 40), UI.fmtDate(i.created_at)]),
      { emptyMsg: 'No delivery issues reported' }
    );
    main.innerHTML = html;
  } catch (e) {
    main.innerHTML = UI.header('Delivery Issues') + UI.empty('⚠️', 'Unable to load delivery issues.');
  }
}

function showDeliveryIssueModal(dispatchId, main, user) {
  UI.modal('Report Delivery Issue', `
    ${UI.formField('Issue Type', UI.select('dIssueType', [
      { value: 'wrong_address', label: 'Wrong Address' },
      { value: 'damaged_goods', label: 'Damaged Goods' },
      { value: 'shortage', label: 'Shortage' },
      { value: 'delay', label: 'Delay' },
      { value: 'vehicle_breakdown', label: 'Vehicle Breakdown' },
      { value: 'other', label: 'Other' }
    ]), true)}
    ${UI.formField('Severity', UI.select('dIssueSeverity', [
      { value: 'low', label: 'Low' }, { value: 'normal', label: 'Normal' },
      { value: 'high', label: 'High' }, { value: 'critical', label: 'Critical' }
    ]))}
    ${UI.formField('Description', UI.textarea('dIssueDesc', 'Describe the issue...', 3), true)}
    <div style="margin-top:1rem;">${UI.button('Report Issue', 'submitDIssueBtn', 'danger')}
    <button class="btn-cancel" data-close style="margin-left:.5rem;">Cancel</button></div>
  `, (modal) => {
    modal.querySelector('#submitDIssueBtn').onclick = async () => {
      const desc = modal.querySelector('#dIssueDesc').value;
      if (!desc) return UI.toast('Description is required', 'error');
      try {
        const { data: d } = await sb.from('dispatches').select('*, orders(order_number)').eq('id', dispatchId).single();
        await sb.from('delivery_issues').insert([{
          dispatch_id: dispatchId, order_id: d.order_id,
          issue_type: modal.querySelector('#dIssueType').value, description: desc,
          severity: modal.querySelector('#dIssueSeverity').value, status: 'open', reported_by: user.id
        }]);
        await DB.notifyRole('admin', 'Delivery Issue Reported', `Issue reported for dispatch ${d.dispatch_number}: ${desc}`, 'error', d.order_id, 'order');
        await DB.log('REPORT_DELIVERY_ISSUE', 'delivery_issue', null, `Reported delivery issue: ${desc}`);
        UI.toast('Issue reported! Admin has been notified.', 'success');
        modal.remove();
      } catch (e) { UI.toast('Failed: ' + e.message, 'error'); }
    };
  });
}

window.Pages = Pages;
