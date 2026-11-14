// Personal Information — details and password cards, used by My Profile and the admin My Profile tab
(function () {
  function esc(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  // Keeps the signed-in copy in step with what was just saved
  function remember(patch) {
    const current = Auth.currentUser || {};
    Object.assign(current, patch);
    Auth.currentUser = current;
    localStorage.setItem('chookee_user', JSON.stringify(current));
  }

  function fieldValue(fd, key) {
    return String(fd.get(key) || '').trim();
  }

  // True when the database function that saves this has not been created yet
  function setupMissing(err) {
    const message = String((err && err.message) || err || '');
    return /set_profile_details|set_user_password|could not find the function|does not exist|schema cache/i.test(message);
  }

  function hintFor(err) {
    return setupMissing(err)
      ? 'Run 009_add_profile_details.sql in Supabase, then try again'
      : 'Could not save: ' + String((err && err.message) || err || '');
  }

  const SETUP_NOTICE = 'Password saving is not switched on in your database yet. In Supabase open SQL Editor and run '
    + 'supabase/migrations/009_add_profile_details.sql once — then this button works for every member.';

  function render(container, user, opts) {
    const options = opts || {};
    // An admin can open another member's details; the saved copy stays local to that member
    const isSelf = !Auth.currentUser || String(user.id) === String(Auth.currentUser.id);
    container.classList.add('pi-stack');
    container.innerHTML = `
      <section class="pi-card">
        <h3 class="pi-title">Personal Information</h3>
        <form class="pi-form pi-details">
          <label class="pi-field">Full Name<input name="full_name" type="text" maxlength="80" placeholder="Your full name" value="${esc(user.full_name || '')}"></label>
          <label class="pi-field">Age<input name="age" type="number" min="1" max="120" placeholder="Age" value="${esc(user.age == null ? '' : user.age)}"></label>
          <label class="pi-field">Email<input name="email" type="email" maxlength="120" placeholder="you@email.com" value="${esc(user.email || '')}"></label>
          <label class="pi-field">Phone<input name="phone" type="tel" maxlength="30" placeholder="Mobile number" value="${esc(user.phone || '')}"></label>
          <label class="pi-field">Complete Address<input name="address" type="text" maxlength="200" placeholder="House, street, city" value="${esc(user.address || '')}"></label>
          <button class="pi-save" type="submit">Save details</button>
        </form>
      </section>

      <section class="pi-card">
        <h3 class="pi-title">Change Password</h3>
        <form class="pi-form pi-password">
          ${isSelf
            ? `<label class="pi-field">Current password<input name="current_password" type="text" value="${esc(user.password || '')}" readonly></label>`
            : '<p class="pi-private">The current password is private to this member. You can still set a new one below.</p>'}
          <label class="pi-field">New password<input name="new_password" type="text" maxlength="60" placeholder="At least 6 characters" autocomplete="new-password"></label>
          <label class="pi-field">Repeat new password<input name="confirm_password" type="text" maxlength="60" placeholder="Type it again" autocomplete="new-password"></label>
          <button class="pi-save" type="submit">Change password</button>
          <p class="pi-setup" hidden></p>
        </form>
      </section>

      ${isSelf ? `
      <section class="pi-card">
        <h3 class="pi-title">Account background</h3>
        <p class="pi-private">Any picture you upload here shows behind every page while you are signed in.</p>
        <div class="pi-bg">
          <div class="pi-bg-preview" id="piBgPreview">
            <span>No background picture yet</span>
          </div>
          <div class="pi-bg-actions">
            <button class="pi-save" id="piBgUpload" type="button">Upload picture</button>
            <button class="pi-clear" id="piBgClear" type="button"${user.background_url ? '' : ' hidden'}>Remove</button>
          </div>
        </div>
      </section>` : ''}`;

    const details = container.querySelector('.pi-details');
    details.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (ReadOnlyMode.block('Saving your details')) return;
      const fd = new FormData(details);
      const ageRaw = fieldValue(fd, 'age');
      const age = ageRaw ? Number(ageRaw) : null;
      if (ageRaw && (!Number.isInteger(age) || age < 1 || age > 120)) {
        showToast('Enter an age between 1 and 120', 'error');
        return;
      }
      const btn = details.querySelector('button[type=submit]');
      btn.disabled = true;
      btn.textContent = 'Saving…';
      const values = {
        full_name: fieldValue(fd, 'full_name') || null,
        age,
        email: fieldValue(fd, 'email') || null,
        phone: fieldValue(fd, 'phone') || null,
        address: fieldValue(fd, 'address') || null
      };
      try {
        const { error } = await sb.rpc('set_profile_details', {
          p_user_id: user.id,
          p_full_name: values.full_name,
          p_age: values.age,
          p_email: values.email,
          p_phone: values.phone,
          p_address: values.address
        });
        if (error) throw error;
        Object.assign(user, values);
        if (isSelf) remember(values);
        showToast(isSelf ? 'Your details are saved' : `${user.full_name || user.username || 'Member'}'s details are saved`, 'success');
        if (options.onSaved) options.onSaved(values);
      } catch (err) {
        showToast(hintFor(err), 'error', 6000);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Save details';
      }
    });

    const passwordForm = container.querySelector('.pi-password');
    if (passwordForm) passwordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(passwordForm);
      const next = String(fd.get('new_password') || '');
      const again = String(fd.get('confirm_password') || '');
      if (next.length < 6) {
        showToast('Password must be at least 6 characters', 'error');
        return;
      }
      if (next !== again) {
        showToast('The two passwords do not match', 'error');
        return;
      }
      const btn = passwordForm.querySelector('button[type=submit]');
      const notice = passwordForm.querySelector('.pi-setup');
      btn.disabled = true;
      btn.textContent = 'Saving…';
      notice.hidden = true;
      try {
        const { error } = await sb.rpc('set_user_password', { p_user_id: user.id, p_password: next });
        if (error) throw error;
        Object.assign(user, { password: next });
        if (isSelf) {
          remember({ password: next });
          LoginVault.updatePassword(user.username, next);
        }
        passwordForm.reset();
        const shown = passwordForm.querySelector('[name=current_password]');
        if (shown) {
          shown.value = next;
          shown.setAttribute('value', next);
        }
        showToast(isSelf ? 'Your password is changed' : `${user.full_name || user.username || 'Member'}'s password is changed`, 'success');
      } catch (err) {
        if (setupMissing(err)) {
          notice.textContent = SETUP_NOTICE;
          notice.hidden = false;
          showToast('Password saving is not set up in your database yet', 'error', 8000);
        } else {
          showToast('Could not change the password: ' + String((err && err.message) || err || ''), 'error', 8000);
        }
      } finally {
        btn.disabled = false;
        btn.textContent = 'Change password';
      }
    });

    // ---------- Account background picture (shown behind every page) ----------

    const backgroundBtn = container.querySelector('#piBgUpload');
    if (backgroundBtn) {
      const backgroundClear = container.querySelector('#piBgClear');
      const preview = container.querySelector('#piBgPreview');

      function paintBackground(url) {
        preview.style.backgroundImage = url ? `url('${url}')` : '';
        preview.classList.toggle('has-image', !!url);
        preview.innerHTML = url ? '' : '<span>No background picture yet</span>';
        backgroundClear.hidden = !url;
        fbPaintPageBackground(url);
      }

      async function saveBackground(url) {
        if (!sb) throw new Error('connect the database to change your background');
        const { error } = await sb.rpc('set_page_background', {
          p_user_id: user.id,
          p_background_url: url
        });
        if (error) throw error;
        user.background_url = url;
        if (isSelf) remember({ background_url: url });
        paintBackground(url);
      }

      function backgroundProblem(err) {
        const message = String((err && err.message) || err || '');
        return /set_page_background|could not find the function|does not exist|schema cache/i.test(message)
          ? 'Run 015_add_page_background.sql in Supabase, then try again'
          : 'Could not update your background: ' + message;
      }

      // Show what is saved already
      if (user.background_url) paintBackground(user.background_url);

      const backgroundFile = document.createElement('input');
      backgroundFile.type = 'file';
      backgroundFile.accept = 'image/*';
      backgroundFile.hidden = true;
      container.append(backgroundFile);

      backgroundBtn.addEventListener('click', () => backgroundFile.click());

      backgroundFile.addEventListener('change', async () => {
        const file = backgroundFile.files[0];
        backgroundFile.value = '';
        if (!file) return;
        if (ReadOnlyMode.block('Uploading a picture')) return;
        if (file.type && file.type.indexOf('image/') !== 0) {
          showToast('Choose an image file', 'error');
          return;
        }
        if (file.size > 20 * 1024 * 1024) {
          showToast('That picture is larger than 20 MB', 'error');
          return;
        }
        backgroundBtn.disabled = true;
        backgroundBtn.textContent = 'Uploading…';
        try {
          // Any picture is accepted: what the browser cannot shrink goes up as it is
          let payload = file;
          try { payload = await shrinkImage(file, 2000); } catch { payload = file; }
          const url = await cloudinaryUpload(payload);
          if (!url) throw new Error('image hosting is not connected');
          await saveBackground(url);
          showToast('Your account background is updated', 'success');
        } catch (err) {
          showToast(backgroundProblem(err), 'error', 6000);
        } finally {
          backgroundBtn.disabled = false;
          backgroundBtn.textContent = 'Upload picture';
        }
      });

      backgroundClear.addEventListener('click', async () => {
        backgroundClear.disabled = true;
        try {
          await saveBackground('');
          showToast('Account background removed', 'success');
        } catch (err) {
          showToast(backgroundProblem(err), 'error', 6000);
        } finally {
          backgroundClear.disabled = false;
        }
      });
    }
  }

  window.PersonalInfo = { render };
})();
