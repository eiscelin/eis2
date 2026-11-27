// A member submits an ad here; it waits in Admin > Ads until an admin approves
// it, then it plays inside member videos like any other ad.
var Pages = window.Pages || {};

Pages.myAdsTab = function (main, user) {
  let file = null;

  main.innerHTML = `<div class="fb-feed">
    <section class="fb-card my-ads">
      <div class="fb-card-head"><h3>Submit an ad</h3></div>
      <p class="my-ads-hint">Pick an image or a video and add how people can reach you. An admin reviews it before it plays.</p>
      <div class="my-ads-form">
        <input id="myAdTitle" type="text" maxlength="60" placeholder="Ad name (e.g. My shop sale)" aria-label="Ad name">
        <div class="my-ads-row">
          <select id="myAdContactType" aria-label="Contact details on this ad">
            <option value="">No contact details</option>
            <option value="mobile">Mobile number</option>
            <option value="facebook">Facebook page</option>
          </select>
          <input id="myAdContactValue" type="text" placeholder="Mobile number" aria-label="Contact details" hidden>
        </div>
        <input id="myAdFile" type="file" accept="image/*,video/*" hidden>
        <div class="my-ads-foot">
          <button class="fb-btn fb-btn-secondary" id="myAdPick" type="button">🎞 Choose image or video</button>
          <span class="my-ads-file" id="myAdFileLabel">No file chosen</span>
          <button class="fb-btn fb-btn-primary" id="myAdSubmit" type="button">Submit ad</button>
        </div>
      </div>
    </section>
    <section class="fb-card my-ads">
      <div class="fb-card-head"><h3>My ads</h3></div>
      <div id="myAdList"><div class="loading" style="padding:1rem;">Loading…</div></div>
    </section>
  </div>`;

  const titleEl = main.querySelector('#myAdTitle');
  const typeEl = main.querySelector('#myAdContactType');
  const valueEl = main.querySelector('#myAdContactValue');
  const fileEl = main.querySelector('#myAdFile');
  const fileLabel = main.querySelector('#myAdFileLabel');
  const submitBtn = main.querySelector('#myAdSubmit');
  const listEl = main.querySelector('#myAdList');

  main.querySelector('#myAdPick').addEventListener('click', () => fileEl.click());
  fileEl.addEventListener('change', () => {
    file = (fileEl.files && fileEl.files[0]) || null;
    fileLabel.textContent = file ? file.name : 'No file chosen';
  });

  // A mobile number gets Call and SMS buttons, a Facebook page opens the page
  typeEl.addEventListener('change', () => {
    const type = typeEl.value;
    valueEl.hidden = !type;
    valueEl.placeholder = type === 'facebook' ? 'facebook.com/yourpage' : '+63 917 000 0000';
    if (!type) valueEl.value = '';
  });

  function statusOf(ad) {
    if (ad.status === 'approved') return ad.is_active ? 'Live' : 'Paused';
    if (ad.status === 'rejected') return 'Rejected';
    return 'Waiting for review';
  }

  async function paintList() {
    const { data, error } = await sb.from('ads').select('*')
      .eq('created_by', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      listEl.innerHTML = `<div class="empty-state" style="padding:1rem;">Your ads could not load. ${/relation|does not exist/i.test(error.message || '') ? 'Run 026_create_ads.sql in Supabase.' : ''}</div>`;
      return;
    }
    const ads = data || [];
    if (!ads.length) {
      listEl.innerHTML = '<div class="empty-state" style="padding:1rem;">No ads yet. Send your first one above.</div>';
      return;
    }
    listEl.innerHTML = ads.map(ad => {
      const isVideo = /video$/.test(String(ad.media_type || ''));
      return `<article class="my-ad">
        <div class="my-ad-media">
          ${isVideo
            ? `<video src="${fbEscape(ad.media_url)}" muted playsinline preload="metadata"></video>`
            : `<img src="${fbEscape(ad.media_url)}" alt="${fbEscape(ad.title || 'Ad')}" loading="lazy">`}
        </div>
        <div class="my-ad-body">
          <div class="my-ad-title">${fbEscape(ad.title || 'Untitled ad')}</div>
          <div class="my-ad-meta">
            <span class="my-ad-status ${fbEscape(ad.status || 'pending')}">${fbEscape(statusOf(ad))}</span>
            <span>${fbEscape(fmtDate(ad.created_at))}</span>
          </div>
        </div>
      </article>`;
    }).join('');
  }

  submitBtn.addEventListener('click', async () => {
    if (!file) return showToast('Choose an ad image or video first', 'error');
    const isVideo = String(file.type || '').startsWith('video/');
    if (isVideo && file.size > 100 * 1024 * 1024) return showToast('Videos must be 100 MB or smaller', 'error', 5000);
    if (!isVideo && file.size > 20 * 1024 * 1024) return showToast('Photos must be 20 MB or smaller', 'error', 5000);
    const type = typeEl.value;
    const raw = valueEl.value.trim();
    if (type && !raw) return showToast(type === 'mobile' ? 'Add your mobile number' : 'Add your Facebook page', 'error', 5000);
    if (type && !(await fbAdsHaveContact())) return showToast('Ads cannot save contact details yet — ask the admin to run 029_ad_contact.sql', 'error', 6000);

    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    try {
      const payload = isVideo ? file : await shrinkImage(file, 1600).catch(() => file);
      const url = await cloudinaryUpload(payload);
      if (!url) throw new Error('Upload failed — try again');
      const { error } = await sb.from('ads').insert([{
        title: titleEl.value.trim() || 'Sponsored',
        media_url: url,
        media_type: isVideo ? 'video' : 'image',
        status: 'pending',
        is_active: true,
        created_by: user.id,
        play_limit: 1,
        gap_minutes: 0,
        target_user_id: null,
        target_post_id: null,
        target_label: 'All member videos',
        ...(type ? { contact_type: type, contact_value: fbAdContactValue(type, raw) } : {})
      }]);
      if (error) throw error;
      showToast('Ad sent to the admin for review', 'success');
      titleEl.value = '';
      typeEl.value = '';
      valueEl.value = '';
      valueEl.hidden = true;
      file = null;
      fileEl.value = '';
      fileLabel.textContent = 'No file chosen';
      await paintList();
    } catch (error) {
      const message = String(error.message || error);
      showToast(/contact_type|contact_value/i.test(message)
        ? 'Run 029_ad_contact.sql in Supabase, then try again'
        : message, 'error', 6000);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit ad';
    }
  });

  paintList();
};
