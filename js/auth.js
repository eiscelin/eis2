// Enhanced Auth with role-based access control
const Auth = {
  currentUser: null,

  init() {
    const stored = localStorage.getItem('chookee_user');
    if (stored) {
      try { this.currentUser = JSON.parse(stored); } catch { this.currentUser = null; }
    }
  },

  async login(username, password) {
    if (!sb) throw new Error('Database not configured');
    const { data, error } = await sb
      .from('users').select('*')
      .eq('username', username).eq('password', password).single();
    if (error || !data) throw new Error('Invalid username or password');
    if (data.status === 'pending') throw new Error('Your account is pending admin approval');
    if (data.status === 'inactive') throw new Error('Your account has been deactivated. Contact admin.');
    this.currentUser = data;
    localStorage.setItem('chookee_user', JSON.stringify(data));
    await DB.log('LOGIN', 'system', null, `${data.username} logged in`);
    return data;
  },

  async register(userData) {
    if (!sb) throw new Error('Database not configured');
    const { data: existing } = await sb.from('users').select('id').eq('username', userData.username).maybeSingle();
    if (existing) throw new Error('Username already taken');
    const { data, error } = await sb.from('users').insert([userData]).select().single();
    if (error) throw new Error('Registration failed: ' + error.message);
    this.currentUser = data;
    localStorage.setItem('chookee_user', JSON.stringify(data));
    return data;
  },

  logout() {
    if (this.currentUser) DB.log('LOGOUT', 'system', null, `${this.currentUser.username} logged out`);
    this.currentUser = null;
    localStorage.removeItem('chookee_user');
    location.hash = '#/';
  },

  isLoggedIn() { return !!this.currentUser; },
  isAdmin() { return this.currentUser?.role === 'admin'; },
  isFranchisee() { return this.currentUser?.role === 'franchisee'; },
  isProduction() { return this.currentUser?.role === 'production'; },
  isDispatch() { return this.currentUser?.role === 'dispatch'; },
  getRole() { return this.currentUser?.role; },
  getFranchiseId() { return this.currentUser?.franchise_id; },

  // Role-based route protection
  canAccess(path) {
    if (!this.isLoggedIn()) return false;
    const role = this.getRole();
    const access = {
      admin: ['/AdminDashboard','/FranchiseManagement','/Orders','/Products','/ProductionDashboard','/DispatchDashboard','/Announcements','/Reports','/ActivityLogs','/Profile','/Settings','/Inventory'],
      franchisee: ['/FranchiseDashboard','/MyOrders','/CreateOrder','/Inventory','/Products','/Announcements','/Profile'],
      production: ['/ProductionDashboard','/ProductionQueue','/ProductionIssues','/Announcements','/Profile'],
      dispatch: ['/DispatchDashboard','/ReadyForDispatch','/ScheduledDeliveries','/InTransit','/Delivered','/DeliveryIssues','/Announcements','/Profile']
    };
    const allowed = access[role] || [];
    return allowed.includes(path);
  },

  redirectByRole() {
    const role = this.getRole();
    const redirects = {
      admin: '/AdminDashboard',
      franchisee: '/FranchiseDashboard',
      production: '/ProductionDashboard',
      dispatch: '/DispatchDashboard'
    };
    return redirects[role] || '/';
  }
};
