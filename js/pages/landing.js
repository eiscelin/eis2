// Landing page — Chookee Inasal presented as a Facebook-style account page
var Pages = window.Pages || {};

Pages.landing = function(el) {
  el.innerHTML = `
    <div class="landing fb-account">
      <header class="fb-topbar">
        <div class="fb-topbar-left">
          <span class="fb-logo" aria-hidden="true">🐔</span>
          <span class="fb-brand-name">Chookee Inasal</span>
        </div>
        <div class="fb-topbar-right">
          <a class="fb-icon-btn" href="#/Register" title="Create account" aria-label="Create account">＋</a>
          <a class="fb-icon-btn" href="#/MemberLogin" title="Log in" aria-label="Log in">👤</a>
        </div>
      </header>

      <div class="fb-profile landing-profile">
        <div class="fb-cover">
          <div class="fb-cover-text">CHOOKEE INASAL</div>
          <span class="fb-cover-badge">Franchise Central</span>
        </div>

        <div class="fb-profile-head">
          <div class="fb-avatar fb-profile-avatar" aria-hidden="true">🐔</div>
          <div class="fb-profile-id">
            <h1 class="fb-profile-name">Chookee Inasal</h1>
            <div class="fb-profile-meta">Central Franchise System · 24 active branches</div>
          </div>
          <div class="fb-profile-actions">
            <a class="fb-btn fb-btn-primary" href="#/Register">＋ Get Started</a>
            <a class="fb-btn fb-btn-secondary" href="#/MemberLogin">Log In to Portal</a>
          </div>
        </div>

        <nav class="fb-profile-tabs" aria-label="Sections">
          <button class="fb-profile-tab active" type="button" data-ltab="all">All</button>
          <button class="fb-profile-tab" type="button" data-ltab="about">Intro</button>
          <button class="fb-profile-tab" type="button" data-ltab="stats">Stats</button>
          <button class="fb-profile-tab" type="button" data-ltab="features">Features</button>
          <button class="fb-profile-tab" type="button" data-ltab="portals">Portals</button>
        </nav>

        <div class="fb-profile-cols">
          <div class="fb-col">
            <section class="fb-card" data-lsection="about">
              <div class="fb-card-head"><h3>Intro</h3></div>
              <ul class="fb-detail-list">
                <li><span class="ico" aria-hidden="true">🔥</span>Central Franchise System</li>
                <li><span class="ico" aria-hidden="true">🏪</span>24 active branches</li>
                <li><span class="ico" aria-hidden="true">📦</span>1,800+ orders processed</li>
                <li><span class="ico" aria-hidden="true">📊</span>₱4.2M monthly sales</li>
              </ul>
              <div class="fb-intro-cta">
                <a class="fb-btn fb-btn-primary" href="#/Register">Get Started →</a>
              </div>
            </section>

            <section class="fb-card" data-lsection="stats">
              <div class="fb-card-head"><h3>Network at a glance</h3></div>
              <div class="dash-stats fb-stats-compact">
                <div class="dash-stat-card"><div class="label">Active Branches</div><div class="value accent">24</div></div>
                <div class="dash-stat-card"><div class="label">Orders Processed</div><div class="value">1,800+</div></div>
                <div class="dash-stat-card"><div class="label">Monthly Sales</div><div class="value">₱4.2M</div></div>
                <div class="dash-stat-card"><div class="label">Royalty Collected</div><div class="value">₱210K</div></div>
              </div>
            </section>
          </div>

          <div class="fb-col">
            <section class="fb-card fb-post-card">
              <div class="fb-post-head">
                <span class="fb-avatar">C</span>
                <div>
                  <div class="fb-post-name">Chookee Inasal</div>
                  <div class="fb-post-time">Sponsored · 🌐</div>
                </div>
              </div>
              <div class="fb-post-body">
                <span class="fb-post-tag">🔥 Central Franchise System</span>
                <strong>Manage Every Chookee Inasal Branch</strong>
                One centralized platform for franchise onboarding, supply ordering, production tracking, and daily operations monitoring — from the main office to every franchisee.
              </div>
            </section>

            <section class="fb-card" data-lsection="features">
              <div class="fb-card-head">
                <h3>Everything in One System</h3>
              </div>
              <div class="fb-feature-list">
                <div class="fb-feature">
                  <span class="fb-feature-icon" aria-hidden="true">🏪</span>
                  <div class="fb-feature-text">
                    <h4>Franchise Management</h4>
                    <p>Onboard and monitor every franchisee from contract signing to daily operations.</p>
                  </div>
                </div>
                <div class="fb-feature">
                  <span class="fb-feature-icon" aria-hidden="true">📦</span>
                  <div class="fb-feature-text">
                    <h4>Supply Ordering</h4>
                    <p>Franchisees order products online with auto-generated order numbers and live tracking.</p>
                  </div>
                </div>
                <div class="fb-feature">
                  <span class="fb-feature-icon" aria-hidden="true">📊</span>
                  <div class="fb-feature-text">
                    <h4>Sales &amp; Royalty Monitoring</h4>
                    <p>Track daily and monthly sales, royalty fees, and outstanding balances across all branches.</p>
                  </div>
                </div>
                <div class="fb-feature">
                  <span class="fb-feature-icon" aria-hidden="true">🚚</span>
                  <div class="fb-feature-text">
                    <h4>Production &amp; Order Tracking</h4>
                    <p>Main office processes and ships supply orders with full status visibility.</p>
                  </div>
                </div>
              </div>
            </section>

            <section class="fb-card" data-lsection="portals">
              <div class="fb-card-head"><h3>Ready to Grow Your Franchise?</h3></div>
              <div class="fb-portal-body">
                <p>Join the Chookee Inasal network and manage your branch operations from a single powerful dashboard.</p>
                <div class="fb-profile-actions">
                  <a class="fb-btn fb-btn-primary" href="#/Register">Create Account</a>
                  <a class="fb-btn fb-btn-secondary" href="#/MemberLogin">Already a Franchisee?</a>
                </div>
              </div>
              <div class="fb-portal-split">
                <h3>Production Team Portal</h3>
                <p>Production staff have a dedicated dashboard for daily consolidated production and inventory monitoring.</p>
                <div class="fb-profile-actions">
                  <a class="fb-btn fb-btn-primary" href="#/ProductionRegister">Production Sign Up</a>
                  <a class="fb-btn fb-btn-secondary" href="#/ProductionLogin">Production Log In</a>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      <nav class="fb-bottom-nav" aria-label="Sections">
        <button class="fb-bottom-item active" type="button" data-ltab-go="all"><span class="ico" aria-hidden="true">🏠</span><span>Home</span></button>
        <button class="fb-bottom-item" type="button" data-ltab-go="about"><span class="ico" aria-hidden="true">ℹ️</span><span>Intro</span></button>
        <button class="fb-bottom-item" type="button" data-ltab-go="features"><span class="ico" aria-hidden="true">📊</span><span>Features</span></button>
        <button class="fb-bottom-item" type="button" data-ltab-go="portals"><span class="ico" aria-hidden="true">🏪</span><span>Portals</span></button>
        <a class="fb-bottom-item" href="#/MemberLogin"><span class="ico" aria-hidden="true">👤</span><span>Log In</span></a>
      </nav>
    </div>
  `;

  const sectionMap = { all: null, about: ['about'], stats: ['stats'], features: ['features'], portals: ['portals'] };

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
