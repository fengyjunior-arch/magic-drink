// ===== Motor de torneio: pareamentos, chaves e classificação =====
const ENGINE = (() => {
  const rid = () => Math.random().toString(36).slice(2, 10);
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pts = ev => Object.assign({ v: 3, e: 1, d: 0 }, ev.pontos || {});
  const active = ev => ev.players.filter(p => !p.dropped);
  const stageRounds = (ev, stage) => ev.rounds.filter(r => (r.stage || 'main') === stage);

  // quem já enfrentou quem (em qualquer rodada)
  function metMap(ev) {
    const m = {};
    const add = (a, b) => { (m[a] = m[a] || {})[b] = (m[a][b] || 0) + 1; };
    ev.rounds.forEach(r => r.matches.forEach(x => {
      if (x.bye) return;
      x.players.forEach(a => x.players.forEach(b => { if (a !== b) add(a, b); }));
    }));
    return m;
  }
  const hadBye = (ev, id) => ev.rounds.some(r => r.matches.some(x => x.bye && x.players[0] === id));

  // ---------- resultado de uma partida ----------
  // 1v1: result = {a, b, d} vitórias de cada lado e jogos empatados
  // multi: result = {winner: id} ou {draw: true}
  function winnerOf(m) {
    if (m.bye) return m.players[0];
    if (!m.result) return null;
    if (m.result.winner) return m.result.winner;
    if (m.result.draw) return null;
    if (m.result.a > m.result.b) return m.players[0];
    if (m.result.b > m.result.a) return m.players[1];
    return null;
  }
  const loserOf = m => { const w = winnerOf(m); return w && !m.bye ? m.players.find(p => p !== w) : null; };
  const done = m => m.bye || m.wait || !!m.result;
  const roundDone = r => r.matches.every(done);

  // ---------- classificação 1v1 (suíço, todos contra todos, draft) ----------
  function standings1v1(ev, stage = 'main') {
    const P = pts(ev), S = {};
    ev.players.forEach(p => S[p.id] = { p, mp: 0, w: 0, l: 0, d: 0, gw: 0, gl: 0, gd: 0, played: 0, opps: [] });
    stageRounds(ev, stage).forEach(r => r.matches.forEach(m => {
      if (m.wait) return;
      if (m.bye) { const s = S[m.players[0]]; if (!s) return; s.mp += P.v; s.w++; s.played++; s.gw += 2; return; }
      if (!m.result) return;
      const [a, b] = m.players, A = S[a], B = S[b];
      if (!A || !B) return;
      const { a: ga = 0, b: gb = 0, d: gd = 0 } = m.result;
      A.played++; B.played++; A.opps.push(b); B.opps.push(a);
      A.gw += ga; A.gl += gb; A.gd += gd; B.gw += gb; B.gl += ga; B.gd += gd;
      if (ga > gb) { A.w++; B.l++; A.mp += P.v; B.mp += P.d; }
      else if (gb > ga) { B.w++; A.l++; B.mp += P.v; A.mp += P.d; }
      else { A.d++; B.d++; A.mp += P.e; B.mp += P.e; }
    }));
    const mw = s => s.played ? Math.max(1 / 3, s.mp / (s.played * P.v)) : 0;
    const gwp = s => { const t = s.gw + s.gl + s.gd; return t ? Math.max(1 / 3, (s.gw * 3 + s.gd) / (t * 3)) : 0; };
    Object.values(S).forEach(s => { s.mwp = mw(s); s.gwp = gwp(s); });
    const avg = (arr, f) => arr.length ? arr.reduce((t, id) => t + f(S[id]), 0) / arr.length : 0;
    Object.values(S).forEach(s => { s.omw = avg(s.opps, o => o.mwp); s.ogw = avg(s.opps, o => o.gwp); });
    return Object.values(S).sort((x, y) =>
      y.mp - x.mp || y.omw - x.omw || y.gwp - x.gwp || y.ogw - x.ogw || x.p.nome.localeCompare(y.p.nome));
  }

  // ---------- classificação multijogador (pods) ----------
  function standingsMulti(ev, stage = 'main') {
    const P = pts(ev), S = {};
    ev.players.forEach(p => S[p.id] = { p, mp: 0, w: 0, l: 0, d: 0, played: 0, opps: [] });
    stageRounds(ev, stage).forEach(r => r.matches.forEach(m => {
      if (!m.result || m.bye) return;
      m.players.forEach(id => {
        const s = S[id]; if (!s) return;
        s.played++; m.players.forEach(o => { if (o !== id) s.opps.push(o); });
        if (m.result.draw) { s.d++; s.mp += P.e; }
        else if (m.result.winner === id) { s.w++; s.mp += P.v; }
        else { s.l++; s.mp += P.d; }
      });
    }));
    Object.values(S).forEach(s => {
      s.ppm = s.played ? s.mp / s.played : 0;
    });
    Object.values(S).forEach(s => {
      s.sos = s.opps.length ? s.opps.reduce((t, o) => t + S[o].ppm, 0) / s.opps.length : 0;
    });
    return Object.values(S).sort((x, y) =>
      y.mp - x.mp || y.sos - x.sos || y.w - x.w || x.p.nome.localeCompare(y.p.nome));
  }

  const isMulti = ev => ev.modo === 'multi' || ev.estrutura === 'pods';
  const standings = (ev, stage) => isMulti(ev) ? standingsMulti(ev, stage) : standings1v1(ev, stage);

  // ---------- pareamento suíço (sem repetir oponente, com retrocesso) ----------
  function pairNoRematch(list, met) {
    let budget = 40000;
    const rec = rem => {
      if (!rem.length) return [];
      const [a, ...rest] = rem;
      for (let i = 0; i < rest.length; i++) {
        if (--budget < 0) return null;
        const b = rest[i];
        if (met[a] && met[a][b]) continue;
        const sub = rec(rest.filter((_, j) => j !== i));
        if (sub) return [[a, b], ...sub];
      }
      return null;
    };
    const res = rec(list);
    if (res) return res;
    const out = []; for (let i = 0; i + 1 < list.length; i += 2) out.push([list[i], list[i + 1]]);
    return out;
  }

  function swissGroup(ev, ids, met, first) {
    let order;
    if (first) order = shuffle(ids);
    else {
      const st = standings1v1(ev); const mp = {}; st.forEach(s => mp[s.p.id] = s.mp);
      order = shuffle(ids).sort((a, b) => mp[b] - mp[a]);
    }
    const matches = [];
    if (order.length % 2) {
      let k = order.length - 1;
      while (k >= 0 && hadBye(ev, order[k])) k--;
      if (k < 0) k = order.length - 1;
      matches.push({ id: rid(), players: [order[k]], bye: true });
      order.splice(k, 1);
    }
    pairNoRematch(order, met).forEach(p => matches.unshift({ id: rid(), players: p, result: null }));
    return matches;
  }

  function nextSwiss(ev) {
    const met = metMap(ev), first = stageRounds(ev, 'main').length === 0;
    const act = active(ev);
    if (ev.estrutura === 'draft') {
      const pods = {};
      act.forEach(p => (pods[p.pod || 1] = pods[p.pod || 1] || []).push(p.id));
      return Object.keys(pods).sort((a, b) => a - b).flatMap(k =>
        swissGroup(ev, pods[k], met, first).map(m => Object.assign(m, { pod: +k })));
    }
    return swissGroup(ev, act.map(p => p.id), met, first);
  }

  // ---------- todos contra todos (método do círculo) ----------
  function nextRoundRobin(ev) {
    if (!ev.rrOrder) ev.rrOrder = shuffle(active(ev).map(p => p.id));
    const ids = ev.rrOrder.slice(); if (ids.length % 2) ids.push(null);
    const n = ids.length, k = stageRounds(ev, 'main').length;
    if (k >= n - 1) throw new Error('Todos os jogadores já se enfrentaram.');
    // rotação: fixa o primeiro, gira o resto k posições
    const rest = ids.slice(1); const r2 = rest.slice(rest.length - (k % rest.length)).concat(rest.slice(0, rest.length - (k % rest.length)));
    const arr = [ids[0], ...r2];
    const dropped = new Set(ev.players.filter(p => p.dropped).map(p => p.id));
    const matches = [];
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i], b = arr[n - 1 - i];
      const A = a && !dropped.has(a) ? a : null, B = b && !dropped.has(b) ? b : null;
      if (A && B) matches.push({ id: rid(), players: [A, B], result: null });
      else if (A || B) matches.push({ id: rid(), players: [A || B], bye: true });
    }
    return matches.sort((x, y) => (x.bye ? 1 : 0) - (y.bye ? 1 : 0));
  }

  // ---------- pods multijogador (Commander) ----------
  function podSizes(n, size) {
    if (n < 2) return [];
    let k = Math.ceil(n / size);
    const make = k => { const base = Math.floor(n / k), extra = n % k; return Array.from({ length: k }, (_, i) => base + (i < extra ? 1 : 0)); };
    let s = make(k);
    while (k > 1 && Math.min(...s) < 3) { k--; s = make(k); }
    return s;
  }
  function nextPods(ev, ids, opts = {}) {
    const size = +ev.podSize || 4, met = metMap(ev);
    let order;
    if (opts.first) order = shuffle(ids);
    else { const st = standingsMulti(ev); const mp = {}; st.forEach(s => mp[s.p.id] = s.mp); order = shuffle(ids).sort((a, b) => mp[b] - mp[a]); }
    const sizes = opts.sizes || podSizes(order.length, size);
    const pool = order.slice(), out = [];
    sizes.forEach(sz => {
      const pod = [pool.shift()];
      while (pod.length < sz && pool.length) {
        let best = 0, bestCost = Infinity;
        for (let i = 0; i < Math.min(pool.length, 8); i++) {
          const c = pod.reduce((t, x) => t + ((met[x] && met[x][pool[i]]) || 0), 0) * 10 + i;
          if (c < bestCost) { bestCost = c; best = i; }
        }
        pod.push(pool.splice(best, 1)[0]);
      }
      out.push({ id: rid(), players: shuffle(pod), result: null }); // ordem = assentos / ordem de turno
    });
    return out;
  }

  // ---------- eliminatória simples ----------
  function seedOrder(size) { let o = [1, 2]; while (o.length < size) { const s = o.length * 2 + 1; o = o.flatMap(x => [x, s - x]); } return o; }
  function elimNext(ev, stage, seeds) {
    const rs = stageRounds(ev, stage);
    if (!rs.length) {
      let size = 2; while (size < seeds.length) size *= 2;
      const slots = seedOrder(size).map(s => seeds[s - 1] || null);
      const ms = [];
      for (let i = 0; i < size; i += 2) {
        const a = slots[i], b = slots[i + 1];
        if (a && b) ms.push({ id: rid(), players: [a, b], result: null, slot: i / 2 });
        else if (a || b) ms.push({ id: rid(), players: [a || b], bye: true, slot: i / 2 });
      }
      return ms;
    }
    const last = rs[rs.length - 1];
    const winners = last.matches.slice().sort((x, y) => x.slot - y.slot).map(winnerOf);
    if (winners.length < 2) throw new Error('A chave já tem um campeão.');
    const ms = [];
    for (let i = 0; i < winners.length; i += 2) ms.push({ id: rid(), players: [winners[i], winners[i + 1]], result: null, slot: i / 2 });
    return ms;
  }
  function elimChampion(ev, stage) {
    const rs = stageRounds(ev, stage); if (!rs.length) return null;
    const last = rs[rs.length - 1];
    return last.matches.length === 1 && roundDone(last) ? winnerOf(last.matches[0]) : null;
  }
  function elimTotalRounds(n) { let r = 0, s = 1; while (s < n) { s *= 2; r++; } return r; }
  function elimLabel(totalRounds, idx) {
    const left = totalRounds - idx;
    return left === 1 ? 'Final' : left === 2 ? 'Semifinal' : left === 3 ? 'Quartas de final' : left === 4 ? 'Oitavas de final' : `Rodada ${idx + 1}`;
  }

  // ---------- eliminatória dupla (dinâmica: chave de vencedores e de perdedores) ----------
  function losses(ev) {
    const L = {}; ev.players.forEach(p => L[p.id] = 0);
    ev.rounds.forEach(r => r.matches.forEach(m => { const l = loserOf(m); if (l) L[l]++; }));
    return L;
  }
  function doubleState(ev) {
    const L = losses(ev), seed = {}; (ev.seeds || ev.players.map(p => p.id)).forEach((id, i) => seed[id] = i);
    const alive = active(ev).filter(p => L[p.id] < 2).map(p => p.id).sort((a, b) => seed[a] - seed[b]);
    return { L, wb: alive.filter(id => L[id] === 0), lb: alive.filter(id => L[id] === 1), alive };
  }
  function nextDouble(ev) {
    if (!ev.seeds) ev.seeds = shuffle(active(ev).map(p => p.id));
    const { wb, lb, alive } = doubleState(ev);
    if (alive.length < 2) throw new Error('A chave já tem um campeão.');
    const met = metMap(ev), ms = [];
    if (alive.length === 2) { ms.push({ id: rid(), players: alive, result: null, bracket: 'F' }); return ms; }
    const side = (ids, br) => {
      if (ids.length === 1) { ms.push({ id: rid(), players: ids, wait: true, bracket: br }); return; }
      let list = ids.slice();
      if (list.length % 2) {
        let k = list.length - 1; while (k >= 0 && ev.rounds.some(r => r.matches.some(m => m.wait && m.players[0] === list[k]))) k--;
        if (k < 0) k = list.length - 1;
        ms.push({ id: rid(), players: [list[k]], wait: true, bracket: br }); list.splice(k, 1);
      }
      pairNoRematch(list, met).forEach(p => ms.push({ id: rid(), players: p, result: null, bracket: br }));
    };
    if (wb.length) side(wb, 'W');
    if (lb.length) side(lb, 'L');
    const bo = { W: 0, L: 1, F: 2 };
    return ms.sort((a, b) => bo[a.bracket] - bo[b.bracket] || (a.wait ? 1 : 0) - (b.wait ? 1 : 0));
  }

  // ---------- próxima rodada ----------
  function nextRound(ev) {
    const last = ev.rounds[ev.rounds.length - 1];
    if (last && !roundDone(last)) throw new Error('Lance todos os resultados da rodada atual antes de gerar a próxima.');
    const act = active(ev);
    let stage = last ? (last.stage || 'main') : 'main';
    if (stage === 'final') throw new Error('A mesa final já foi gerada.');
    if (stage === 'elim') {
      if (elimChampion(ev, 'elim')) throw new Error('O top já terminou. Temos um campeão.');
      return { n: ev.rounds.length + 1, stage: 'elim', matches: elimNext(ev, 'elim', ev.cutSeeds) };
    }
    if (act.length < 2) throw new Error('São necessários pelo menos 2 jogadores ativos.');
    let matches;
    switch (ev.estrutura) {
      case 'single': if (!ev.seeds) ev.seeds = shuffle(act.map(p => p.id));
        if (elimChampion(ev, 'main')) throw new Error('A chave já tem um campeão.');
        matches = elimNext(ev, 'main', ev.seeds); break;
      case 'double': matches = nextDouble(ev); break;
      case 'roundrobin': matches = nextRoundRobin(ev); break;
      case 'pods': matches = nextPods(ev, act.map(p => p.id), { first: stageRounds(ev, 'main').length === 0 }); break;
      default: matches = nextSwiss(ev);
    }
    matches.forEach((m, i) => m.mesa = i + 1);
    return { n: ev.rounds.length + 1, stage: 'main', matches };
  }

  // ---------- top (corte após a fase classificatória) ----------
  function startCut(ev) {
    const n = +ev.topCut;
    const last = ev.rounds[ev.rounds.length - 1];
    if (last && !roundDone(last)) throw new Error('Lance todos os resultados antes de iniciar o top.');
    const st = standings(ev, 'main').filter(s => !s.p.dropped);
    if (isMulti(ev)) {
      const ids = st.slice(0, Math.min(n || +ev.podSize || 4, st.length)).map(s => s.p.id);
      ev.cutSeeds = ids;
      // mesa final: assento 1 para o primeiro colocado
      return { n: ev.rounds.length + 1, stage: 'final', matches: [{ id: rid(), players: ids, result: null, mesa: 1 }] };
    }
    ev.cutSeeds = st.slice(0, Math.min(n, st.length)).map(s => s.p.id);
    const r = { n: ev.rounds.length + 1, stage: 'elim', matches: elimNext(Object.assign({}, ev, { rounds: [] }), 'elim', ev.cutSeeds) };
    r.matches.forEach((m, i) => m.mesa = i + 1);
    return r;
  }

  function assignDraftPods(ev) {
    const size = +ev.podSize || 8;
    const ids = shuffle(active(ev).map(p => p.id));
    const k = Math.max(1, Math.round(ids.length / size));
    const base = Math.floor(ids.length / k), extra = ids.length % k;
    let i = 0;
    for (let pod = 1; pod <= k; pod++) {
      const sz = base + (pod <= extra ? 1 : 0);
      for (let s = 1; s <= sz; s++, i++) { const p = ev.players.find(x => x.id === ids[i]); p.pod = pod; p.assento = s; }
    }
  }

  function suggestedRounds(n, estrutura) {
    if (estrutura === 'roundrobin') return n % 2 ? n : n - 1;
    if (estrutura === 'pods') return Math.max(3, Math.min(5, Math.ceil(n / 8) + 2));
    if (estrutura === 'draft') return 3;
    if (n <= 8) return 3; if (n <= 16) return 4; if (n <= 32) return 5; if (n <= 64) return 6; if (n <= 128) return 7; return 8;
  }

  return { rid, shuffle, nextRound, startCut, standings, standings1v1, standingsMulti, winnerOf, roundDone, done, isMulti,
    elimChampion, elimTotalRounds, elimLabel, doubleState, assignDraftPods, suggestedRounds, podSizes, stageRounds, metMap };
})();
if (typeof module !== 'undefined') module.exports = ENGINE;
