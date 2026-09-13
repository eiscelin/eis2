// Auth pages — login and registration
var Pages = window.Pages || {};

Pages.memberLogin = function(el) {
  el.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header">
          <div class="logo">CI</div>
          <h1>Chookee Inasal Portal</h1>
          <p>Franchise Management System</p>
        </div>
        <div class="auth-body">
          <h2>Sign In</h2>
          <div class="form-group">
            <label>Username</label>
            <input type="text" id="loginUsername" placeholder="Enter your username" class="form-input">
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="loginPassword" placeholder="Enter your password" class="form-input">
          </div>
          <button class="btn-auth" id="loginBtn">Login →</button>
          <p class="auth-footer">Don't have an account? <a href="#/Register">Register here</a></p>
          <p class="auth-footer" style="margin-top:.5rem;"><a href="#/ProductionLogin">Production Team Login</a></p>
        </div>
      </div>
    </div>`;

  el.querySelector('#loginBtn').onclick = async () => {
    const username = el.querySelector('#loginUsername').value;
    const password = el.querySelector('#loginPassword').value;
    if (!username || !password) return UI.toast('Enter username and password', 'error');
    try {
      const user = await Auth.login(username, password);
      UI.toast('Welcome back!', 'success');
      Router.navigate(Auth.redirectByRole());
    } catch (e) { UI.toast(e.message, 'error'); }
  };

  el.querySelector('#loginPassword').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') el.querySelector('#loginBtn').click();
  });
};

Pages.register = function(el) {
  el.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header">
          <div class="logo">CI</div>
          <h1>Chookee Inasal Portal</h1>
          <p>Franchise Registration</p>
        </div>
        <div class="auth-body">
          <h2>Create Account</h2>
          <div class="form-group"><label>Full Name</label><input type="text" id="regName" placeholder="Your full name" class="form-input"></div>
          <div class="form-group"><label>Username</label><input type="text" id="regUsername" placeholder="Choose a username" class="form-input"></div>
          <div class="form-group"><label>Contact Number</label><input type="text" id="regContact" placeholder="0917-xxx-xxxx" class="form-input"></div>
          <div class="form-group"><label>Password</label><input type="password" id="regPassword" placeholder="Min 6 characters" class="form-input"></div>
          <button class="btn-auth" id="registerBtn">Register →</button>
          <p class="auth-footer">Already have an account? <a href="#/MemberLogin">Login here</a></p>
        </div>
      </div>
    </div>`;

  el.querySelector('#registerBtn').onclick = async () => {
    const full_name = el.querySelector('#regName').value;
    const username = el.querySelector('#regUsername').value;
    const password = el.querySelector('#regPassword').value;
    if (!full_name || !username || !password) return UI.toast('All fields required', 'error');
    if (password.length < 6) return UI.toast('Password must be at least 6 characters', 'error');
    try {
      await Auth.register({
        full_name, username, password,
        contact_number: el.querySelector('#regContact').value,
        role: 'franchisee', status: 'active'
      });
      UI.toast('Registration successful!', 'success');
      Router.navigate('/FranchiseDashboard');
    } catch (e) { UI.toast(e.message, 'error'); }
  };
};

Pages.productionLogin = function(el) {
  el.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header" style="background:linear-gradient(135deg,#1565C0,#42A5F5);">
          <div class="logo">CI</div>
          <h1>Production Portal</h1>
          <p>Chookee Inasal Production System</p>
        </div>
        <div class="auth-body">
          <h2>Production Sign In</h2>
          <div class="form-group"><label>Username</label><input type="text" id="prodLoginUser" placeholder="Enter your username" class="form-input"></div>
          <div class="form-group"><label>Password</label><input type="password" id="prodLoginPass" placeholder="Enter your password" class="form-input"></div>
          <button class="btn-auth" id="prodLoginBtn">Login →</button>
          <p class="auth-footer"><a href="#/MemberLogin">Back to main login</a></p>
        </div>
      </div>
    </div>`;

  el.querySelector('#prodLoginBtn').onclick = async () => {
    const username = el.querySelector('#prodLoginUser').value;
    const password = el.querySelector('#prodLoginPass').value;
    if (!username || !password) return UI.toast('Enter username and password', 'error');
    try {
      const user = await Auth.login(username, password);
      if (user.role !== 'production' && user.role !== 'dispatch' && user.role !== 'admin') {
        Auth.logout();
        return UI.toast('This login is for production team only', 'error');
      }
      UI.toast('Welcome!', 'success');
      Router.navigate(Auth.redirectByRole());
    } catch (e) { UI.toast(e.message, 'error'); }
  };
};

Pages.productionRegister = function(el) {
  el.innerHTML = `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-header" style="background:linear-gradient(135deg,#1565C0,#42A5F5);">
          <div class="logo">CI</div>
          <h1>Production Portal</h1>
          <p>Production Team Registration</p>
        </div>
        <div class="auth-body">
          <h2>Production Sign Up</h2>
          <div class="form-group"><label>Full Name</label><input type="text" id="pregName" placeholder="Your full name" class="form-input"></div>
          <div class="form-group"><label>Username</label><input type="text" id="pregUser" placeholder="Choose a username" class="form-input"></div>
          <div class="form-group"><label>Password</label><input type="password" id="pregPass" placeholder="Min 6 characters" class="form-input"></div>
          <button class="btn-auth" id="pregBtn">Register →</button>
          <p class="auth-footer"><a href="#/ProductionLogin">Already have an account? Login</a></p>
        </div>
      </div>
    </div>`;

  el.querySelector('#pregBtn').onclick = async () => {
    const full_name = el.querySelector('#pregName').value;
    const username = el.querySelector('#pregUser').value;
    const password = el.querySelector('#pregPass').value;
    if (!full_name || !username || !password) return UI.toast('All fields required', 'error');
    if (password.length < 6) return UI.toast('Password must be at least 6 characters', 'error');
    try {
      await Auth.register({ full_name, username, password, role: 'production', status: 'active' });
      UI.toast('Registration successful!', 'success');
      Router.navigate('/ProductionDashboard');
    } catch (e) { UI.toast(e.message, 'error'); }
  };
};

window.Pages = Pages;
