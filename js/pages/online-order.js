// Online Order page — customer-facing order page
var Pages = window.Pages || {};

Pages.onlineOrder = function(el) {
  let activeTab = 'shop';
  el.innerHTML = `
    <div style="min-height:100vh;background:linear-gradient(135deg,#fff 0%,#fff8f0 100%);">
      <header style="display:flex;align-items:center;gap:.75rem;padding:1rem 2rem;border-bottom:1px solid #f0f0f0;">
        <div style="width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#e63946,#f48c06);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;">CI</div>
        <div><strong>Chookee Inasal</strong><div style="font-size:.75rem;color:#888;">Online Order</div></div>
      </header>
      <div style="padding:2rem;max-width:900px;margin:0 auto;">
        <h1 style="font-size:1.75rem;font-weight:800;color:#1f2937;margin-bottom:1rem;">Order Online</h1>
        <div style="background:#fff9e6;border:1px solid #fde68a;border-radius:.75rem;padding:1rem;margin-bottom:1.5rem;display:flex;gap:.5rem;align-items:start;">
          <span>🏪</span>
          <p style="font-size:.875rem;color:#92400e;">This order link isn't linked to a branch. Please use the order link shared by your Chookee Inasal branch.</p>
        </div>
        <div class="tab-toggle" style="margin-bottom:1.5rem;">
          <button class="tab-btn active" data-tab="shop" style="display:inline-flex;align-items:center;gap:.3rem;">🛒 Shop</button>
          <button class="tab-btn" data-tab="orders" style="display:inline-flex;align-items:center;gap:.3rem;">📋 My Orders</button>
        </div>
        <div id="orderContent"></div>
      </div>
    </div>`;

  const renderContent = async () => {
    const content = el.querySelector('#orderContent');
    if (activeTab === 'shop') {
      try {
        const { data: products } = await sb.from('products').select('*').eq('is_active', true).order('name');
        content.innerHTML = (products || []).length ? tableCard('Available Products', ['Product', 'Category', 'Price', 'Order'],
          (products || []).map(p => [p.name, p.category || '—', fmtPeso(p.price), `<button class="btn-save" onclick="alert('Order placed for ${p.name}')">Order</button>`])) : emptyState('📦', 'No products available right now.');
      } catch { content.innerHTML = emptyState('📦', 'No products available right now.'); }
    } else {
      content.innerHTML = emptyState('📋', 'No orders yet. Place an order from the Shop tab.');
    }
  };

  el.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      el.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderContent();
    });
  });
  renderContent();
};

window.Pages = Pages;
