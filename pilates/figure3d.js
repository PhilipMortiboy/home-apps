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
    const CONTACT = [["Head", 0.11], ["neck_01", 0.07], ["spine_03", 0.12], ["spine_02", 0.11], ["pelvis", 0.13], ["thigh_r", 0.09], ["thigh_l", 0.09],
      ["calf_r", 0.06], ["calf_l", 0.06], ["foot_r", 0.05], ["foot_l", 0.05], ["ball_r", 0.03], ["ball_l", 0.03],
      ["lowerarm_r", 0.045], ["lowerarm_l", 0.045], ["hand_r", 0.035], ["hand_l", 0.035]];
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
    info.hand_r.d0 = info.lowerarm_r.d0.clone(); info.hand_l.d0 = info.lowerarm_l.d0.clone();
    for (const k in info) { // each bone's rest direction swung into the side-view plane
      const d0 = info[k].d0, flat = new THREE.Vector3(d0.x, d0.y, 0);
      const nd = flat.length() > 0.35 ? flat.normalize() : new THREE.Vector3(0, -1, 0);
      info[k].qn = new THREE.Quaternion().setFromUnitVectors(d0, nd);
      info[k].th0 = Math.atan2(nd.y, nd.x);
    }
    const order = []; model.traverse(o => { if (info[o.name]) order.push(info[o.name]); });
    const skins = []; model.traverse(o => { if (o.isSkinnedMesh && o.material !== mat.hair) skins.push(o); });

    function joints(r) {
      const P = [r.px, r.py], W = add(P, dir(r.t), LEN.lt), S = add(W, dir(r.u), LEN.ut);
      const Hc = add(add(S, dir(r.n), NECK), dir(r.n), HR);
      const arm = a => { const E = add(S, dir(a[0]), LEN.ua); return { E, Hd: add(E, dir(a[1]), LEN.fa) }; };
      const leg = l => { const K = add(P, dir(l[0]), LEN.th), Ak = add(K, dir(l[1]), LEN.sh); return { K, Ak, T: add(Ak, dir(l[2]), LEN.ft) }; };
      return { P, S, Hc, a: arm(r.a), A: arm(r.A), l: leg(r.l), L: leg(r.L) };
    }
    function lowest(j) {
      let m = Infinity; const c = (p, rr) => { m = Math.min(m, p[1] - rr); };
      c(j.P, 10); c(j.S, 9); c(j.Hc, HR);
      for (const s of [j.a, j.A]) { c(s.E, 4); c(s.Hd, 4); }
      for (const s of [j.l, j.L]) { c(s.K, 6); c(s.Ak, 4.5); c(s.T, 3.4); }
      return m;
    }

    function pose(r, breath) {
      for (const I of order) {
        qz.setFromAxisAngle(Z, rad(DRIVE[I.b.name](r)) - I.th0);
        q1.copy(qz).multiply(I.qn).multiply(I.rest);
        I.b.parent.getWorldQuaternion(q2).invert();
        I.b.quaternion.copy(q2.multiply(q1));
        I.b.updateMatrixWorld(true);
      }
      // hips where the pose says, lowest point on the mat
      root.position.set(0, 0, 0); root.updateMatrixWorld(true);
      bones.thigh_r.getWorldPosition(va); bones.thigh_l.getWorldPosition(vb); va.add(vb).multiplyScalar(0.5);
      let low = Infinity;
      for (const [n, rr] of CONTACT) { bones[n].getWorldPosition(vb); low = Math.min(low, vb.y - rr * SC); }
      root.position.set(r.px - va.x, -low, -va.z);
      // hands near the mat lie flat, fingers forward, palm down
      for (const [hn, fore, sgn] of [["hand_r", r.a[1], 1], ["hand_l", r.A[1], -1]]) {
        const I = info[hn]; I.b.getWorldPosition(vb);
        const fa = ((fore % 360) + 540) % 360 - 180;
        const k = Math.min(1, Math.max(0, (10 - (vb.y + root.position.y)) / 6)) * Math.min(1, Math.max(0, -Math.sin(rad(fa)) * 2 - 0.6));
        if (k <= 0) continue;
        qz.setFromAxisAngle(Z, rad(fa * (1 - k)) - I.th0);
        q1.copy(qz).multiply(I.qn).multiply(I.rest);
        q2.setFromAxisAngle(va.set(1, 0, 0), -sgn * Math.PI / 2 * k); q1.premultiply(q2);
        I.b.parent.getWorldQuaternion(q2).invert(); I.b.quaternion.copy(q2.multiply(q1));
      }
      const s = 1 + breath * 0.015; bones.spine_03.scale.set(s, 1, s); // breathing
      // settle the skin itself onto the mat
      root.updateMatrixWorld(true);
      let m = Infinity;
      for (const B of skins) {
        const pos = B.geometry.attributes.position;
        for (let i = 0; i < pos.count; i += 4) { vb.fromBufferAttribute(pos, i); B.boneTransform(i, vb); vb.applyMatrix4(B.matrixWorld); if (vb.y < m) m = vb.y; }
      }
      root.position.y -= m;
      root.updateMatrixWorld(true);
    }

    // camera: a three-quarter view framed on everything the exercise does
    const AZ = rad(42), EL = rad(13), target = new THREE.Vector3();
    let box = null, w = 0, h = 0;
    function fit(keys) {
      let x0 = Infinity, x1 = -Infinity, y1 = 0;
      for (const r of keys) {
        const j = joints(r), dy = Math.max(0, -lowest(j));
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
