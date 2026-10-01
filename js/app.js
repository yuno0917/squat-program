/* スクワット プログラムメーカー: 画面の処理（フォーム・描画・保存・共有・実施チェック） */
(function () {
  'use strict';
  const SP = window.SP;
  const D = SP.DATA;

  const STORAGE_KEY = 'squatprog:v1';
  const DONE_KEY = 'squatprog:done:';
  const CODES = {
    level: { beginner: 'b', intermediate: 'i', advanced: 'a' },
    goal: { strength: 's', hypertrophy: 'h', both: 'x' },
    weak: { none: 'n', bottom: 'b', middle: 'm', lean: 'f' },
    equip: { gym: 'g', rack: 'r' }
  };

  const form = document.getElementById('prog-form');
  const errorBox = document.getElementById('form-error');
  const maxField = document.getElementById('max-field');
  const repsField = document.getElementById('reps-field');
  const estOut = document.getElementById('est-out');
  const levelHint = document.getElementById('level-hint');
  const resultSection = document.getElementById('result');
  const summaryMeta = document.getElementById('summary-meta');
  const factList = document.getElementById('fact-list');
  const calcLink = document.getElementById('calc-link');
  const progressRow = document.getElementById('progress-row');
  const progressText = document.getElementById('progress-text');
  const resetBtn = document.getElementById('reset-done');
  const tabsEl = document.getElementById('week-tabs');
  const panelsEl = document.getElementById('week-panels');
  const shareBtn = document.getElementById('share-btn');
  const printBtn = document.getElementById('print-btn');
  const shareBox = document.getElementById('share-box');
  const shareInput = document.getElementById('share-url');
  const shareStatus = document.getElementById('share-status');

  let current = null;
  let levelTouched = false;

  // ---- 小さな DOM ヘルパー（文字列は必ず textContent として入れる） ----
  function h(tag, props, ...children) {
    const node = document.createElement(tag);
    if (props) {
      Object.keys(props).forEach(k => {
        const v = props[k];
        if (v == null || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? '' : String(v));
      });
    }
    children.flat(Infinity).forEach(c => {
      if (c == null || c === false) return;
      node.append(c instanceof Node ? c : document.createTextNode(String(c)));
    });
    return node;
  }

  const kg = x => (Math.round(x * 100) / 100).toString();
  // 回数の表示（例: 6 → '6rep'、'10回' → '10rep'。秒で数える種目はそのまま）
  const repText = r => (typeof r === 'number' ? r + 'rep' : String(r).replace(/回$/, 'rep'));
  const rirText = rir => (rir >= 5 ? 'たっぷり残す（あと5回以上）' : 'あと' + rir + '回');

  // ---- フォームの状態 ----
  function readForm() {
    const e = form.elements;
    return {
      mode: e.mode.value, max: e.max.value, liftW: e.liftW.value, liftR: e.liftR.value, bw: e.bw.value,
      level: e.level.value, goal: e.goal.value, freq: e.freq.value, weeks: e.weeks.value, weak: e.weak.value, equip: e.equip.value
    };
  }

  function setRadio(name, value) {
    const match = Array.from(form.querySelectorAll('input[name="' + name + '"]')).find(i => i.value === String(value));
    if (match) match.checked = true;
  }

  function applyState(s) {
    if (!s || typeof s !== 'object') return;
    const e = form.elements;
    ['max', 'liftW', 'liftR', 'bw'].forEach(k => { if (s[k] != null) e[k].value = s[k]; });
    ['weeks', 'weak'].forEach(k => { if (s[k] != null) e[k].value = String(s[k]); });
    ['mode', 'level', 'goal', 'freq', 'equip'].forEach(k => { if (s[k] != null) setRadio(k, s[k]); });
    if (s.level) levelTouched = true;
    syncMode();
  }

  function currentMax(s) {
    if (s.mode === 'reps') return SP.estimate1RM(s.liftW, s.liftR);
    const m = Number(s.max);
    return m > 0 ? m : null;
  }

  function syncMode() {
    const e = form.elements;
    const reps = e.mode.value === 'reps';
    maxField.hidden = reps;
    repsField.hidden = !reps;
    const est = SP.estimate1RM(e.liftW.value, e.liftR.value);
    estOut.textContent = reps && est ? '推定MAX：' + kg(est) + 'kg' : '';
    const max = currentMax(readForm());
    const bw = Number(e.bw.value);
    const lv = SP.suggestLevel(max, bw);
    if (lv) {
      levelHint.textContent = 'MAXは体重の' + (max / bw).toFixed(2) + '倍です。目安は「' + D.levels[lv].name + '」です。';
      if (!levelTouched) setRadio('level', lv);
    } else {
      levelHint.textContent = '体重を入れると、レベルの目安が出ます。';
    }
  }

  // ---- 保存（使えないブラウザでも動くように try/catch で囲む） ----
  function save(s) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch (e) { /* 保存できなくても続行 */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // ---- URL での共有 ----
  function toParams(n, bw) {
    const p = new URLSearchParams();
    p.set('m', kg(n.max));
    p.set('lv', CODES.level[n.level]);
    p.set('g', CODES.goal[n.goal]);
    p.set('f', String(n.freq));
    p.set('wk', String(n.weeks));
    p.set('wp', CODES.weak[n.weak]);
    p.set('eq', CODES.equip[n.equip]);
    if (bw > 0) p.set('bw', kg(bw));
    return p;
  }
  const decode = (map, code) => Object.keys(map).find(k => map[k] === code);
  function fromParams(search) {
    const p = new URLSearchParams(search);
    if (!p.has('m')) return null;
    return {
      mode: 'max', max: p.get('m'), bw: p.get('bw') || '',
      level: decode(CODES.level, p.get('lv')), goal: decode(CODES.goal, p.get('g')),
      freq: p.get('f') || undefined, weeks: p.get('wk') || undefined,
      weak: decode(CODES.weak, p.get('wp')), equip: decode(CODES.equip, p.get('eq')),
      fromUrl: true, hasLevel: p.has('lv')
    };
  }
  const baseUrl = () => location.href.split(/[?#]/)[0];
  function updateUrl(n, bw) {
    try { history.replaceState(null, '', '?' + toParams(n, bw).toString()); } catch (e) { /* file:// などで失敗しても続行 */ }
  }

  // ---- 実施チェック（この端末のブラウザだけに保存） ----
  function doneKey(n) {
    return DONE_KEY + toParams(n, 0).toString();
  }
  function loadDone(n) {
    try {
      const raw = localStorage.getItem(doneKey(n));
      return new Set(raw ? JSON.parse(raw) : []);
    } catch (e) {
      return new Set();
    }
  }
  function saveDone(n, set) {
    try { localStorage.setItem(doneKey(n), JSON.stringify(Array.from(set))); } catch (e) { /* 保存できなくても続行 */ }
  }
  function totalDays(prog) {
    return prog.weeks.reduce((a, w) => a + w.days.length, 0);
  }
  function updateProgress() {
    if (!current) return;
    const done = loadDone(current.input);
    progressText.textContent = '実施済み ' + done.size + ' / ' + totalDays(current) + '日';
    progressRow.hidden = done.size === 0;
  }

  // ---- 描画: 概要 ----
  function renderSummary(prog, bw) {
    const n = prog.input;
    summaryMeta.textContent = ['MAX ' + kg(n.max) + 'kg', D.levels[n.level].name, prog.goal.name, '週' + n.freq + '回', n.weeks + '週間', D.equipments[n.equip].name].join('・');
    const mins = prog.weeks.slice(0, -1).flatMap(w => w.days.map(d => d.minutes));
    const facts = [
      h('li', null, h('span', { class: 'fact-name', text: '1週目のバックスクワット' }), h('span', { class: 'fact-val', text: '週' + prog.weeklyMainSets + 'セット' + (prog.weeklyVariationSets ? '＋' + D.weakPoints[n.weak].variation.name + ' ' + prog.weeklyVariationSets + 'セット' : '') })),
      h('li', null, h('span', { class: 'fact-name', text: '1回の時間' }), h('span', { class: 'fact-val', text: '約' + Math.min(...mins) + '〜' + Math.max(...mins) + '分' }))
    ];
    if (prog.attempts) {
      facts.push(h('li', null, h('span', { class: 'fact-name', text: n.weeks + '週目に測る重さ' }), h('span', { class: 'fact-val', text: prog.attempts.map(a => kg(a.weight)).join(' → ') + 'kg' })));
    } else {
      facts.push(h('li', null, h('span', { class: 'fact-name', text: n.weeks + '週目' }), h('span', { class: 'fact-val', text: '回数で新しいMAXを推定' })));
    }
    factList.replaceChildren(...facts);

    const cp = new URLSearchParams();
    cp.set('m', kg(n.max));
    if (bw > 0) cp.set('bw', kg(bw));
    cp.set('wk', String(n.weeks));
    cp.set('f', n.freq === 2 ? '2' : '3');
    calcLink.href = '/squat-goal/?' + cp.toString();
    updateProgress();
  }

  // ---- 描画: 週と日 ----
  function warmupBlock(list) {
    if (!list || !list.length) return null;
    return h('details', { class: 'warmup' },
      h('summary', null, h('span', { class: 'wu-title', text: 'ウォームアップ' }), h('span', { class: 'wu-line' }, list.map((w, i) => [i ? ' → ' : null, h('span', { class: 'wu-step', text: kg(w.weight) + 'kg ×' + w.reps + 'rep' })]))),
      h('ol', { class: 'wu-list' }, list.map(w => h('li', null,
        h('span', { class: 'ts-weight', text: kg(w.weight) + 'kg ×' + w.reps + 'rep' }),
        h('span', { class: 'ts-note', text: SP.formatPlates(w.weight) })
      )))
    );
  }

  function renderExercise(e) {
    if (e.kind === 'acc') {
      return h('li', { class: 'ex ex-acc' },
        h('div', { class: 'ex-top' },
          h('span', { class: 'ex-name', text: e.name }),
          h('span', { class: 'ex-part', text: e.target })
        ),
        h('div', { class: 'ex-load' }, h('span', { class: 'ex-sets-big', text: repText(e.repsText) + ' ' + e.sets + 'set' })),
        h('div', { class: 'ex-meta' },
          e.rirText ? h('span', { text: '余力 ' + e.rirText }) : null,
          h('span', { text: '休憩 ' + e.rest })
        ),
        h('p', { class: 'ex-cue', text: e.cue })
      );
    }
    return h('li', { class: 'ex' + (e.kind === 'variation' ? ' ex-var' : '') },
      h('div', { class: 'ex-top' },
        h('span', { class: 'ex-name', text: e.name }),
        e.kind === 'variation' ? h('span', { class: 'badge badge-var', text: '苦手に合わせた種目' }) : null
      ),
      h('div', { class: 'ex-load' },
        h('span', { class: 'ex-weight' }, kg(e.weight), h('small', { text: 'kg' })),
        h('span', { class: 'ex-sets', text: '×' + repText(e.reps) + ' ' + e.sets + 'set' })
      ),
      h('div', { class: 'ex-meta' },
        h('span', { text: '余力 ' + rirText(e.rir) }),
        h('span', { text: '休憩 ' + e.rest }),
        h('span', { text: SP.formatPlates(e.weight) })
      ),
      e.cue ? h('p', { class: 'ex-cue', text: e.cue }) : null
    );
  }

  function rebuildWith(max) {
    const e = form.elements;
    setRadio('mode', 'max');
    e.max.value = kg(max);
    syncMode();
    if (generate()) {
      resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function nextCycleBox(kind, weight) {
    const input = h('input', { type: 'number', inputmode: kind === 'check' ? 'numeric' : 'decimal', min: '1', step: kind === 'check' ? '1' : '0.5', 'aria-label': kind === 'check' ? 'できた回数' : '挙がった重さ（kg）' });
    const out = h('p', { class: 'next-out', 'aria-live': 'polite' });
    const btn = h('button', { type: 'button', class: 'secondary', hidden: true, text: 'このMAXで次のプログラムを作る' });
    let value = null;
    input.addEventListener('input', () => {
      const v = Number(input.value);
      value = null;
      if (kind === 'check') {
        if (v >= 1) {
          // あと1回できる余力を残しているので、1回足して推定する
          value = SP.estimate1RM(weight, v + 1);
          out.textContent = '推定MAX：' + kg(Math.round(value * 2) / 2) + 'kg' + (v + 1 > 10 ? '（10回を超える分は数えない控えめな推定です）' : '');
        } else out.textContent = '';
      } else {
        value = v >= 20 ? v : null;
        out.textContent = value ? '新しいMAX：' + kg(value) + 'kg' : '';
      }
      btn.hidden = !value;
    });
    btn.addEventListener('click', () => { if (value) rebuildWith(Math.round(value * 2) / 2); });
    return h('div', { class: 'next-cycle' },
      h('label', { class: 'next-label' }, h('span', { text: kind === 'check' ? 'できた回数' : '挙がった一番重い重さ' }), h('span', { class: 'num' }, input, h('span', { class: 'unit', text: kind === 'check' ? '回' : 'kg' }))),
      out, btn
    );
  }

  function renderDay(d, w, done) {
    const id = w.week + '-' + d.name;
    const check = h('input', { type: 'checkbox', class: 'done-check', 'aria-label': '第' + w.week + '週 ' + d.name + ' をやった' });
    check.checked = done.has(id);
    check.addEventListener('change', () => {
      const set = loadDone(current.input);
      if (check.checked) set.add(id); else set.delete(id);
      saveDone(current.input, set);
      card.classList.toggle('is-done', check.checked);
      updateProgress();
    });
    const title = h('h4', { class: 'day-title' },
      d.name + '　' + d.label,
      d.type === 'test' ? h('span', { class: 'badge badge-test', text: '測定' }) : null,
      h('span', { class: 'day-minutes', text: '約' + d.minutes + '分' }),
      h('label', { class: 'done-label' }, check, h('span', { text: 'やった' }))
    );
    let body;
    if (d.type === 'test') {
      body = [
        h('p', { class: 'day-lead', text: (w.days.length > 1 ? '軽めの確認の日から2〜3日' : '前の週の最後のトレーニングから3日以上') + 'あけて行います。1本ごとに5分ほど休みます。補助者をつけるか、セーフティバーを正しい高さにしてください。' }),
        h('ol', { class: 'test-steps' },
          d.warmup.map(x => h('li', null, h('span', { class: 'ts-weight', text: kg(x.weight) + 'kg ×' + x.reps + 'rep' }), h('span', { class: 'ts-note', text: 'ウォームアップ・' + x.plates }))),
          d.attempts.map((a, i) => h('li', { class: 'is-attempt' }, h('span', { class: 'ts-weight', text: (i + 1) + '本目 ' + kg(a.weight) + 'kg ×1rep' }), h('span', { class: 'ts-note', text: a.note + '・' + a.plates })))
        ),
        h('p', { class: 'test-next', text: '1本目が楽に挙がったら2本目へ。きつかったら、そこで終わりにします。' }),
        nextCycleBox('test')
      ];
    } else if (d.type === 'check') {
      body = [
        h('p', { class: 'day-lead', text: (w.days.length > 1 ? '軽い日から2〜3日' : '前の週の最後のトレーニングから3日以上') + 'あけて行います。ウォームアップのあと、' + kg(d.weight) + 'kg（今のMAXの' + Math.round(D.checkPct * 100) + '%）で1セットだけ、あと1回できるところまで続けます。' }),
        h('ol', { class: 'test-steps' },
          d.warmup.map(x => h('li', null, h('span', { class: 'ts-weight', text: kg(x.weight) + 'kg ×' + x.reps + 'rep' }), h('span', { class: 'ts-note', text: 'ウォームアップ・' + x.plates }))),
          h('li', { class: 'is-attempt' }, h('span', { class: 'ts-weight', text: kg(d.weight) + 'kg ×できるだけ' }), h('span', { class: 'ts-note', text: 'あと1回できるところで止める・' + d.plates }))
        ),
        nextCycleBox('check', d.weight)
      ];
    } else {
      body = [warmupBlock(d.warmup), h('ul', { class: 'ex-list' }, d.exercises.map(renderExercise))];
    }
    const card = h('article', { class: 'day' + (d.type === 'test' || d.type === 'check' ? ' day-test' : '') + (check.checked ? ' is-done' : '') }, title, body);
    return card;
  }

  function renderWeek(w, i, done) {
    const isEnd = w.phase === 'test' || w.phase === 'reps';
    const panel = h('section', {
      class: 'week-panel', role: 'tabpanel', id: 'panel-w' + w.week,
      'aria-labelledby': 'tab-w' + w.week, tabindex: '0', hidden: i !== 0
    });
    panel.append(
      h('div', { class: 'week-head' },
        h('h3', null, '第' + w.week + '週', h('span', { class: 'badge' + (isEnd ? ' badge-test' : ''), text: w.phaseName })),
        h('p', { class: 'week-note', text: w.note })
      ),
      h('div', { class: 'days' }, w.days.map(d => renderDay(d, w, done)))
    );
    return panel;
  }

  function renderMenu(prog) {
    const done = loadDone(prog.input);
    tabsEl.replaceChildren(...prog.weeks.map((w, i) => {
      const isEnd = w.phase === 'test' || w.phase === 'reps';
      return h('button', {
        type: 'button', role: 'tab', id: 'tab-w' + w.week, 'aria-controls': 'panel-w' + w.week,
        'aria-selected': i === 0 ? 'true' : 'false', tabindex: i === 0 ? '0' : '-1',
        class: 'tab' + (isEnd ? ' is-test' : ''), onclick: () => selectWeek(i, false)
      }, h('span', { text: w.week + '週' }), isEnd ? h('span', { class: 'tab-tag', text: w.phaseName }) : null);
    }));
    panelsEl.replaceChildren(...prog.weeks.map((w, i) => renderWeek(w, i, done)));
  }

  function selectWeek(index, focus) {
    const tabs = Array.from(tabsEl.children);
    const panels = Array.from(panelsEl.children);
    tabs.forEach((t, i) => {
      const on = i === index;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach((p, i) => { p.hidden = i !== index; });
    const tab = tabs[index];
    if (tab) {
      if (focus) tab.focus();
      tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  tabsEl.addEventListener('keydown', e => {
    const tabs = Array.from(tabsEl.children);
    const cur = tabs.indexOf(document.activeElement);
    if (cur < 0) return;
    let next = null;
    if (e.key === 'ArrowRight') next = (cur + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') next = (cur - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = tabs.length - 1;
    if (next == null) return;
    e.preventDefault();
    selectWeek(next, true);
  });

  // ---- 作成 ----
  function generate() {
    const s = readForm();
    const n = SP.normalizeInput({ max: currentMax(s), level: s.level, goal: s.goal, freq: s.freq, weeks: s.weeks, weak: s.weak, equip: s.equip });
    const errors = SP.validate(n);
    if (errors.length) {
      errorBox.replaceChildren(...errors.map(t => h('span', { class: 'error-line', text: t })));
      errorBox.hidden = false;
      return false;
    }
    errorBox.hidden = true;
    const bw = Number(s.bw);
    current = SP.buildProgram(n);
    renderSummary(current, bw);
    renderMenu(current);
    resultSection.hidden = false;
    shareBox.hidden = true;
    save(s);
    updateUrl(current.input, bw);
    return true;
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (generate()) resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  form.addEventListener('change', e => {
    if (e.target.name === 'level') levelTouched = true;
    if (e.target.name === 'mode') syncMode();
  });
  form.addEventListener('input', e => {
    if (['liftW', 'liftR', 'max', 'bw'].indexOf(e.target.name) >= 0) syncMode();
  });

  resetBtn.addEventListener('click', () => {
    if (!current) return;
    saveDone(current.input, new Set());
    Array.from(panelsEl.querySelectorAll('.done-check')).forEach(c => { c.checked = false; });
    Array.from(panelsEl.querySelectorAll('.day.is-done')).forEach(c => c.classList.remove('is-done'));
    updateProgress();
  });

  shareBtn.addEventListener('click', async () => {
    if (!current) return;
    const url = baseUrl() + '?' + toParams(current.input, Number(form.elements.bw.value)).toString();
    shareInput.value = url;
    shareBox.hidden = false;
    try {
      await navigator.clipboard.writeText(url);
      shareStatus.textContent = 'リンクをコピーしました。開くと同じプログラムが表示されます。';
    } catch (e) {
      shareInput.focus();
      shareInput.select();
      shareStatus.textContent = 'リンクを選択しました。コピーして共有してください。';
    }
  });

  // 印刷するときは、ウォームアップの内訳も開いておく
  window.addEventListener('beforeprint', () => {
    Array.from(document.querySelectorAll('details.warmup')).forEach(d => { d.open = true; });
  });
  printBtn.addEventListener('click', () => window.print());

  // ---- 起動時: URL のパラメータ → 前回の入力 の順で復元 ----
  const fromUrl = fromParams(location.search);
  const initial = fromUrl || load();
  if (initial) {
    applyState(initial);
    if (fromUrl && !fromUrl.hasLevel) levelTouched = false;
    syncMode();
    if (currentMax(readForm())) generate();
  } else {
    syncMode();
  }
})();
