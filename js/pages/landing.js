// Landing page — Chookee Inasal Central Franchise System
var Pages = window.Pages || {};

Pages.landing = function(el) {
  el.innerHTML = `
    <div class="landing">
      <nav class="landing-nav">
        <div class="landing-logo">
          <div style="width:36px;height:36px;border-radius:50%;background:var(--gradient);display:flex;align-items:center;justify-content:center;font-size:1.1rem;">🐔</div>
          Chookee Inasal
        </div>
      </nav>

      <section class="landing-hero">
        <span class="landing-badge">🔥 Central Franchise System</span>
        <h1>Manage Every <span class="accent">Chookee Inasal</span> Branch</h1>
        <p>One centralized platform for franchise onboarding, supply ordering, production tracking, and daily operations monitoring — from the main office to every franchisee.</p>
        <div class="landing-cta">
          <a href="#/Register" class="btn-primary">Get Started →</a>
          <a href="#/MemberLogin" class="btn-secondary">Log In to Portal</a>
        </div>
      </section>

      <section class="landing-stats">
        <div class="stat-card"><div class="num">24</div><div class="label">Active Branches</div></div>
        <div class="stat-card"><div class="num">1,800+</div><div class="label">Orders Processed</div></div>
        <div class="stat-card"><div class="num">₱4.2M</div><div class="label">Monthly Sales</div></div>
        <div class="stat-card"><div class="num">₱210K</div><div class="label">Royalty Collected</div></div>
      </section>

      <section class="landing-features">
        <h2>Everything in One System</h2>
        <p>From onboarding a new franchisee to monitoring daily sales — all in real time.</p>
        <div class="feature-grid">
          <div class="feature-card">
            <div class="icon">🏪</div>
            <h3>Franchise Management</h3>
            <p>Onboard and monitor every franchisee from contract signing to daily operations.</p>
          </div>
          <div class="feature-card">
            <div class="icon">📦</div>
            <h3>Supply Ordering</h3>
            <p>Franchisees order products online with auto-generated order numbers and live tracking.</p>
          </div>
          <div class="feature-card">
            <div class="icon">📊</div>
            <h3>Sales & Royalty Monitoring</h3>
            <p>Track daily and monthly sales, royalty fees, and outstanding balances across all branches.</p>
          </div>
          <div class="feature-card">
            <div class="icon">🚚</div>
            <h3>Production & Order Tracking</h3>
            <p>Main office processes and ships supply orders with full status visibility.</p>
          </div>
        </div>
      </section>

      <section class="landing-cta-section">
        <h2>Ready to Grow Your Franchise?</h2>
        <p>Join the Chookee Inasal network and manage your branch operations from a single powerful dashboard.</p>
        <div class="landing-cta">
          <a href="#/Register" class="btn-primary">Create Account</a>
          <a href="#/MemberLogin" class="btn-secondary">Already a Franchisee?</a>
        </div>
      </section>

      <section class="landing-production">
        <h3>Production Team Portal</h3>
        <p>Production staff have a dedicated dashboard for daily consolidated production and inventory monitoring.</p>
        <div class="landing-cta">
          <a href="#/ProductionRegister" class="btn-primary">Production Sign Up</a>
          <a href="#/ProductionLogin" class="btn-secondary">Production Log In</a>
        </div>
      </section>
    </div>
  `;
};
