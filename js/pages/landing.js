// Landing page — the social app presented as a Facebook-style account page
var Pages = window.Pages || {};

Pages.landing = function(el) {
  const brand = fbBrand();

  el.innerHTML = `
    <div class="landing fb-account">
      <header class="fb-topbar">
        <div class="fb-topbar-left">
          <span class="fb-logo" aria-hidden="true">${fbEscape(brand.initial)}</span>
          <span class="fb-brand-name">${fbEscape(brand.name)}</span>
        </div>
        <div class="fb-topbar-right">
          <a class="fb-icon-btn" href="#/Register" title="Create account" aria-label="Create account">＋</a>
          <a class="fb-icon-btn" href="#/Login" title="Log in" aria-label="Log in">👤</a>
        </div>
      </header>

      <div class="fb-profile landing-profile">
        <div class="fb-cover">
          <div class="fb-cover-text">${fbEscape(brand.name.toUpperCase())}</div>
          <span class="fb-cover-badge">Social network</span>
        </div>

        <div class="fb-profile-head">
          <div class="fb-avatar fb-profile-avatar" aria-hidden="true">${fbEscape(brand.initial)}</div>
          <div class="fb-profile-id">
            <h1 class="fb-profile-name">${fbEscape(brand.name)}</h1>
            <div class="fb-profile-meta">Public · Share posts, meet friends, chat instantly</div>
          </div>
          <div class="fb-profile-actions">
            <a class="fb-btn fb-btn-primary" href="#/Register">＋ Join now</a>
            <a class="fb-btn fb-btn-secondary" href="#/Login">Log in</a>
          </div>
        </div>

        <nav class="fb-profile-tabs" aria-label="Sections">
          <button class="fb-profile-tab active" type="button" data-ltab="all">All</button>
          <button class="fb-profile-tab" type="button" data-ltab="about">About</button>
          <button class="fb-profile-tab" type="button" data-ltab="stats">Community</button>
          <button class="fb-profile-tab" type="button" data-ltab="features">Features</button>
          <button class="fb-profile-tab" type="button" data-ltab="join">Join</button>
        </nav>

        <div class="fb-profile-cols">
          <div class="fb-col">
            <section class="fb-card" data-lsection="about">
              <div class="fb-card-head"><h3>About</h3></div>
              <ul class="fb-detail-list">
                <li><span class="ico" aria-hidden="true">🌐</span>Public social network</li>
                <li><span class="ico" aria-hidden="true">📝</span>Share posts with friends</li>
                <li><span class="ico" aria-hidden="true">👥</span>Meet new people</li>
                <li><span class="ico" aria-hidden="true">💬</span>Chat instantly</li>
              </ul>
              <div class="fb-intro-cta">
                <a class="fb-btn fb-btn-primary" href="#/Register">Join ${fbEscape(brand.name)}</a>
              </div>
            </section>

            <section class="fb-card" data-lsection="stats">
              <div class="fb-card-head"><h3>Community at a glance</h3></div>
              <div class="dash-stats fb-stats-compact">
                <div class="dash-stat-card"><div class="label">Members</div><div class="value accent">1,200+</div></div>
                <div class="dash-stat-card"><div class="label">Posts shared</div><div class="value">8,400+</div></div>
                <div class="dash-stat-card"><div class="label">Messages sent</div><div class="value">24K</div></div>
                <div class="dash-stat-card"><div class="label">Active today</div><div class="value">310</div></div>
              </div>
            </section>
          </div>

          <div class="fb-col">
            <section class="fb-card fb-post-card">
              <div class="fb-post-head">
                <span class="fb-avatar">${fbEscape(brand.initial)}</span>
                <div>
                  <div class="fb-post-name">${fbEscape(brand.name)}</div>
                  <div class="fb-post-time">Public · 🌐</div>
                </div>
              </div>
              <div class="fb-post-body">
                <span class="fb-post-tag">🌐 Now open to everyone</span>
                <strong>Share your moments with friends</strong>
                ${fbEscape(brand.tagline)} Post updates, meet new people, and keep every conversation in one place.
              </div>
            </section>

            <section class="fb-card" data-lsection="features">
              <div class="fb-card-head">
                <h3>Everything in One App</h3>
              </div>
              <div class="fb-feature-list">
                <div class="fb-feature">
                  <span class="fb-feature-icon" aria-hidden="true">📝</span>
                  <div class="fb-feature-text">
                    <h4>Share posts</h4>
                    <p>Post what's on your mind and see everything your friends are sharing.</p>
                  </div>
                </div>
                <div class="fb-feature">
                  <span class="fb-feature-icon" aria-hidden="true">👥</span>
                  <div class="fb-feature-text">
                    <h4>Find friends</h4>
                    <p>Browse the community directory and start a conversation with one tap.</p>
                  </div>
                </div>
                <div class="fb-feature">
                  <span class="fb-feature-icon" aria-hidden="true">💬</span>
                  <div class="fb-feature-text">
                    <h4>Instant messages</h4>
                    <p>A Messenger-style chat that follows you across every page.</p>
                  </div>
                </div>
                <div class="fb-feature">
                  <span class="fb-feature-icon" aria-hidden="true">👤</span>
                  <div class="fb-feature-text">
                    <h4>Your profile</h4>
                    <p>A personal page with your posts, friends and details.</p>
                  </div>
                </div>
              </div>
            </section>

            <section class="fb-card" data-lsection="join">
              <div class="fb-card-head"><h3>Join ${fbEscape(brand.name)}</h3></div>
              <div class="fb-portal-body">
                <p>All you need is a username and a password — no email, no forms.</p>
                <div class="fb-profile-actions">
                  <a class="fb-btn fb-btn-primary" href="#/Register">Create account</a>
                  <a class="fb-btn fb-btn-secondary" href="#/Login">Already a member?</a>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <nav class="fb-bottom-nav" aria-label="Sections">
        <button class="fb-bottom-item active" type="button" data-ltab-go="all"><span class="ico" aria-hidden="true">🏠</span><span>Home</span></button>
        <button class="fb-bottom-item" type="button" data-ltab-go="about"><span class="ico" aria-hidden="true">ℹ️</span><span>About</span></button>
        <button class="fb-bottom-item" type="button" data-ltab-go="features"><span class="ico" aria-hidden="true">📊</span><span>Features</span></button>
        <button class="fb-bottom-item" type="button" data-ltab-go="join"><span class="ico" aria-hidden="true">＋</span><span>Join</span></button>
        <a class="fb-bottom-item" href="#/Login"><span class="ico" aria-hidden="true">👤</span><span>Log in</span></a>
      </nav>
    </div>
  `;

  const sectionMap = { all: null, about: ['about'], stats: ['stats'], features: ['features'], join: ['join'] };

  function showTab(tab) {
    el.querySelectorAll('[data-lsection]').forEach(section => {
      const allowed = sectionMap[tab];
      section.style.display = (!allowed || allowed.includes(section.dataset.lsection)) ? '' : 'none';
    });
    el.querySelectorAll('.fb-profile-tab').forEach(btn => btn.classList.toggle('active', btn.dataset.ltab === tab));
    el.querySelectorAll('.fb-bottom-item[data-ltab-go]').forEach(btn => btn.classList.toggle('active', btn.dataset.ltabGo === tab));
  }

  el.querySelectorAll('[data-ltab]').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.ltab));
  });
  el.querySelectorAll('[data-ltab-go]').forEach(btn => {
    btn.addEventListener('click', () => {
      showTab(btn.dataset.ltabGo);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
};
