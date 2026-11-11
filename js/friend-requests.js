// Friend requests: "Add friend" sends a request the other member accepts or declines
var FriendRequests = {
  missingHint: 'Run 006_create_friend_requests.sql in Supabase, then try again',

  // The table is missing until the migration has been run in Supabase
  isMissing(error) {
    const message = String((error && (error.message || error.details)) || '');
    return /friend_requests/.test(message);
  },

  // Every request I am part of, keyed by the other member's id:
  // { "<id>": { status: 'sent' | 'incoming' | 'friends', id } }
  async states(me) {
    const state = {};
    if (!sb || !me) return { state, missing: false };
    const { data, error } = await sb.from('friend_requests')
      .select('id, sender_id, receiver_id, status')
      .or(`sender_id.eq.${me},receiver_id.eq.${me}`);
    if (error) return { state, missing: this.isMissing(error) };

    (data || []).forEach(row => {
      const fromMe = String(row.sender_id) === String(me);
      const status = row.status === 'accepted' ? 'friends' : row.status === 'pending' ? (fromMe ? 'sent' : 'incoming') : '';
      if (!status) return;
      state[String(fromMe ? row.receiver_id : row.sender_id)] = { status, id: row.id };
    });
    return { state, missing: false };
  },

  // Pending requests waiting for my answer, newest first, with the sender's details
  async incoming(me) {
    if (!sb || !me) return { requests: [], missing: false };
    const { data, error } = await sb.from('friend_requests')
      .select('id, sender_id, created_at')
      .eq('receiver_id', me)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });
    if (error) return { requests: [], missing: this.isMissing(error) };

    const rows = data || [];
    let people = [];
    if (rows.length) {
      const { data: found } = await sb.from('users')
        .select('id, username, full_name, avatar_url')
        .in('id', rows.map(r => r.sender_id));
      people = found || [];
    }
    const byId = {};
    people.forEach(p => { byId[String(p.id)] = p; });

    return { requests: rows.map(r => ({ ...r, person: byId[String(r.sender_id)] || null })), missing: false };
  },

  async send(from, to) {
    const { error } = await sb.from('friend_requests').upsert(
      [{ sender_id: from, receiver_id: to, status: 'pending', responded_at: null }],
      { onConflict: 'sender_id,receiver_id' }
    );
    return { ok: !error, error, missing: this.isMissing(error) };
  },

  async respond(id, accept) {
    const { error } = await sb.from('friend_requests')
      .update({ status: accept ? 'accepted' : 'declined', responded_at: new Date().toISOString() })
      .eq('id', id);
    return { ok: !error, error, missing: this.isMissing(error) };
  }
};

window.FriendRequests = FriendRequests;
