// Achievements, worked out from the lesson history, so past lessons count and
// old data and old backups keep working. Each badge's earned day is then saved
// in state.earned, so a badge is never lost when a lesson joins its set. Badges
// not yet earned always use the current library.
//
// - Days and weeks are UTC day numbers of the local calendar date (see dayNum in
//   index.html), so daylight saving can't shift a streak.
// - A streak badge stays earned once the best-ever streak reaches it. Progress on
//   an unearned one shows the live streak, which survives until a full day (or
//   Monday-to-Sunday week) has been missed.
// - A set badge needs every lesson of that type done N times. Extra repeats of one
//   lesson don't count towards the others.
// - "Closest" is the highest fraction done. Ties go to the fewest steps left, then
//   list order. "Recent" is the latest earned; ties go to the bigger badge.
(function () {
  const DAY_GOALS = [1, 3, 5, 10];
  const WEEK_GOALS = [2, 4, 8, 12, 26, 52];
  const SET_GOALS = [1, 3, 5];

  // Day 0 was a Thursday, so day -3 is the Monday that starts week 0.
  const weekOf = day => Math.floor((day + 3) / 7);
  const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

  function definitions(lessons, cats) {
    const defs = [];
    DAY_GOALS.forEach(n => defs.push({
      id: `day-${n}`, kind: "day", group: "Day streaks", goal: n, need: n,
      name: n === 1 ? "First day" : `${n}-day streak`,
      detail: n === 1 ? "Finish a lesson" : `A lesson on ${n} days in a row`,
      short: plural(n, "day"), mark: String(n),
    }));
    WEEK_GOALS.forEach(n => defs.push({
      id: `week-${n}`, kind: "week", group: "Week streaks", goal: n, need: n,
      name: `${n}-week streak`,
      detail: `At least one lesson a week, ${n} weeks running`,
      short: plural(n, "week"), mark: String(n),
    }));
    cats.forEach(c => {
      const ids = lessons.filter(l => l.cat === c.id).map(l => l.id);
      if (!ids.length) return;
      const word = c.name.split(" ")[0];
      SET_GOALS.forEach(n => defs.push({
        id: `set-${c.id}-${n}`, kind: "set", cat: c.id, group: `${c.name} lessons`, goal: n, ids,
        need: ids.length * n,
        name: n === 1 ? `All ${c.name}` : `All ${c.name} × ${n}`,
        detail: n === 1 ? `Finish all ${ids.length} ${c.name} lessons` : `Finish all ${ids.length} ${c.name} lessons ${n} times each`,
        short: `${word} ×${n}`, mark: `×${n}`,
      }));
    });
    // The last goal in each group earns a gold badge.
    defs.forEach(d => { d.final = d.goal === Math.max(...defs.filter(x => x.group === d.group).map(x => x.goal)); });
    return defs;
  }

  const setDone = (def, counts) => def.ids.reduce((sum, id) => sum + Math.min(counts[id] || 0, def.goal), 0);

  // Keeps only valid { badgeId: dayNumber } pairs from stored or restored data.
  const clean = earned => earned && typeof earned === "object" && !Array.isArray(earned)
    ? Object.fromEntries(Object.entries(earned).filter(([, day]) => Number.isFinite(day)))
    : {};

  // Returns every achievement with { earned, earnedDay, have, need, frac, progress }.
  // `kept` is the saved { badgeId: dayNumber } of badges already earned.
  function compute(history, lessons, cats, today, kept = {}) {
    const defs = definitions(lessons, cats);
    const entries = history
      .filter(h => h && Number.isFinite(h.date))
      .slice()
      .sort((a, b) => a.date - b.date || (a.ts || 0) - (b.ts || 0));

    const counts = {};
    let dayRun = 0, bestDay = 0, lastDay = null;
    let weekRun = 0, bestWeek = 0, lastWeek = null;
    const won = {};

    entries.forEach((h, seq) => {
      counts[h.id] = (counts[h.id] || 0) + 1;
      if (h.date !== lastDay) { dayRun = lastDay !== null && h.date - lastDay === 1 ? dayRun + 1 : 1; lastDay = h.date; }
      const w = weekOf(h.date);
      if (w !== lastWeek) { weekRun = lastWeek !== null && w - lastWeek === 1 ? weekRun + 1 : 1; lastWeek = w; }
      bestDay = Math.max(bestDay, dayRun);
      bestWeek = Math.max(bestWeek, weekRun);
      defs.forEach(d => {
        if (won[d.id]) return;
        const hit = d.kind === "day" ? bestDay >= d.goal : d.kind === "week" ? bestWeek >= d.goal : setDone(d, counts) === d.need;
        if (hit) won[d.id] = { day: h.date, seq };
      });
    });

    const liveDay = lastDay !== null && today - lastDay <= 1 ? dayRun : 0;
    const liveWeek = lastWeek !== null && weekOf(today) - lastWeek <= 1 ? weekRun : 0;

    return defs.map((d, order) => {
      const w = won[d.id];
      const keptDay = Number.isFinite(kept[d.id]) ? kept[d.id] : null;
      const earned = !!w || keptDay !== null;
      const live = d.kind === "day" ? liveDay : d.kind === "week" ? liveWeek : setDone(d, counts);
      const best = d.kind === "day" ? bestDay : d.kind === "week" ? bestWeek : live;
      const have = earned ? d.need : Math.min(live, d.need);
      const unit = d.kind === "day" ? "day" : d.kind === "week" ? "week" : "lesson";
      const bestNote = !earned && d.kind !== "set" && best > have ? ` · best ${best}` : "";
      return {
        ...d, order, have, earned, earnedDay: keptDay !== null ? keptDay : w ? w.day : null, earnedSeq: w ? w.seq : -1,
        frac: have / d.need,
        progress: `${have} of ${d.need} ${unit}${d.need === 1 ? "" : "s"}${bestNote}`,
      };
    });
  }

  const byRecent = (a, b) => b.earnedDay - a.earnedDay || b.earnedSeq - a.earnedSeq || b.need - a.need || a.order - b.order;
  const byClosest = (a, b) => b.frac - a.frac || (a.need - a.have) - (b.need - b.have) || a.order - b.order;

  // Up to 2 recently earned, then the closest to earn. If there aren't enough
  // left to earn, more earned badges fill the remaining slots.
  function pickHome(all, slots = 4) {
    const earned = all.filter(a => a.earned).sort(byRecent);
    const next = all.filter(a => !a.earned).sort(byClosest);
    const recent = earned.slice(0, 2);
    const upcoming = next.slice(0, slots - recent.length);
    const extra = earned.slice(2, 2 + slots - recent.length - upcoming.length);
    return [...recent, ...extra, ...upcoming];
  }

  // ---------- badge drawing ----------
  const GLYPHS = {
    day: '<circle cx="32" cy="21" r="4.5" fill="currentColor"/><path d="M32 11v2.5M32 28.5V31M22 21h2.500M39.500 21H42M25 14l1.800 1.800M37.200 26.200 39 28M39 14l-1.800 1.800M26.800 26.200 25 28"/>',
    week: '<rect x="23" y="13" width="18" height="17" rx="3"/><path d="M23 19.500h18M28 10.500v5M36 10.500v5"/>',
    core: '<circle cx="32" cy="21" r="9.500"/><circle cx="32" cy="21" r="3.500" fill="currentColor"/>',
    lower: '<path d="m24 13 8 7 8-7M24 22l8 7 8-7"/>',
    upper: '<path d="m24 20 8-7 8 7M24 29l8-7 8 7"/>',
    full: '<path d="m32 11 3 6.500 7 .800-5.200 4.800 1.400 7L32 26.600l-6.200 3.500 1.400-7-5.200-4.800 7-.800z" stroke-linejoin="round"/>',
    back: '<path d="M32 10c6 3.500 6 7 0 10.500s-6 7 0 10.500"/>',
  };

  function badge(a) {
    const glyph = GLYPHS[a.kind === "set" ? a.cat : a.kind] || GLYPHS.core;
    const fg = a.earned ? "#FFFFFF" : "#8F968C";
    const ring = a.earned
      ? `<circle cx="32" cy="32" r="30" fill="${a.final ? "#BC8E28" : "#56735A"}"/><circle cx="32" cy="32" r="26" fill="none" stroke="${a.final ? "#FBEFC9" : "#DCE6D8"}" stroke-width="1.500" opacity=".7"/>`
      : '<circle cx="32" cy="32" r="29" fill="#FFFCF6" stroke="#C9C3B5" stroke-width="2" stroke-dasharray="4 3.500"/>';
    return `<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">${ring}` +
      `<g fill="none" stroke="${fg}" color="${fg}" stroke-width="2.400" stroke-linecap="round">${glyph}</g>` +
      `<text x="32" y="50" text-anchor="middle" font-size="15" font-weight="700" fill="${a.earned ? "#FFFFFF" : "#6D776D"}">${a.mark}</text></svg>`;
  }

  window.ACH = { compute, pickHome, badge, weekOf, clean };
})();
