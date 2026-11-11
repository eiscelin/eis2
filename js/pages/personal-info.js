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

  function hintFor(err) {
    const message = String((err && err.message) || err || '');
    return /set_profile_details|set_user_password|could not find the function|does not exist|schema cache/i.test(message)
      ? 'Run 009_add_profile_details.sql in Supabase, then try again'
      : 'Could not save: ' + message;
  }

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

      ${options.hidePassword ? '' : `<section class="pi-card">
        <h3 class="pi-title">Change Password</h3>
        <form class="pi-form pi-password">
          <label class="pi-field">New password<input name="new_password" type="text" maxlength="60" placeholder="At least 6 characters" autocomplete="new-password"></label>
          <label class="pi-field">Repeat new password<input name="confirm_password" type="text" maxlength="60" placeholder="Type it again" autocomplete="new-password"></label>
          <button class="pi-save" type="submit">Change password</button>
        </form>
      </section>`}`;

    const details = container.querySelector('.pi-details');
    details.addEventListener('submit', async (e) => {
      e.preventDefault();
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
      btn.disabled = true;
      btn.textContent = 'Saving…';
      try {
        const { error } = await sb.rpc('set_user_password', { p_user_id: user.id, p_password: next });
        if (error) throw error;
        Object.assign(user, { password: next });
        remember({ password: next });
        passwordForm.reset();
        showToast('Your password is changed', 'success');
      } catch (err) {
        showToast(hintFor(err), 'error', 6000);
      } finally {
        btn.disabled = false;
        btn.textContent = 'Change password';
      }
    });
  }

  window.PersonalInfo = { render };
})();
