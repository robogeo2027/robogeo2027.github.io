/* RoboGeo main-results leaderboard (paper Table 2).
 *
 * Values: pnorm/ext/img/cal are the Sedan viewpoint-perturbation block
 * (P_NORMAL, then mVRS %); suvO/suvImg/suvCal and busO/busImg/busCal are
 * the cross-platform blocks (P_oracle, then CTS %). Higher is better.
 */
(function () {
  'use strict';

  var FAMILY = {
    fp: { label: 'Forward-proj.', cls: 'rg-fam-fp' },
    bp: { label: 'Backward-proj.', cls: 'rg-fam-bp' },
    pf: { label: 'Projection-free', cls: 'rg-fam-pf' }
  };

  var DATA = {
    det: [
      { model: 'BEVDet', mark: '†', fam: 'fp', pnorm: 0.517, ext: 89.1, img: 83.0, cal: 87.5, suvO: 0.535, suvImg: 17.0, suvCal: 16.1, busO: 0.373, busImg: 0.2, busCal: 22.8 },
      { model: 'BEVDepth', mark: '†', fam: 'fp', pnorm: 0.535, ext: 90.2, img: 82.8, cal: 87.4, suvO: 0.547, suvImg: 10.3, suvCal: 5.7, busO: 0.418, busImg: 0.1, busCal: 16.6 },
      { model: 'BEVFormer', mark: '', fam: 'bp', pnorm: 0.504, ext: 83.2, img: 83.9, cal: 93.6, suvO: 0.503, suvImg: 37.2, suvCal: 71.9, busO: 0.547, busImg: 18.0, busCal: 40.1 },
      { model: 'DFA3D', mark: '†', fam: 'bp', pnorm: 0.489, ext: 90.5, img: 86.1, cal: 93.1, suvO: 0.514, suvImg: 38.8, suvCal: 47.5, busO: 0.556, busImg: 28.8, busCal: 48.1 },
      { model: 'DETR3D', mark: '', fam: 'bp', pnorm: 0.533, ext: 84.3, img: 84.1, cal: 96.0, suvO: 0.560, suvImg: 34.9, suvCal: 76.9, busO: 0.602, busImg: 26.5, busCal: 37.6 },
      { model: 'CAPE', mark: '‡', fam: 'pf', pnorm: 0.555, ext: 94.0, img: 83.9, cal: 88.6, suvO: 0.596, suvImg: 33.8, suvCal: 34.3, busO: 0.449, busImg: 36.0, busCal: 32.9 }
    ],
    seg: [
      { model: 'LSS', mark: '', fam: 'fp', pnorm: 0.445, ext: 88.4, img: 81.9, cal: 86.3, suvO: 0.497, suvImg: 24.3, suvCal: 23.9, busO: 0.567, busImg: 17.4, busCal: 17.1 },
      { model: 'GaussianLSS', mark: '', fam: 'fp', pnorm: 0.489, ext: 90.7, img: 84.5, cal: 92.1, suvO: 0.511, suvImg: 36.3, suvCal: 40.9, busO: 0.582, busImg: 14.1, busCal: 36.6 },
      { model: 'BEVFormer', mark: '', fam: 'bp', pnorm: 0.455, ext: 80.2, img: 79.6, cal: 88.2, suvO: 0.473, suvImg: 18.2, suvCal: 23.0, busO: 0.542, busImg: 18.8, busCal: 36.8 },
      { model: 'PointBeV', mark: '', fam: 'bp', pnorm: 0.485, ext: 79.7, img: 79.4, cal: 92.6, suvO: 0.510, suvImg: 23.2, suvCal: 67.5, busO: 0.544, busImg: 10.3, busCal: 20.5 },
      { model: 'CVT', mark: '', fam: 'pf', pnorm: 0.420, ext: 91.2, img: 83.8, cal: 90.9, suvO: 0.433, suvImg: 46.5, suvCal: 27.1, busO: 0.477, busImg: 17.5, busCal: 2.4 },
      { model: 'LaRa', mark: '', fam: 'pf', pnorm: 0.454, ext: 91.1, img: 82.5, cal: 90.0, suvO: 0.490, suvImg: 31.0, suvCal: 38.5, busO: 0.535, busImg: 27.7, busCal: 21.5 },
      { model: 'DSPE', mark: '‡', fam: 'pf', pnorm: 0.436, ext: 97.7, img: 80.7, cal: 82.0, suvO: 0.454, suvImg: 26.7, suvCal: 27.1, busO: 0.533, busImg: 14.5, busCal: 15.6 }
    ]
  };

  // Numeric columns in display order. cls marks primary (shaded) and
  // analysis-only (muted) columns; emph columns get bold/underline for
  // the best / second-best value, matching the paper.
  var COLS = [
    { key: 'pnorm', html: 'P<sub>NORMAL</sub>', dec: 3, group: 0, emph: true },
    { key: 'ext', html: 'EXT', dec: 1, group: 0, cls: 'rg-col-muted' },
    { key: 'img', html: 'IMG', dec: 1, group: 0, cls: 'rg-col-primary', emph: true },
    { key: 'cal', html: 'CAL', dec: 1, group: 0 },
    { key: 'suvO', html: 'P<sub>oracle</sub>', dec: 3, group: 1 },
    { key: 'suvImg', html: 'IMG', dec: 1, group: 1 },
    { key: 'suvCal', html: 'CAL', dec: 1, group: 1, cls: 'rg-col-primary', emph: true },
    { key: 'busO', html: 'P<sub>oracle</sub>', dec: 3, group: 2 },
    { key: 'busImg', html: 'IMG', dec: 1, group: 2 },
    { key: 'busCal', html: 'CAL', dec: 1, group: 2, cls: 'rg-col-primary', emph: true }
  ];

  var GROUPS = [
    { html: 'Viewpoint Perturbation &mdash; mVRS (%) &middot; Sedan', span: 4 },
    { html: 'Cross-platform &mdash; CTS (%) &middot; SUV', span: 3 },
    { html: 'Cross-platform &mdash; CTS (%) &middot; Bus', span: 3 }
  ];

  var state = { task: 'det', sortKey: null, dir: -1 };

  function topTwo(rows, key) {
    var vals = rows.map(function (r) { return r[key]; }).slice().sort(function (a, b) { return b - a; });
    return { first: vals[0], second: vals[1] };
  }

  function render(table) {
    var rows = DATA[state.task].slice();
    if (state.sortKey) {
      rows.sort(function (a, b) {
        return (a[state.sortKey] - b[state.sortKey]) * state.dir * -1;
      });
    }

    var emph = {};
    COLS.forEach(function (c) {
      if (c.emph) emph[c.key] = topTwo(rows, c.key);
    });

    var h = '<thead><tr>' +
      '<th rowspan="2" class="rg-th-model rg-sortable" data-key="__reset" title="Restore paper order">Model</th>' +
      '<th rowspan="2" class="rg-th-fam">View Transf.</th>';
    GROUPS.forEach(function (g, i) {
      h += '<th colspan="' + g.span + '" class="rg-th-group rg-group-' + i + '">' + g.html + '</th>';
    });
    h += '</tr><tr>';
    COLS.forEach(function (c, i) {
      var first = (i === 0 || COLS[i - 1].group !== c.group) ? ' rg-group-start' : '';
      var arrow = '';
      if (state.sortKey === c.key) arrow = state.dir === -1 ? ' ▾' : ' ▴';
      h += '<th class="rg-sortable' + first + (c.cls ? ' ' + c.cls : '') + '" data-key="' + c.key + '">' + c.html + arrow + '</th>';
    });
    h += '</tr></thead><tbody>';

    rows.forEach(function (r) {
      var fam = FAMILY[r.fam];
      h += '<tr><td class="rg-td-model">' + r.model + (r.mark ? '<sup>' + r.mark + '</sup>' : '') + '</td>';
      h += '<td class="rg-td-fam"><span class="rg-fam ' + fam.cls + '">' + fam.label + '</span></td>';
      COLS.forEach(function (c, i) {
        var first = (i === 0 || COLS[i - 1].group !== c.group) ? ' rg-group-start' : '';
        var cls = (c.cls ? c.cls : '') + first;
        var v = r[c.key];
        var txt = v.toFixed(c.dec);
        if (c.emph) {
          var e = emph[c.key];
          if (v === e.first) txt = '<b>' + txt + '</b>';
          else if (v === e.second) txt = '<u>' + txt + '</u>';
        }
        h += '<td class="' + cls + '">' + txt + '</td>';
      });
      h += '</tr>';
    });
    h += '</tbody>';
    table.innerHTML = h;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var table = document.getElementById('rg-results-table');
    if (!table) return;
    var tabs = document.querySelector('.rg-task-tabs');

    render(table);

    tabs.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn || btn.dataset.task === state.task) return;
      state.task = btn.dataset.task;
      state.sortKey = null;
      Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) {
        b.classList.toggle('rg-selected', b === btn);
      });
      render(table);
    });

    table.addEventListener('click', function (e) {
      var th = e.target.closest('th.rg-sortable');
      if (!th) return;
      var key = th.dataset.key;
      if (key === '__reset') {
        state.sortKey = null;
      } else if (state.sortKey === key) {
        state.dir = -state.dir;
      } else {
        state.sortKey = key;
        state.dir = -1;
      }
      render(table);
    });
  });
})();
