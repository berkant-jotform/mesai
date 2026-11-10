const A = require('../src/ask.js'), assert = require('assert');
const P = (t) => A.parse(t, 1); // today = Tuesday
const cases = [
  ['cuma kaçta çıkarım?', { kind: 'when', day: 4 }],
  ['yarın 10’da gelip 20’de çıkacağım', { kind: 'plan', day: 2, s: 600, e: 1200 }],
  ['cuma 16:00’da çıkmak istiyorum', { kind: 'leaveAt', day: 4, e: 960 }],
  ['Cuma 5te çıkarım', { kind: 'leaveAt', day: 4, e: 1020 }],
  ['perşembe izinliyim', { kind: 'type', day: 3, type: 'izin' }],
  ['cuma izin alsam?', { kind: 'type', day: 4, type: 'izin' }],
  ['çarşamba tatil', { kind: 'type', day: 2, type: 'tatil' }],
  ['bugün 1 saat OOO aldım', { kind: 'ooo', day: 1, m: 60, s: null }],
  ['OOO’yu 2 saat yap', { kind: 'ooo', day: 1, m: 120, s: null }],
  ['perşembe 14:00 2 saat ooo', { kind: 'ooo', day: 3, m: 120, s: 840 }],
  ['yarım saat ooo', { kind: 'ooo', day: 1, m: 30, s: null }],
  ['şimdi çıksam?', { kind: 'leaveNow', day: 1 }],
  ['geçen hafta?', { kind: 'history' }],
  ['ne kadar kaldı', { kind: 'remaining' }],
  ['sıfırla', { kind: 'reset' }],
  ['perşembe 9.30 da gelirim', { kind: 'arrive', day: 3, s: 570 }],
  ['when do I leave on friday', { kind: 'when', day: 4 }],
  ['leave friday at 15:30', { kind: 'leaveAt', day: 4, e: 930 }],
  ['tomorrow come 10 leave 19', { kind: 'plan', day: 2, s: 600, e: 1140 }],
  ['cumartesi 3 saat', { kind: 'length', day: 5, m: 180 }],
  ['merhaba', null]
];
cases.forEach(([q, exp]) => assert.deepEqual(P(q), exp, q));
const extra = [
  ['tomorrow 45 minutes off', { kind: 'ooo', day: 2, m: 45, s: null }],
  ['Friday off', { kind: 'type', day: 4, type: 'izin' }],
  ['tomorrow 9am to 5:30pm', { kind: 'plan', day: 2, s: 540, e: 1050 }],
  ['Friday arrive at 12am', { kind: 'arrive', day: 4, s: 0 }],
  ['Friday leave at 12pm', { kind: 'leaveAt', day: 4, e: 720 }],
  ['Friday 9h30m', { kind: 'length', day: 4, m: 570 }],
  ['Friday 9:30 hours', { kind: 'length', day: 4, m: 570 }],
  ['Friday 9.25 hours', { kind: 'length', day: 4, m: 555 }]
];
extra.forEach(([q, exp]) => assert.deepEqual(P(q), exp, q));
console.log((cases.length + extra.length) + ' ask tests passed');
