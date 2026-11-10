// Auth pages — username + password only
var Pages = window.Pages || {};

function authShell(el, opts) {
  const brand = fbBrand();
  el.innerHTML = `
    <div class="auth-page">
      ${Theme.toggleButtonHTML('auth-theme')}
      ${opts.backLink ? `<a class="auth-back" href="#${opts.backLink}">← ${opts.backText}</a>` : ''}
      <div class="auth-card">
        <div class="auth-header">
          <div class="logo">${fbEscape(brand.initial)}</div>
          <h2>${opts.title}</h2>
          <p>${opts.subtitle}</p>
        </div>
        <div class="auth-body">
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
      btn.textContent = 'Welcome!';
    } catch (err) {
      errEl.textContent = err.message;
      errEl.classList.add('show');
      btn.disabled = false;
      btn.textContent = btn.dataset.label;
    }
  });
}

// Passwords are shown while typing by default; the toggle hides them
function pwToggleScript() {
  document.querySelectorAll('.toggle-pw').forEach(t => {
    const flip = () => {
      const input = t.parentElement.querySelector('input');
      const nowShown = input.type === 'password';
      input.type = nowShown ? 'text' : 'password';
      t.textContent = nowShown ? '🙈' : '👁';
      const label = nowShown ? 'Hide password' : 'Show password';
      t.setAttribute('aria-label', label);
      t.title = label;
    };
    t.addEventListener('click', flip);
    t.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
    });
  });
}

const usernameField = `
  <div class="form-group">
    <label>Username <span class="req">*</span></label>
    <div class="input-wrap">
      <span class="icon" aria-hidden="true">👤</span>
      <input type="text" name="username" placeholder="Enter your username" required autocomplete="username">
    </div>
  </div>
`;

function passwordField(placeholder, autocomplete) {
  return `
  <div class="form-group">
    <label>Password <span class="req">*</span></label>
    <div class="input-wrap">
      <span class="icon" aria-hidden="true">🔒</span>
      <input type="text" name="password" placeholder="${placeholder}" required autocomplete="${autocomplete}">
      <span class="toggle-pw" role="button" tabindex="0" aria-label="Hide password" title="Hide password">🙈</span>
    </div>
  </div>
  <button type="submit" class="btn-auth" data-label="Login">Login →</button>
`;
}

// ===== Log in =====
Pages.login = function (el) {
  authShell(el, {
    title: 'Log in to ' + fbBrand().name,
    subtitle: fbBrand().tagline,
    formFields: usernameField + passwordField('Enter your password', 'current-password'),
    footer: `<div class="auth-footer">New here? <a href="#/Register">Create an account</a></div>`
  });
  pwToggleScript();
  bindAuthForm(async (fd) => {
    await Auth.login(fd.get('username').trim(), fd.get('password'));
    Router.navigate('/App');
  });
};

// ===== Register (username + password) =====
Pages.register = function (el) {
  authShell(el, {
    title: 'Join ' + fbBrand().name,
    subtitle: fbBrand().tagline,
    formFields: usernameField + passwordField('Choose a password (6+ characters)', 'new-password').replace(
      '<button type="submit" class="btn-auth" data-label="Login">Login →</button>',
      '<button type="submit" class="btn-auth" data-label="Sign up">Sign up</button>'
    ),
    backLink: '/Login',
    backText: 'Back to Log in',
    footer: `<div class="auth-footer">Already have an account? <a href="#/Login">Log in</a></div>`
  });
  pwToggleScript();
  bindAuthForm(async (fd) => {
    const username = fd.get('username').trim();
    const password = fd.get('password');
    if (!username) throw new Error('Enter a username');
    if (password.length < 6) throw new Error('Password must be at least 6 characters');
    await Auth.register({ username, password, role: 'member' });
    Router.navigate('/App');
  });
};

window.Pages = Pages;
