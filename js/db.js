// Database helper functions
const DB = {
  // Generate sequential IDs
  async generateOrderId() {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `ORD-${today}-`;
    const { data } = await sb.from('orders').select('order_number').like('order_number', `${prefix}%`).order('order_number', { ascending: false }).limit(1);
    let seq = 1;
    if (data && data.length) {
      const last = parseInt(data[0].order_number.split('-')[2]);
      seq = last + 1;
    }
    return `${prefix}${String(seq).padStart(5, '0')}`;
  },

  async generateDispatchId() {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `DSP-${today}-`;
    const { data } = await sb.from('dispatches').select('dispatch_number').like('dispatch_number', `${prefix}%`).order('dispatch_number', { ascending: false }).limit(1);
    let seq = 1;
    if (data && data.length) { const last = parseInt(data[0].dispatch_number.split('-')[2]); seq = last + 1; }
    return `${prefix}${String(seq).padStart(5, '0')}`;
  },

  async generateProductionId() {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `PRD-${today}-`;
    const { data } = await sb.from('production_tasks').select('production_number').like('production_number', `${prefix}%`).order('production_number', { ascending: false }).limit(1);
    let seq = 1;
    if (data && data.length) { const last = parseInt(data[0].production_number.split('-')[2]); seq = last + 1; }
    return `${prefix}${String(seq).padStart(5, '0')}`;
  },

  async generateFranchiseCode() {
    const { data } = await sb.from('franchises').select('franchise_code').like('franchise_code', 'FR-%').order('franchise_code', { ascending: false }).limit(1);
    let seq = 1;
    if (data && data.length) { const last = parseInt(data[0].franchise_code.split('-')[1]); seq = last + 1; }
    return `FR-${String(seq).padStart(6, '0')}`;
  },

  // Audit log helper
  async log(action, entity, entityId, details, prevVal, newVal) {
    const user = Auth.currentUser;
    if (!user || !sb) return;
    try {
      await sb.from('audit_logs').insert([{
        user_id: user.id, user_name: user.username, role: user.role,
        action, entity, entity_id: entityId ? String(entityId) : null,
        details: details || null, previous_value: prevVal || null, new_value: newVal || null
      }]);
    } catch (e) { console.error('Audit log failed:', e.message); }
  },

  // Timeline helper
  async addTimeline(orderId, event, description) {
    const user = Auth.currentUser;
    if (!sb) return;
    try {
      await sb.from('order_timeline').insert([{
        order_id: orderId, event, description,
        user_id: user?.id, user_name: user?.username
      }]);
    } catch (e) { console.error('Timeline insert failed:', e.message); }
  },

  // Notification helper
  async notify(userId, title, message, type, refId, refType) {
    if (!sb) return;
    try {
      await sb.from('notifications').insert([{ user_id: userId, title, message, type: type || 'info', reference_id: refId || null, reference_type: refType || null }]);
    } catch (e) { console.error('Notify failed:', e.message); }
  },

  // Notify all users of a role
  async notifyRole(role, title, message, type, refId, refType) {
    if (!sb) return;
    try {
      const { data: users } = await sb.from('users').select('id').eq('role', role).eq('status', 'active');
      if (users) for (const u of users) await this.notify(u.id, title, message, type, refId, refType);
    } catch (e) { console.error('Notify role failed:', e.message); }
  },

  // Update order status with validation
  async updateOrderStatus(orderId, newStatus, extra) {
    if (!sb) return { error: 'No database' };
    const { data: order } = await sb.from('orders').select('*').eq('id', orderId).single();
    if (!order) return { error: 'Order not found' };

    // Validate transition
    const valid = this.isValidTransition(order.status, newStatus);
    if (!valid) return { error: `Cannot transition from ${order.status} to ${newStatus}` };

    const updates = { status: newStatus, updated_at: new Date().toISOString(), ...extra };
    const { data, error } = await sb.from('orders').update(updates).eq('id', orderId).select().single();
    if (error) return { error: error.message };

    await this.addTimeline(orderId, this.statusEvent(newStatus), `Order status changed to ${newStatus}`);
    await this.log('UPDATE_STATUS', 'order', orderId, `Changed order status to ${newStatus}`, order.status, newStatus);
    return { data };
  },

  isValidTransition(from, to) {
    const transitions = {
      'draft': ['submitted'],
      'submitted': ['pending_approval', 'cancelled'],
      'pending_approval': ['approved', 'rejected', 'cancelled'],
      'approved': ['in_production', 'cancelled'],
      'rejected': ['cancelled'],
      'in_production': ['production_completed', 'issue_reported', 'cancelled'],
      'issue_reported': ['in_production', 'cancelled'],
      'production_completed': ['ready_for_dispatch'],
      'ready_for_dispatch': ['preparing_dispatch', 'dispatched'],
      'preparing_dispatch': ['dispatched', 'cancelled'],
      'dispatched': ['in_transit', 'delivered'],
      'in_transit': ['delivered'],
      'delivered': ['received'],
      'received': [],
      'cancelled': []
    };
    return (transitions[from] || []).includes(to);
  },

  statusEvent(status) {
    const events = {
      'submitted': 'Order Submitted', 'pending_approval': 'Pending Approval',
      'approved': 'Order Approved', 'rejected': 'Order Rejected',
      'in_production': 'Production Started', 'production_completed': 'Production Completed',
      'ready_for_dispatch': 'Ready for Dispatch', 'preparing_dispatch': 'Preparing Dispatch',
      'dispatched': 'Dispatched', 'in_transit': 'In Transit',
      'delivered': 'Delivered', 'received': 'Received by Franchise',
      'cancelled': 'Order Cancelled', 'issue_reported': 'Issue Reported'
    };
    return events[status] || status;
  }
};
