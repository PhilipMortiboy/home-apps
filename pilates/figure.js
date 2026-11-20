// Side-view figure, drawn from joint angles and animated between key poses.
// World units: y up, the mat surface is y = 0. Angles are absolute, in degrees
// (0 = pointing right, 90 = up). Figure faces right when standing.
//
// Pose fields:
//   t, u   lower torso (pelvis -> waist) and upper torso (waist -> shoulders)
//   n      head (neck -> crown)
//   a, A   near / far arm: [upperArm, forearm] or IK {to:[joint, along, side], b}
//          or {at:[dx, dy]} relative to the pelvis
//   l, L   near / far leg: [thigh, shin, foot] or IK {at:[dx, dy], b, f}
//   x      horizontal offset; anchor names a joint to hold at that x (default pelvis)
//   y      pelvis height; when absent the figure is set down onto the mat
(function () {
  const LEN = { lt: 22, ut: 28, neck: 6, head: 11, ua: 27, fa: 25, th: 42, sh: 40, ft: 11 };
  const R = { P: 10, W: 10, S: 9, H: 11, K: 6, Ak: 4.5, T: 3, E: 4, Hd: 4 };
  // colours match the 3D model: white tee, dark green leggings, bare feet, dark ponytail
  const C = {
    skin: "#DDAA84", skinFar: "#C69370", tee: "#F7F6F1", teeFar: "#E2E1DA",
    legs: "#34403A", legsFar: "#252E29", hair: "#1A1414", eye: "#2A2220",
    line: "#46564A", mat: "#9DC08F", matEdge: "#7FA572",
  };
  const rad = d => d * Math.PI / 180;
  const dir = d => [Math.cos(rad(d)), Math.sin(rad(d))];
  const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];
  const ang = (p, q) => Math.atan2(q[1] - p[1], q[0] - p[0]) * 180 / Math.PI;
  const lerpP = (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];

  // Two-bone IK: angles of both bones from `from` to reach `to`.
  // b = 1 bends the middle joint to the left of the from->to line, -1 to the right.
  function ik(from, to, l1, l2, b = 1) {
    const dx = to[0] - from[0], dy = to[1] - from[1];
    let d = Math.hypot(dx, dy);
    d = Math.min(Math.max(d, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
    const base = Math.atan2(dy, dx);
    const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    const a1 = base + b * Math.acos(Math.max(-1, Math.min(1, cosA)));
    const mid = [from[0] + l1 * Math.cos(a1), from[1] + l1 * Math.sin(a1)];
    return [a1 * 180 / Math.PI, ang(mid, to)];
  }

  function chain(r) {
    const P = [r.px, r.py];
    const W = add(P, dir(r.t), LEN.lt), S = add(W, dir(r.u), LEN.ut);
    const N = add(S, dir(r.n), LEN.neck), H = add(N, dir(r.n), LEN.head);
    const arm = a => { const E = add(S, dir(a[0]), LEN.ua); return { E, Hd: add(E, dir(a[1]), LEN.fa) }; };
    const leg = l => { const K = add(P, dir(l[0]), LEN.th), Ak = add(K, dir(l[1]), LEN.sh); return { K, Ak, T: add(Ak, dir(l[2]), LEN.ft) }; };
    return { P, W, S, N, H, n: r.n, a: arm(r.a), A: arm(r.A), l: leg(r.l), L: leg(r.L) };
  }

  function lowest(j) {
    let m = Infinity;
    const chk = (p, r) => { m = Math.min(m, p[1] - r); };
    chk(j.P, R.P); chk(j.W, R.W); chk(j.S, R.S); chk(j.H, R.H);
    for (const s of [j.a, j.A]) { chk(s.E, R.E); chk(s.Hd, R.Hd); }
    for (const s of [j.l, j.L]) { chk(s.K, R.K); chk(s.Ak, R.Ak); chk(s.T, R.T); }
    return m;
  }

  function jointAt(j, name) {
    const map = { P: j.P, W: j.W, S: j.S, H: j.H, E: j.a.E, Hd: j.a.Hd, K: j.l.K, Ak: j.l.Ak, T: j.l.T,
      eE: j.A.E, eHd: j.A.Hd, kK: j.L.K, kAk: j.L.Ak, kT: j.L.T };
    return map[name];
  }
  // frame angle used for {to:[joint, along, side]} offsets
  function frameAngle(r, name) {
    return { H: r.n, S: r.u, W: r.u, P: r.t, K: r.l[0], Ak: r.l[1], kK: r.L[0], kAk: r.L[1] }[name] ?? 0;
  }

  // Turn an authored pose into plain angles plus a pelvis position.
  // Limb targets: {at:[dx,dy]} is relative to the pelvis, {w:[x,y]} is a fixed
  // point in the world (needs an explicit pose y), {to:[joint, along, side]}
  // is relative to another joint (arms only).
  function resolve(p) {
    const r = { px: 0, py: 0, t: p.t, u: p.u, n: p.n ?? p.u, a: [0, 0], A: [0, 0], l: [0, 0, 0], L: [0, 0, 0] };
    const fixedRoot = p.y != null;
    const usesWorld = [p.l, p.L, p.a, p.A].some(s => s && s.w);
    if (usesWorld && !fixedRoot) throw new Error("world targets need pose.y");
    // with a fixed y and a body anchor, place the root before solving limbs
    const bodyAnchor = !p.anchor || ["P", "W", "S", "H"].includes(p.anchor);
    const placeRoot = () => {
      const j = chain(r);
      const anchor = p.anchor ? jointAt(j, p.anchor) : j.P;
      r.px += (p.x || 0) - anchor[0];
      r.py = fixedRoot ? p.y : r.py - lowest(j);
    };
    if (fixedRoot && bodyAnchor) placeRoot();
    const P = () => [r.px, r.py];
    const legOf = l => {
      if (Array.isArray(l)) return l.slice();
      const tgt = l.w ? l.w : add(P(), l.at);
      const [th, sh] = ik(P(), tgt, LEN.th, LEN.sh, l.b ?? 1);
      return [th, sh, l.f ?? 0];
    };
    r.l = legOf(p.l); r.L = p.L ? legOf(p.L) : r.l.slice();
    const armOf = a => {
      if (Array.isArray(a)) return a.slice();
      const j = chain(r);
      let tgt;
      if (a.w) tgt = a.w;
      else if (a.at) tgt = add(P(), a.at);
      else {
        const base = jointAt(j, a.to[0]), fa = frameAngle(r, a.to[0]);
        tgt = add(add(base, dir(fa), a.to[1] || 0), dir(fa + 90), a.to[2] || 0);
      }
      return ik(j.S, tgt, LEN.ua, LEN.fa, a.b ?? 1);
    };
    r.a = armOf(p.a); r.A = p.A ? armOf(p.A) : r.a.slice();
    fix(r);
    if (!(fixedRoot && bodyAnchor)) {
      if (usesWorld) throw new Error("world targets need a body anchor");
      placeRoot();
    }
    return r;
  }

  // ---- what a body can do ----
  // Pose angles are absolute directions in the side view, with the body's front at (trunk - 90).
  // Each joint's angle is measured from its neutral standing position, wrapped so the cut
  // falls in a range no body can reach. Limits are generous, for a flexible adult.
  const wrap = (x, lo = -180) => ((((x - lo) % 360) + 360) % 360) + lo;
  const LIM = {
    spine: [-85, 50],     // upper trunk vs lower trunk: flexion (-) / extension (+)
    neck: [-60, 70],      // head vs upper trunk
    shoulder: [-80, 235], // upper arm: 0 hanging, 90 forward, 180 overhead, - behind
    elbow: [0, 150],      // forearm vs upper arm: 0 straight, + bent
    hip: [-35, 165],      // thigh: 0 standing, 90 forward, - behind
    knee: [-160, 0],      // shin vs thigh: 0 straight, - bent
    ankle: [10, 115],     // foot vs shin: 90 standing, small = pointed
  };
  const clamp = (x, [lo, hi]) => Math.min(hi, Math.max(lo, x));
  const SH_CUT = -110; // shoulder angles wrap at the impossible "far behind" direction
  function rel(r) {
    const arm = (a, u) => [wrap(a[0] - u + 180, SH_CUT), wrap(a[1] - a[0])];
    const leg = (l, t) => [wrap(l[0] - t + 180), wrap(l[1] - l[0]), wrap(l[2] - l[1])];
    return { px: r.px, py: r.py, t: r.t, sp: wrap(r.u - r.t), nk: wrap(r.n - r.u),
      a: arm(r.a, r.u), A: arm(r.A, r.u), l: leg(r.l, r.t), L: leg(r.L, r.t) };
  }
  function abs(j) {
    const u = j.t + j.sp;
    const arm = a => { const a0 = a[0] + u - 180; return [a0, a0 + a[1]]; };
    const leg = l => { const l0 = l[0] + j.t - 180, l1 = l0 + l[1]; return [l0, l1, l1 + l[2]]; };
    return { px: j.px, py: j.py, t: j.t, u, n: u + j.nk, a: arm(j.a), A: arm(j.A), l: leg(j.l), L: leg(j.L) };
  }
  // Bend a two-bone limb the way the joint actually bends, keeping its end where it was:
  // reflect both bones across the line from the root to the end.
  function flip(b0, b1, l0, l1) {
    const e = add(dir(b0), dir(b1), l1 / l0), base = Math.atan2(e[1], e[0]) * 180 / Math.PI;
    return [2 * base - b0, 2 * base - b1];
  }
  function fix(r) {
    // too much spinal flexion is taken at the hip instead
    let sp = wrap(r.u - r.t);
    if (sp < LIM.spine[0] || sp > LIM.spine[1]) r.t = r.u - clamp(sp, LIM.spine);
    r.n = r.u + clamp(wrap(r.n - r.u), LIM.neck);
    for (const k of ["a", "A"]) {
      let a = r[k];
      if (wrap(a[1] - a[0]) < 0) a = flip(a[0], a[1], LEN.ua, LEN.fa);
      const s = clamp(wrap(a[0] - r.u + 180, SH_CUT), LIM.shoulder), e = clamp(wrap(a[1] - a[0]), LIM.elbow);
      const a0 = s + r.u - 180; r[k] = [a0, a0 + e];
    }
    for (const k of ["l", "L"]) {
      let l = r[k], f = l[2];
      if (wrap(l[1] - l[0]) > 0) [l[0], l[1]] = flip(l[0], l[1], LEN.th, LEN.sh);
      const h = clamp(wrap(l[0] - r.t + 180), LIM.hip), kn = clamp(wrap(l[1] - l[0]), LIM.knee);
      const l0 = h + r.t - 180, l1 = l0 + kn;
      r[k] = [l0, l1, l1 + clamp(wrap(f - l1), LIM.ankle)];
    }
    return r;
  }

  // Blend two poses joint by joint, so each joint takes the short way round within its range.
  const lerp = (a, b, k) => a + (b - a) * k;
  function mix(r1, r2, k) {
    const x = rel(r1), y = rel(r2), m = (p, q) => p.map((v, i) => lerp(v, q[i], k));
    return abs({ px: lerp(x.px, y.px, k), py: lerp(x.py, y.py, k), t: lerp(x.t, y.t, k), sp: lerp(x.sp, y.sp, k),
      nk: lerp(x.nk, y.nk, k), a: m(x.a, y.a), A: m(x.A, y.A), l: m(x.l, y.l), L: m(x.L, y.L) });
  }

  // ---- drawing ----
  const f1 = v => v.toFixed(1);
  const X = p => f1(p[0]), Y = p => f1(-p[1]);
  const line = (p, q, w, c) => `<line x1="${X(p)}" y1="${Y(p)}" x2="${X(q)}" y2="${Y(q)}" stroke="${c}" stroke-width="${w}"/>`;
  const poly = (pts, w, c) => `<polyline points="${pts.map(p => X(p) + "," + Y(p)).join(" ")}" fill="none" stroke="${c}" stroke-width="${w}"/>`;
  const circ = (p, r, c) => `<circle cx="${X(p)}" cy="${Y(p)}" r="${r}" fill="${c}"/>`;
  const OUT = 2.6;

  // each part: [kind, geometry, width, colour]; drawn as outline pass then fill pass
  function layer(parts) {
    let o = "", f = "";
    for (const [k, g, w, c] of parts) {
      if (k === "l") { o += line(g[0], g[1], w + OUT, C.line); f += line(g[0], g[1], w, c); }
      else if (k === "p") { o += poly(g, w + OUT, C.line); f += poly(g, w, c); }
      else if (k === "c") { o += circ(g[0], g[1] + OUT / 2, C.line); f += circ(g[0], g[1], c); }
      else if (k === "raw") { f += g; }
    }
    return o + f;
  }
  function armParts(S, s, far) {
    const sleeve = lerpP(S, s.E, 0.42);
    return [["l", [s.E, s.Hd], 7, far ? C.skinFar : C.skin], ["l", [sleeve, s.E], 7.6, far ? C.skinFar : C.skin],
      ["l", [S, sleeve], 9.5, far ? C.teeFar : C.tee]];
  }
  function legParts(P, s, far) {
    const legs = far ? C.legsFar : C.legs;
    return [["l", [s.Ak, s.T], 6, far ? C.skinFar : C.skin], ["l", [s.K, s.Ak], 9.5, legs],
      ["l", [P, s.K], 13, legs]];
  }
  function hair(H, n) {
    const pts = [];
    for (let a = n - 40; a <= n + 175; a += 12) pts.push(add(H, dir(a), 12.2));
    pts.push(add(H, dir(n + 90), 2));
    const cap = `<polygon points="${pts.map(p => X(p) + "," + Y(p)).join(" ")}" fill="${C.hair}"/>`;
    // ponytail hangs back from the crown; it never dips below the mat
    const flo = p => [p[0], Math.max(p[1], 3)];
    const a0 = add(H, dir(n + 55), 11), c1 = flo(add(add(H, dir(n + 80), 17), [0, -3]));
    const e = flo(add(add(H, dir(n + 100), 16), [0, -20]));
    const tail = `<path d="M${X(a0)} ${Y(a0)} Q${X(c1)} ${Y(c1)} ${X(e)} ${Y(e)}" fill="none" stroke="${C.hair}" stroke-width="7"/>`;
    const tie = circ(a0, 3.4, C.hair);
    const eye = circ(add(H, dir(n - 62), 6.4), 1.4, C.eye);
    return cap + tail + tie + eye;
  }

  function draw(r) {
    const j = chain(r);
    const lift = lowest(j);
    if (lift < -0.01) return draw({ ...r, py: r.py - lift });
    const P = j.P, W = j.W, S = j.S;
    const waist = lerpP(P, W, 0.3);
    let s = "";
    s += layer(armParts(S, j.A, true));
    s += layer(legParts(P, j.L, true));
    s += layer([["l", [S, j.N], 7.5, C.skin], ["c", [j.H, LEN.head], 0, C.skin]]);
    s += hair(j.H, j.n);
    s += layer([["p", [P, W, S], 20, C.tee], ["l", [P, waist], 20.5, C.legs]]);
    s += layer(legParts(P, j.l, false));
    s += layer(armParts(S, j.a, false));
    return s;
  }

  function bounds(keys) {
    let x0 = Infinity, x1 = -Infinity, y1 = 0;
    for (const r of keys) {
      const j = chain(r);
      const pts = [j.P, j.W, j.S, j.H, j.a.E, j.a.Hd, j.A.E, j.A.Hd, j.l.K, j.l.Ak, j.l.T, j.L.K, j.L.Ak, j.L.T];
      for (const p of pts) { x0 = Math.min(x0, p[0] - 14); x1 = Math.max(x1, p[0] + 14); y1 = Math.max(y1, p[1] + 14); }
    }
    return { cx: (x0 + x1) / 2, top: y1 };
  }

  const W = 250, Hh = 178;
  function svgShell(inner, cx, mirror) {
    const tf = mirror ? `transform="translate(${f1(2 * cx)} 0) scale(-1 1)"` : "";
    return `<svg viewBox="${f1(cx - W / 2)} ${-Hh + 14} ${W} ${Hh}" xmlns="http://www.w3.org/2000/svg" stroke-linecap="round" stroke-linejoin="round" role="img">` +
      `<rect x="${f1(cx - W / 2 + 10)}" y="0" width="${W - 20}" height="7" rx="3.5" fill="${C.mat}"/>` +
      `<rect x="${f1(cx - W / 2 + 10)}" y="5" width="${W - 20}" height="2" rx="1" fill="${C.matEdge}"/>` +
      `<g ${tf}>${inner}</g></svg>`;
  }

  const ease = k => 0.5 - 0.5 * Math.cos(Math.PI * k);
  const cache = new WeakMap();
  function prepared(ex) {
    if (!cache.has(ex)) {
      const keys = ex.poses.map(resolve);
      cache.set(ex, { keys, box: bounds(keys) });
    }
    return cache.get(ex);
  }

  function frameAt(keys, cyc, tSec) {
    if (keys.length === 1) return keys[0];
    const seq = keys.length === 2 ? [0, 1] : keys.map((_, i) => i);
    const segs = seq.length; // loop back to start
    const pos = ((tSec % cyc) + cyc) % cyc / cyc * segs;
    const i = Math.floor(pos), k = ease(pos - i);
    return mix(keys[seq[i]], keys[seq[(i + 1) % segs]], k);
  }

  // Static SVG string of one key pose (for lists and reduced motion).
  function still(ex, idx, mirror) {
    const { keys, box } = prepared(ex);
    const i = idx ?? (ex.key ?? (keys.length > 1 ? 1 : 0));
    return svgShell(draw(keys[i]), box.cx, mirror);
  }

  // Live figure in `el`. Returns controls.
  function mount(el, ex, { mirror = false, paused = false } = {}) {
    const { keys, box } = prepared(ex);
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.innerHTML = still(ex, undefined, mirror);
    if (keys.length < 2 || reduce) return { setPaused() {}, stop() {} };
    el.innerHTML = svgShell("", box.cx, mirror);
    const g = el.querySelector("g");
    const cyc = ex.cyc || 4;
    let t = 0, last = null, raf = 0, isPaused = paused, alive = true;
    const tick = now => {
      if (!alive) return;
      if (last != null && !isPaused) t += (now - last) / 1000;
      last = now;
      g.innerHTML = draw(frameAt(keys, cyc, t));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return {
      setPaused(p) { isPaused = p; },
      stop() { alive = false; cancelAnimationFrame(raf); },
    };
  }

  window.Figure = { mount, still, resolve, mix, fix, rel, LIM, LEN };
})();
