// Exercise library and lessons. See docs/research.md for sources.
// type: "hold" (keep the position) or "reps" (repeat at breath pace).
// sides: done once on each side, with a short switch in between.
// poses: key poses for the figure (see figure.js); cyc = seconds per animation loop.
(function () {
  // ---- shared positions ----
  const SUP = { t: 180, u: 180, n: 180 };                 // lying on back, head to the left
  const CURL = { t: 180, u: 148, n: 128 };                // head and shoulders curled up
  const FEET = { w: [36, 5] };                            // foot planted on the mat
  const ARMS_DOWN = [-3, 0];                              // arms long by the sides
  const BENT = { ...SUP, y: 10, a: ARMS_DOWN, l: FEET };  // knees bent, feet down
  const TABLE = [90, 0, 0];                               // leg in tabletop
  const QUAD = { t: 6, u: 8, n: 10, y: 48, l: [-90, 180, 180], a: { w: [54, 4], b: -1 } }; // all fours
  const PRONE = { t: 0, u: 0, n: -4, l: [180, 180, 180] }; // face down, head to the right
  const SEAT = { t: 90, u: 90, n: 90, l: [0, 0, 90] };    // sitting tall, legs long
  const STAND = { t: 90, u: 90, n: 90, l: [-90, -90, 0], a: [-88, -88], anchor: "Ak" };
  const PLANK = { t: 19, u: 19, n: 24, y: 40, x: 84, l: [199, 199, -125], a: { w: [131, 4], b: -1 } };
  const HANDS_HEAD = { to: ["H", -5, 10], b: -1 };

  const X = [];
  // plant: "hands", "feet" or both stay exactly where they are in the pose plantFrom (default the first)
  // blend: turn each joint smoothly between the solved key poses, for a limb lifting off the mat
  const ex = (id, name, o) => X.push({ id, name, ...o, ...(o.blend ? { in3d: { blend: true, keys: o.poses } } : {}), ...(o.plant ? { in3d: {
    plant: o.plant.split(" "), then: o.in3d, from: o.poses[o.plantFrom || 0], elbowsOut: o.elbowsOut } } : {}) });

  // ---------- warm-up and mobility ----------
  ex("breathing", "Breathing & Imprint", {
    type: "hold",
    setup: "Lie on your back, knees bent, feet flat and hip-width apart. Rest your hands on your lower ribs.",
    move: "Breathe wide into your back and sides. As you breathe out, draw your belly button gently in and let your low back soften towards the mat (imprint), then return to neutral.",
    breath: "In through the nose for 4, out through the mouth for 6.",
    focus: "Shoulders heavy, jaw soft. Feel the ribs widen under your hands.",
    easier: "Place a folded towel under your head.",
    poses: [{ ...BENT, a: { to: ["W", 2, -12], b: -1 } }],
  });
  ex("pelvic-curl", "Pelvic Curl", {
    type: "reps", reps: "8 slow reps", cyc: 5,
    setup: "Lie on your back, knees bent, feet flat and hip-width apart, arms long by your sides.",
    move: "Tilt your pelvis to flatten your low back, then peel your spine off the mat one bone at a time until you rest on your shoulder blades. Roll back down from the top of the spine to the tailbone.",
    breath: "Breathe out to curl up, in at the top, out to roll down.",
    focus: "Move one vertebra at a time. Keep weight even on both feet.",
    easier: "Only lift as far as your low back – a small tilt is enough.",
    in3d: "arms-out",
    plant: "feet",
    poses: [{ ...BENT, anchor: "S", x: -50 }, { t: 205, u: 190, n: 180, y: 25, anchor: "S", x: -50, a: [0, 0], l: FEET }],
  });
  ex("cat-cow", "Cat-Cow", {
    type: "reps", reps: "6 slow reps", cyc: 5,
    setup: "Come onto all fours, hands under shoulders, knees under hips.",
    move: "Round your spine up towards the ceiling, tucking tailbone and chin (cat). Then lengthen and gently arch, lifting your chest and tailbone (cow).",
    breath: "Breathe out to round, in to lengthen and arch.",
    focus: "Start each movement from the pelvis and let the spine follow.",
    easier: "Keep the movement small and stay in a pain-free range.",
    plant: "hands feet",
    poses: [{ ...QUAD, t: -14, u: 24, n: 40 }, { ...QUAD, t: 50, u: -30, n: -70 }],
  });
  ex("roll-down", "Standing Roll Down", {
    type: "reps", reps: "4 slow reps", cyc: 7,
    setup: "Stand tall, feet hip-width apart, knees soft, arms by your sides.",
    move: "Drop your chin and roll down through the spine, letting your arms hang towards the floor. Pause, then stack the spine back up one vertebra at a time.",
    breath: "Breathe out to roll down, in at the bottom, out to roll up.",
    focus: "Keep your weight over the middle of your feet, not your heels.",
    easier: "Bend your knees more and only go as far as feels comfortable.",
    blend: true,
    poses: [STAND, { ...STAND, t: 42, u: -62, n: -96, a: [-92, -92], l: [-80, -100, 0] }],
  });
  ex("arm-arcs", "Arm Arcs", {
    type: "reps", reps: "8 slow reps", cyc: 5,
    setup: "Lie on your back, knees bent, feet flat. Reach your arms straight up towards the ceiling.",
    move: "Float your arms back overhead only as far as your ribs stay down, then bring them back over your shoulders.",
    breath: "Breathe in as the arms go back, out to return.",
    focus: "Ribs stay heavy on the mat – don't let your back arch.",
    easier: "Make the arc smaller.",
    poses: [{ ...BENT, a: [90, 90] }, { ...BENT, a: [165, 168] }],
  });
  ex("child-pose", "Child's Pose", {
    type: "hold",
    setup: "Kneel and sit back towards your heels, knees slightly apart.",
    move: "Fold forward, rest your forehead on the mat and reach your arms long in front.",
    breath: "Breathe slowly into your back and feel it widen.",
    focus: "Let your hips sink and your shoulders soften.",
    easier: "Put a cushion between your heels and hips, or under your forehead.",
    poses: [{ t: -2, u: -14, n: -22, l: [-24, 180, 180], a: [-8, -3] }],
  });
  ex("knees-to-chest", "Knees to Chest", {
    type: "hold",
    setup: "Lie on your back and draw both knees towards your chest.",
    move: "Hold your shins and gently hug the knees in. Rock slightly side to side if it feels good.",
    breath: "Long, slow breaths. Let each out-breath relax the low back.",
    focus: "Keep your head and shoulders relaxed on the mat.",
    easier: "Hold behind your thighs instead of your shins.",
    poses: [{ ...SUP, l: [135, -5, -5], a: { to: ["Ak", -12, 0] } }],
  });
  ex("hamstring-stretch", "Hamstring Stretch", {
    type: "hold", sides: true,
    setup: "Lie on your back, knees bent. Lift one leg towards the ceiling and hold behind the thigh.",
    move: "Straighten the lifted leg as far as is comfortable and gently draw it towards you.",
    breath: "Breathe slowly; ease a little further on each out-breath.",
    focus: "Keep your hips level and your tailbone on the mat.",
    easier: "Keep a slight bend in the knee, or use a towel around the foot.",
    poses: [{ ...BENT, l: [86, 86, 172], L: FEET, a: { to: ["K", -12, 0] } }],
  });
  ex("hip-flexor-stretch", "Kneeling Hip Flexor Stretch", {
    type: "hold", sides: true,
    setup: "Kneel on one knee with the other foot flat in front, both knees at about 90 degrees. Hands on the front thigh.",
    move: "Tuck your tailbone slightly and shift your hips forward until you feel a stretch at the front of the back hip.",
    breath: "Slow breaths, staying tall through the spine.",
    focus: "Don't arch your back – the stretch comes from the pelvis tucking under.",
    easier: "Put a folded towel under the back knee.",
    poses: [{ t: 92, u: 94, n: 90, l: [-4, -90, 0], L: [-118, 180, 180], a: { to: ["K", -8, 6] } }],
  });
  ex("spine-stretch", "Spine Stretch Forward", {
    type: "reps", reps: "6 slow reps", cyc: 6,
    setup: "Sit tall with legs long and a little wider than your hips, feet flexed. Reach your arms forward at shoulder height.",
    move: "Nod your head and roll forward through the spine into a C-shape, reaching towards your feet. Roll back up to sitting tall.",
    breath: "Breathe out to roll forward, in to stack back up.",
    focus: "Lift up out of your hips as you curve forward – it's a stretch up and over, not a collapse.",
    easier: "Sit on a folded towel or bend your knees slightly.",
    poses: [{ ...SEAT, a: [0, 0] }, { ...SEAT, t: 80, u: 24, n: -26, a: [-14, -14] }],
  });
  ex("seated-fold", "Seated Forward Stretch", {
    type: "hold",
    setup: "Sit tall with legs long in front and feet flexed.",
    move: "Round forward over your legs and let your hands rest wherever they reach – thighs, shins or feet.",
    breath: "Breathe into your back and relax a little more each time you breathe out.",
    focus: "Relax your neck and let your head hang.",
    easier: "Bend your knees and rest your chest towards your thighs.",
    poses: [{ ...SEAT, t: 74, u: 18, n: -34, a: [-18, -14] }],
  });
  ex("sphinx", "Sphinx", {
    type: "hold",
    setup: "Lie face down and prop yourself on your forearms, elbows under your shoulders.",
    move: "Press gently into your forearms and lengthen your chest forward and up.",
    breath: "Breathe slowly into the front of the body.",
    focus: "Shoulders away from your ears; keep the back of the neck long.",
    easier: "Bring your elbows further forward to reduce the arch.",
    poses: [{ ...PRONE, u: 40, n: 22, a: [-95, 0] }],
  });

  // ---------- core ----------
  ex("hundred", "The Hundred", {
    type: "hold", reps: "Pump: in for 5, out for 5", cyc: 1.2, key: 0,
    setup: "Lie on your back with legs in tabletop (knees over hips, shins parallel to the floor). Curl your head and shoulders up and reach your arms long by your sides, just off the mat.",
    move: "Pump your arms up and down in small, firm movements while holding the curl.",
    breath: "Breathe in for 5 pumps and out for 5 pumps.",
    focus: "Keep your gaze on your belly and a gap the size of an orange under your chin.",
    easier: "Keep your feet on the mat, or your head down.",
    harder: "Straighten your legs to 45 degrees.",
    poses: [{ ...CURL, l: TABLE, a: [-10, -12] }, { ...CURL, l: TABLE, a: [-3, -6] }],
  });
  ex("chest-lift", "Chest Lift", {
    in3d: "laced",
    type: "reps", reps: "8 reps", cyc: 4,
    setup: "Lie on your back, knees bent, feet flat. Lace your hands behind your head, elbows wide.",
    move: "Nod your chin and curl your head and shoulders up to the bottom of your shoulder blades, then lower with control.",
    breath: "Breathe out to curl up, in to lower.",
    focus: "Lift from your abdominals, not by pulling on your head. Keep the pelvis still.",
    easier: "Make the lift smaller and rest your head between reps.",
    poses: [{ ...BENT }, { ...BENT, ...CURL, y: 10 }],
  });
  ex("roll-up", "Roll Up", {
    type: "reps", reps: "5 slow reps", cyc: 8,
    setup: "Lie on your back with legs long together and feet flexed. Reach your arms overhead.",
    move: "Float your arms to the ceiling, nod your head and peel up through the spine to reach towards your toes. Then roll back down one vertebra at a time.",
    breath: "Breathe in to lift the arms, out to roll up, in at the top, out to roll down.",
    focus: "No jerking or momentum – roll like a wheel, bone by bone.",
    easier: "Bend your knees and hold the backs of your thighs to help you up, or only roll halfway back.",
    blend: true,
    poses: [
      // lying, the legs tip down 1.5 degrees: the hips sit 2 cm lower once up on the sitting bones,
      // so this keeps the knees and feet in the same place on the mat
      { ...SUP, l: [-1.5, -1.5, 90], a: [178, 178] },
      { t: 176, u: 124, n: 104, l: [-1.5, -1.5, 90], a: [92, 82] },
      { t: 78, u: 24, n: -12, l: [0, 0, 90], a: [6, 2] },
      { t: 176, u: 124, n: 104, l: [-1.5, -1.5, 90], a: [92, 82] },
    ],
  });
  ex("single-leg-stretch", "Single Leg Stretch", {
    type: "reps", reps: "10 reps (5 each leg)", cyc: 3,
    setup: "Lie on your back, curl your head and shoulders up, and draw both knees in.",
    move: "Extend one leg out on a diagonal while you hold the other shin, then switch legs.",
    breath: "Breathe out for each switch, or in for two switches and out for two.",
    focus: "Keep your upper body still and your low back anchored.",
    easier: "Rest your head down, or extend the legs higher towards the ceiling.",
    poses: [
      { ...CURL, l: [114, 12, 12], L: [22, 22, 22], a: { to: ["Ak", -12, 0] }, A: { to: ["K", 0, 0] } },
      { ...CURL, l: [22, 22, 22], L: [114, 12, 12], a: { to: ["kK", 0, 0] }, A: { to: ["kAk", -12, 0] } },
    ],
  });
  ex("double-leg-stretch", "Double Leg Stretch", {
    type: "reps", reps: "8 reps", cyc: 4,
    setup: "Lie on your back, curl your head and shoulders up, knees into the chest and hands on the shins.",
    move: "Reach your arms back past your ears and your legs out on a diagonal, then circle the arms round and hug the knees back in.",
    breath: "Breathe in to stretch out, out to circle and hug in.",
    focus: "Keep the curl of the upper body as the arms and legs stretch away.",
    easier: "Reach the legs higher towards the ceiling, or keep the arms by your sides.",
    poses: [
      // the skin under the hips thickens as the thighs lower, so these angles keep the body's rise small
      { ...CURL, l: [104, 12, 12], a: { to: ["Ak", -12, 0] } },
      { ...CURL, l: [40, 40, 40], a: [160, 162] },
    ],
  });
  ex("single-straight-leg", "Single Straight Leg Stretch", {
    type: "reps", reps: "10 reps (5 each leg)", cyc: 3,
    setup: "Lie on your back, curl your head and shoulders up and lift both legs straight, one towards the ceiling, the other hovering low.",
    move: "Hold the raised leg behind the calf and pulse it towards you twice, then scissor the legs to switch.",
    breath: "Breathe in for one switch, out for the next.",
    focus: "Keep the hips still and lengthen out through both legs.",
    easier: "Bend the knees slightly, or keep the lower leg higher.",
    poses: [
      { ...CURL, l: [94, 94, 94], L: [24, 24, 24], a: { to: ["Ak", -10, 0] }, A: { to: ["K", -4, 0] } },
      { ...CURL, l: [24, 24, 24], L: [94, 94, 94], a: { to: ["kK", -4, 0] }, A: { to: ["kAk", -10, 0] } },
    ],
  });
  ex("criss-cross", "Criss-Cross", {
    in3d: "criss-cross",
    type: "reps", reps: "10 reps (5 each side)", cyc: 3,
    setup: "Lie on your back, hands behind your head, curl up and bring your legs to tabletop.",
    move: "Rotate your upper body to bring one shoulder towards the opposite knee while that leg draws in and the other extends. Switch sides through the centre.",
    breath: "Breathe out as you twist, in as you pass through the middle.",
    focus: "Turn from the waist; elbows stay wide and the pelvis stays still.",
    easier: "Keep both feet on the mat and just do the upper body twist.",
    poses: [
      { ...CURL, u: 144, n: 124, l: [114, 12, 12], L: [22, 22, 22], a: HANDS_HEAD },
      { ...CURL, u: 144, n: 124, l: [22, 22, 22], L: [114, 12, 12], a: HANDS_HEAD },
    ],
  });
  ex("toe-taps", "Toe Taps", {
    type: "reps", reps: "10 reps (5 each leg)", cyc: 3,
    setup: "Lie on your back, arms long by your sides, and lift both legs to tabletop.",
    move: "Keeping the knee bend, lower one foot to tap the mat, then return it to tabletop. Alternate legs.",
    breath: "Breathe out as you lower, in as you lift.",
    focus: "Keep your low back steady – don't let it arch as the leg lowers.",
    easier: "Keep one foot on the mat while the other leg moves.",
    blend: true,
    poses: [
      { ...SUP, a: ARMS_DOWN, l: [62, -70, -45], L: TABLE }, // foot pointed, so only the toes tap the mat
      { ...SUP, a: ARMS_DOWN, l: TABLE, L: [62, -70, -45] },
    ],
  });
  ex("dead-bug", "Dead Bug", {
    type: "reps", reps: "10 reps (5 each side)", cyc: 4,
    setup: "Lie on your back with arms reaching to the ceiling and legs in tabletop.",
    move: "Reach one arm back overhead while the opposite leg straightens away. Return and switch sides.",
    breath: "Breathe out as you reach, in as you return.",
    focus: "Low back stays heavy on the mat; move slowly.",
    easier: "Move only the legs and keep the arms up, or just tap the heel down.",
    poses: [
      { ...SUP, a: [170, 172], A: [90, 90], l: TABLE, L: [12, 12, 12] },
      { ...SUP, a: [90, 90], A: [170, 172], l: [12, 12, 12], L: TABLE },
    ],
  });
  ex("teaser-prep", "Teaser Prep", {
    type: "hold",
    setup: "Sit and lean back to balance just behind your sitting bones, knees bent and shins parallel to the floor.",
    move: "Reach your arms forward parallel to your shins and hold the V-shape.",
    breath: "Breathe steadily – don't hold your breath.",
    focus: "Lift through the chest and draw the belly in; don't sink into the low back.",
    easier: "Keep your toes on the mat, or hold behind your thighs.",
    poses: [{ t: 118, u: 110, n: 100, l: [48, 0, 0], a: [28, 26] }],
  });
  ex("rolling-ball", "Rolling Like a Ball", {
    type: "reps", reps: "8 reps", cyc: 3,
    setup: "Sit and hug your shins, knees into your chest, head tucked. Lift your feet and balance just behind your sitting bones.",
    move: "Roll back to your shoulder blades, then roll up to balance again – keeping the same ball shape throughout.",
    breath: "Breathe in to roll back, out to roll up.",
    focus: "Never roll onto your neck. Use your abdominals to stop at the balance point.",
    easier: "Hold behind your thighs and make the roll smaller. Skip this if you have neck or low-back problems.",
    poses: [
      { t: 104, u: 74, n: 40, l: [48, -44, -30], a: { to: ["Ak", -10, 0] } },
      { t: 176, u: 146, n: 112, l: [120, 28, 42], a: { to: ["Ak", -10, 0] }, x: -22 },
    ],
  });
  ex("swimming", "Swimming", {
    type: "reps", reps: "About 20 small kicks", cyc: 1.6,
    setup: "Lie face down with arms reaching past your head and legs long. Lift your head, chest, arms and legs a little off the mat.",
    move: "Flutter opposite arm and leg up and down in small, quick movements, like swimming.",
    breath: "Breathe in for 5 kicks, out for 5.",
    focus: "Reach long rather than high; belly lifts gently off the mat.",
    easier: "Lift just the arms or just the legs, or move one arm and the opposite leg slowly.",
    poses: [
      { ...PRONE, u: 6, n: 12, a: [16, 15], A: [4, 3], l: [181, 181, 181], L: [171, 171, 171] },
      { ...PRONE, u: 6, n: 12, a: [4, 3], A: [16, 15], l: [171, 171, 171], L: [181, 181, 181] },
    ],
  });
  ex("bird-dog", "Bird Dog", {
    type: "reps", sides: true, reps: "6 reps", cyc: 4,
    setup: "Come onto all fours, hands under shoulders, knees under hips.",
    move: "Reach one arm forward and the opposite leg back until both are level with your body. Hold for a breath, then return.",
    breath: "Breathe out to reach, in to return.",
    focus: "Keep the pelvis level, as if balancing a cup of tea on your back.",
    easier: "Slide the leg back along the mat without lifting the arm.",
    blend: true,
    poses: [QUAD, { ...QUAD, a: [8, 8], A: QUAD.a, l: QUAD.l, L: [182, 182, 182] }],
  });
  ex("plank-forearm", "Forearm Plank", {
    type: "hold",
    setup: "Lie face down, elbows under your shoulders, then tuck your toes and lift your body into one long line.",
    move: "Hold the line from head to heels.",
    breath: "Breathe steadily throughout.",
    focus: "Don't let the hips sag or pike; draw the belly in and press the floor away.",
    easier: "Drop your knees to the mat.",
    poses: [{ t: 9, u: 9, n: 14, l: [189, 189, -125], a: [-90, 0] }],
  });
  ex("side-plank", "Side Plank", {
    lie: "side-plank", // the 3D figure is up on its lower hand
    type: "hold", sides: true,
    setup: "Lie on your side and prop up on your hand (or forearm), shoulder over wrist, legs long and stacked.",
    move: "Lift your hips so your body forms a straight line. Reach the top arm to the ceiling.",
    breath: "Breathe steadily.",
    focus: "Press the floor away so you don't sink into the supporting shoulder.",
    easier: "Bend your knees and keep the bottom knee down.",
    poses: [{ ...PLANK, a: [90, 90], A: { w: [131, 4], b: -1 }, l: [199, 199, -150] }],
  });

  // ---------- lower body ----------
  ex("bridge", "Shoulder Bridge", {
    type: "reps", reps: "8 slow reps", cyc: 5,
    setup: "Lie on your back, knees bent, feet flat and hip-width apart, arms by your sides.",
    move: "Roll the spine up until you're in a straight line from shoulders to knees. Squeeze your glutes, then roll back down.",
    breath: "Breathe out to lift, in at the top, out to roll down.",
    focus: "Weight on the shoulder blades, not the neck. Knees stay hip-width.",
    easier: "Lift halfway and lower; keep the movement small.",
    in3d: "arms-out",
    plant: "feet",
    poses: [{ ...BENT, anchor: "S", x: -50 }, { t: 214, u: 214, n: 180, y: 39, anchor: "S", x: -50, a: [0, 0], l: FEET }],
  });
  ex("single-leg-bridge", "Single Leg Bridge", {
    type: "reps", sides: true, reps: "6 reps", cyc: 4,
    setup: "Lift into a bridge, then straighten one leg in line with your thigh.",
    move: "Lower your hips a few centimetres and lift back up, keeping the leg extended.",
    breath: "Breathe in to lower, out to lift.",
    focus: "Keep the hips level – don't let the lifted side drop.",
    easier: "Keep both feet down and just hold the bridge.",
    in3d: "arms-out",
    plant: "footL",
    poses: [
      { t: 214, u: 214, n: 180, y: 39, anchor: "S", x: -50, a: [0, 0], l: [34, 34, 34], L: FEET },
      { t: 200, u: 196, n: 180, y: 25, anchor: "S", x: -50, a: [0, 0], l: [22, 22, 22], L: FEET },
    ],
  });
  ex("side-leg-lift", "Side Leg Lift", {
    lie: "side", // the 3D figure lies on its side
    type: "reps", sides: true, reps: "10 reps", cyc: 3,
    setup: "Lie on your side with your head resting on your lower arm and your body in one long line. Place your top hand on the mat in front of your chest.",
    move: "Lift the top leg to hip height or a little higher, then lower with control.",
    breath: "Breathe out to lift, in to lower.",
    focus: "Lead with the heel and keep the toes facing forward; don't roll the hips back.",
    easier: "Bend the bottom knee for more stability.",
    poses: [
      { t: 180, u: 176, n: 172, a: { at: [-26, -6] }, A: [180, 180], l: [0, 0, 0], L: [0, 0, 0] },
      { t: 180, u: 176, n: 172, a: { at: [-26, -6] }, A: [180, 180], l: [24, 24, 24], L: [0, 0, 0] },
    ],
  });
  ex("leg-circles", "Single Leg Circles", {
    in3d: "leg-circles",
    type: "reps", sides: true, reps: "5 circles each way", cyc: 3,
    setup: "Lie on your back, arms by your sides. Bend one knee with the foot down and lift the other leg towards the ceiling.",
    move: "Draw small circles with the raised leg: across the body, down, around and up. Reverse halfway.",
    breath: "Breathe in for the first half of the circle, out for the second.",
    focus: "The pelvis stays completely still – keep the circles small enough to do that.",
    easier: "Bend the raised knee slightly and make the circles smaller.",
    poses: [
      { ...BENT, l: [80, 80, 82], L: FEET },
      { ...BENT, l: [96, 96, 100], L: FEET },
      { ...BENT, l: [82, 82, 84], L: FEET },
      { ...BENT, l: [66, 66, 68], L: FEET },
    ],
  });
  ex("single-leg-kick", "Single Leg Kick", {
    type: "reps", reps: "10 reps (5 each leg)", cyc: 2.5,
    setup: "Lie face down propped on your forearms, elbows under shoulders, legs long together.",
    move: "Kick one heel towards your bottom with two quick pulses, then lengthen it back down. Switch legs.",
    breath: "Breathe in for one leg, out for the other.",
    focus: "Lift the belly gently away from the mat and keep the chest lifted.",
    easier: "Rest your forehead on your hands and kick slowly.",
    blend: true,
    poses: [
      { ...PRONE, u: 40, n: 22, a: [-95, 0], l: [180, 42, 42], L: [180, 180, 180] },
      { ...PRONE, u: 40, n: 22, a: [-95, 0], l: [180, 180, 180], L: [180, 42, 42] },
    ],
  });
  ex("heel-squeeze", "Prone Heel Squeeze", {
    in3d: "heel-squeeze",
    type: "reps", reps: "10 reps", cyc: 3,
    setup: "Lie face down with your forehead on your hands. Bend your knees, open them wide and press your heels together.",
    move: "Squeeze your heels together and lift your knees a few centimetres off the mat, then lower.",
    breath: "Breathe out to lift, in to lower.",
    focus: "Keep your belly drawn in so your low back doesn't arch.",
    easier: "Just squeeze the heels together without lifting the knees.",
    poses: [
      { ...PRONE, n: -8, a: { at: [60, -4] }, l: [180, 90, 0] },
      { ...PRONE, n: -8, a: { at: [60, -4] }, l: [170, 84, -4] },
    ],
  });
  ex("kneeling-leg-lift", "Kneeling Leg Lift", {
    type: "reps", sides: true, reps: "10 reps", cyc: 3,
    setup: "Come onto all fours. Lift one knee and bend it to 90 degrees, sole of the foot towards the ceiling.",
    move: "Press the foot up towards the ceiling, lifting the thigh to hip height, then lower without touching down.",
    breath: "Breathe out to lift, in to lower.",
    focus: "Work from the glute; don't arch the back or tip the hips.",
    easier: "Make the lift smaller.",
    blend: true,
    poses: [{ ...QUAD, L: QUAD.l }, { ...QUAD, l: [176, 86, 176], L: QUAD.l }],
  });
  ex("squat", "Pilates Squat", {
    type: "reps", reps: "10 slow reps", cyc: 4,
    setup: "Stand with feet hip-width apart, arms by your sides.",
    move: "Sit your hips back and down as if into a chair, reaching your arms forward. Press through your heels to stand.",
    breath: "Breathe in to lower, out to stand.",
    focus: "Knees track over your toes; keep your chest open.",
    easier: "Only squat halfway, or hold onto a chair.",
    plant: "feet",
    poses: [STAND, { ...STAND, t: 58, u: 62, n: 70, a: [-2, 0], l: [-20, -112, 0] }],
  });
  ex("lunge", "Split Squat", {
    type: "reps", sides: true, reps: "8 reps", cyc: 4,
    setup: "Stand in a long split stance, front foot flat and back heel lifted. Hands on hips.",
    move: "Bend both knees to lower the back knee towards the mat, then press back up.",
    breath: "Breathe in to lower, out to rise.",
    focus: "Torso stays upright; front knee stays over the ankle.",
    easier: "Make the movement smaller, or hold a wall.",
    plant: "feet",
    poses: [
      { t: 90, u: 90, n: 90, y: 80, a: { to: ["P", 14, -8] }, l: { w: [32, 5], b: 1 }, L: { w: [-30, 12], b: 1, f: -32 } },
      { t: 90, u: 90, n: 90, y: 50, a: { to: ["P", 14, -8] }, l: { w: [32, 5], b: 1 }, L: { w: [-30, 12], b: 1, f: -32 } },
    ],
  });

  // ---------- upper body ----------
  ex("plank", "Plank", {
    type: "hold",
    setup: "From all fours, step your feet back so your body forms a long line, hands under shoulders.",
    move: "Hold the line from head to heels.",
    breath: "Breathe steadily throughout.",
    focus: "Press the floor away to widen your shoulder blades; draw the belly in.",
    easier: "Keep your knees on the mat.",
    poses: [PLANK],
  });
  ex("push-up", "Push Up", {
    type: "reps", reps: "6 reps", cyc: 4,
    setup: "Start in a plank with hands just wider than your shoulders.",
    move: "Bend your elbows close to your ribs to lower your chest towards the mat, then press back up.",
    breath: "Breathe in to lower, out to press up.",
    focus: "Keep your body in one line – the hips move with the chest.",
    easier: "Do it with your knees on the mat, or against a wall.",
    plant: "hands feet",
    poses: [PLANK, { t: 6, u: 6, n: 10, y: 20, x: 88, l: [186, 186, -120], a: { w: [131, 4], b: -1 } }],
  });
  ex("tricep-dip", "Tricep Dips", {
    type: "reps", reps: "8 reps", cyc: 4,
    setup: "Sit with knees bent and feet flat. Place your hands behind you, fingers pointing towards your hips, and lift your bottom slightly.",
    move: "Bend your elbows straight back to lower a few centimetres, then press back up.",
    breath: "Breathe in to lower, out to press.",
    focus: "Shoulders stay down away from your ears; elbows point backwards.",
    easier: "Keep your bottom on the mat and just bend and straighten the arms.",
    plant: "hands feet",
    poses: [
      { t: 135, u: 135, n: 120, y: 16, l: { w: [45, 5] }, a: { w: [-43, 4] } },
      { t: 141, u: 141, n: 124, y: 13, l: { w: [45, 5] }, a: { w: [-43, 4] } },
    ],
  });
  ex("reverse-tabletop", "Reverse Tabletop", {
    type: "hold",
    setup: "Sit with knees bent and feet flat, hands behind you under your shoulders with fingers facing forward.",
    move: "Press into your hands and feet to lift your hips until your body is flat like a table.",
    breath: "Breathe steadily.",
    focus: "Open the chest and keep the head in line with the spine.",
    easier: "Lift the hips only partway.",
    poses: [{ t: 170, u: 170, n: 158, l: [-5, -90, 0], a: [-92, -92] }],
  });
  ex("leg-pull-front", "Leg Pull Front", {
    type: "reps", sides: true, reps: "5 reps", cyc: 4,
    setup: "Start in a plank, hands under shoulders.",
    move: "Lift one straight leg a little, then lower it, keeping the rest of the body still.",
    breath: "Breathe out to lift, in to lower.",
    focus: "Don't let the hips sway or the lower back sag.",
    easier: "Hold the plank only, or do it from a forearm plank.",
    blend: true,
    poses: [PLANK, { ...PLANK, l: [186, 186, PLANK.l[2]], L: PLANK.l }],
  });
  ex("shoulder-taps", "Plank Shoulder Taps", {
    in3d: "shoulder-taps",
    type: "reps", reps: "10 reps (5 each side)", cyc: 5,
    setup: "Start in a plank, feet a little wider than usual for balance.",
    move: "Lift one hand to tap the opposite shoulder, then put it down and switch.",
    breath: "Breathe out on each tap.",
    focus: "Keep the hips square – resist rocking side to side.",
    easier: "Do it from your knees.",
    poses: [PLANK, { ...PLANK, a: { to: ["S", -2, -9] }, A: PLANK.a }, PLANK, { ...PLANK, a: PLANK.a, A: { to: ["S", -2, -9] } }],
  });
  ex("plank-pike", "Plank to Pike", {
    type: "reps", reps: "6 slow reps", cyc: 5,
    setup: "Start in a plank, hands under shoulders.",
    move: "Draw your belly in and lift your hips up into an upside-down V, then lower back to plank with control.",
    breath: "Breathe out to pike up, in to lower.",
    focus: "Lift from the abdominals; keep the arms and legs long.",
    easier: "Bend your knees as you lift, or do a smaller lift.",
    plant: "hands feet",
    poses: [PLANK, { t: -44, u: -44, n: -64, y: 70, x: 68, l: [220, 220, 217], a: { w: [131, 4], b: -1 } }],
  });
  ex("swan", "Swan", {
    type: "reps", reps: "6 slow reps", cyc: 5,
    setup: "Lie face down with your hands under your shoulders, elbows close to your sides and legs long.",
    move: "Lengthen your head forward and press into your hands to lift the chest, peeling the upper spine off the mat. Lower back down with control.",
    breath: "Breathe in to lift, out to lower.",
    focus: "Lift from the upper back, not by crunching the low back; keep the hips on the mat.",
    easier: "Only lift as far as the bottom of the ribs, or stay on your forearms.",
    plant: "hands", plantFrom: 1, elbowsOut: true,
    poses: [
      { ...PRONE, y: 10, t: 4, u: 2, n: -6, a: { at: [60, -6], b: 1 } }, // hips already down, so the legs don't drop as the chest lifts
      { ...PRONE, y: 10, t: 4, u: 46, n: 34, a: { at: [60, -6], b: 1 } },
    ],
  });

  // ---------- lessons ----------
  // Each lesson: [exerciseId, seconds (per side for sided exercises), optional reps text]
  const CATS = [
    { id: "core", name: "Core" },
    { id: "lower", name: "Lower body" },
    { id: "upper", name: "Upper body" },
    { id: "full", name: "Full body" },
    { id: "back", name: "Back & mobility" },
  ];
  const L = [];
  const lesson = (id, cat, title, blurb, items) => L.push({ id, cat, title, blurb, items: items.map(([e, s, r]) => ({ e, s, r })) });

  lesson("core-1", "core", "Core Foundations", "Find your deep core with breathing, gentle curls and a short plank.", [
    ["breathing", 45], ["pelvic-curl", 45], ["cat-cow", 45],
    ["chest-lift", 55], ["hundred", 60], ["single-leg-stretch", 45], ["toe-taps", 60], ["dead-bug", 60],
    ["bird-dog", 30], ["rolling-ball", 40], ["plank-forearm", 35], ["double-leg-stretch", 45],
    ["child-pose", 50], ["knees-to-chest", 45],
  ]);
  lesson("core-2", "core", "Classical Core", "The classic abdominal series, from the Hundred to the leg stretches.", [
    ["breathing", 40], ["pelvic-curl", 45], ["roll-down", 40],
    ["hundred", 60], ["roll-up", 60], ["single-leg-stretch", 45], ["double-leg-stretch", 55], ["single-straight-leg", 55],
    ["criss-cross", 45], ["toe-taps", 45], ["rolling-ball", 40], ["teaser-prep", 30], ["plank-forearm", 35],
    ["child-pose", 45], ["spine-stretch", 40],
  ]);
  lesson("core-3", "core", "Core Stability", "Hold steady against movement: dead bugs, bird dogs and planks.", [
    ["cat-cow", 45], ["pelvic-curl", 45], ["arm-arcs", 40],
    ["chest-lift", 45], ["hundred", 60], ["toe-taps", 50], ["dead-bug", 50], ["single-leg-stretch", 45],
    ["bird-dog", 30], ["plank-forearm", 30], ["side-plank", 20], ["teaser-prep", 30], ["criss-cross", 45],
    ["child-pose", 45], ["knees-to-chest", 40],
  ]);
  lesson("lower-1", "lower", "Glutes & Legs", "Bridges, leg lifts and kneeling work for strong hips and glutes.", [
    ["breathing", 30], ["pelvic-curl", 45], ["cat-cow", 40],
    ["squat", 50], ["bridge", 60], ["single-leg-bridge", 35], ["leg-circles", 30], ["side-leg-lift", 45],
    ["kneeling-leg-lift", 40], ["heel-squeeze", 55],
    ["child-pose", 50], ["hip-flexor-stretch", 35],
  ]);
  lesson("lower-2", "lower", "Standing Strength", "Squats and split squats, then mat work for the backs of the legs.", [
    ["roll-down", 40], ["cat-cow", 40], ["pelvic-curl", 40],
    ["squat", 50], ["lunge", 40], ["bridge", 50], ["single-leg-bridge", 30], ["side-leg-lift", 35],
    ["leg-circles", 30], ["single-leg-kick", 45], ["heel-squeeze", 50],
    ["child-pose", 40], ["hamstring-stretch", 30],
  ]);
  lesson("lower-3", "lower", "Hips & Hamstrings", "Leg circles, side lifts and bridges, finishing with a long stretch.", [
    ["pelvic-curl", 45], ["cat-cow", 40], ["arm-arcs", 30],
    ["leg-circles", 40], ["bridge", 45], ["squat", 50], ["side-leg-lift", 40], ["single-leg-bridge", 30],
    ["kneeling-leg-lift", 30], ["heel-squeeze", 50], ["single-leg-kick", 40],
    ["hamstring-stretch", 30], ["knees-to-chest", 45],
  ]);
  lesson("upper-1", "upper", "Arms & Shoulders", "Push ups, dips and planks with a back-opening Swan.", [
    ["cat-cow", 40], ["arm-arcs", 40], ["roll-down", 40],
    ["plank", 30], ["push-up", 50], ["reverse-tabletop", 30], ["tricep-dip", 50], ["shoulder-taps", 40],
    ["plank-pike", 45], ["side-plank", 20], ["swan", 45], ["leg-pull-front", 25], ["plank-forearm", 30], ["push-up", 50],
    ["child-pose", 45], ["sphinx", 30],
  ]);
  lesson("upper-2", "upper", "Plank Power", "Plank variations for strong shoulders and a steady trunk.", [
    ["cat-cow", 45], ["bird-dog", 30], ["arm-arcs", 30],
    ["plank-forearm", 30], ["plank-pike", 45], ["shoulder-taps", 40], ["side-plank", 20], ["reverse-tabletop", 30],
    ["tricep-dip", 45], ["leg-pull-front", 25], ["plank", 30], ["push-up", 40], ["swimming", 40], ["swan", 40],
    ["child-pose", 45], ["sphinx", 40],
  ]);
  lesson("upper-3", "upper", "Posture & Upper Back", "Strengthen the back of the body to stand taller.", [
    ["arm-arcs", 40], ["cat-cow", 45], ["roll-down", 40],
    ["swan", 45], ["swimming", 40], ["bird-dog", 30], ["sphinx", 30], ["reverse-tabletop", 30], ["tricep-dip", 40],
    ["push-up", 45], ["shoulder-taps", 40], ["plank-pike", 50], ["plank", 30], ["swan", 40],
    ["child-pose", 45], ["spine-stretch", 40],
  ]);
  lesson("full-1", "full", "Full Body Flow", "A bit of everything: curls, bridges, squats, push ups and swimming.", [
    ["roll-down", 40], ["cat-cow", 40], ["pelvic-curl", 40],
    ["hundred", 60], ["roll-up", 50], ["dead-bug", 50], ["bridge", 45], ["squat", 45], ["lunge", 35], ["push-up", 40],
    ["swimming", 35], ["side-plank", 20], ["spine-stretch", 40],
    ["child-pose", 45], ["knees-to-chest", 30],
  ]);
  lesson("full-2", "full", "Classical Mat Sampler", "Classical mat exercises in their traditional order.", [
    ["breathing", 35], ["pelvic-curl", 45],
    ["hundred", 60], ["roll-up", 50], ["leg-circles", 35], ["rolling-ball", 40], ["single-leg-stretch", 40],
    ["double-leg-stretch", 40], ["single-straight-leg", 45], ["spine-stretch", 40], ["swan", 40], ["single-leg-kick", 40],
    ["swimming", 35], ["leg-pull-front", 25],
    ["child-pose", 40],
  ]);
  lesson("full-3", "full", "Total Body Tone", "Standing work, planks and balance to work everything at once.", [
    ["roll-down", 40], ["cat-cow", 40],
    ["squat", 45], ["lunge", 35], ["hundred", 60], ["push-up", 45], ["plank-pike", 40], ["bird-dog", 25],
    ["teaser-prep", 30], ["side-leg-lift", 30], ["swimming", 35], ["side-plank", 15], ["bridge", 45],
    ["child-pose", 40], ["knees-to-chest", 30],
  ]);
  lesson("back-1", "back", "Spine Mobility", "Move the spine through flexion and extension, gently and slowly.", [
    ["breathing", 45], ["pelvic-curl", 50], ["cat-cow", 50], ["arm-arcs", 40],
    ["roll-down", 45], ["spine-stretch", 50], ["bird-dog", 30], ["swan", 45], ["swimming", 35], ["sphinx", 40],
    ["child-pose", 50], ["knees-to-chest", 40], ["hamstring-stretch", 35], ["hip-flexor-stretch", 30],
  ]);
  lesson("back-2", "back", "Back Care", "Gentle strength for the muscles that support your back.", [
    ["breathing", 45], ["pelvic-curl", 50], ["arm-arcs", 40], ["cat-cow", 45], ["roll-down", 45],
    ["bird-dog", 30], ["swimming", 30], ["swan", 45], ["sphinx", 40], ["heel-squeeze", 40], ["spine-stretch", 50],
    ["child-pose", 45], ["seated-fold", 35], ["knees-to-chest", 40], ["hamstring-stretch", 30],
  ]);
  lesson("back-3", "back", "Stretch & Release", "A slower session of long holds to loosen hips, hamstrings and back.", [
    ["breathing", 55], ["pelvic-curl", 50], ["cat-cow", 45], ["roll-down", 40],
    ["leg-circles", 30], ["rolling-ball", 40], ["spine-stretch", 50], ["hip-flexor-stretch", 40], ["hamstring-stretch", 40],
    ["sphinx", 40], ["seated-fold", 50], ["child-pose", 60], ["knees-to-chest", 45],
  ]);

  // Timeline: a short get-ready, then each exercise (both sides for sided ones)
  // with a break between exercises and a quick switch between sides.
  const READY = 10, REST = 15, SWITCH = 5;
  function steps(lessonObj) {
    const out = [{ kind: "ready", secs: READY, i: 0 }];
    lessonObj.items.forEach((it, i) => {
      const e = X.find(x => x.id === it.e);
      if (!e) throw new Error("unknown exercise " + it.e);
      if (i > 0) out.push({ kind: "rest", secs: REST, i });
      if (e.sides) {
        out.push({ kind: "work", secs: it.s, i, side: 1 });
        out.push({ kind: "switch", secs: SWITCH, i });
        out.push({ kind: "work", secs: it.s, i, side: 2 });
      } else out.push({ kind: "work", secs: it.s, i });
    });
    return out;
  }
  const total = l => steps(l).reduce((a, s) => a + s.secs, 0);

  window.LIB = { steps, total, exercises: X, byId: Object.fromEntries(X.map(e => [e.id, e])), lessons: L, cats: CATS };
})();
