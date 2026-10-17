// Liga o app ao Supabase, oferecendo a mesma interface `claude.use(...)` que o app usa
// (db, user, assets, downloads). Sem config.js preenchido, o app roda em modo local.
(function () {
  const cfg = window.MD_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseAnonKey || !window.supabase) return;

  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);
  const BUCKET = 'media';
  const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
  const parentOf = p => p.split('/').slice(0, -1).join('/');
  const fail = error => ({ code: error && (error.code === '42501' || /row-level security/i.test(error.message || '')) ? 'invalid_argument' : 'unavailable', message: error && error.message });

  // sessão: organizador entra com e-mail e senha; jogadores recebem uma sessão anônima
  const session = (async () => {
    let { data: { session: s } } = await sb.auth.getSession();
    if (!s) {
      const r = await sb.auth.signInAnonymously();
      s = r.data && r.data.session;
    }
    const user = s && s.user;
    let admin = false;
    if (user && !user.is_anonymous) {
      const { data } = await sb.rpc('is_admin');
      admin = !!data;
    }
    return { uid: user ? user.id : null, admin, user };
  })();

  // ---------- documentos ----------
  const snap = (path, data) => ({ id: path.split('/').pop(), exists: data != null, data: () => data == null ? undefined : data, metadata: { fromCache: false, hasPendingWrites: false } });
  const watches = new Set();
  let timer = null;
  const refreshAll = () => { clearTimeout(timer); timer = setTimeout(() => watches.forEach(w => w.fetch()), 250); };
  sb.channel('docs').on('postgres_changes', { event: '*', schema: 'public', table: 'docs' }, refreshAll).subscribe();
  setInterval(() => { if (document.visibilityState === 'visible') watches.forEach(w => w.fetch()); }, 30000);

  function watch(filter, onRows, onError) {
    const w = {
      async fetch() {
        let q = sb.from('docs').select('path,data');
        q = filter.path ? q.eq('path', filter.path) : q.eq('collection', filter.collection);
        const { data, error } = await q;
        if (error) { if (onError) onError(fail(error)); return; }
        onRows(data || []);
      },
    };
    watches.add(w);
    session.then(() => w.fetch());
    return () => watches.delete(w);
  }

  function docRef(path) {
    return {
      id: path.split('/').pop(), path,
      async get() {
        await session;
        const { data, error } = await sb.from('docs').select('data').eq('path', path).maybeSingle();
        if (error) throw fail(error);
        return snap(path, data ? data.data : null);
      },
      async set(d) {
        await session;
        const { error } = await sb.from('docs').upsert({ path, collection: parentOf(path), data: d, updated_at: new Date().toISOString() });
        if (error) throw fail(error);
        refreshAll();
      },
      async update(d) {
        const cur = await this.get();
        if (!cur.exists) throw { code: 'invalid_argument', message: 'document does not exist' };
        return this.set(Object.assign({}, cur.data(), d));
      },
      async delete() {
        await session;
        const { error } = await sb.from('docs').delete().eq('path', path);
        if (error) throw fail(error);
        refreshAll();
      },
      onSnapshot(next, err) { return watch({ path }, rows => next(snap(path, rows[0] ? rows[0].data : null)), err); },
      collection(c) { return collRef(path + '/' + c); },
    };
  }
  function collRef(c) {
    const toSnap = rows => { const docs = rows.map(r => snap(r.path, r.data)); return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: { fromCache: false, hasPendingWrites: false } }; };
    return {
      path: c,
      doc: id => docRef(c + '/' + (id || rid())),
      async add(d) { const r = docRef(c + '/' + rid()); await r.set(d); return r; },
      async get() {
        await session;
        const { data, error } = await sb.from('docs').select('path,data').eq('collection', c);
        if (error) throw fail(error);
        return toSnap(data || []);
      },
      onSnapshot(next, err) { return watch({ collection: c }, rows => next(toSnap(rows)), err); },
    };
  }
  const db = { doc: docRef, collection: collRef };

  // ---------- quem está vendo ----------
  const user = {
    isOwner: async () => (await session).admin,
    canEdit: async () => (await session).admin,
    can: async () => true,
    id: async () => (await session).uid,
    me: async () => { const s = await session; return { id: s.uid, name: '', email: s.user && !s.user.is_anonymous ? s.user.email : null, isOwner: s.admin, canEdit: s.admin }; },
  };

  // ---------- fotos e vídeos ----------
  const assets = {
    async upload(blob, opts = {}) {
      const id = rid(), type = opts.type || blob.type;
      const { error } = await sb.storage.from(BUCKET).upload(id, blob, { contentType: type, upsert: false });
      if (error) throw { code: /size|large/i.test(error.message || '') ? 'too_large' : 'upstream_error', message: error.message };
      return { id, url: blobUrl(id), sizeBytes: blob.size, contentType: type };
    },
    async delete(id) {
      const { error } = await sb.storage.from(BUCKET).remove([id]);
      if (error) throw { code: 'upstream_error', message: error.message };
      return { deleted: true };
    },
  };
  const blobUrl = id => sb.storage.from(BUCKET).getPublicUrl(id).data.publicUrl;

  // ---------- salvar arquivos (flyer) ----------
  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data]);
      const file = new File([blob], filename, { type: blob.type || 'application/octet-stream' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: filename }); return { status: 'saved' }; }
        catch (err) { if (err && err.name === 'AbortError') throw { code: 'cancelled' }; }
      }
      const url = URL.createObjectURL(blob), a = document.createElement('a');
      a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      return { status: 'saved' };
    },
  };

  window.MD_BLOB_URL = blobUrl;
  window.MD_AUTH = {
    async signIn(email, password) {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      // confere na hora se este usuário está na tabela admins, para o site poder explicar o problema
      const r = await sb.rpc('is_admin');
      return { email: data.user && data.user.email, admin: !!r.data, error: r.error ? r.error.message : null };
    },
    async signOut() { await sb.auth.signOut(); },
  };
  const caps = { db, user, assets, downloads };
  window.claude = {
    async use(name) {
      if (name === 'assets') { const s = await session; return s.admin ? assets : null; }
      if (name === 'db' || name === 'user') { try { await session; } catch (e) { return null; } }
      return caps[name] || null;
    },
  };
})();
