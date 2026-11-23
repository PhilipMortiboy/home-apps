/* Tresza's Training — 3D lesson figure.
 * A skinned MakeHuman model (model/tresza_mh.json) whose bones follow the same pose
 * angles as the 2D figure in figure.js. Same API as Figure.mount: returns
 * { setPaused, stop }. Figure3D.preload() starts the loading and first-time work quietly
 * when the app opens; prepare() (the lesson's loading screen) joins or finishes it. mount()
 * never loads anything, so a figure can't pop in mid-lesson. Until prepare() has succeeded, mount() shows the 2D figure.
 * Needs figure.js loaded first. three.js is loaded by prepare() from vendor/. */
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

  // ---- loading (once; a failed or cancelled load can be tried again) ----
  // sizes are only for the progress bar (unpacked bytes, as a fetch stream reports them)
  const ASSETS = [
    { f: "vendor/three.min.js", size: 607784 }, { f: "vendor/GLTFLoader.js", size: 103311 },
    { f: "model/tresza_mh.json", size: 1600622 }, { f: "model/hair.png", size: 740648, tex: "hair" },
    { f: "model/eye.png", size: 66425, tex: "eyes" }, { f: "model/brows.png", size: 27213, tex: "brows" },
    { f: "model/lashes.png", size: 41956, tex: "lashes" },
  ];
  const NO_DATA_MS = 25000, NO_DATA_CACHED_MS = 5000; // give up on a silent connection (sooner if we hold a saved copy)
  const stopIf = signal => { if (signal.aborted) throw new DOMException("Cancelled", "AbortError"); };
  const pause = (ms = 0) => new Promise(ok => setTimeout(ok, ms)); // lets the phone draw and respond to taps
  let files = {}, scripts = {}, built = null;

  // One file as a Blob, kept so a retry resumes from what already arrived. If the network
  // fails or goes quiet, falls back to the copy the service worker saved.
  async function grab(a, signal, onBytes) {
    if (files[a.f]) { onBytes(a.size); return files[a.f]; }
    // the saved copy of this exact version needs no network at all
    const v = (window.ASSET_VERSIONS || {})[a.f], url = v ? `${a.f}?v=${v}` : a.f;
    let saved = null;
    try {
      if (window.caches) {
        const exact = v ? await caches.match(url) : null;
        if (exact) { files[a.f] = await exact.blob(); onBytes(a.size); return files[a.f]; }
        saved = await caches.match(a.f, { ignoreSearch: true }); // an older version: the fallback if the network fails
      }
    } catch (e) {}
    stopIf(signal);
    const ctl = new AbortController(), onStop = () => ctl.abort();
    signal.addEventListener("abort", onStop);
    let timer = 0;
    const watch = () => {
      clearTimeout(timer);
      timer = setTimeout(() => { if (document.hidden) watch(); else ctl.abort(); }, saved ? NO_DATA_CACHED_MS : NO_DATA_MS);
    };
    try {
      watch();
      const res = await fetch(url, { signal: ctl.signal });
      if (!res.ok) throw new Error(a.f + " HTTP " + res.status);
      if (res.body) {
        const rd = res.body.getReader(), parts = [];
        for (let got = 0;;) {
          const { done, value } = await rd.read();
          if (done) break;
          parts.push(value); got += value.length; watch(); onBytes(Math.min(got, a.size));
        }
        files[a.f] = new Blob(parts);
      } else files[a.f] = await res.blob();
    } catch (e) {
      stopIf(signal);
      if (!saved) throw e;
      files[a.f] = await saved.blob();
    } finally {
      clearTimeout(timer); signal.removeEventListener("abort", onStop);
    }
    onBytes(a.size);
    return files[a.f];
  }
  function runScript(f) {
    if (!scripts[f]) {
      const url = URL.createObjectURL(files[f]);
      scripts[f] = script(url).finally(() => URL.revokeObjectURL(url));
      scripts[f].catch(() => { delete scripts[f]; });
    }
    return scripts[f];
  }
  function texture(a) {
    const url = URL.createObjectURL(files[a.f]);
    return new Promise((ok, bad) => new THREE.TextureLoader().load(url, ok, undefined, () => bad(new Error(a.f))))
      .finally(() => URL.revokeObjectURL(url));
  }
  async function load(signal, report) {
    if (built) return built;
    if (!webgl()) throw Object.assign(new Error("no WebGL"), { noWebGL: true });
    const total = ASSETS.reduce((n, a) => n + a.size, 0), got = {};
    // let every file finish even if one fails, so "Try again" only has to fetch the failed ones
    const results = await Promise.allSettled(ASSETS.map(a => grab(a, signal, n => {
      got[a.f] = n; report("download", Object.values(got).reduce((x, y) => x + y, 0) / total);
    })));
    stopIf(signal);
    const failed = results.find(r => r.status === "rejected");
    if (failed) throw failed.reason;
    report("build", 0); await pause();
    if (!window.THREE) await runScript("vendor/three.min.js");
    if (!THREE.GLTFLoader) await runScript("vendor/GLTFLoader.js");
    stopIf(signal);
    const tex = {};
    await Promise.all(ASSETS.filter(a => a.tex).map(async a => { tex[a.tex] = await texture(a); }));
    const g = JSON.parse(await files["model/tresza_mh.json"].text());
    stopIf(signal); await pause();
    const gltf = await parse(g);
    stopIf(signal); await pause();
    if (built) return built; // an earlier attempt got there first
    built = engine(gltf, tex);
    built.canvas.addEventListener("webglcontextlost", () => { preparedEx = new WeakSet(); }); // iOS can drop it in the background
    files = {}; // the engine holds what it needs
    return built;
  }

  // The one download-and-build in progress, shared by the quiet preload and the loading screen.
  let job = null;
  function engineJob() {
    if (!job) {
      const j = job = { ctrl: new AbortController(), last: null, subs: new Set() };
      j.promise = load(j.ctrl.signal, (stage, k) => { j.last = [stage, k]; j.subs.forEach(f => f(stage, k)); })
        .finally(() => { if (job === j) job = null; });
      j.promise.catch(() => {});
    }
    return job;
  }
  // after iOS drops the graphics context, wait for it to come back before drawing
  async function restored(E) {
    if (!E.lost()) return;
    await new Promise(ok => {
      const done = () => { clearTimeout(t); E.canvas.removeEventListener("webglcontextrestored", done); ok(); };
      const t = setTimeout(done, 5000);
      E.canvas.addEventListener("webglcontextrestored", done);
    });
    if (E.lost()) throw new Error("graphics context lost");
  }

  // Everything a lesson's figure needs, done before the lesson starts: downloads, the model,
  // shaders and textures (compiled and uploaded by the first draw) and each exercise's poses.
  // el must be on the page and laid out. onProgress(stage, 0..1); stage is "download" or "prepare".
  let preparedEx = new WeakSet(), bg = null;
  const isPrepared = exercises => !!built && !built.lost() && exercises.every(ex => preparedEx.has(ex));
  async function prepare(exercises, el, { signal, onProgress = () => {} }) {
    if (bg) bg.stop = true; // the loading screen takes over from the quiet preload
    const DL = 0.8, BUILD = 0.05;
    const report = (stage, k) => onProgress(stage === "download" ? "download" : "prepare",
      stage === "download" ? k * DL : stage === "build" ? DL : DL + BUILD + k * (1 - DL - BUILD));
    let E = built;
    if (!E) {
      const j = engineJob(), cancel = () => { j.ctrl.abort(); if (job === j) job = null; };
      signal.addEventListener("abort", cancel);
      j.subs.add(report);
      if (j.last) report(...j.last); // carry on from wherever the preload has got to
      try { E = await j.promise; }
      finally { j.subs.delete(report); signal.removeEventListener("abort", cancel); }
    }
    stopIf(signal);
    await restored(E);
    stopIf(signal);
    el.innerHTML = ""; el.appendChild(E.canvas); E.canvas.style.transform = ""; E.resize();
    const todo = exercises.filter(ex => !preparedEx.has(ex));
    const poses = todo.reduce((n, ex) => n + ex.poses.length, 0);
    let done = 0;
    report("poses", 0); await pause();
    stopIf(signal);
    for (const ex of todo) {
      const keys = ex.poses.map(Figure.resolve);
      E.fit(keys);
      for (const r of keys) {
        E.pose(r, 0); E.draw();
        report("poses", ++done / poses);
        await pause(); stopIf(signal);
      }
      preparedEx.add(ex);
    }
    report("poses", 1);
  }

  // The same work, unseen, while she's on the home screen. Failures are silent:
  // the loading screen tries again and explains if she starts the lesson.
  async function preload(exercises) {
    if (bg || isPrepared(exercises)) return;
    const me = bg = { stop: false };
    let host = null;
    try {
      const E = built || await engineJob().promise;
      if (me.stop) return;
      await restored(E);
      if (me.stop) return;
      host = document.createElement("div"); host.className = "fig3d-host"; host.setAttribute("aria-hidden", "true");
      document.body.appendChild(host); host.appendChild(E.canvas);
      E.canvas.style.transform = ""; E.resize();
      for (const ex of exercises) {
        if (preparedEx.has(ex)) continue;
        const keys = ex.poses.map(Figure.resolve);
        E.fit(keys);
        for (const r of keys) {
          E.pose(r, 0); E.draw();
          await pause(20); // gentler than the loading screen: she may be scrolling
          if (me.stop) return;
        }
        preparedEx.add(ex);
      }
    } catch (e) {
    } finally {
      if (bg === me) bg = null;
      if (host) host.remove();
    }
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
  function engine(gltf, tex) {
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
    for (const k in tex) { tex[k].encoding = THREE.sRGBEncoding; tex[k].flipY = false; mat[k].map = tex[k]; }
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
    root.rotation.order = "ZYX"; // the side poses roll first, then tip
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

    const ARM_OUT = 10; // degrees
    function setWorld(I, a) { // point a bone along angle a (degrees) in the side view
      qz.setFromAxisAngle(Z, rad(a) - I.th0);
      q1.copy(qz).multiply(I.qn).multiply(I.rest);
      I.b.parent.getWorldQuaternion(q2).invert();
      I.b.quaternion.copy(q2.multiply(q1));
      I.b.updateMatrixWorld(true);
    }
    function apply(r, tw) {
      for (const I of order) setWorld(I, DRIVE[I.b.name](r));
      // a foot planted on the mat lies with its sole flat: the ankle-to-toe bone slopes down in a flat foot,
      // so a level pose angle would tip the toes up (lifted heels, tiptoes and pointed feet are left alone)
      const flat = {};
      for (const [n, f, up] of [["foot_r", r.l[2], tw.up.footR], ["foot_l", r.L[2], tw.up.footL]]) {
        const fa = w180(f), k = c01((9 - up) / 3) * c01((45 - Math.abs(fa)) / 15), I = info[n];
        flat[n] = { k, fa: fa + k * (deg(I.th0) - fa) };
        if (k > 0) setWorld(I, flat[n].fa);
      }
      // straight arms long by the sides angle slightly out, so the hands sit beside the hips rather than in them
      // (fading out as an arm lifts away from the body or bends to hold a leg or a hip)
      // (a hand on the mat counts further from the trunk's line, as the hips rise off the mat in a bridge)
      for (const [sd, a, out, up] of [["r", r.a, 1, tw.up.handR], ["l", r.A, -1, tw.up.handL]]) {
        const c = Math.cos(rad(a[0] - (r.t + r.u) / 2 - 180));
        const k = Math.max(c01((c - 0.891) / 0.087), c01((c - 0.75) / 0.12) * c01((6 - up) / 3)) * c01((Math.cos(rad(a[1] - a[0])) - 0.85) / 0.1);
        if (k <= 0) continue;
        const U = info["upperarm_" + sd].b;
        va.set(Math.cos(rad(a[0])), Math.sin(rad(a[0])), 0);
        vb.copy(va).addScaledVector(Z, out * Math.tan(rad(ARM_OUT)) * k).normalize();
        q2.setFromUnitVectors(va, vb); U.getWorldQuaternion(q1).premultiply(q2);
        U.parent.getWorldQuaternion(q2).invert(); U.quaternion.copy(q2.multiply(q1)); U.updateMatrixWorld(true);
      }
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
      for (const [n, F, k0] of [["ball_r", flat.foot_r, tw.footR], ["ball_l", flat.foot_l, tw.footL]]) {
        const T = toe[n], fa = F.fa, k = k0 * (1 - F.k) * c01(-Math.sin(rad(fa)) * 2 - 0.8);
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

    function pose(r0, breath, lie, finish, beat) {
      if (finish && finish.blend) return poseBlend(finish, breath, lie, beat);
      if (finish && finish.plant && !pins.has(finish)) capturePins(finish, lie);
      root.position.set(0, 0, 0); root.rotation.set(0, 0, 0);
      const s = 1 + breath * 0.015; bones.spine_03.scale.set(s, 1, s); // breathing
      if (lie === "side") return poseOnSide(r0);
      if (lie === "side-plank") return poseSidePlank(r0);
      const tw = touch(r0);
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
      if (finish && finish.plant) {
        if (finish.then) FINISH[finish.then](beat);
        holdPins(finish); settle();
      } else if (finish) { FINISH[finish](beat); settle(); }
    }
    // ---- moves that lift a limb off the mat ----
    // The contact solver changes its mind as a hand or knee leaves the mat, which shakes the body.
    // An exercise with "blend" solves only its key poses and turns every joint smoothly between them.
    const blends = new Map();
    function poseBlend(spec, breath, lie, beat) {
      let K = blends.get(spec);
      if (!K) {
        K = spec.keys.map(p => {
          pose(Figure.resolve(p), 0, lie);
          return { p: root.position.clone(), q: root.quaternion.clone(), b: Object.values(bones).map(b => b.quaternion.clone()) };
        });
        blends.set(spec, K);
      }
      const i = Math.max(0, beat ? beat.i : 0), k = beat ? beat.k : 0, A = K[i], B = K[(i + 1) % K.length];
      root.position.lerpVectors(A.p, B.p, k); root.quaternion.slerpQuaternions(A.q, B.q, k);
      Object.values(bones).forEach((b, j) => b.quaternion.slerpQuaternions(A.b[j], B.b[j], k));
      const s = 1 + breath * 0.015; bones.spine_03.scale.set(s, 1, s);
      root.updateMatrixWorld(true); settle();
    }
    // ---- hands and feet that stay planted ----
    // An exercise's "plant" names the ends that keep the place and angle they have in its reference pose;
    // the rest of the limb bends to meet them, whatever the body does.
    const pins = new Map(), PIN_ENDS = { hands: ["hand", "lowerarm", "upperarm"], feet: ["foot", "calf", "thigh"] };
    function capturePins(spec, lie) {
      pose(Figure.resolve(spec.from), 0, lie);
      const rec = [];
      for (const part of spec.plant) for (const [sd, o] of [["r", 1], ["l", -1]]) {
        const [e, l, u] = PIN_ENDS[part].map(n => bones[n + "_" + sd]), kids = [];
        e.traverse(c => { if (c !== e && c.isBone) kids.push([c, c.quaternion.clone()]); });
        rec.push({ part, o, u, l, e, kids, p: e.getWorldPosition(new THREE.Vector3()), q: e.getWorldQuaternion(new THREE.Quaternion()) });
      }
      pins.set(spec, rec);
    }
    function holdPins(spec) {
      const rec = pins.get(spec);
      if (spec.plant.includes("hands")) { // arms that are being moved no longer hold the body up
        const m = measure();
        root.position.y -= Math.min(...["footR", "footL", "kneeR", "kneeL", "hips", "trunk", "head", "leg"].map(p => m[p].y));
        root.updateMatrixWorld(true);
      }
      for (const R of rec) {
        R.u.getWorldPosition(rS); R.l.getWorldPosition(rE); R.e.getWorldPosition(rH);
        const l1 = rS.distanceTo(rE), l2 = rE.distanceTo(rH);
        rD.subVectors(R.p, rS); const d = Math.min(rD.length(), l1 + l2 - 0.01); rD.normalize();
        const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
        // knees always bend to the front of the leg, so a nearly straight leg can't flip
        const bend = R.part === "feet" ? rP.set(-rD.y, rD.x, 0) : spec.elbowsOut ? rP.set(-0.2, 0.4, R.o) : rP.subVectors(rE, rS);
        const P = bend.clone().addScaledVector(rD, -bend.dot(rD));
        if (P.length() < 0.5) P.set(0, 0, R.o).addScaledVector(rD, -R.o * rD.z);
        P.normalize();
        const E = rS.clone().addScaledVector(rD, a).addScaledVector(P, h);
        pointBone(R.u, rE.clone().sub(rS).normalize(), E.sub(rS).normalize(), 1);
        R.l.getWorldPosition(rE); R.e.getWorldPosition(rH);
        pointBone(R.l, rH.clone().sub(rE).normalize(), R.p.clone().sub(rE).normalize(), 1);
        R.e.parent.getWorldQuaternion(rq2).invert(); R.e.quaternion.copy(rq2.multiply(R.q));
        for (const [c, q] of R.kids) c.quaternion.copy(q);
        R.e.updateMatrixWorld(true);
      }
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
        bones["upperarm_" + sd].getWorldPosition(rS); bones.spine_02.getWorldPosition(rC);
        const side = Math.sign(rS.z - rC.z) || 1, wx = rC.x - 3, wz = rC.z + side * 10;
        rF.set(0.45, 0, -side * 0.89).normalize();  // fingers towards the navel
        const [tw0, tw1] = skinTop([[wx, wz], [wx + rF.x * 12, wz + rF.z * 12]]);
        if (!isFinite(tw0) || !isFinite(tw1)) continue;
        rT.set(wx, tw0 + 2.2, wz);
        rF.y = (tw1 - tw0) / 12; rF.normalize();    // along the curve of the belly
        reachHand(sd, rT, rP.set(-0.15, -0.45, side * 0.88), rF, DOWN, k, 0.7); // elbow relaxed outwards and down
      }
    }
    // two-bone reach in 3D: wrist to T, elbow towards the pole, fingers along F, palm facing N
    function reachHand(sd, T, pole, F, N, k, flat) {
      const U = bones["upperarm_" + sd], L = bones["lowerarm_" + sd], H = bones["hand_" + sd];
      U.getWorldPosition(rS); L.getWorldPosition(rE); H.getWorldPosition(rH);
      const l1 = rS.distanceTo(rE), l2 = rE.distanceTo(rH);
      rD.subVectors(T, rS); const d = Math.min(rD.length(), l1 + l2 - 0.01); rD.normalize();
      const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
      const P = pole.clone().addScaledVector(rD, -pole.dot(rD)).normalize();
      const E = rS.clone().addScaledVector(rD, a).addScaledVector(P, h);
      pointBone(U, rE.clone().sub(rS).normalize(), E.clone().sub(rS).normalize(), k);
      L.getWorldPosition(rE); H.getWorldPosition(rH);
      pointBone(L, rH.clone().sub(rE).normalize(), T.clone().sub(rE).normalize(), k);
      H.getWorldQuaternion(rq); pointBone(H, rN.set(0, 1, 0).applyQuaternion(rq).clone(), F, k);
      H.getWorldQuaternion(rq); const ax = rN.set(0, 1, 0).applyQuaternion(rq).clone(), pn = palm["hand_" + sd].clone().applyQuaternion(rq);
      const roll = Math.atan2(vc.crossVectors(pn, N).dot(ax), pn.dot(N) - pn.dot(ax) * N.dot(ax));
      rq.premultiply(rq2.setFromAxisAngle(ax, roll * k)); H.parent.getWorldQuaternion(rq2).invert();
      H.quaternion.copy(rq2.multiply(rq)); H.updateMatrixWorld(true);
      for (const G of fingers["hand_" + sd]) { G.b.quaternion.copy(G.rest).slerp(G.flat, k * flat); G.b.updateMatrixWorld(true); }
    }

    // ---- lying on the side ----
    // The side-view angles can't turn the body to face the viewer, so the figure is posed flat, its limbs
    // are moved across the body in 3D, and the whole figure then rolls a quarter turn onto its right side:
    // head on the lower arm, legs stacked, top hand on the mat in front of the chest. The pose's near thigh
    // angle says how far the top leg lifts.
    const Y = new THREE.Vector3(0, 1, 0), NEAR = new THREE.Vector3(0, 0, 1);
    const NO_TOUCH = { up: { handR: 99, handL: 99, footR: 99, footL: 99 }, footR: 0, footL: 0 };
    function spin(n, axis, d) { // turn a bone by d degrees about a world axis
      const b = bones[n];
      b.getWorldQuaternion(rq).premultiply(rq2.setFromAxisAngle(axis, rad(d)));
      b.parent.getWorldQuaternion(rq2).invert();
      b.quaternion.copy(rq2.multiply(rq)); b.updateMatrixWorld(true);
    }
    const swingY = (n, d) => spin(n, Y, d); // + moves something pointing along +x towards -z
    function nearSide() { // how far each part reaches to the near side, which becomes the mat after the roll
      root.updateMatrixWorld(true);
      const z = {}; for (const p of PARTS) z[p] = -Infinity;
      skins.forEach((B, s) => {
        const pos = B.geometry.attributes.position, S = samples[s];
        for (let j = 0; j < S.length; j += 2) {
          vb.fromBufferAttribute(pos, S[j]); B.boneTransform(S[j], vb); vb.applyMatrix4(B.matrixWorld);
          const p = PARTS[S[j + 1]]; if (vb.z > z[p]) z[p] = vb.z;
        }
      });
      return z;
    }
    const FLAT_ON_SIDE = { t: 180, u: 180, n: 180, a: [176, 176], A: [180, 180], l: [0, 0, 60], L: [0, 0, 60] };
    // the side bends that lay this body on the mat (worked out once): the waist curves so hip and shoulder
    // both touch, the lower leg and arm lie on the mat, the head rests on the arm, the top leg on the lower leg
    let sideFit = null;
    function fitOnSide() {
      const f = {}, tip = (d, len) => deg(Math.asin(Math.max(-0.5, Math.min(0.5, d / len))));
      let z = nearSide();
      f.spine_02 = -tip(Math.max(z.trunk, z.arm) - z.hips, 28); swingY("spine_02", f.spine_02); z = nearSide();
      f.thigh_r = -tip(z.hips - z.footR, 85); swingY("thigh_r", f.thigh_r); z = nearSide();
      f.thigh_l = -tip(z.footR - 8 - z.footL, 85); swingY("thigh_l", f.thigh_l); z = nearSide();
      f.upperarm_r = tip(z.hips - z.handR, 52); swingY("upperarm_r", f.upperarm_r); z = nearSide();
      f.neck_01 = tip(z.hips - 7 - z.head, 17); swingY("neck_01", f.neck_01);
      return f;
    }
    function poseOnSide(r0) {
      apply({ ...r0, ...FLAT_ON_SIDE }, NO_TOUCH);
      if (!sideFit) { sideFit = fitOnSide(); apply({ ...r0, ...FLAT_ON_SIDE }, NO_TOUCH); }
      for (const n in sideFit) swingY(n, sideFit[n] + (n === "thigh_l" ? w180(r0.l[0]) : 0));
      const z = nearSide();
      bones.spine_03.getWorldPosition(rC);
      reachHand("l", rT.set(rC.x + 2, rC.y + 26, z.hips - 4.5), rP.set(0.15, 0.6, -0.8), rF.set(0.35, 0.94, 0).normalize(), NEAR, 1, 0.85);
      root.rotation.x = Math.PI / 2; root.updateMatrixWorld(true);
      bones.thigh_r.getWorldPosition(va); bones.thigh_l.getWorldPosition(vb); va.add(vb).multiplyScalar(0.5);
      const cx = va.x, cz = va.z, m = measure();
      root.position.set(r0.px - cx, -Math.min(...PARTS.map(p => m[p].y)), -cz);
      root.updateMatrixWorld(true);
    }
    // up on the lower hand: a straight line from stacked feet to shoulder, top arm to the ceiling
    function poseSidePlank(r0) {
      apply({ ...r0, ...FLAT_ON_SIDE }, NO_TOUCH);
      swingY("thigh_r", 5); swingY("thigh_l", -5);
      root.rotation.x = Math.PI / 2; root.updateMatrixWorld(true);
      const S = bones.upperarm_r.getWorldPosition(new THREE.Vector3()), F = bones.foot_r.getWorldPosition(new THREE.Vector3());
      const El = bones.lowerarm_r.getWorldPosition(new THREE.Vector3()), W = bones.hand_r.getWorldPosition(new THREE.Vector3());
      root.rotation.z = -Math.asin(Math.min(0.7, (S.distanceTo(El) + El.distanceTo(W) + 3) / Math.hypot(S.x - F.x, S.y - F.y)));
      root.updateMatrixWorld(true);
      bones.thigh_r.getWorldPosition(va); bones.thigh_l.getWorldPosition(vb); va.add(vb).multiplyScalar(0.5);
      const cx = va.x, cz = va.z;
      root.position.set(r0.px - cx, -bones.foot_r.getWorldPosition(vb).y + 3, -cz); root.updateMatrixWorld(true);
      bones.upperarm_r.getWorldPosition(S);
      reachHand("r", rT.set(S.x, 3, S.z + 1), rP.set(0, 0, -1), rF.set(-0.2, 0, 0.98).normalize(), DOWN, 1, 0.85);
      bones.upperarm_l.getWorldPosition(S);
      reachHand("l", rT.set(S.x, S.y + 60, S.z), rP.set(-1, 0, 0), rF.set(0, 1, 0), NEAR, 1, 0.4);
      settle();
    }
    function settle() { // the lowest skin back on the mat after a 3D move
      const m = measure(); root.position.y -= Math.min(...PARTS.map(p => m[p].y)); root.updateMatrixWorld(true);
    }

    // ---- movement the side-view angles can't show ----
    // Added after the pose is solved; named by an exercise's "in3d". The beat says how far through its keys it is.
    const X = new THREE.Vector3(1, 0, 0), keyed = (vals, b) => vals[b.i] * (1 - b.k) + vals[(b.i + 1) % vals.length] * b.k;
    const hU = rv(), hF = rv(), hS = rv(), hC = rv(), hq = new THREE.Quaternion();
    function headFrame() { // the head's centre, and its up, face and side directions
      const I = info.Head; I.b.getWorldQuaternion(hq).multiply(rq2.copy(I.rest).invert());
      hU.set(0, 1, 0).applyQuaternion(hq); hF.set(1, 0, 0).applyQuaternion(hq); hS.set(0, 0, 1).applyQuaternion(hq);
      I.b.getWorldPosition(hC).addScaledVector(hU, 9);
    }
    function lacedHands() { // hands behind the head, fingers meeting, elbows wide
      headFrame();
      for (const [sd, o] of [["r", 1], ["l", -1]]) {
        rT.copy(hC).addScaledVector(hF, -11).addScaledVector(hS, o * 6);
        rT.y = Math.max(rT.y, 2.5);
        const pole = hS.clone().multiplyScalar(o).addScaledVector(hF, 0.15);
        reachHand(sd, rT, pole, hS.clone().multiplyScalar(-o).addScaledVector(hU, 0.3).normalize(), hF.clone(), 1, 0.25);
      }
    }
    const FINISH = {
      laced: lacedHands,
      "criss-cross"(b) { // the chest turns towards the knee that is drawn in
        const d = keyed([1, -1], b) * 17;
        bones.spine_01.getWorldPosition(va); bones.spine_03.getWorldPosition(vb);
        const ax = vb.clone().sub(va).normalize();
        spin("spine_02", ax, -d); spin("spine_03", ax, -d);
        lacedHands();
      },
      "heel-squeeze"(b) { // flat on the front, forehead on the hands, knees wide, shins angled in so the heels meet
        const m = measure();
        root.position.y -= Math.min(m.trunk.y, m.hips.y, m.head.y); root.updateMatrixWorld(true); // elbows no longer prop the chest up
        headFrame();
        for (const [sd, o] of [["r", 1], ["l", -1]]) {
          rT.copy(hC).addScaledVector(hF, 9).addScaledVector(hU, 3).addScaledVector(hS, o * 6);
          rT.y = Math.max(3, rT.y - 4);
          reachHand(sd, rT, rP.set(0.2, -0.25, o), rF.set(0.1, 0, -o).normalize(), DOWN, 1, 0.8);
        }
        const mid = (bones.thigh_r.getWorldPosition(va).z + bones.thigh_l.getWorldPosition(vb).z) / 2;
        const m1 = measure(), lift = keyed([0, 5], b);
        for (const [sd, o, knee] of [["r", 1, m1.kneeR.y], ["l", -1, m1.kneeL.y]]) {
          spin("thigh_" + sd, Y, o * 26);
          const H = bones["thigh_" + sd].getWorldPosition(rv()), K0 = bones["calf_" + sd].getWorldPosition(rv());
          spin("thigh_" + sd, Z, deg(Math.asin(Math.max(-0.5, Math.min(0.5, (knee - lift) / H.distanceTo(K0))))));
          const K = bones["calf_" + sd].getWorldPosition(rv()), A = bones["foot_" + sd].getWorldPosition(rv());
          const len = K.distanceTo(A), dx = A.x - K.x, dz = mid + o * 2 - K.z;
          const T = rv().set(A.x, K.y + Math.sqrt(Math.max(1, len * len - dx * dx - dz * dz)), mid + o * 2);
          pointBone(bones["calf_" + sd], A.clone().sub(K).normalize(), T.sub(K).normalize(), 1);
          spin("foot_" + sd, Y, -o * 50);
        }
      },
      "shoulder-taps"(b) { // from its place on the mat, a hand arcs up to the other shoulder and back
        for (const [sd, other, e, o] of [["r", "l", keyed([0, 1, 0, 0], b), 1], ["l", "r", keyed([0, 0, 0, 1], b), -1]]) {
          if (e <= 0) continue;
          const T = bones["hand_" + sd].getWorldPosition(rv());
          bones["upperarm_" + other].getWorldPosition(rC); rC.x += 3; rC.y -= 3; rC.z += o * 2;
          T.lerp(rC, e); T.y += Math.sin(Math.PI * e) * 6;
          const w = c01(e * 3); // eases in, so the hand doesn't change speed as it takes over from the planted arm
          reachHand(sd, T, rP.set(0.1, 0.3, o), rF.set(0.2, 0.3, -o).normalize(), Y, w * w * (3 - 2 * w), 0.3);
        }
      },
      "arms-out"() { // bridges: both hands stay planted on the mat, 10 degrees out from the shoulders, while the hips move
        const reach = 39, c = Math.cos(rad(10)), s = Math.sin(rad(10));
        for (const [sd, o] of [["r", 1], ["l", -1]]) {
          rT.set(-41.4 + reach * c, 4, o * (14.4 + reach * s));
          reachHand(sd, rT, rP.set(0, 0, o), rF.set(c, 0, o * s), DOWN, 1, 0.8);
        }
      },
      "leg-circles"(b) { // the raised leg's foot draws a circle: out, up, across, down
        const a = (b.i + b.k) * Math.PI / 2;
        spin("thigh_r", Z, 1 + Math.sin(a) * 15); spin("thigh_r", X, Math.cos(a) * 14);
      },
    };

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
    return { canvas, pose, fit, resize, draw, lost: () => renderer.getContext().isContextLost() };
  }

  // ---- animation (as figure.js, plus a pause at each end, follow-through and breathing) ----
  const smoother = k => k * k * k * (k * (k * 6 - 15) + 10);
  function beatAt(n, cyc, t) { // which key the movement is leaving, and how far towards the next
    const pos = ((t % cyc) + cyc) % cyc / cyc * n, i = Math.floor(pos);
    return { i, k: smoother(Math.min(1, Math.max(0, (pos - i - 0.12) / 0.76))) };
  }
  // Leg circles run at a steady speed, easing to a stop and back each time they change direction
  // after 5 circles. The beat is the position around the circle, a quarter turn per key.
  function circleBeat(cyc, t) {
    const way = 5 * cyc, ease = cyc / 4, u = ((t % (2 * way)) + 2 * way) % (2 * way);
    let p = u < way ? u : 2 * way - u;
    if (p < ease) p = ease / 2 + p * p / (2 * ease);
    else if (p > way - ease) p = way - ease / 2 - (way - p) * (way - p) / (2 * ease);
    const pos = p / cyc * 4, whole = Math.floor(pos);
    return { i: whole % 4, k: pos - whole };
  }
  function frameAt(keys, cyc, t) {
    if (keys.length === 1) return keys[0];
    const { i, k } = beatAt(keys.length, cyc, t);
    return Figure.mix(keys[i], keys[(i + 1) % keys.length], k);
  }

  function mount(el, ex, { mirror = false, paused = false, flat = false } = {}) {
    if (bg) bg.stop = true; // a lesson is starting: nothing else may move the figure
    const E = flat ? null : built;
    if (!E) return Figure.mount(el, ex, { mirror, paused }); // 3D didn't load: 2D for the whole lesson
    let alive = true, isPaused = paused, raf = 0, t = 0, last = null;
    const keys = ex.poses.map(Figure.resolve), cyc = ex.cyc || 4;
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const still = keys[ex.key ?? (keys.length > 1 ? 1 : 0)];
    // arms trail slightly behind the body only when they aren't planted or holding something
    const lag = ex.poses.every(p => [p.a, p.A].every(s => !s || Array.isArray(s) || s.at));

    function render() {
      let r, breath = 0, beat = { i: keys.indexOf(still), k: 0 };
      if (reduce || keys.length < 2) r = still;
      else {
        r = frameAt(keys, cyc, t); beat = beatAt(keys.length, cyc, t);
        breath = Math.sin(t * 2 * Math.PI / 5);
        if (lag) {
          const ra = frameAt(keys, cyc, t - cyc * 0.05), rf = frameAt(keys, cyc, t - cyc * 0.09);
          r = { ...r, a: [ra.a[0], rf.a[1]], A: [ra.A[0], rf.A[1]] };
        }
        r = { ...r, n: frameAt(keys, cyc, t - cyc * 0.03).n + breath * 1.2, u: r.u + breath * 0.8 };
      }
      if (ex.in3d === "shoulder-taps") r = { ...r, a: keys[0].a, A: keys[0].A }; // both hands stay planted; the tap is added in 3D
      if (ex.in3d === "leg-circles") { // the leg holds its centre; the circle is added in 3D
        r = { ...r, l: keys[0].l };
        if (!reduce) beat = circleBeat(cyc, t);
      }
      E.pose(r, breath, ex.lie, ex.in3d, beat); E.draw();
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

    el.innerHTML = ""; el.appendChild(E.canvas);
    E.canvas.style.transform = mirror ? "scaleX(-1)" : "";
    E.resize(); E.fit(keys); render(); start();
    const ro = new ResizeObserver(() => { if (alive && E.resize()) render(); }); ro.observe(E.canvas);

    return {
      setPaused(p) {
        isPaused = p;
        if (p) { cancelAnimationFrame(raf); raf = 0; } else start();
      },
      stop() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); },
    };
  }

  window.Figure3D = { mount, prepare, preload, isPrepared };
})();
