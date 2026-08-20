// host/demo/panel.js — the floating Demo transport (design/scripted-demo.md).
//
// A WIDE, SHORT window: what you are running on the left, what you press on the right. The shape is
// the point — a low, broad strip sits along the bottom of the screen without reaching up into the
// rack, so it covers less of whatever the demo is doing and needs to move out of the way less often.
//
// No title bar. It only ever said "Demo", which the window's contents already make obvious, so the
// row was pure height. The window is dragged by its own background instead, and the close sits at the
// end of the status line, where it is out of the buttons' way.
//
// It opens at BOTTOM CENTRE, steps aside when a demo is about to work underneath it (see `avoid`),
// and otherwise stays wherever you drag it to, remembered between sessions.
'use strict';

import { tip } from '../tooltip.js';

const CSS = `
  .demo-panel { position: fixed; left: 50%; transform: translateX(-50%); bottom: 12px; z-index: 2000;
    width: 430px; display: none; cursor: move;
    background: var(--panel, #211c15); color: var(--ink, #f2ead9); border: 1px solid #cfcfcf;
    border-radius: 9px; user-select: none;
    font: 13px/1.3 -apple-system, system-ui, sans-serif; }
  .demo-panel.open { display: flex; }
  .demo-panel-left { flex: 1 1 auto; min-width: 0; padding: 7px 6px 7px 9px;
    display: flex; flex-direction: column; gap: 5px; justify-content: center; }
  .demo-panel-right { flex: none; padding: 7px 9px 7px 6px; display: flex; flex-direction: column; gap: 4px; }
  .demo-panel-close { flex: none; border: none; background: transparent;
    color: var(--ink-dim, #b6ab93); font-size: 14px; line-height: 1; cursor: pointer; padding: 0 2px; flex: none; }
  .demo-panel-close:hover { color: var(--ink, #f2ead9); }

  .demo-panel-select { flex: 1 1 auto; min-width: 0; padding: 2px 5px; border-radius: 5px;
    font: 600 13px/1.2 inherit; background: var(--bg, #14110d); color: var(--ink, #f2ead9);
    border: 1px solid rgba(207,207,207,0.55); }
  .demo-panel-row { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ink-dim, #b6ab93);
    flex-wrap: wrap; row-gap: 4px; }
  .demo-panel-rate { padding: 0 3px; border-radius: 5px; font: inherit; font-size: 12px;
    background: var(--bg, #14110d); color: var(--ink, #f2ead9); border: 1px solid rgba(207,207,207,0.55); }
  .demo-panel-caps { display: flex; align-items: center; gap: 4px; cursor: pointer; }
  .demo-panel-goto { display: flex; align-items: center; gap: 4px; flex: none; }
  .demo-panel-gotonum { width: 46px; padding: 1px 4px; border-radius: 5px; font: inherit; font-size: 12px;
    color: inherit; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.25); }
  .demo-panel-reload { padding: 1px 7px; border-radius: 5px; font: inherit; font-size: 12px; cursor: pointer;
    flex: none; border: 1px solid rgba(207,207,207,0.55); background: rgba(255,255,255,0.04);
    color: var(--ink, #f2ead9); }
  .demo-panel-reload:hover { border-color: #fff; background: rgba(255,255,255,0.14); }
  .demo-panel-dot { width: 8px; height: 8px; border-radius: 50%; background: #5a5348; flex: none; }
  .demo-panel-dot.on { background: #43c463; box-shadow: 0 0 6px #43c463; }
  .demo-panel-pos { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1 1 auto; }
  .demo-panel-title { flex: 1 1 auto; min-width: 0; font-weight: 600; white-space: nowrap;
    overflow: hidden; text-overflow: ellipsis; display: none; }

  .demo-panel-btns { display: flex; gap: 4px; }
  /* Every button carries its border at rest. A control whose outline only appears when the pointer
     is already on it does not tell you it is there — which is the whole job of a border. */
  .demo-panel-btns button { width: 62px; padding: 3px 0; border-radius: 5px; font: inherit; font-size: 12px;
    cursor: pointer; border: 1px solid rgba(207,207,207,0.55); background: rgba(255,255,255,0.04);
    color: var(--ink, #f2ead9); }
  .demo-panel-btns button:hover:not(:disabled) { border-color: #fff; background: rgba(255,255,255,0.14); }
  .demo-panel-btns button:active:not(:disabled) { background: rgba(255,255,255,0.22); }
  .demo-panel-btns button:disabled { opacity: 0.35; cursor: default; }

  /* the OS cursor is hidden during a run, but keep it visible over this window so its controls stay
     usable while a demo plays */
  html.demo-playing .demo-panel, html.demo-playing .demo-panel * { cursor: auto !important; }
  html.demo-playing .demo-panel { cursor: move !important; }
`;

export function createDemoPanel({ demos = [], onSelect, onRun, onStop, onRestart, onRate, onCaptions, onCaptionVoice, onPause, onStep, onBack, onPlay, onReload, onGoto, onRunFrom, onClose } = {}) {
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  const el = document.createElement('div');
  el.className = 'demo-panel';
  el.style.position = 'fixed';
  el.innerHTML =
    '<div class="demo-panel-left">' +
      // The reel picker IS the window's title: it names what you are working on and lets you change
      // it, which is everything a title bar would have done and one thing more.
      '<div class="demo-panel-row">' +
        '<select class="demo-panel-select"></select>' +
        '<span class="demo-panel-title"></span>' +
      '</div>' +
      '<div class="demo-panel-row">' +
        '<label>Rate ' +
          '<select class="demo-panel-rate">' +
            '<option value="0.5">0.5×</option><option value="0.75">0.75×</option>' +
            // ONE AND A HALF BY DEFAULT. A demo is watched, not worked through: at 1× the pointer
            // ambles between two knobs that are four inches apart and the whole thing sags. A
            // tutorial someone is following along with can be slowed from here; a reel should not
            // have to be sped up before it is worth watching.
            '<option value="1">1×</option><option value="1.5" selected>1.5×</option><option value="2">2×</option>' +
          '</select>' +
        '</label>' +
        // CAPTIONS INSTEAD OF THE VOICE, not alongside it. Ticked, the run is silent: each step
        // shows its one-line caption hung off the pointer and is timed by how long that takes to
        // read. Unticked, the script runs however it declares itself, which is spoken for all but
        // the demos written captions-first.
        '<label class="demo-panel-caps"><input type="checkbox"> Captions</label>' +
        // ...and the third way to run it: the captions, spoken. Only meaningful with the box above
        // ticked, since it swaps WHICH words are said rather than turning the voice on.
        '<label class="demo-panel-caps demo-panel-say"><input type="checkbox"> Speak them</label>' +
      '</div>' +
      '<div class="demo-panel-row">' +
      '</div>' +
      '<div class="demo-panel-row">' +
        '<span class="demo-panel-dot"></span>' +
        '<span class="demo-panel-pos">—</span>' +
        // JUMP TO A STEP. Authoring a demo means watching one moment of it over and over, and the
        // only ways there were pressing Step twenty times or watching the whole thing again. The
        // number is the step shown beside it, so what you read is what you type.
        '<label class="demo-panel-goto">Step ' +
          '<input type="number" min="0" step="1" class="demo-panel-gotonum">' +
        '</label>' +
        '<button class="demo-panel-reload" data-act="goto">Go</button>' +
        '<button class="demo-panel-reload" data-act="runfrom">Run from</button>' +
        '<button class="demo-panel-reload" data-act="reload">Reload</button>' +
      '</div>' +
    '</div>' +
    '<div class="demo-panel-right">' +
      '<div class="demo-panel-btns">' +
        '<button data-act="run">Run</button>' +
        // PAUSE SITS BESIDE RUN, not beside Stop, because it belongs to watching rather than to
        // ending: it freezes the performance and gives nothing up, where Stop ends the run.
        '<button data-act="pause">Pause</button>' +
        '<button data-act="stop">Stop</button>' +
        '<button data-act="restart">Restart</button>' +
      '</div>' +
      // Stepping is the author's control: one step per press with every wait collapsed, Back
      // restoring the state that stood before the previous step, Play performing the current step
      // properly — full pacing and narration — so the words and timing can be judged, not just checked.
      '<div class="demo-panel-btns">' +
        '<button data-act="back">Back</button>' +
        '<button data-act="step">Step</button>' +
        '<button data-act="play">Play</button>' +
      '</div>' +
      // Close is a NAMED button in the lower right. A bare × had nowhere to go: the top corners are
      // taken by the picker and the first button row, and in the middle of the window it read as
      // something to do with the step it sat beside.
      '<div class="demo-panel-btns demo-panel-btns-end">' +
        '<button class="demo-panel-close">Exit</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(el);

  const dot = el.querySelector('.demo-panel-dot');
  const sel = el.querySelector('.demo-panel-select');
  const titleEl = el.querySelector('.demo-panel-title');
  const runBtn = el.querySelector('[data-act="run"]');
  const stopBtn = el.querySelector('[data-act="stop"]');

  for (const d of demos) { const o = document.createElement('option'); o.value = d.id; o.textContent = d.title || d.id; sel.appendChild(o); }
  const entryById = (id) => demos.find((d) => d.id === id) || null;

  const rateSel = el.querySelector('.demo-panel-rate');
  const capsChk = el.querySelector('.demo-panel-caps input');
  sel.addEventListener('change', () => onSelect && onSelect(entryById(sel.value)));
  rateSel.addEventListener('change', () => onRate && onRate(Number(rateSel.value)));
  capsChk.addEventListener('change', () => onCaptions && onCaptions(capsChk.checked));
  const sayChk = el.querySelector('.demo-panel-say input');
  if (sayChk) sayChk.addEventListener('change', () => onCaptionVoice && onCaptionVoice(sayChk.checked));
  const on = (act, fn) => el.querySelector(`[data-act="${act}"]`).addEventListener('click', () => fn && fn());
  // Delayed tips, in the app's own chip rather than the operating system's.
  for (const [act, text] of [
    ['run', 'Play this demonstration from the start'],
    ['pause', 'Pause — freeze it here, look around, carry on'],
    ['stop', 'Stop — and stay on the step it reached'],
    ['restart', 'Start again from the beginning'],
    ['back', 'Back one step'],
    ['step', 'Forward one step, without waiting'],
    ['play', 'Perform this one step at full speed, with narration'],
    ['reload', 'Re-read the script from disk and come back to this step'],
  ]) { const b = el.querySelector(`[data-act="${act}"]`); if (b) tip(b, text); }
  tip(el.querySelector('.demo-panel-close'), 'Leave the demonstration');
  on('run', onRun); on('stop', onStop); on('restart', onRestart);
  const gotoNum = el.querySelector('.demo-panel-gotonum');
  const wanted = () => Math.max(0, Number(gotoNum && gotoNum.value) || 0);
  on('goto', () => onGoto && onGoto(wanted()));
  on('runfrom', () => onRunFrom && onRunFrom(wanted()));
  const pauseBtn = el.querySelector('[data-act="pause"]');
  // The key and the button are two ways to the same switch, so the button follows whatever happened.
  const setPaused = (on) => { if (pauseBtn) pauseBtn.textContent = on ? 'Resume' : 'Pause'; };
  if (pauseBtn) pauseBtn.addEventListener('click', () => { if (onPause) pauseBtn.textContent = onPause() ? 'Resume' : 'Pause'; });
  on('step', onStep); on('back', onBack); on('play', onPlay); on('reload', onReload);
  el.querySelector('.demo-panel-close').addEventListener('click', () => (onClose ? onClose() : close()));

  // ---- where it sits --------------------------------------------------------
  const POS_KEY = 'wcoast.demoPanelPos';
  function placeAt(x, y) {
    const w = el.offsetWidth || 430, h = el.offsetHeight || 90;
    el.style.left = Math.max(0, Math.min(window.innerWidth - w, x)) + 'px';
    el.style.top = Math.max(0, Math.min(window.innerHeight - h, y)) + 'px';
    el.style.right = 'auto'; el.style.bottom = 'auto';
    el.style.transform = 'none';   // the CSS centring is a starting position, not a lasting one
  }
  function restorePos() {
    try {
      const p = JSON.parse(localStorage.getItem(POS_KEY) || 'null');
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) placeAt(p.x, p.y);
    } catch (_e) { /* the CSS default — bottom centre — is a fine place to open */ }
  }
  const savePos = () => {
    const r = el.getBoundingClientRect();
    try { localStorage.setItem(POS_KEY, JSON.stringify({ x: Math.round(r.left), y: Math.round(r.top) })); } catch (_e) { /* no storage */ }
  };
  const rect = () => { const r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; };

  // Getting out of the way. The runner hands over the region the next stretch of the demo will work
  // in. If the window is not sitting on it, nothing happens — a window that shuffles about for no
  // reason is worse than one that occasionally overlaps. If it IS in the way it takes the nearest
  // clear berth, preferring to stay low and central, because that is where it is easiest to find.
  const CLEAR = 14;
  function berths(w, h) {
    const W = window.innerWidth, H = window.innerHeight, M = 12;
    const mid = Math.round((W - w) / 2), low = H - h - M, high = M;
    return [
      { x: mid, y: low }, { x: M, y: low }, { x: W - w - M, y: low },
      { x: mid, y: high }, { x: M, y: high }, { x: W - w - M, y: high },
      { x: M, y: Math.round((H - h) / 2) }, { x: W - w - M, y: Math.round((H - h) / 2) },
    ];
  }
  const overlaps = (x, y, w, h, r) => !!r
    && x - CLEAR < r.x + r.w && x + w + CLEAR > r.x
    && y - CLEAR < r.y + r.h && y + h + CLEAR > r.y;
  // One region or several — the work about to happen, and the caption card if it is showing.
  const hits = (x, y, w, h, regions) =>
    (Array.isArray(regions) ? regions : [regions]).some((r) => overlaps(x, y, w, h, r));

  function avoid(region) {
    if (!el.classList.contains('open')) return;
    const r = el.getBoundingClientRect();
    const w = r.width, h = r.height;
    if (!hits(r.left, r.top, w, h, region)) return;   // already clear: leave it exactly where it is
    for (const b of berths(w, h)) {
      if (!hits(b.x, b.y, w, h, region)) { placeAt(b.x, b.y); savePos(); return; }
    }
    // Nowhere is clear (a demo touching the whole window). Staying put beats jumping somewhere no better.
  }

  // Dragged by its own background, since there is no title bar to grab. A press that lands on a
  // control is that control's, not the drag's.
  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button, select, input, label')) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    const ox = e.clientX - r.left, oy = e.clientY - r.top;
    const move = (ev) => placeAt(ev.clientX - ox, ev.clientY - oy);
    const up = () => {
      savePos();
      document.removeEventListener('pointermove', move, true);
      document.removeEventListener('pointerup', up, true);
    };
    document.addEventListener('pointermove', move, true);
    document.addEventListener('pointerup', up, true);
  });
  // A window remembered off the edge of a smaller screen is a window you cannot reach.
  window.addEventListener('resize', () => { if (el.classList.contains('open')) { const r = el.getBoundingClientRect(); placeAt(r.left, r.top); } });

  function setRunning(name) {
    const live = !!name;
    dot.classList.toggle('on', live);
    runBtn.disabled = live;
    if (pauseBtn) { pauseBtn.disabled = !live; if (!live) pauseBtn.textContent = 'Pause'; }
    // Stop is ALWAYS live. It ends a step-through as well as a playback — and a step-through is not
    // "running", so gating it on that left the only way out of stepping disabled.
    stopBtn.disabled = false;
  }
  // "step 4 of 15 — patch", so the author can see where a step-through has got to.
  function setPosition(i, n, label) {
    // The box follows where the demo is, unless you are typing in it — so the number you read beside
    // it and the number you jump to are the same number.
    if (gotoNum && document.activeElement !== gotoNum) gotoNum.value = String(Math.max(0, i || 0));
    el.querySelector('.demo-panel-pos').textContent =
      n ? `step ${Math.min(i + 1, n)} of ${n}${label ? ' — ' + label : ''}` : '—';
  }
  // TWO FACES. A reader arrives from a tutorial section, so the demo is already chosen: the picker
  // goes and its title stands there instead, and the author-only controls go with it. An author gets
  // the lot. Exit reads as Exit either way — it closes the window, and for a reader that is also how
  // they get back to the tutorial.
  function setMode(mode) {
    const author = mode !== 'reader';
    el.classList.toggle('reader', !author);
    sel.style.display = author ? '' : 'none';
    titleEl.style.display = author ? 'none' : 'block';   // '' would fall back to the CSS default, which is none
    // Only the two author controls go. NOT their rows — Play shares a row with Back and Step, which a
    // reader very much needs, and hiding the row took them with it.
    for (const act of ['play', 'reload']) {
      const b = el.querySelector(`[data-act="${act}"]`);
      if (b) b.style.display = author ? '' : 'none';
    }
  }
  function setTitle(t) { titleEl.textContent = t || ''; }
  // "Return to tutorial" when that is where leaving goes, "Close" when it just closes. The button has
  // to say where it takes you, since a finished demo now waits here rather than bouncing you back.
  function setExitLabel(t) { el.querySelector('.demo-panel-close').textContent = t || 'Exit'; }

  function open() { el.classList.add('open'); restorePos(); }
  function close() { el.classList.remove('open'); }
  function toggle() { el.classList.contains('open') ? close() : open(); }

  setRunning(null);
  if (demos[0] && onSelect) onSelect(demos[0]);   // default selection matches the drop-down

  return { open, close, toggle, setRunning, setPaused, setPosition, setMode, setTitle, setExitLabel, avoid, rect, el };
}
