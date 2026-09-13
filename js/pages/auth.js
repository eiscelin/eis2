// Auth pages — login, register, production login, production register
var Pages = window.Pages || {};

function authShell(el, opts) {
  const isProd = opts.production;
  el.innerHTML = `
    <div class="auth-page">
      ${opts.backLink ? `<a class="auth-back" href="#${opts.backLink}">← ${opts.backText}</a>` : ''}
      <div class="auth-card">
        <div class="auth-header ${isProd ? 'production' : ''}">
          <div class="logo">CI</div>
          <h2>${opts.title}</h2>
          <p>${opts.subtitle}</p>
        </div>
        <div class="auth-body">
          <h3>${opts.formTitle}</h3>
          <div class="auth-error" id="authError"></div>
          <form id="authForm">${opts.formFields}</form>
          ${opts.footer || ''}
        </div>
      </div>
    </div>
  `;
}

function bindAuthForm(onSubmit) {
  const form = document.getElementById('authForm');
  const errEl = document.getElementById('authError');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errEl.classList.remove('show');
    const btn = form.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Please wait...';
    try {
      await onSubmit(new FormData(form));
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.add('show');
      btn.disabled = false;
      btn.textContent = btn.dataset.label;
    }
  });
}

function pwToggleScript() {
  document.querySelectorAll('.toggle-pw').forEach(t => {
    t.addEventListener('click', () => {
      const input = t.parentElement.querySelector('input');
      if (input.type === 'password') { input.type = 'text'; t.textContent = '🙈'; }
      else { input.type = 'password'; t.textContent = '👁'; }
    });
  });
}

const loginFields = `
  <div class="form-group">
    <label>Username</label>
    <div class="input-wrap">
      <span class="icon">👤</span>
      <input type="text" name="username" placeholder="Enter your username" required>
    </div>
  </div>
  <div class="form-group">
    <label>Password</label>
    <div class="input-wrap">
      <span class="icon">🔒</span>
      <input type="password" name="password" placeholder="Enter your password" required>
      <span class="toggle-pw">👁</span>
    </div>
  </div>
  <button type="submit" class="btn-auth" data-label="Login">Login →</button>
`;

const registerFields = (btnLabel) => `
  <div class="form-group">
    <label>Full Name <span class="req">*</span></label>
    <div class="input-wrap">
      <span class="icon">👤</span>
      <input type="text" name="full_name" placeholder="Enter your full name" required>
    </div>
  </div>
  <div class="form-group">
    <label>Username <span class="req">*</span></label>
    <div class="input-wrap">
      <span class="icon">👤</span>
      <input type="text" name="username" placeholder="Choose a username" required>
    </div>
  </div>
  <div class="form-group">
    <label>Contact Number</label>
    <div class="input-wrap">
      <span class="icon">📱</span>
      <input type="text" name="contact_number" placeholder="e.g. 0917 123 4567">
    </div>
  </div>
  <div class="form-group">
    <label>Password <span class="req">*</span></label>
    <div class="input-wrap">
      <span class="icon">🔒</span>
      <input type="password" name="password" placeholder="At least 6 characters" required minlength="6">
      <span class="toggle-pw">👁</span>
    </div>
  </div>
  <div class="form-group">
    <label>Confirm Password <span class="req">*</span></label>
    <div class="input-wrap">
      <span class="icon">🔒</span>
      <input type="password" name="confirm_password" placeholder="Re-enter your password" required>
      <span class="toggle-pw">👁</span>
    </div>
  </div>
  <button type="submit" class="btn-auth" data-label="${btnLabel}">${btnLabel}</button>
`;

// ===== Member Login =====
Pages.memberLogin = function(el) {
  authShell(el, {
    title: 'Chookee Inasal Portal',
    subtitle: 'Franchise Management System',
    formTitle: 'Sign In',
    formFields: loginFields,
    footer: `<div class="auth-footer">Don't have an account? <a href="#/Register">Register here</a></div>`
  });
  pwToggleScript();
  bindAuthForm(async (fd) => {
    const user = await Auth.login(fd.get('username'), fd.get('password'));
    redirectByRole(user);
  });
};

// ===== Franchisee Register =====
Pages.register = function(el) {
  authShell(el, {
    title: 'Chookee Inasal Franchisee Sign Up',
    subtitle: 'Create your franchisee portal account',
    formTitle: '',
    formFields: registerFields('Create Account'),
    backLink: '/MemberLogin',
    backText: 'Back to Login',
    footer: `<div class="auth-footer">Already have an account? <a href="#/MemberLogin">Login here</a></div>`
  });
  el.querySelector('h3').style.display = 'none';
  pwToggleScript();
  bindAuthForm(async (fd) => {
    if (fd.get('password') !== fd.get('confirm_password')) throw new Error('Passwords do not match');
    const user = await Auth.register({
      full_name: fd.get('full_name'),
      username: fd.get('username'),
      contact_number: fd.get('contact_number'),
      password: fd.get('password'),
      role: 'franchisee'
    });
    redirectByRole(user);
  });
};

// ===== Production Login =====
Pages.productionLogin = function(el) {
  authShell(el, {
    production: true,
    title: 'Production Portal',
    subtitle: 'Chookee Inasal Production Team',
    formTitle: 'Production Sign In',
    formFields: loginFields.replace('btn-auth', 'btn-auth production'),
    footer: `<div class="auth-footer">Don't have a production account? <a href="#/ProductionRegister">Register here</a></div><div class="auth-footer" style="margin-top:.5rem;"><a href="#/MemberLogin">Franchisee / Admin login</a></div>`
  });
  pwToggleScript();
  bindAuthForm(async (fd) => {
    const user = await Auth.login(fd.get('username'), fd.get('password'));
    redirectByRole(user);
  });
};

// ===== Production Register =====
Pages.productionRegister = function(el) {
  authShell(el, {
    production: true,
    title: 'Production Team Sign Up',
    subtitle: 'Create your production portal account',
    formTitle: '',
    formFields: registerFields('Create Production Account').replace('btn-auth', 'btn-auth production'),
    backLink: '/ProductionLogin',
    backText: 'Back to Production Login',
    footer: `<div class="auth-footer">Already have an account? <a href="#/ProductionLogin">Login here</a></div>`
  });
  el.querySelector('h3').style.display = 'none';
  pwToggleScript();
  bindAuthForm(async (fd) => {
    if (fd.get('password') !== fd.get('confirm_password')) throw new Error('Passwords do not match');
    const user = await Auth.register({
      full_name: fd.get('full_name'),
      username: fd.get('username'),
      contact_number: fd.get('contact_number'),
      password: fd.get('password'),
      role: 'production'
    });
    redirectByRole(user);
  });
};

function redirectByRole(user) {
  if (user.role === 'admin') Router.navigate('/admin-dashboard');
  else if (user.role === 'production') Router.navigate('/production-dashboard');
  else Router.navigate('/dashboard');
}

window.Pages = Pages;
