// Friends + Messages tabs — the people directory
var Pages = window.Pages || {};

function peopleRows(people) {
  return people.map(p => {
    const name = p.full_name || p.username || 'Member';
    return `<div class="fb-person-row">
      ${fbAvatar(name, 'fb-avatar-sm')}
      <div class="fb-person-info">
        <div class="name">${fbEscape(name)}</div>
        <div class="meta">@${fbEscape(p.username || '')}</div>
      </div>
      <button class="fb-btn fb-btn-secondary" type="button" data-uid="${fbEscape(p.id)}">Message</button>
    </div>`;
  }).join('');
}

function loadPeople(main, user, heading, emptyMsg) {
  main.innerHTML = `
    <div class="fb-feed">
      <section class="fb-card">
        <div class="fb-card-head"><h3>${heading}</h3></div>
        <div id="peopleList"><div class="loading">Loading…</div></div>
      </section>
    </div>
  `;

  const list = main.querySelector('#peopleList');
  let people = [];

  function renderPeople(query) {
    const q = query || '';
    const shown = people.filter(p => !q || `${p.full_name || ''} ${p.username || ''}`.toLowerCase().includes(q));
    list.innerHTML = shown.length
      ? peopleRows(shown)
      : emptyState('👥', q ? 'No one matches your search.' : emptyMsg);
    list.querySelectorAll('[data-uid]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (window.ChatWidget && window.ChatWidget.openWith) window.ChatWidget.openWith(btn.dataset.uid);
        else showToast('Messaging is unavailable right now', 'error');
      });
    });
  }

  async function load() {
    if (!sb) { people = []; renderPeople(); return; }
    try {
      const { data } = await sb.from('users').select('*').order('username', { ascending: true });
      people = (data || []).filter(u => String(u.id) !== String(user.id));
    } catch {
      people = [];
    }
    renderPeople();
  }

  window.__appSearchHandler = (q) => renderPeople(q);
  load();
}

Pages.peopleTab = function (main, user) {
  loadPeople(main, user, 'Friends', 'No one else has joined yet.');
};

Pages.messagesTab = function (main, user) {
  loadPeople(main, user, 'Messages', 'No conversations yet. Invite a friend to join.');
};

window.Pages = Pages;
