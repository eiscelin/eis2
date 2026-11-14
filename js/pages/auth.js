// Auth pages — username + password only
var Pages = window.Pages || {};

// Small line icons used inside the fields
function authIcon(name) {
  const paths = {
    user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    eye: '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>'
      + '<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>'
      + '<path d="M1 1l22 22"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}

function authShell(el, opts) {
  const brand = fbBrand();
  el.innerHTML = `
    <div class="auth-split">
      <aside class="auth-hero">
        <div class="auth-hero-glow" aria-hidden="true"></div>
        <div class="auth-hero-grid" aria-hidden="true"></div>
        <div class="auth-brand">
          <div class="auth-brand-logo">${fbBrandMark()}</div>
          <div class="auth-brand-name">${fbEscape(brand.name)}</div>
          <p class="auth-brand-line">Connect • Share • Enjoy</p>
          <p class="auth-brand-tag"><span>A Better Social Experience for Everyone!</span></p>
          <ul class="auth-perks">
            <li><span class="ico" aria-hidden="true">👥</span><span>Connect with Friends</span></li>
            <li><span class="ico" aria-hidden="true">💬</span><span>Share What You Love</span></li>
            <li><span class="ico" aria-hidden="true">👍</span><span>Chat Instantly</span></li>
          </ul>
        </div>
        <svg class="auth-skyline" viewBox="0 0 1440 240" preserveAspectRatio="none" aria-hidden="true">
          <path fill="rgba(3,15,60,.34)" d="M0 240V150h40v-40h30v40h25V90h35v60h20v-30h45v30h30V70h40v80h25v-25h50v25h30V100h35v50h25v-20h40v20h30V60h45v90h25v-35h40v35h30V110h35v40h25v-25h45v25h30V80h40v70h25v-30h40v30h30V140h45v-20h40v20h30V95h40v55h30v-15h50v15H1440V240Z"/>
        </svg>
      </aside>

      <div class="auth-panel">
        ${opts.backLink ? `<a class="auth-back" href="#${opts.backLink}">← ${opts.backText}</a>` : ''}
        <div class="auth-card">
          <div class="auth-header">
            <svg class="auth-head-waves" viewBox="0 0 400 120" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 78c58-34 120-34 178-6 58 28 122 30 222-10v58H0z" fill="rgba(255,255,255,.13)"/>
              <path d="M0 96c70-30 138-26 196 2 56 27 120 24 204-14v36H0z" fill="rgba(255,255,255,.1)"/>
            </svg>
            <div class="logo">${fbBrandMark()}</div>
            <h2>${opts.title}</h2>
            <p>${opts.subtitle}</p>
          </div>
          <div class="auth-body">
            <div class="auth-error" id="authError"></div>
            <form id="authForm">${opts.formFields}</form>
            <div class="auth-or">OR</div>
            ${opts.footer || ''}
          </div>
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
      t.classList.toggle('pw-hidden', !nowShown);
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
    <label for="authUsername">Username <span class="req">*</span></label>
    <div class="input-wrap">
      <span class="icon" aria-hidden="true">${authIcon('user')}</span>
      <input id="authUsername" type="text" name="username" placeholder="Enter your username" required autocomplete="username" aria-describedby="authUserNote">
    </div>
    <p class="auth-note" id="authUserNote" hidden></p>
  </div>
`;

function passwordField(placeholder, autocomplete, submitLabel) {
  return `
  <div class="form-group">
    <label for="authPassword">Password <span class="req">*</span></label>
    <div class="input-wrap">
      <span class="icon" aria-hidden="true">${authIcon('lock')}</span>
      <input id="authPassword" type="text" name="password" placeholder="${placeholder}" required autocomplete="${autocomplete}">
      <span class="toggle-pw" role="button" tabindex="0" aria-label="Hide password" title="Hide password">
        <span class="eye-open">${authIcon('eye')}</span>
        <span class="eye-shut">${authIcon('eyeOff')}</span>
      </span>
    </div>
  </div>
  <button type="submit" class="btn-auth" data-label="${submitLabel}">${submitLabel}</button>
`;
}

// ===== Log in =====
Pages.login = function (el) {
  authShell(el, {
    title: 'Log in to ' + fbBrand().name,
    subtitle: 'Connect with friends, share what you love, and chat instantly.',
    formFields: usernameField + passwordField('Enter your password', 'current-password', 'Login'),
    footer: `<div class="auth-footer">New here? <a href="#/Register">Create an account</a></div>`
  });
  pwToggleScript();
  LoginVault.attachTo(el);
  bindAuthForm(async (fd) => {
    const username = fd.get('username').trim();
    const password = fd.get('password');
    await Auth.login(username, password);
    LoginVault.remember(username, password);
    Router.navigate('/App');
  });
};

// ===== Register (username + password) =====
Pages.register = function (el) {
  authShell(el, {
    title: 'Join ' + fbBrand().name,
    subtitle: fbBrand().tagline,
    formFields: usernameField + passwordField('Choose a password (6+ characters)', 'new-password', 'Sign up'),
    backLink: '/Login',
    backText: 'Back to Log in',
    footer: `<div class="auth-footer">Already have an account? <a href="#/Login">Log in</a></div>`
  });
  pwToggleScript();

  // Usernames are one per person: say so as they type so a taken one is never used
  const unameInput = el.querySelector('input[name=username]');
  const unameNote = el.querySelector('#authUserNote');
  let takenName = '';
  let checkTimer = null;

  function paintUsernameNote(taken) {
    unameNote.textContent = taken ? 'This username is taken — choose another one.' : 'This username is available.';
    unameNote.className = 'auth-note ' + (taken ? 'taken' : 'ok');
    unameNote.hidden = false;
  }

  async function checkUsername() {
    const name = unameInput.value.trim();
    takenName = '';
    if (!name) { unameNote.hidden = true; return; }
    try {
      const { data } = await sb.from('users').select('username').eq('username', name).maybeSingle();
      if (unameInput.value.trim() !== name) return;
      const taken = !!(data && data.username);
      if (taken) takenName = name;
      paintUsernameNote(taken);
    } catch {
      unameNote.hidden = true;
    }
  }

  unameInput.addEventListener('input', () => {
    unameNote.hidden = true;
    takenName = '';
    clearTimeout(checkTimer);
    checkTimer = setTimeout(checkUsername, 400);
  });
  unameInput.addEventListener('blur', checkUsername);

  bindAuthForm(async (fd) => {
    const username = fd.get('username').trim();
    const password = fd.get('password');
    if (!username) throw new Error('Enter a username');
    await checkUsername();
    if (takenName) throw new Error('Username already taken — choose another one');
    if (password.length < 6) throw new Error('Password must be at least 6 characters');
    await Auth.register({ username, password, role: 'member' });
    LoginVault.remember(username, password);
    Router.navigate('/App');
  });
};

window.Pages = Pages;
