// Auth logic — username/password based using a users table in Supabase
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
      .from('users')
      .select('*')
      .eq('username', username)
      .eq('password', password)
      .single();
    if (error || !data) throw new Error('Invalid username or password');
    this.currentUser = data;
    localStorage.setItem('chookee_user', JSON.stringify(data));
    return data;
  },

  async register(userData) {
    if (!sb) throw new Error('Database not configured');
    const { data: existing } = await sb
      .from('users')
      .select('id')
      .eq('username', userData.username)
      .maybeSingle();
    if (existing) throw new Error('Username already taken');
    const { data, error } = await sb
      .from('users')
      .insert([userData])
      .select()
      .single();
    if (error) throw new Error('Registration failed: ' + error.message);
    this.currentUser = data;
    localStorage.setItem('chookee_user', JSON.stringify(data));
    return data;
  },

  logout() {
    this.currentUser = null;
    localStorage.removeItem('chookee_user');
    location.hash = '#/';
  },

  isLoggedIn() { return !!this.currentUser; },
  isAdmin() { return this.currentUser?.role === 'admin'; },
  isFranchisee() { return this.currentUser?.role === 'franchisee'; },
  isProduction() { return this.currentUser?.role === 'production'; },
  isDispatch() { return this.currentUser?.role === 'dispatch'; },
  getRole() { return this.currentUser?.role; }
};
