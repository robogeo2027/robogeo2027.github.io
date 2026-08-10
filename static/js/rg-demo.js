/* RoboGeo interactive demos.
 *
 * All pose videos of a scene share one timeline, so switching pose =
 * load the new file on the hidden <video>, seek it to the visible one's
 * currentTime, then cross-fade. Dragging (on the video or on a dial)
 * maps to 4-degree angle steps and adds a subtle CSS tilt for the
 * fractional remainder, so stepping through discrete renders reads as
 * one continuous camera move.
 */
(function () {
  'use strict';

  var STEP = 4;          // degrees between neighboring renders
  var MAX = 20;          // max |angle| available
  var PX_PER_DEG = 9;    // video-drag sensitivity: pixels per degree
  var TILT = 1.1;        // CSS preview tilt per degree of residual
  var ARC = 75;          // dial degrees that map to MAX pose degrees

  // Sign between dial/badge angle and the file naming convention.
  // roll is -1: the rendered roll videos run opposite to the dial direction.
  var FILE_SIGN = { yaw: 1, pitch: 1, roll: -1 };

  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  var SVG_NS = 'http://www.w3.org/2000/svg';

  /* ---------- dual-video switcher ---------- */
  function createSwitcher(wrap) {
    var vids = wrap.querySelectorAll('.rg-stage video');
    var badge = wrap.querySelector('.rg-badge');
    var spinner = wrap.querySelector('.rg-spinner');
    var overlay = wrap.querySelector('.rg-play-overlay');
    var active = 0, pendingSrc = null, pendingCb = null, spinnerTimer = null;
    var seekHandlers = [null, null];
    var visible = true;

    function showSpinner(s) { spinner.style.display = s ? 'flex' : 'none'; }

    function settle(ok) {
      var cb = pendingCb;
      pendingCb = null;
      if (cb) cb(ok);
    }

    function clearSeekHandler(i) {
      if (seekHandlers[i]) {
        vids[i].removeEventListener('seeked', seekHandlers[i]);
        seekHandlers[i] = null;
      }
    }

    function doSwap(next) {
      if (vids[active] === next) return;  // idempotent: never swap twice
      var cur = vids[active];
      // The new video fades in ON TOP of the old one, which stays fully
      // visible beneath — the black stage never shows through mid-fade.
      next.classList.remove('rg-under');
      cur.classList.add('rg-under');
      cur.classList.remove('rg-active');
      next.classList.add('rg-active');
      active = 1 - active;
      clearTimeout(spinnerTimer);
      showSpinner(false);
      setTimeout(function () {
        cur.classList.remove('rg-under');
        // Pause the hidden video so two streams don't decode at once.
        if (vids[active] !== cur) cur.pause();
      }, 200);
    }

    function syncAndSwap(next, resetTime, src) {
      var i = (next === vids[0]) ? 0 : 1;
      clearSeekHandler(i);
      var cur = vids[active];
      var t = resetTime ? 0 : (cur.currentTime || 0);
      if (next.duration && t >= next.duration) t = t % next.duration;
      var h = function () {
        next.removeEventListener('seeked', h);
        if (seekHandlers[i] === h) seekHandlers[i] = null;
        if (pendingSrc !== src) return;
        var done = function () {
          if (pendingSrc === src) { doSwap(next); settle(true); }
        };
        var p = next.play();
        if (p && p.then) p.then(done, done); else done();
      };
      seekHandlers[i] = h;
      next.addEventListener('seeked', h);
      // Setting currentTime always fires 'seeked', even when t is unchanged.
      next.currentTime = t;
    }

    function tryPlay() {
      var v = vids[active];
      var p = v.play();
      if (p && p.then) {
        p.then(function () { overlay.classList.remove('rg-show'); },
               function () { if (visible) overlay.classList.add('rg-show'); });
      }
    }

    // Recover from blocked autoplay (tap anywhere on the video area).
    wrap.addEventListener('pointerdown', function () {
      if (vids[active].paused) tryPlay();
    });
    Array.prototype.forEach.call(vids, function (v) {
      v.addEventListener('play', function () { overlay.classList.remove('rg-show'); });
    });

    // Pause offscreen demos to save decode/battery; resume in view.
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        if (visible) {
          tryPlay();
        } else {
          vids[0].pause();
          vids[1].pause();
          overlay.classList.remove('rg-show');
        }
      }, { threshold: 0.15 }).observe(wrap);
    }

    return {
      init: function (src, label) {
        vids[active].src = src;
        vids[active].dataset.src = src;
        vids[active].classList.add('rg-active');
        badge.textContent = label;
      },
      setLabel: function (label) { badge.textContent = label; },
      // cb(ok) fires once when this request finishes (superseded requests
      // are dropped without a callback).
      switchTo: function (src, resetTime, cb) {
        pendingSrc = src;
        pendingCb = cb || null;
        var next = vids[1 - active];
        var i = (next === vids[0]) ? 0 : 1;
        clearSeekHandler(i);
        if (next.dataset.src === src && next.readyState >= 2) {
          syncAndSwap(next, resetTime, src);
          return;
        }
        clearTimeout(spinnerTimer);
        spinnerTimer = setTimeout(function () { showSpinner(true); }, 250);
        next.dataset.src = src;
        next.src = src;
        next.load();
        next.onloadeddata = function () {
          if (pendingSrc === src) syncAndSwap(next, resetTime, src);
        };
        next.onerror = function () {
          if (pendingSrc !== src) return;
          pendingSrc = null;
          next.dataset.src = '';
          clearTimeout(spinnerTimer);
          showSpinner(false);
          settle(false);
        };
      }
    };
  }

  /* ---------- scene selector pills ---------- */
  function wireSceneGroup(group, onChange) {
    if (!group) return;
    group.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn || btn.classList.contains('rg-selected')) return;
      var prev = group.querySelector('button.rg-selected');
      var select = function (b) {
        Array.prototype.forEach.call(group.querySelectorAll('button'), function (x) {
          x.classList.toggle('rg-selected', x === b);
        });
      };
      select(btn);
      onChange(btn.dataset.scene, function () { if (prev) select(prev); });
    });
  }

  /* ---------- viewpoint perturbation ---------- */
  function initViewpoint() {
    var root = document.getElementById('rg-vp');
    if (!root) return;
    var wrap = root.querySelector('.rg-video-wrap');
    var stage = root.querySelector('.rg-stage');
    var hint = root.querySelector('.rg-drag-hint');
    var resetBtn = root.querySelector('.rg-reset');
    var sw = createSwitcher(wrap);

    var scene = 'scene-0241';
    var pose = { axis: 'yaw', angle: 0 };
    var lastSrc = null;
    var interacted = false;   // gate prefetching until first interaction

    function base() { return 'static/demo/viewpoint/' + scene + '/'; }
    function fileFor(p) {
      var signed = p.angle * FILE_SIGN[p.axis];
      if (signed === 0) return base() + 'center.mp4';
      return base() + p.axis + '_' + (signed > 0 ? 'p' : 'm') + pad2(Math.abs(signed)) + '.mp4';
    }
    function labelFor(p) {
      if (p.angle === 0) return 'Base rig';
      var name = p.axis.charAt(0).toUpperCase() + p.axis.slice(1);
      return name + ' ' + (p.angle > 0 ? '+' : '−') + Math.abs(p.angle) + '°';
    }
    function tiltFor(axis, residual) {
      var deg = residual * TILT;
      if (axis === 'yaw') return 'perspective(1100px) rotateY(' + deg + 'deg)';
      if (axis === 'pitch') return 'perspective(1100px) rotateX(' + (-deg) + 'deg)';
      return 'rotate(' + deg + 'deg)';
    }

    /* --- dials: yaw (arc up), pitch (arc right, vertical), roll (arc up) --- */
    // dir: sign between the dial's screen direction t and the pose angle.
    var dialCfgs = [
      { axis: 'yaw', rot: 0, dir: 1 },
      { axis: 'pitch', rot: 90, dir: -1 },  // up = pitch+
      { axis: 'roll', rot: 0, dir: 1 }
    ];
    var dials = [];

    function polar(rot, t, r) {
      var rad = (rot + t) * Math.PI / 180;
      return [r * Math.sin(rad), -r * Math.cos(rad)];
    }

    function buildDial(cfg) {
      var svg = root.querySelector('.rg-dial[data-axis="' + cfg.axis + '"]');
      svg.setAttribute('viewBox', cfg.rot === 0 ? '-48 -50 96 62' : '-10 -48 58 96');
      svg.setAttribute('tabindex', '0');

      var p1 = polar(cfg.rot, -ARC, 40), p2 = polar(cfg.rot, ARC, 40);
      var arc = document.createElementNS(SVG_NS, 'path');
      arc.setAttribute('class', 'rg-dial-arc');
      arc.setAttribute('d', 'M ' + p1[0].toFixed(1) + ' ' + p1[1].toFixed(1) +
        ' A 40 40 0 0 1 ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1));
      svg.appendChild(arc);

      var ticks = document.createElementNS(SVG_NS, 'g');
      ticks.setAttribute('class', 'rg-dial-ticks');
      for (var k = -5; k <= 5; k++) {
        var t = k * (ARC / 5);
        var a = polar(cfg.rot, t, 36);
        var b = polar(cfg.rot, t, k === 0 ? 45 : 42);
        var line = document.createElementNS(SVG_NS, 'line');
        line.setAttribute('x1', a[0].toFixed(1)); line.setAttribute('y1', a[1].toFixed(1));
        line.setAttribute('x2', b[0].toFixed(1)); line.setAttribute('y2', b[1].toFixed(1));
        ticks.appendChild(line);
      }
      svg.appendChild(ticks);

      var needleG = document.createElementNS(SVG_NS, 'g');
      needleG.setAttribute('class', 'rg-dial-needle');
      var needle = document.createElementNS(SVG_NS, 'line');
      needle.setAttribute('x1', '0'); needle.setAttribute('y1', '6');
      needle.setAttribute('x2', '0'); needle.setAttribute('y2', '-30');
      needleG.appendChild(needle);
      svg.appendChild(needleG);

      var cap = document.createElementNS(SVG_NS, 'circle');
      cap.setAttribute('class', 'rg-dial-cap');
      cap.setAttribute('r', '5'); cap.setAttribute('cx', '0'); cap.setAttribute('cy', '0');
      svg.appendChild(cap);

      var d = { cfg: cfg, svg: svg, needleG: needleG, pointer: null };
      dials.push(d);

      svg.addEventListener('pointerdown', function (e) {
        if (e.button !== undefined && e.button !== 0) return;
        if (d.pointer !== null) return;
        d.pointer = e.pointerId;
        if (svg.setPointerCapture) svg.setPointerCapture(e.pointerId);
        stage.classList.add('rg-no-ease');
        hint.classList.add('rg-hint-hidden');
        dialApply(d, e);
        e.preventDefault();
      });
      svg.addEventListener('pointermove', function (e) {
        if (d.pointer === e.pointerId) dialApply(d, e);
      });
      function end(e) {
        if (d.pointer === null || (e && e.pointerId !== d.pointer)) return;
        d.pointer = null;
        stage.classList.remove('rg-no-ease');
        stage.style.transform = '';
        updateDials(null, null);
      }
      svg.addEventListener('pointerup', end);
      svg.addEventListener('pointercancel', end);

      // Keyboard: arrows step the axis by 4 degrees.
      svg.addEventListener('keydown', function (e) {
        var delta = 0;
        if (e.key === 'ArrowRight' || e.key === 'ArrowUp') delta = STEP;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') delta = -STEP;
        else return;
        e.preventDefault();
        var current = (pose.axis === cfg.axis) ? pose.angle : 0;
        applyAxis(cfg.axis, clamp(current + delta, -MAX, MAX));
        stage.style.transform = '';
      });
    }

    function dialApply(d, e) {
      var rect = d.svg.getBoundingClientRect();
      // The viewBox is not centered on (0,0): map client coords into it.
      var vb = d.svg.viewBox.baseVal;
      var cx = rect.left + (0 - vb.x) / vb.width * rect.width;
      var cy = rect.top + (0 - vb.y) / vb.height * rect.height;
      var raw = Math.atan2(e.clientX - cx, -(e.clientY - cy)) * 180 / Math.PI;
      var t = raw - d.cfg.rot;
      if (t > 180) t -= 360;
      if (t < -180) t += 360;
      t = clamp(t, -ARC, ARC);
      applyAxis(d.cfg.axis, d.cfg.dir * t / ARC * MAX);
    }

    function updateDials(activeAxis, cont) {
      dials.forEach(function (d) {
        var value = (d.cfg.axis === pose.axis) ? pose.angle : 0;
        if (activeAxis === d.cfg.axis && cont !== null && cont !== undefined) value = cont;
        d.needleG.setAttribute('transform',
          'rotate(' + (d.cfg.rot + d.cfg.dir * value / MAX * ARC) + ')');
        d.svg.setAttribute('aria-valuenow',
          String(d.cfg.axis === pose.axis ? pose.angle : 0));
      });
    }

    /* --- shared pose application (from video drag, dial drag or keys) --- */
    var switchTimer = null;
    function applyAxis(axis, cont) {
      interacted = true;
      var snap = Math.round(cont / STEP) * STEP;
      stage.style.transform = tiltFor(axis, cont - snap);
      updateDials(axis, cont);
      if (snap === pose.angle && axis === pose.axis) return;
      pose = { axis: axis, angle: snap };
      sw.setLabel(labelFor(pose));
      clearTimeout(switchTimer);
      switchTimer = setTimeout(function () {
        var src = fileFor(pose);
        prefetchNeighbors();
        if (src === lastSrc) return;
        lastSrc = src;
        sw.switchTo(src, false, function (ok) { if (!ok) lastSrc = null; });
      }, 60);
    }

    /* --- drag on the video: horizontal = yaw, vertical = pitch --- */
    var dragPointer = null, dragAxis = null, sx = 0, sy = 0, baseAngle = 0;

    wrap.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (dragPointer !== null) return;
      dragPointer = e.pointerId;
      dragAxis = null;
      sx = e.clientX;
      sy = e.clientY;
      if (wrap.setPointerCapture) wrap.setPointerCapture(e.pointerId);
      stage.classList.add('rg-no-ease');
      hint.classList.add('rg-hint-hidden');
      e.preventDefault();
    });

    wrap.addEventListener('pointermove', function (e) {
      if (e.pointerId !== dragPointer) return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if (!dragAxis) {
        if (Math.hypot(dx, dy) < 8) return;
        // Touch: keep vertical for page scrolling (touch-action: pan-y),
        // so touch drags only control yaw; pitch has its own dial.
        dragAxis = (e.pointerType === 'touch' || Math.abs(dx) >= Math.abs(dy)) ? 'yaw' : 'pitch';
        baseAngle = (pose.axis === dragAxis) ? pose.angle : 0;
      }
      // Drag right = yaw+, drag up = pitch+. Flip signs here if the
      // rendered direction feels inverted.
      var d = dragAxis === 'yaw' ? dx : -dy;
      applyAxis(dragAxis, clamp(baseAngle + d / PX_PER_DEG, -MAX, MAX));
    });

    function endDrag(e) {
      if (dragPointer === null || (e && e.pointerId !== dragPointer)) return;
      dragPointer = null;
      stage.classList.remove('rg-no-ease');
      stage.style.transform = '';
      updateDials(null, null);
    }
    wrap.addEventListener('pointerup', endDrag);
    wrap.addEventListener('pointercancel', endDrag);

    /* --- reset / scene switching / prefetch --- */
    resetBtn.addEventListener('click', function () {
      // Cancel any in-progress drag before resetting.
      dragPointer = null;
      dials.forEach(function (d) { d.pointer = null; });
      stage.classList.remove('rg-no-ease');
      stage.style.transform = '';
      pose = { axis: 'yaw', angle: 0 };
      sw.setLabel(labelFor(pose));
      updateDials(null, null);
      var src = fileFor(pose);
      prefetchNeighbors();
      if (src !== lastSrc) {
        lastSrc = src;
        sw.switchTo(src, false, function (ok) { if (!ok) lastSrc = null; });
      }
    });

    wireSceneGroup(root.querySelector('.rg-scene-group'), function (s, revert) {
      var prevScene = scene;
      scene = s;
      interacted = true;
      var src = fileFor(pose);
      lastSrc = src;
      sw.switchTo(src, true, function (ok) {  // different scene: restart
        if (!ok) {
          scene = prevScene;
          lastSrc = null;
          revert();
        } else {
          prefetchNeighbors();
        }
      });
    });

    // Best-effort cache warming for the neighboring steps.
    var warm = [document.createElement('video'), document.createElement('video')];
    warm.forEach(function (v) { v.preload = 'auto'; v.muted = true; });
    function prefetchNeighbors() {
      if (!interacted) return;  // don't burn bandwidth before any interaction
      var files = [];
      [pose.angle - STEP, pose.angle + STEP].forEach(function (a) {
        if (a >= -MAX && a <= MAX) files.push(fileFor({ axis: pose.axis, angle: a }));
      });
      files.slice(0, 2).forEach(function (f, i) {
        if (warm[i].dataset.src !== f) {
          warm[i].dataset.src = f;
          warm[i].src = f;
          warm[i].load();
        }
      });
    }

    dialCfgs.forEach(buildDial);
    lastSrc = fileFor(pose);
    sw.init(lastSrc, labelFor(pose));
    updateDials(null, null);
  }

  /* ---------- cross-platform transfer ---------- */
  function initPlatform() {
    var root = document.getElementById('rg-cp');
    if (!root) return;
    var wrap = root.querySelector('.rg-video-wrap');
    var group = root.querySelector('.rg-platform-group');
    var sw = createSwitcher(wrap);

    var scene = 'scene-0224';
    var LABELS = { sedan: 'Sedan (base layout)', suv: 'SUV', bus: 'Bus' };
    var current = 'sedan';

    function src() { return 'static/demo/platform/' + scene + '/' + current + '.mp4'; }
    function select(value) {
      Array.prototype.forEach.call(group.querySelectorAll('button'), function (b) {
        b.classList.toggle('rg-selected', b.dataset.value === value);
      });
    }

    sw.init(src(), LABELS[current]);

    group.addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn || btn.dataset.value === current) return;
      var prev = current;
      current = btn.dataset.value;
      select(current);
      sw.setLabel(LABELS[current]);
      sw.switchTo(src(), false, function (ok) {
        if (!ok) {
          current = prev;
          select(current);
          sw.setLabel(LABELS[current]);
        }
      });
    });

    wireSceneGroup(root.querySelector('.rg-scene-group'), function (s, revert) {
      var prevScene = scene;
      scene = s;
      sw.switchTo(src(), true, function (ok) {  // different scene: restart
        if (!ok) {
          scene = prevScene;
          revert();
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initViewpoint();
    initPlatform();
  });
})();
