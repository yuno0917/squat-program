/* スクワット プログラムメーカー: 設定値（研究の数字とメニューの組み方） */
(function (root) {
  'use strict';
  const SP = root.SP = root.SP || {};

  SP.DATA = {
    weekOptions: [4, 6, 8, 10, 12],
    defaultWeeks: 8,
    step: 2.5,
    bar: 20,
    plates: [20, 15, 10, 5, 2.5, 1.25],

    // 伸びの見込み（1週あたり、始めのMAXに対する%）。
    // スクワット伸び計算機と同じく、体重比1.0倍・1.5倍・2.0倍の研究の幅を使う。
    levels: {
      beginner: { name: '初心者', hint: 'MAXが体重の1.25倍未満', low: 2.0, high: 3.5, heavySets: 3 },
      intermediate: { name: '中級者', hint: '体重の1.25〜1.75倍', low: 1.0, high: 2.0, heavySets: 3 },
      advanced: { name: '上級者', hint: '体重の1.75倍以上', low: 0.5, high: 1.5, heavySets: 4 }
    },
    levelCut: [1.25, 1.75],
    // 9週目からは半分のペースで控えめに見込む
    fullRateWeeks: 8,
    lateFactor: 0.5,

    // 目的ごとの段階。heavy は重い日、volume は回数の日の回数と余力（あと何回できるか）。
    goals: {
      strength: {
        name: 'MAXを伸ばす',
        ending: 'test',
        heavySetsAdd: 0,
        accessoryCount: 2,
        accessorySets: 3,
        accessoryRir: 'あと2〜3回',
        phases: [
          { key: 'base', name: '基礎', share: 0.4, heavy: { reps: [6], rir: [3, 2] }, volume: { reps: [9], rir: [3, 2], sets: 3 }, note: '6回で、フォームを固めながら量をこなす段階です。' },
          { key: 'strength', name: '筋力', share: 0.35, heavy: { reps: [4], rir: [2, 1] }, volume: { reps: [7], rir: [3, 2], sets: 3 }, note: '4回で、MAXの80%を超える重さに慣れる段階です。' },
          { key: 'peak', name: '仕上げ', heavy: { reps: [3, 2], rir: [2, 1] }, volume: { reps: [5], rir: [3, 2], sets: 2 }, note: '3回と2回で、MAXに近い重さに体を慣らす段階です。' }
        ]
      },
      hypertrophy: {
        name: '脚を太くする',
        ending: 'reps',
        heavySetsAdd: 1,
        accessoryCount: 3,
        accessorySets: 3,
        accessoryRir: 'あと1〜2回',
        phases: [
          { key: 'h1', name: '慣らし', share: 0.35, heavy: { reps: [12], rir: [3, 2] }, volume: { reps: [15], rir: [3, 2], sets: 3 }, note: '12回で、筋肉が大きくなる刺激に体を慣らす段階です。' },
          { key: 'h2', name: '積み上げ', share: 0.35, heavy: { reps: [10], rir: [2, 1] }, volume: { reps: [12], rir: [2, 1], sets: 4 }, note: '10回で、セット数を増やして量を積み上げる段階です。' },
          { key: 'h3', name: '追い込み', heavy: { reps: [8], rir: [1, 1] }, volume: { reps: [10], rir: [1, 1], sets: 4 }, note: '8回で、限界の近くまで行う段階です。' }
        ]
      },
      both: {
        name: '両方（MAXと脚の太さ）',
        ending: 'test',
        heavySetsAdd: 0,
        accessoryCount: 3,
        accessorySets: 3,
        accessoryRir: 'あと1〜2回',
        phases: [
          { key: 'base', name: '基礎', share: 0.4, heavy: { reps: [6], rir: [3, 2] }, volume: { reps: [10], rir: [2, 2], sets: 3 }, note: '重い日は6回、回数の日は10回で、量を積み上げる段階です。' },
          { key: 'strength', name: '筋力', share: 0.35, heavy: { reps: [5], rir: [2, 1] }, volume: { reps: [10], rir: [2, 1], sets: 4 }, note: '重い日は5回で重さに慣れ、回数の日で脚を太くします。' },
          { key: 'peak', name: '仕上げ', heavy: { reps: [3], rir: [2, 1] }, volume: { reps: [8], rir: [2, 2], sets: 3 }, note: '重い日は3回で、MAXに近い重さに体を慣らす段階です。' }
        ]
      }
    },

    // 週の回数ごとの日の並び
    dayPlan: {
      1: ['heavy'],
      2: ['heavy', 'volume'],
      3: ['heavy', 'light', 'volume']
    },
    // 脚を太くする目的の週3回は、軽い日のかわりに中くらいの日にする
    dayPlanHypertrophy3: ['heavy', 'medium', 'volume'],
    dayTypes: {
      heavy: { name: '重い日', rest: '3〜5分' },
      light: { name: '軽い日', rest: '2〜3分', rirAdd: 5, sets: 2 },
      medium: { name: '中くらいの日', rest: '3〜4分', rirAdd: 2, sets: 3 },
      volume: { name: '回数の日', rest: '3〜4分' }
    },
    maxMainSets: 5,

    // 弱点に合わせた種目（研究で効果が確かめられた方法ではなく、指導の現場でよく使われる方法）
    weakPoints: {
      none: { name: '特になし・わからない', variation: null },
      bottom: {
        name: 'しゃがんだ一番下で止まる',
        variation: { id: 'pause', name: 'ポーズスクワット', factor: 0.87, reps: 3, rir: 3, sets: 3, cue: '一番下で2秒止まってから立ち上がります。反動を使わずに切り返す練習です。' }
      },
      middle: {
        name: '立ち上がる途中で止まる',
        variation: { id: 'pin', name: 'ピンスクワット', factor: 0.85, reps: 3, rir: 3, sets: 3, cue: 'セーフティバーを止まりやすい高さに合わせ、バーをのせた状態から立ち上がります。' }
      },
      lean: {
        name: '上体が前に倒れる',
        variation: { id: 'front', name: 'フロントスクワット', factor: 0.8, reps: 5, rir: 3, sets: 3, cue: 'バーを肩の前にのせ、上体を起こしたまましゃがみます。' }
      }
    },

    accessories: {
      rdl: { name: 'ルーマニアンデッドリフト', reps: '8〜10回', target: '太ももの裏・お尻', cue: '膝を軽く曲げたまま、お尻を後ろに引いてバーを下ろします。' },
      bulgarian: { name: 'ブルガリアンスクワット', reps: '8〜12回', target: '太もも・お尻', cue: '片脚ずつ行います。後ろ足をベンチにのせ、前の脚で深くしゃがみます。' },
      leg_press: { name: 'レッグプレス', reps: '10〜15回', target: '太ももの前', cue: 'お尻が浮かない範囲で、深く下ろします。' },
      seated_curl: { name: 'シーテッドレッグカール', reps: '10〜15回', target: '太ももの裏', cue: '座って行うと、太ももの裏が伸びた位置で負荷がかかります。', long: true },
      leg_ext: { name: 'レッグエクステンション', reps: '12〜15回', target: '太ももの前', cue: '膝を伸ばしきったところで1秒止めます。' },
      hip_thrust: { name: 'ヒップスラスト', reps: '8〜12回', target: 'お尻', cue: '肩をベンチにのせ、お尻を持ち上げます。' },
      goblet: { name: 'ゴブレットスクワット', reps: '10〜15回', target: '太もも', cue: 'ダンベルを胸の前で持ち、上体を起こしてしゃがみます。' },
      plank: { name: 'プランク', reps: '30〜45秒', target: '体幹', cue: '頭からかかとまで一直線に保ちます。', timed: true }
    },
    // 日の種類ごとの補助種目（前から順に使う）
    accPlan: {
      gym: {
        heavy: ['rdl', 'bulgarian', 'plank'],
        volume: ['leg_press', 'seated_curl', 'leg_ext'],
        light: ['hip_thrust', 'plank', 'leg_ext'],
        medium: ['bulgarian', 'seated_curl', 'plank']
      },
      rack: {
        heavy: ['rdl', 'bulgarian', 'plank'],
        volume: ['goblet', 'hip_thrust', 'bulgarian'],
        light: ['hip_thrust', 'plank', 'goblet'],
        medium: ['bulgarian', 'rdl', 'plank']
      }
    },
    equipments: {
      gym: { name: 'ジム', hint: 'マシンが使える' },
      rack: { name: 'ラックとダンベルだけ', hint: '自宅やマシンのない場所' }
    },

    // ウォームアップ（その日の重さに対する割合と回数）。バーだけの10回から始める。
    warmup: {
      normal: [{ pct: 0.4, reps: 5 }, { pct: 0.6, reps: 3 }, { pct: 0.8, reps: 2 }],
      light: [{ pct: 0.6, reps: 5 }],
      test: [{ pct: 0.5, reps: 5 }, { pct: 0.7, reps: 3 }, { pct: 0.8, reps: 2 }, { pct: 0.9, reps: 1 }]
    },
    // 回数チェック（脚を太くする目的の最後の週）の重さ
    checkPct: 0.8,

    // 所要時間の目安（分）
    minutes: { warmupSet: 1.5, heavy: 4, light: 2.5, medium: 3.5, volume: 3.5, variation: 3, accessory: 2, fixed: 5 }
  };
})(typeof window !== 'undefined' ? window : globalThis);
