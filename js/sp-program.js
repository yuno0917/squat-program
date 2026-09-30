/* スクワット プログラムメーカー: プログラムの作成（DOM に触れない純粋な関数） */
(function (root) {
  'use strict';
  const SP = root.SP = root.SP || {};
  const D = SP.DATA;

  const EPS = 1e-9;
  const r3 = n => Math.round(n * 1000) / 1000;
  const roundTo = (x, step) => r3(Math.round(x / step) * step);
  const floorTo = (x, step) => r3(Math.floor(x / step + EPS) * step);
  const round5 = x => Math.max(5, Math.round(x / 5) * 5);

  // 重量 × 回数から MAX を推定する（Epley の式、回数は10回まで）
  function estimate1RM(weight, reps) {
    const w = Number(weight);
    let r = Math.round(Number(reps));
    if (!(w > 0) || !(r >= 1)) return null;
    if (r > 10) r = 10;
    if (r === 1) return w;
    return Math.round(w * (1 + r / 30) * 100) / 100;
  }

  // 片側に付けるプレートを大きい順に選ぶ
  function platesPerSide(total) {
    let side = r3((total - D.bar) / 2);
    const plates = [];
    if (side <= 0) return { plates, remainder: 0 };
    for (const p of D.plates) {
      while (side >= p - EPS) {
        plates.push(p);
        side = r3(side - p);
      }
    }
    return { plates, remainder: side };
  }

  function formatPlates(total) {
    const p = platesPerSide(total).plates;
    return p.length ? '片側 ' + p.join(' + ') : 'バーのみ';
  }

  // 体重比からレベルの目安を出す
  function suggestLevel(max, bw) {
    if (!(max > 0) || !(bw > 0)) return null;
    const ratio = max / bw;
    if (ratio < D.levelCut[0]) return 'beginner';
    if (ratio < D.levelCut[1]) return 'intermediate';
    return 'advanced';
  }

  // weeks 週間の伸びの見込み（%）。8週までは rate のまま、9週目からは半分のペース。
  function gainPct(weeks, rate) {
    const full = Math.min(weeks, D.fullRateWeeks);
    const late = Math.max(0, weeks - D.fullRateWeeks);
    return rate * full + rate * D.lateFactor * late;
  }

  // reps 回を、あと rir 回できる余力を残して終える重さ（MAX に対する割合）
  function loadPct(reps, rir) {
    return 1 / (1 + (reps + rir) / 30);
  }

  function weightFor(projMax, reps, rir) {
    return Math.max(D.bar, roundTo(projMax * loadPct(reps, rir), D.step));
  }

  // 最後の週を除いた週を、目的の3つの段階に分ける
  function allocatePhases(trainWeeks, phases) {
    let a = Math.max(1, Math.round(trainWeeks * phases[0].share));
    let b = Math.max(1, Math.round(trainWeeks * phases[1].share));
    let c = trainWeeks - a - b;
    while (c < 1) {
      if (a >= b && a > 1) a--;
      else if (b > 1) b--;
      else break;
      c = trainWeeks - a - b;
    }
    return [a, b, c];
  }

  // バーだけの10回から、その日の重さの手前まで
  function warmupFor(weight, kind) {
    const out = [{ weight: D.bar, reps: 10 }];
    D.warmup[kind].forEach(w => {
      const kg = Math.max(D.bar, roundTo(weight * w.pct, D.step));
      if (kg < weight - EPS && kg > out[out.length - 1].weight + EPS) out.push({ weight: kg, reps: w.reps });
    });
    if (weight <= D.bar + EPS) return [];
    return out;
  }

  function normalizeInput(input) {
    const i = input || {};
    const num = v => (v === '' || v == null ? NaN : Number(v));
    const pick = (obj, v, def) => (Object.prototype.hasOwnProperty.call(obj, v) ? v : def);
    let weeks = Math.round(num(i.weeks));
    if (D.weekOptions.indexOf(weeks) < 0) weeks = D.defaultWeeks;
    const f = Math.round(num(i.freq));
    return {
      max: num(i.max),
      level: pick(D.levels, i.level, 'beginner'),
      goal: pick(D.goals, i.goal, 'strength'),
      freq: f >= 1 && f <= 3 ? f : 2,
      weeks,
      weak: pick(D.weakPoints, i.weak, 'none'),
      equip: pick(D.equipments, i.equip, 'gym')
    };
  }

  function validate(n) {
    return n.max >= 20 && n.max <= 400 ? [] : ['スクワットのMAXを20〜400kgの範囲で入れてください。'];
  }

  function mainLift(weight, sets, reps, rir, rest, max) {
    return { kind: 'main', name: 'バックスクワット', sets, reps, rir, weight, pctOfMax: weight / max, plates: formatPlates(weight), rest };
  }

  function dayMinutes(day, typeKey) {
    const M = D.minutes;
    let m = M.fixed + (day.warmup ? day.warmup.length : 0) * M.warmupSet;
    day.exercises.forEach(e => {
      if (e.kind === 'main') m += e.sets * M[typeKey];
      else if (e.kind === 'variation') m += e.sets * M.variation;
      else m += e.sets * M.accessory;
    });
    return round5(m);
  }

  function buildProgram(input) {
    const n = normalizeInput(input);
    const L = D.levels[n.level];
    const G = D.goals[n.goal];
    const max = n.max;
    const rates = { low: L.low, high: L.high };
    const alloc = allocatePhases(n.weeks - 1, G.phases);
    const plan = n.goal === 'hypertrophy' && n.freq === 3 ? D.dayPlanHypertrophy3 : D.dayPlan[n.freq];
    const variation = D.weakPoints[n.weak].variation;
    const varDay = variation ? (n.freq === 1 ? 0 : 1) : -1;
    const heavySets = Math.min(D.maxMainSets, L.heavySets + G.heavySetsAdd + (n.freq === 1 ? 1 : 0));
    const proj = w => max * (1 + gainPct(w - 1, rates.low) / 100);
    const pickBy = (arr, i, len) => arr[Math.min(arr.length - 1, Math.floor(i * arr.length / len))];
    const lerp = (pair, t) => Math.round(pair[0] + (pair[1] - pair[0]) * t);

    const seq = [];
    G.phases.forEach((ph, pi) => {
      for (let i = 0; i < alloc[pi]; i++) seq.push({ ph, i, len: alloc[pi] });
    });

    const weeks = seq.map((s, idx) => {
      const week = idx + 1;
      const ph = s.ph;
      const t = s.len === 1 ? 0 : s.i / (s.len - 1);
      const hReps = pickBy(ph.heavy.reps, s.i, s.len);
      const hRir = lerp(ph.heavy.rir, t);
      const vReps = pickBy(ph.volume.reps, s.i, s.len);
      const vRir = lerp(ph.volume.rir, t);
      const pm = proj(week);

      const days = plan.map((type, di) => {
        const dt = D.dayTypes[type];
        let sets, reps, rir;
        if (type === 'heavy') { sets = heavySets; reps = hReps; rir = hRir; }
        else if (type === 'volume') { sets = ph.volume.sets; reps = vReps; rir = vRir; }
        else { sets = dt.sets; reps = hReps; rir = hRir + dt.rirAdd; }
        const weight = weightFor(pm, reps, rir);
        const exercises = [mainLift(weight, sets, reps, rir, dt.rest, max)];
        if (di === varDay) {
          const vw = weightFor(pm * variation.factor, variation.reps, variation.rir);
          exercises.push({
            kind: 'variation', id: variation.id, name: variation.name, sets: variation.sets, reps: variation.reps,
            rir: variation.rir, weight: vw, pctOfMax: vw / max, plates: formatPlates(vw), rest: '3分', cue: variation.cue
          });
        }
        const accCount = Math.max(1, G.accessoryCount - (di === varDay ? 1 : 0));
        D.accPlan[n.equip][type].slice(0, accCount).forEach(id => {
          const a = D.accessories[id];
          exercises.push({
            kind: 'acc', id, name: a.name, sets: G.accessorySets, repsText: a.reps,
            rirText: a.timed ? null : G.accessoryRir, rest: '1〜2分', cue: a.cue, target: a.target, long: !!a.long
          });
        });
        const day = {
          name: 'Day' + (di + 1), type, label: dt.name,
          warmup: warmupFor(weight, type === 'light' ? 'light' : 'normal'),
          exercises
        };
        day.minutes = dayMinutes(day, type);
        return day;
      });
      return { week, phase: ph.key, phaseName: ph.name, note: ph.note, projMax: pm, days };
    });

    // 最後の週
    const last = n.weeks;
    const pmLast = proj(last);
    const lowGain = max * gainPct(last, rates.low) / 100;
    const highGain = max * gainPct(last, rates.high) / 100;
    let lastDays;
    let attempts = null;
    if (G.ending === 'test') {
      const a1 = Math.max(floorTo(max + lowGain * 0.5, D.step), floorTo(max, D.step));
      const a2 = Math.max(roundTo(max + lowGain, D.step), a1 + D.step);
      const a3 = Math.max(roundTo(max + (lowGain + highGain) / 2, D.step), a2 + D.step);
      attempts = [
        { weight: a1, plates: formatPlates(a1), note: '確実に挙げたい重さ' },
        { weight: a2, plates: formatPlates(a2), note: '控えめな見込み' },
        { weight: a3, plates: formatPlates(a3), note: '調子が良ければ' }
      ];
      const test = {
        name: 'Day' + (n.freq === 1 ? 1 : 2), type: 'test', label: 'MAX測定',
        warmup: warmupFor(a1, 'test').map(w => Object.assign({ plates: formatPlates(w.weight) }, w)),
        attempts, exercises: []
      };
      test.minutes = round5(D.minutes.fixed + (test.warmup.length + attempts.length) * 4);
      lastDays = [test];
      if (n.freq >= 2) {
        const ow = weightFor(pmLast, 2, 3);
        const opener = { name: 'Day1', type: 'opener', label: '軽めの確認', warmup: warmupFor(ow, 'normal'), exercises: [mainLift(ow, 2, 2, 3, '3〜5分', max)] };
        opener.minutes = dayMinutes(opener, 'light');
        lastDays.unshift(opener);
      }
    } else {
      const cw = Math.max(D.bar, roundTo(max * D.checkPct, D.step));
      const check = {
        name: 'Day' + (n.freq === 1 ? 1 : 2), type: 'check', label: '回数チェック', weight: cw, plates: formatPlates(cw),
        warmup: warmupFor(cw, 'normal').map(w => Object.assign({ plates: formatPlates(w.weight) }, w)), exercises: []
      };
      check.minutes = round5(D.minutes.fixed + check.warmup.length * D.minutes.warmupSet + 5);
      lastDays = [check];
      if (n.freq >= 2) {
        // 疲れを抜く週なので、伸びを見込まない今のMAXから軽めに決める
        const lw = weightFor(max, 8, 6);
        const light = { name: 'Day1', type: 'light', label: '軽い日', warmup: warmupFor(lw, 'light'), exercises: [mainLift(lw, 2, 8, 6, '2〜3分', max)] };
        light.minutes = dayMinutes(light, 'light');
        lastDays.unshift(light);
      }
    }
    const lastNote = G.ending === 'test'
      ? '量を減らして疲れを抜き、週の最後にMAXを測ります。'
      : '量を減らして疲れを抜き、週の最後に回数で今の力を確かめます。';
    weeks.push({ week: last, phase: G.ending, phaseName: G.ending === 'test' ? '測定' : '確認', note: lastNote, projMax: pmLast, days: lastDays });

    const setsOf = kind => weeks[0].days.reduce((a, d) => a + d.exercises.filter(e => e.kind === kind).reduce((b, e) => b + e.sets, 0), 0);
    return { input: n, level: L, goal: G, rates, alloc, weeks, attempts, weeklyMainSets: setsOf('main'), weeklyVariationSets: setsOf('variation'), lowGain, highGain };
  }

  Object.assign(SP, {
    estimate1RM, platesPerSide, formatPlates, suggestLevel, gainPct, loadPct, weightFor, allocatePhases,
    warmupFor, normalizeInput, validate, buildProgram
  });
})(typeof window !== 'undefined' ? window : globalThis);
