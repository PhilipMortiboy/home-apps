/* Tresza's Training — 3D lesson figure.
 * A skinned MakeHuman model (model/tresza_mh.json) whose bones follow the same pose
 * angles as the 2D figure in figure.js. Same API as Figure.mount: returns
 * { setPaused, stop }. Shows the 2D figure straight away and swaps to 3D once the
 * model has loaded; if WebGL or the model isn't available it simply stays 2D.
 * Needs figure.js loaded first. three.js is loaded on first use from vendor/. */
(function () {
  const rad = d => d * Math.PI / 180;
  const dir = d => [Math.cos(rad(d)), Math.sin(rad(d))];
  const add = (p, v, k = 1) => [p[0] + v[0] * k, p[1] + v[1] * k];

  function webgl() {
    try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); }
    catch (e) { return false; }
  }
  function script(src) {
    return new Promise((ok, bad) => {
      const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => bad(new Error(src));
      document.head.appendChild(s);
    });
  }

  // ---- loading (once) ----
  let ready = null; // Promise<engine>
  function load() {
    if (!ready) {
      ready = (async () => {
        if (!webgl()) throw new Error("no WebGL");
        if (!window.THREE) await script("vendor/three.min.js");
        if (!THREE.GLTFLoader) await script("vendor/GLTFLoader.js");
        const res = await fetch("model/tresza_mh.json");
        if (!res.ok) throw new Error("model HTTP " + res.status);
        const gltf = await parse(await res.json());
        return engine(gltf);
      })();
      ready.catch(() => {});
    }
    return ready;
  }
  // The model ships as glTF JSON with its buffer inlined. Rebuild a GLB in memory so the
  // loader never has to fetch a data: URL (some hosts block that).
  function parse(g) {
    const bin = atob(g.buffers[0].uri.split(",")[1]);
    const body = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) body[i] = bin.charCodeAt(i);
    delete g.buffers[0].uri;
    const json = new TextEncoder().encode(JSON.stringify(g));
    const jl = Math.ceil(json.length / 4) * 4, bl = Math.ceil(body.length / 4) * 4;
    const out = new Uint8Array(28 + jl + bl), dv = new DataView(out.buffer);
    dv.setUint32(0, 0x46546C67, true); dv.setUint32(4, 2, true); dv.setUint32(8, out.length, true);
    dv.setUint32(12, jl, true); dv.setUint32(16, 0x4E4F534A, true); out.fill(0x20, 20, 20 + jl); out.set(json, 20);
    dv.setUint32(20 + jl, bl, true); dv.setUint32(24 + jl, 0x004E4942, true); out.set(body, 28 + jl);
    return new Promise((ok, bad) => new THREE.GLTFLoader().parse(out.buffer, "", ok, bad));
  }

  // ---- the renderer, scene and rigged model (one of each, reused between exercises) ----
  function engine(gltf) {
    const LEN = Figure.LEN, HR = 11, NECK = 6;
    THREE.ColorManagement.legacyMode = false; // treat colour values as sRGB, as written
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const canvas = renderer.domElement; canvas.className = "fig3d";
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 2, 10, 3000);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xC9D6C0, 0.75));
    const key = new THREE.DirectionalLight(0xFFF4E6, 1.25);
    key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 6;
    Object.assign(key.shadow.camera, { left: -200, right: 200, top: 200, bottom: -200, near: 10, far: 700 });
    scene.add(key, key.target);
    const rim = new THREE.DirectionalLight(0xDDE8FF, 0.45); rim.position.set(-160, 120, -140); scene.add(rim);

    const M = (color, rough, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
    const mat = {
      skin: new THREE.MeshPhysicalMaterial({ color: 0xD49E78, roughness: 0.5, sheen: 0.5, sheenColor: new THREE.Color(0xF2C0A0), clearcoat: 0.06 }),
      top: M(0xF7F6F1, 0.85), leggings: M(0x34403A, 0.7),
      hair: new THREE.MeshStandardMaterial({ roughness: 0.42, alphaTest: 0.35, side: THREE.DoubleSide }),
      eyes: M(0xFFFFFF, 0.25), brows: M(0x17110F, 1, { transparent: true, depthWrite: false }),
      lashes: M(0x17110F, 1, { transparent: true, depthWrite: false }), mat: M(0x9DC08F, 0.95),
    };
    const tl = new THREE.TextureLoader();
    for (const [k, f] of [["hair", "hair.png"], ["eyes", "eye.png"], ["brows", "brows.png"], ["lashes", "lashes.png"]]) {
      tl.load("model/" + f, tx => { tx.encoding = THREE.sRGBEncoding; tx.flipY = false; mat[k].map = tx; mat[k].needsUpdate = true; draw(); });
    }
    const matMesh = new THREE.Mesh(new THREE.BoxGeometry(240, 3, 80), mat.mat); matMesh.position.y = -1.5; matMesh.receiveShadow = true; scene.add(matMesh);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.ShadowMaterial({ opacity: 0.12 }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -3.01; floor.receiveShadow = true; scene.add(floor);

    // bone -> the pose value that drives it; the near side is the model's right
    const DRIVE = {
      pelvis: r => r.t, spine_01: r => r.t, spine_02: r => (r.t + r.u) / 2, spine_03: r => r.u, neck_01: r => r.n, Head: r => r.n,
      upperarm_r: r => r.a[0], lowerarm_r: r => r.a[1], hand_r: r => r.a[1],
      upperarm_l: r => r.A[0], lowerarm_l: r => r.A[1], hand_l: r => r.A[1],
      thigh_r: r => r.l[0], calf_r: r => r.l[1], foot_r: r => r.l[2],
      thigh_l: r => r.L[0], calf_l: r => r.L[1], foot_l: r => r.L[2],
    };
    const CHILD = { pelvis: "spine_01", spine_01: "spine_02", spine_02: "spine_03", spine_03: "neck_01", neck_01: "Head",
      upperarm_r: "lowerarm_r", lowerarm_r: "hand_r", upperarm_l: "lowerarm_l", lowerarm_l: "hand_l",
      thigh_r: "calf_r", calf_r: "foot_r", foot_r: "ball_r", thigh_l: "calf_l", calf_l: "foot_l", foot_l: "ball_l" };
    const SC = 94; // model metres -> pose units
    const q1 = new THREE.Quaternion(), q2 = new THREE.Quaternion(), qz = new THREE.Quaternion(), Z = new THREE.Vector3(0, 0, 1);
    const va = new THREE.Vector3(), vb = new THREE.Vector3();

    const model = gltf.scene, root = new THREE.Group();
    model.rotation.y = Math.PI / 2; // the model faces +z; the pose figure faces +x
    root.add(model); root.scale.setScalar(SC); scene.add(root);
    const bones = {};
    model.traverse(o => {
      if (o.isBone) bones[o.name] = o;
      if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; o.material = mat[o.material.name] || mat.skin; }
    });
    root.updateMatrixWorld(true);
    const info = {};
    for (const name of Object.keys(DRIVE)) {
      const b = bones[name], rest = b.getWorldQuaternion(new THREE.Quaternion()), p0 = b.getWorldPosition(new THREE.Vector3());
      const d0 = CHILD[name] ? bones[CHILD[name]].getWorldPosition(new THREE.Vector3()).sub(p0).normalize() : new THREE.Vector3(0, 1, 0);
      info[name] = { b, rest, d0 };
    }
    for (const h of ["hand_r", "hand_l"]) info[h].d0 = new THREE.Vector3(0, 1, 0).applyQuaternion(info[h].rest); // wrist to knuckles
    for (const k in info) { // each bone's rest direction swung into the side-view plane
      const d0 = info[k].d0, flat = new THREE.Vector3(d0.x, d0.y, 0);
      const nd = flat.length() > 0.35 ? flat.normalize() : new THREE.Vector3(0, -1, 0);
      info[k].qn = new THREE.Quaternion().setFromUnitVectors(d0, nd);
      info[k].th0 = Math.atan2(nd.y, nd.x);
    }
    const order = []; model.traverse(o => { if (info[o.name]) order.push(info[o.name]); });
    const skins = []; model.traverse(o => { if (o.isSkinnedMesh && o.material !== mat.hair) skins.push(o); });

    const c01 = x => Math.min(1, Math.max(0, x));
    function joints(r) {
      const P = [r.px, r.py], W = add(P, dir(r.t), LEN.lt), S = add(W, dir(r.u), LEN.ut);
      const Hc = add(add(S, dir(r.n), NECK), dir(r.n), HR);
      const arm = a => { const E = add(S, dir(a[0]), LEN.ua); return { E, Hd: add(E, dir(a[1]), LEN.fa) }; };
      const leg = l => { const K = add(P, dir(l[0]), LEN.th), Ak = add(K, dir(l[1]), LEN.sh); return { K, Ak, T: add(Ak, dir(l[2]), LEN.ft) }; };
      return { P, W, S, Hc, a: arm(r.a), A: arm(r.A), l: leg(r.l), L: leg(r.L) };
    }
    // how far a hand rests on the belly of a figure lying on its back (those arms are placed in 3D, see restHands)
    const onBody = (r, j, Hd) => Hd[1] <= j.W[1] ? 0 :
      c01((-Math.cos(rad(r.t)) - 0.7) / 0.2) * c01((18 - Math.hypot(Hd[0] - j.W[0], Hd[1] - j.W[1])) / 4);
    function lowest(j, r) {
      let m = Infinity; const c = (p, rr) => { m = Math.min(m, p[1] - rr); };
      c(j.P, 10); c(j.W, 10); c(j.S, 9); c(j.Hc, HR);
      for (const s of [j.a, j.A]) { if (r && onBody(r, j, s.Hd) > 0) continue; c(s.E, 4); c(s.Hd, 4); }
      for (const s of [j.l, j.L]) { c(s.K, 6); c(s.Ak, 4.5); c(s.T, 3.4); }
      return m;
    }

    // ---- contact with the mat ----
    // The 3D body's proportions differ from the 2D figure's, so posing by the same angles leaves some
    // parts short of the mat. The 2D pose says which parts touch; the 3D pose is adjusted until they do.
    const w180 = x => ((x % 360) + 540) % 360 - 180, deg = x => x * 180 / Math.PI;
    // how firmly each part touches in the 2D pose: 1 on the mat, 0 from 3 units up
    // (tw.up holds each part's height above the mat in the 2D pose)
    function touch(r) {
      const j = joints(r), lo = Math.min(0, lowest(j, r)), h = (p, rr) => p[1] - rr - lo;
      const up = { handR: h(j.a.Hd, 4), handL: h(j.A.Hd, 4), footR: Math.min(h(j.l.T, 3.4), h(j.l.Ak, 4.5)), footL: Math.min(h(j.L.T, 3.4), h(j.L.Ak, 4.5)),
        kneeR: h(j.l.K, 6), kneeL: h(j.L.K, 6), hips: Math.min(h(j.P, 10), h(j.W, 10)), trunk: h(j.S, 9), head: h(j.Hc, HR), arm: 99, leg: 99 };
      const tw = { up };
      for (const p in up) tw[p] = c01((3 - up[p]) / 2);
      return tw;
    }
    // a sample of skin vertices, each tagged with the body part of its strongest bone
    const PARTS = ["handR", "handL", "footR", "footL", "kneeR", "kneeL", "hips", "trunk", "head", "arm", "leg"];
    const partOf = n => {
      const s = /_r$/.test(n) ? "R" : /_l$/.test(n) ? "L" : "";
      if (/^(hand|index|middle|pinky|ring|thumb)_/.test(n)) return "hand" + s;
      if (/^(foot|ball)_/.test(n)) return "foot" + s;
      if (/^(thigh|calf)_/.test(n)) return "knee" + s;
      if (/^(Head|neck_01)$/.test(n)) return "head";
      if (/^(spine_02|spine_03|clavicle_[lr])$/.test(n)) return "trunk";
      if (/^(upperarm|lowerarm)_/.test(n)) return "arm";
      return "hips";
    };
    // (only skin within 10 units of the knee joint counts as the knee; the rest of the leg is "leg")
    const kneeAt = { R: bones.calf_r.getWorldPosition(new THREE.Vector3()), L: bones.calf_l.getWorldPosition(new THREE.Vector3()) };
    const samples = skins.map(B => {
      const g = B.geometry.attributes, idx = g.skinIndex.array, wt = g.skinWeight.array;
      const part = B.skeleton.bones.map(b => partOf(b.name)), out = [];
      for (let i = 0; i < g.position.count; i += 3) {
        let k = 0; for (let m = 1; m < 4; m++) if (wt[i * 4 + m] > wt[i * 4 + k]) k = m;
        let p = part[idx[i * 4 + k]];
        if (p.startsWith("knee")) {
          vb.fromBufferAttribute(g.position, i); B.boneTransform(i, vb); vb.applyMatrix4(B.matrixWorld);
          if (vb.distanceTo(kneeAt[p[4]]) > 10) p = "leg";
        }
        out.push(i, PARTS.indexOf(p));
      }
      return Int32Array.from(out);
    });
    // lowest point (y, and its x) of each part
    function measure() {
      root.updateMatrixWorld(true);
      const m = {}; for (const p of PARTS) m[p] = { y: Infinity, x: 0 };
      skins.forEach((B, s) => {
        const pos = B.geometry.attributes.position, S = samples[s];
        for (let j = 0; j < S.length; j += 2) {
          vb.fromBufferAttribute(pos, S[j]); B.boneTransform(S[j], vb); vb.applyMatrix4(B.matrixWorld);
          const L = m[PARTS[S[j + 1]]]; if (vb.y < L.y) { L.y = vb.y; L.x = vb.x; }
        }
      });
      return m;
    }

    // the toe bones, which follow the foot unless they are bent flat on the mat
    const toe = {};
    for (const [n, foot] of [["ball_r", "foot_r"], ["ball_l", "foot_l"]]) {
      const b = bones[n], rest = b.getWorldQuaternion(new THREE.Quaternion());
      const d0 = new THREE.Vector3(0, 1, 0).applyQuaternion(rest), nd = new THREE.Vector3(d0.x, d0.y, 0).normalize();
      const th0 = Math.atan2(nd.y, nd.x);
      toe[n] = { b, rest, qn: new THREE.Quaternion().setFromUnitVectors(d0, nd), th0, local: b.quaternion.clone(), off: deg(th0 - info[foot].th0) };
    }

    // each palm's normal in its hand bone's frame: across the knuckles, on the side the fingers curl to
    const palm = {};
    for (const sd of ["r", "l"]) {
      const w = n => bones[n + "_" + sd].getWorldPosition(new THREE.Vector3()), I = info["hand_" + sd];
      const n = new THREE.Vector3(0, 1, 0).applyQuaternion(I.rest).cross(w("pinky_01").sub(w("index_01"))).normalize();
      if (n.dot(w("middle_03").sub(w("middle_01"))) < 0) n.negate();
      palm["hand_" + sd] = n.applyQuaternion(I.rest.clone().invert());
    }
    const DOWN = new THREE.Vector3(0, -1, 0), vc = new THREE.Vector3(), qI = new THREE.Quaternion();
    const thumb = { hand_r: { b: bones.thumb_01_r, rest: bones.thumb_01_r.quaternion.clone() }, hand_l: { b: bones.thumb_01_l, rest: bones.thumb_01_l.quaternion.clone() } };
    // the fingers of a hand on the mat straighten out from their relaxed curl
    const fingers = { hand_r: [], hand_l: [] };
    for (const sd of ["r", "l"]) for (const f of ["index", "middle", "ring", "pinky", "thumb"]) for (const i of ["01", "02", "03"]) {
      if (f === "thumb" && i === "01") continue; // laid into the palm's plane in apply()
      const b = bones[`${f}_${i}_${sd}`], rest = b.quaternion.clone();
      const y = new THREE.Vector3(0, 1, 0).applyQuaternion(rest);
      fingers["hand_" + sd].push({ b, rest, flat: new THREE.Quaternion().setFromUnitVectors(y, new THREE.Vector3(0, 1, 0)).multiply(rest) });
    }

    function setWorld(I, a) { // point a bone along angle a (degrees) in the side view
      qz.setFromAxisAngle(Z, rad(a) - I.th0);
      q1.copy(qz).multiply(I.qn).multiply(I.rest);
      I.b.parent.getWorldQuaternion(q2).invert();
      I.b.quaternion.copy(q2.multiply(q1));
      I.b.updateMatrixWorld(true);
    }
    function apply(r, tw) {
      for (const I of order) setWorld(I, DRIVE[I.b.name](r));
      // weight-bearing hands lie flat, fingers forward, palm turned to the mat
      // (a hand stays flat until it is well clear of the mat, so its fingers never dip into it)
      for (const [hn, fore, k0] of [["hand_r", r.a[1], c01((8 - tw.up.handR) / 5)], ["hand_l", r.A[1], c01((8 - tw.up.handL) / 5)]]) {
        const fa = w180(fore), k = k0 * c01(-Math.sin(rad(fa)) * 2 - 0.6);
        for (const F of fingers[hn]) F.b.quaternion.copy(F.rest).slerp(F.flat, k);
        const th = thumb[hn]; th.b.quaternion.copy(th.rest);
        if (k <= 0) continue;
        const I = info[hn];
        setWorld(I, fa * (1 - k)); // q1 is now the hand's world rotation
        va.set(0, 1, 0).applyQuaternion(q1); vb.copy(palm[hn]).applyQuaternion(q1); // along the hand, out of the palm
        const roll = Math.atan2(vc.crossVectors(vb, DOWN).dot(va), vb.dot(DOWN) - vb.dot(va) * DOWN.dot(va));
        q2.setFromAxisAngle(va, roll * k); q1.premultiply(q2);
        I.b.parent.getWorldQuaternion(q2).invert(); I.b.quaternion.copy(q2.multiply(q1)); I.b.updateMatrixWorld(true);
        // the thumb swings up level with the palm
        th.b.updateMatrixWorld(true);
        th.b.getWorldQuaternion(q1); va.set(0, 1, 0).applyQuaternion(q1); vb.copy(palm[hn]).applyQuaternion(I.b.getWorldQuaternion(q2));
        vc.copy(va).addScaledVector(vb, -va.dot(vb)).normalize();
        q2.setFromUnitVectors(va, vc).slerp(qI, 1 - k); q1.premultiply(q2);
        th.b.parent.getWorldQuaternion(q2).invert(); th.b.quaternion.copy(q2.multiply(q1)); th.b.updateMatrixWorld(true);
      }
      // weight-bearing toes on a steep foot bend up to lie flat on the mat
      for (const [n, f, k0] of [["ball_r", r.l[2], tw.footR], ["ball_l", r.L[2], tw.footL]]) {
        const T = toe[n], fa = w180(f), k = k0 * c01(-Math.sin(rad(fa)) * 2 - 0.8);
        if (k <= 0) { T.b.quaternion.copy(T.local); T.b.updateMatrixWorld(true); continue; }
        const nat = fa + T.off; // where the toes point with the foot as it is
        setWorld(T, nat + k * Math.min(90, Math.max(0, -nat)));
      }
    }
    const turn = (r, d) => ({ ...r, t: r.t + d, u: r.u + d, n: r.n + d,
      a: r.a.map(x => x + d), A: r.A.map(x => x + d), l: r.l.map(x => x + d), L: r.L.map(x => x + d) });
    const at = n => { bones[n].getWorldPosition(va); return [va.x, va.y]; };
    function ik2(A, T, l1, l2, b) { // two-bone IK in the side view, as in figure.js
      const dx = T[0] - A[0], dy = T[1] - A[1], d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
      const a1 = Math.atan2(dy, dx) + b * Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d))));
      const M = [A[0] + l1 * Math.cos(a1), A[1] + l1 * Math.sin(a1)];
      return [deg(a1), deg(Math.atan2(T[1] - M[1], T[0] - M[0]))];
    }
    const LIMBS = [["handR", null, "a", ["upperarm_r", "lowerarm_r", "hand_r"], -1], ["handL", null, "A", ["upperarm_l", "lowerarm_l", "hand_l"], -1],
      ["footR", "kneeR", "l", ["thigh_r", "calf_r", "foot_r"], 1], ["footL", "kneeL", "L", ["thigh_l", "calf_l", "foot_l"], 1]];
    const BODY = ["hips", "trunk", "head"], SUPPORT = ["handR", "handL", "footR", "footL", "kneeR", "kneeL"];

    function pose(r0, breath) {
      const tw = touch(r0);
      root.position.set(0, 0, 0);
      const s = 1 + breath * 0.015; bones.spine_03.scale.set(s, 1, s); // breathing
      let r = r0;
      apply(r, tw); let m = measure();
      const body = BODY.filter(p => tw[p] >= 0.5);
      // a knee on the mat carries the leg; its foot is then laid down by swinging the shin
      const sup = SUPPORT.filter(p => tw[p] > 0 && !(p === "footR" && tw.kneeR > 0) && !(p === "footL" && tw.kneeL > 0));
      const strong = sup.filter(p => tw[p] >= 0.5);
      if (!body.length && strong.length) {
        // held up on hands, knees or feet: tip the whole body so the outermost hand, knee or foot ends
        // sit at the same heights as in the 2D pose (on the mat, or as far above it), fading out from 5 units up
        const ends = SUPPORT.filter(p => tw.up[p] < 10 && !(p === "footR" && tw.kneeR > 0) && !(p === "footL" && tw.kneeL > 0));
        const fade = p => c01((10 - tw.up[p]) / 5), hgt = p => m[p].y - Math.max(0, tw.up[p]);
        for (let it = 0; it < 2 && ends.length > 1; it++) {
          // the outermost ends; of two at much the same place, the one nearer the mat
          const x0 = Math.min(...ends.map(p => m[p].x)), x1 = Math.max(...ends.map(p => m[p].x));
          const pick = near => ends.filter(near).reduce((q, p) => tw.up[p] < tw.up[q] ? p : q);
          const a = pick(p => m[p].x < x0 + 15), b = pick(p => m[p].x > x1 - 15);
          const dx = m[b].x - m[a].x;
          if (dx < 20) break;
          const d = -deg(Math.atan2(hgt(b) - hgt(a), dx)) * Math.min(fade(a), fade(b));
          if (Math.abs(d) < 0.05) break;
          r = turn(r, Math.max(-12, Math.min(12, d))); apply(r, tw); m = measure();
        }
      }
      // then each limb reaches the mat if it should touch, and comes up out of it if it sinks
      const ground = Math.min(...(body.length ? body : strong.length ? strong : sup.length ? sup : PARTS).map(p => m[p].y));
      let nr = null;
      const lift = (part, w) => { const gap = m[part].y - ground; return gap > 0 ? -gap * w : -gap; }; // how far to move a part
      // turn a pose angle about a pivot so that a point at x moves up by dy
      const swing = (pivot, x, dy) => Math.abs(x - pivot[0]) < 8 ? 0 : deg(Math.asin(Math.max(-0.5, Math.min(0.5, dy / (x - pivot[0])))));
      // an upper back that should rest on the mat tips down to it at the waist, before the arms are placed
      // (full within 2 units of the mat in the 2D pose, fading out by 4, so it eases in and out as the back curls)
      const wt = c01((4 - tw.up.trunk) / 2) * Math.max(tw.hips, tw.head);
      if (wt > 0) {
        const want = (ground - m.trunk.y) * wt, sw = Math.max(-12, Math.min(12, swing(at("spine_02"), m.trunk.x, want)));
        if (sw) {
          const r1 = { ...r, u: r.u + sw }; apply(r1, tw); const m1 = measure();
          // on a steep back the swing can roll a different part of it down; keep it only if it helped
          if (Math.abs(m.trunk.y + want - m1.trunk.y) < Math.abs(want)) { r = r1; m = m1; } else apply(r, tw);
        }
      }
      for (const [foot, knee, key, ch, b] of LIMBS) {
        const A = at(ch[0]), B = at(ch[1]), C = at(ch[2]), l1 = Math.hypot(B[0] - A[0], B[1] - A[1]);
        if (knee && tw[knee] > 0 && tw[knee] >= tw[foot]) {
          // knee down: swing the thigh, then the shin so the foot lies on the mat too
          const dk = lift(knee, tw[knee]);
          const th = Math.atan2(B[1] - A[1], B[0] - A[0]), sn = Math.max(-1, Math.min(1, (B[1] + dk - A[1]) / l1));
          const th2 = Math.abs(dk) < 0.2 ? deg(th) : deg(Math.cos(th) >= 0 ? Math.asin(sn) : Math.PI - Math.asin(sn));
          const g = m[foot].y + dk - ground, df = g > 0 ? -g * tw[foot] : -g;
          const sw = Math.abs(df) < 0.2 ? 0 : swing([B[0], B[1] + dk], m[foot].x, df);
          if (Math.abs(dk) < 0.2 && !sw) continue;
          nr = nr || { ...r };
          nr[key] = [th2, r[key][1] + sw, r[key][2] + sw];
        } else {
          const dy = lift(foot, tw[foot]);
          if (Math.abs(dy) < 0.2) continue;
          nr = nr || { ...r };
          const [a1, a2] = ik2(A, [C[0], C[1] + dy], l1, Math.hypot(C[0] - B[0], C[1] - B[1]), b);
          nr[key] = key === "a" || key === "A" ? [a1, a2] : [a1, a2, r[key][2]];
        }
      }
      // a head that should rest on the mat tips down to it at the neck
      if ((body.length > 1 || wt > 0) && tw.head >= 0.5) {
        const dh = lift("head", tw.head), sw = Math.abs(dh) < 0.3 ? 0 : swing(at("neck_01"), m.head.x, dh);
        if (sw) { nr = nr || { ...r }; nr.n = r.n + sw; }
      }
      if (nr) { r = nr; apply(r, tw); m = measure(); }
      // hips where the pose says, the lowest skin on the mat
      bones.thigh_r.getWorldPosition(va); bones.thigh_l.getWorldPosition(vb); va.add(vb).multiplyScalar(0.5);
      root.position.set(r0.px - va.x, -Math.min(...PARTS.map(p => m[p].y)), -va.z);
      root.updateMatrixWorld(true);
      restHands(r0, tw);
    }

    // ---- hands resting on the body ----
    // The side-view angles can't reach across the body, so a hand on the belly of a figure lying on its
    // back is placed in 3D: wrist on the lower ribs, fingers towards the navel, elbow relaxed out to the side.
    const rv = () => new THREE.Vector3();
    const rS = rv(), rE = rv(), rH = rv(), rT = rv(), rD = rv(), rP = rv(), rF = rv(), rN = rv(), rC = rv();
    const rq = new THREE.Quaternion(), rq2 = new THREE.Quaternion();
    function pointBone(b, from, to, k) { // turn a bone so that its direction "from" becomes "to", by k
      const old = b.quaternion.clone();
      b.getWorldQuaternion(rq).premultiply(rq2.setFromUnitVectors(from, to));
      b.parent.getWorldQuaternion(rq2).invert();
      b.quaternion.copy(old.slerp(rq2.multiply(rq), k)); b.updateMatrixWorld(true);
    }
    function skinTop(points) { // highest hip or trunk skin near each [x, z]
      const top = points.map(() => -Infinity), hips = PARTS.indexOf("hips"), trunk = PARTS.indexOf("trunk");
      skins.forEach((B, s) => {
        const pos = B.geometry.attributes.position, S = samples[s];
        for (let j = 0; j < S.length; j += 2) {
          if (S[j + 1] !== hips && S[j + 1] !== trunk) continue;
          vb.fromBufferAttribute(pos, S[j]); B.boneTransform(S[j], vb); vb.applyMatrix4(B.matrixWorld);
          points.forEach((p, i) => { if (Math.abs(vb.x - p[0]) < 2.5 && Math.abs(vb.z - p[1]) < 2.5 && vb.y > top[i]) top[i] = vb.y; });
        }
      });
      return top;
    }
    function restHands(r0, tw) {
      const j = joints(r0);
      if (tw.hips <= 0) return;
      for (const [sd, Hd] of [["r", j.a.Hd], ["l", j.A.Hd]]) {
        const k = tw.hips * onBody(r0, j, Hd);
        if (k <= 0) continue;
        const U = bones["upperarm_" + sd], L = bones["lowerarm_" + sd], H = bones["hand_" + sd];
        U.getWorldPosition(rS); L.getWorldPosition(rE); H.getWorldPosition(rH);
        const l1 = rS.distanceTo(rE), l2 = rE.distanceTo(rH);
        bones.spine_02.getWorldPosition(rC);
        const side = Math.sign(rS.z - rC.z) || 1, wx = rC.x - 3, wz = rC.z + side * 10;
        rF.set(0.45, 0, -side * 0.89).normalize();  // fingers towards the navel
        const [tw0, tw1] = skinTop([[wx, wz], [wx + rF.x * 12, wz + rF.z * 12]]);
        if (!isFinite(tw0) || !isFinite(tw1)) continue;
        rT.set(wx, tw0 + 2.2, wz);
        rF.y = (tw1 - tw0) / 12; rF.normalize();    // along the curve of the belly
        // two-bone reach, the elbow relaxed outwards and down
        rD.subVectors(rT, rS); const d = Math.min(rD.length(), l1 + l2 - 0.01); rD.normalize();
        const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
        rP.set(-0.15, -0.45, side * 0.88); rP.addScaledVector(rD, -rP.dot(rD)).normalize();
        const E = rS.clone().addScaledVector(rD, a).addScaledVector(rP, h);
        pointBone(U, rE.clone().sub(rS).normalize(), E.clone().sub(rS).normalize(), k);
        L.getWorldPosition(rE); H.getWorldPosition(rH);
        pointBone(L, rH.clone().sub(rE).normalize(), rT.clone().sub(rE).normalize(), k);
        // the hand lies along the belly, palm down
        H.getWorldQuaternion(rq); pointBone(H, rN.set(0, 1, 0).applyQuaternion(rq).clone(), rF, k);
        H.getWorldQuaternion(rq); const ax = rN.set(0, 1, 0).applyQuaternion(rq).clone(), pn = palm["hand_" + sd].clone().applyQuaternion(rq);
        const roll = Math.atan2(vc.crossVectors(pn, DOWN).dot(ax), pn.dot(DOWN) - pn.dot(ax) * DOWN.dot(ax));
        rq.premultiply(rq2.setFromAxisAngle(ax, roll * k)); H.parent.getWorldQuaternion(rq2).invert();
        H.quaternion.copy(rq2.multiply(rq)); H.updateMatrixWorld(true);
        for (const F of fingers["hand_" + sd]) { F.b.quaternion.copy(F.rest).slerp(F.flat, k * 0.7); F.b.updateMatrixWorld(true); }
      }
    }

    // camera: a three-quarter view framed on everything the exercise does
    const AZ = rad(42), EL = rad(13), target = new THREE.Vector3();
    let box = null, w = 0, h = 0;
    function fit(keys) {
      let x0 = Infinity, x1 = -Infinity, y1 = 0;
      for (const r of keys) {
        const j = joints(r), dy = Math.max(0, -lowest(j, r));
        for (const p of [j.P, j.S, j.Hc, j.a.Hd, j.A.Hd, j.l.T, j.L.T, j.l.K, j.a.E]) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1] + dy); }
        y1 = Math.max(y1, j.Hc[1] + dy + HR * 1.4);
      }
      box = { cx: (x0 + x1) / 2, w: x1 - x0 + 40, h: y1 + 16 };
      matMesh.position.x = box.cx;
      key.target.position.set(box.cx, 0, 0); key.position.set(box.cx + 80, 220, 160);
      aim();
    }
    function aim() {
      if (!box || !w) return;
      camera.aspect = w / h; camera.updateProjectionMatrix();
      const vf = rad(camera.fov) / 2;
      const dist = Math.max(box.h / (2 * Math.tan(vf)), box.w * 0.9 / (2 * Math.tan(vf) * camera.aspect)) * 1.04 + 40;
      target.set(box.cx, box.h * 0.42, 0);
      camera.position.set(target.x + dist * Math.sin(AZ) * Math.cos(EL), target.y + dist * Math.sin(EL), target.z + dist * Math.cos(AZ) * Math.cos(EL));
      camera.lookAt(target);
    }
    function resize() {
      const nw = canvas.clientWidth, nh = canvas.clientHeight;
      if (!nw || !nh || (nw === w && nh === h)) return false;
      w = nw; h = nh; renderer.setSize(w, h, false); aim(); return true;
    }
    function draw() { if (box && w) renderer.render(scene, camera); }
    return { canvas, pose, fit, resize, draw };
  }

  // ---- animation (as figure.js, plus a pause at each end, follow-through and breathing) ----
  const smoother = k => k * k * k * (k * (k * 6 - 15) + 10);
  function frameAt(keys, cyc, t) {
    if (keys.length === 1) return keys[0];
    const n = keys.length, pos = ((t % cyc) + cyc) % cyc / cyc * n, i = Math.floor(pos);
    const k = smoother(Math.min(1, Math.max(0, (pos - i - 0.12) / 0.76)));
    return Figure.mix(keys[i], keys[(i + 1) % n], k);
  }

  function mount(el, ex, { mirror = false, paused = false } = {}) {
    const flat = Figure.mount(el, ex, { mirror, paused }); // shows at once; replaced when 3D is ready
    let alive = true, isPaused = paused, raf = 0, t = 0, last = null, E = null, ro = null;
    const keys = ex.poses.map(Figure.resolve), cyc = ex.cyc || 4;
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const still = keys[ex.key ?? (keys.length > 1 ? 1 : 0)];
    // arms trail slightly behind the body only when they aren't planted or holding something
    const lag = ex.poses.every(p => [p.a, p.A].every(s => !s || Array.isArray(s) || s.at));

    function render() {
      let r, breath = 0;
      if (reduce || keys.length < 2) r = still;
      else {
        r = frameAt(keys, cyc, t);
        breath = Math.sin(t * 2 * Math.PI / 5);
        if (lag) {
          const ra = frameAt(keys, cyc, t - cyc * 0.05), rf = frameAt(keys, cyc, t - cyc * 0.09);
          r = { ...r, a: [ra.a[0], rf.a[1]], A: [ra.A[0], rf.A[1]] };
        }
        r = { ...r, n: frameAt(keys, cyc, t - cyc * 0.03).n + breath * 1.2, u: r.u + breath * 0.8 };
      }
      E.pose(r, breath); E.draw();
    }
    function loop(now) {
      if (!alive) return;
      raf = 0;
      if (last != null) t += Math.min(0.05, (now - last) / 1000);
      last = now; render();
      if (!isPaused && !reduce) raf = requestAnimationFrame(loop);
    }
    function start() {
      if (alive && E && !raf && !isPaused && !reduce) { last = null; raf = requestAnimationFrame(loop); }
    }

    load().then(engine => {
      if (!alive) return;
      E = engine; flat.stop();
      el.innerHTML = ""; el.appendChild(E.canvas);
      E.canvas.style.transform = mirror ? "scaleX(-1)" : "";
      E.resize(); E.fit(keys); render(); start();
      ro = new ResizeObserver(() => { if (E.resize()) render(); }); ro.observe(E.canvas);
    }, () => {}); // no WebGL or no model: the 2D figure stays

    return {
      setPaused(p) {
        isPaused = p; flat.setPaused(p);
        if (p) { cancelAnimationFrame(raf); raf = 0; } else start();
      },
      stop() { alive = false; cancelAnimationFrame(raf); flat.stop(); if (ro) ro.disconnect(); },
    };
  }

  window.Figure3D = { mount, load };
})();
