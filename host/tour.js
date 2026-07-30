// tour.js — the getting-started tour: a sequence of MODELESS floating cards.
//
// Every step of the guide is a "try this now" step, so the card must NOT block the thing it
// describes: there is no backdrop, no focus trap, and no Escape binding (Escape already cancels
// a cable pull and closes the overview — a card must not steal it). The reader drives with Next
// and Previous; nothing advances on its own, so a step can never trap someone who did the action
// slightly differently than we expected.
//
// The card is chrome, not rack content: it is position:fixed, so the rack zooms and pans beneath
// it. It sits above the scopes/monitors band but BELOW menus and the overview navigator — the
// overview is a full-window opaque picture and is meant to cover this, so any step that sends the
// reader there must tell them how to come back.
//
// Steps are plain data — { title, body } — so the copy can be rewritten without touching any of
// this. A step's body is a list of parts: a string is prose, and { try: '...' } is a "Do this"
// block. They render in the order written and scroll together, because a step often has more than
// one thing to do and each belongs next to the prose that sets it up — not parked in one fixed
// slot at the bottom. The copy itself comes from host/tutorial.md, via host/tutorial-md.js.

'use strict';

const POS_KEY = 'wcoast.tourPos';    // remembered card position: the reader parks it out of the way once
const SIZE_KEY = 'wcoast.tourSize';  // remembered card size, once the reader has resized it themselves
const SEEN_KEY = 'wcoast.introSeen';  // set only by "Don't show on startup" — a plain close still returns next run

// A card title → the fragment an in-tutorial link points at, e.g. "First sound" → "first-sound".
const slug = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (_e) { return null; } };
const write = (k, v) => { try { localStorage.setItem(k, v); } catch (_e) { /* no storage */ } };

export function tourSeen() { try { return localStorage.getItem(SEEN_KEY) === '1'; } catch (_e) { return false; } }

// `steps`: the card copy, in order. `onExternal(url)`: open a link outside the app (Electron needs
// this routed through the shell, so the caller supplies it). `isDark()`: the app's current mode —
// the card is dressed as a faceplate, so it follows View ▸ Light/Dark mode like the panels do.
export function createTour({ steps, onExternal, isDark, onSee, canSee, homePos }) {
  let el = null;
  let titleEl, bodyEl, neverCb, homeBtn;

  // Keep the card fully on screen. A remembered position can fall outside the window after a
  // resize (or a move between displays), which would strand the card where it can't be reached.
  // If the window can't be measured yet, DON'T clamp: a zero viewport would pin the card into the
  // top-left corner, which is worse than leaving it where it was asked to go.
  // The card may hang off the left, right or bottom — you often want it mostly out of the way —
  // but KEEP_ON_SCREEN of it always stays reachable, and its top never goes above the window,
  // because the header is the only drag handle: pushed off the top it could never be grabbed back.
  const KEEP_ON_SCREEN = 80;
  const clampIntoView = (x, y) => {
    const vw = window.innerWidth || 0, vh = window.innerHeight || 0;
    if (vw <= 0 || vh <= 0) return { x, y };
    const w = el.offsetWidth || 340;
    return {
      x: Math.max(KEEP_ON_SCREEN - w, Math.min(vw - KEEP_ON_SCREEN, x)),
      y: Math.max(4, Math.min(vh - 40, y)),
    };
  };

  const place = (x, y) => {
    const p = clampIntoView(x, y);
    el.style.left = Math.round(p.x) + 'px';
    el.style.top = Math.round(p.y) + 'px';
    return p;
  };

  // Drag by the header only, so a press on the body or the buttons still does its own job.
  const startDrag = (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const r = el.getBoundingClientRect();
    const dx = e.clientX - r.left, dy = e.clientY - r.top;
    const onMove = (ev) => place(ev.clientX - dx, ev.clientY - dy);
    const onUp = (ev) => {
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerup', onUp, true);
      const p = place(ev.clientX - dx, ev.clientY - dy);
      write(POS_KEY, JSON.stringify(p));   // park it once, find it there next time
    };
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', onUp, true);
  };

  // Resize by a grip: 'y' drags height only (the whole bottom edge), 'xy' drags both (the corner).
  // Clamps match the CSS min/max so a drag can't shrink the card past its controls or overflow the
  // window. Setting inline width/height is what the ResizeObserver watches, so the size persists.
  const startResize = (axis) => (e) => {
    if (e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    const r = el.getBoundingClientRect();
    const sx = e.clientX, sy = e.clientY, sw = r.width, sh = r.height;
    const maxH = (window.innerHeight || 0) * 0.9;   // matches max-height: 90vh
    const maxW = (window.innerWidth || 0) * 0.95;   // matches max-width: 95vw
    const wide = axis === 'x' || axis === 'xy';
    const tall = axis === 'y' || axis === 'xy';
    const onMove = (ev) => {
      if (wide) {
        let w = Math.max(320, sw + (ev.clientX - sx));
        if (maxW > 0) w = Math.min(w, maxW);
        el.style.width = Math.round(w) + 'px';
      }
      if (tall) {
        let h = Math.max(130, sh + (ev.clientY - sy));
        if (maxH > 0) h = Math.min(h, maxH);
        el.style.height = Math.round(h) + 'px';
      }
    };
    const onUp = () => {
      document.removeEventListener('pointermove', onMove, true);
      document.removeEventListener('pointerup', onUp, true);
      write(SIZE_KEY, JSON.stringify({ w: el.offsetWidth, h: el.offsetHeight }));
    };
    document.addEventListener('pointermove', onMove, true);
    document.addEventListener('pointerup', onUp, true);
  };

  // Which section is the reader in? The one whose heading is highest on screen without having
  // scrolled past the top of the view — read on scroll, and the head reports it. Cheap: the
  // section elements are collected once at render, so this is a walk over eight offsets.
  let sections = [];                        // { title, el, id }

  // A section's distance below the TOP OF THE SCROLLING BODY. Not `offsetTop`: that is measured
  // from the nearest POSITIONED ancestor, which here is the card, so it silently includes the
  // header's height — scrolling to a section overshot it by exactly that, and the document opened
  // with its first heading already off the top. Client rects have no such ambiguity.
  const offsetInBody = (elm) => bodyEl.scrollTop
    + (elm.getBoundingClientRect().top - bodyEl.getBoundingClientRect().top);

  const refreshCurrentSection = () => {
    if (!bodyEl || !sections.length || !titleEl) return;
    const bodyTop = bodyEl.getBoundingClientRect().top + 8;
    let cur = sections[0];
    for (const s of sections) { if (s.el.getBoundingClientRect().top <= bodyTop) cur = s; else break; }
    if (titleEl.textContent !== cur.label) titleEl.textContent = cur.label;
    if (homeBtn) homeBtn.style.visibility = bodyEl.scrollTop > 8 ? '' : 'hidden';
    clearCallout();
  };

  // Take down whatever callout is showing. Hovering off a ? button is the usual way here, but it
  // is also called on scroll: a wheel turn slides the button out from under a stationary pointer,
  // and the boundary event for that is not something to rely on across browsers. Clearing on
  // scroll is unconditional and cheap, and it guarantees no arrow is ever left pointing from a
  // button that has moved.
  const clearCallout = () => {
    const lit = bodyEl && bodyEl.querySelector('.tour-eye.lit');
    if (!lit) return;
    lit.classList.remove('lit');
    if (onSee) onSee(null, null);
  };

  const build = () => {
    el = document.createElement('div');
    el.className = 'tour-card';

    const head = document.createElement('div');
    head.className = 'tour-head';
    // The title is not a card's name any more — it reports WHICH SECTION you are currently
    // scrolled into, updated as you move. That is what replaces the old "4 of 8": with one
    // continuous document there are no steps to count, but you still need to know where you are.
    titleEl = document.createElement('div'); titleEl.className = 'tour-title';
    // The only button left in the head besides Close. A long document with no way back to the
    // start is worse than one button — everything else that used to live here is gone.
    homeBtn = document.createElement('button');
    homeBtn.className = 'tour-home'; homeBtn.textContent = 'Top';
    homeBtn.title = 'Back to the top';
    homeBtn.setAttribute('aria-label', 'Back to the top');
    homeBtn.addEventListener('click', () => { if (bodyEl) bodyEl.scrollTo({ top: 0, behavior: 'smooth' }); });
    const close = document.createElement('button');
    close.className = 'tour-x'; close.textContent = '×';
    close.title = 'Close (Help ▸ Interactive tutorial brings it back)';
    close.setAttribute('aria-label', 'Close');
    close.addEventListener('click', () => { if (onSee) onSee(null, null); hide(); });
    head.appendChild(titleEl); head.appendChild(homeBtn); head.appendChild(close);
    head.addEventListener('pointerdown', startDrag);

    bodyEl = document.createElement('div'); bodyEl.className = 'tour-body';
    bodyEl.addEventListener('scroll', refreshCurrentSection, { passive: true });

    const foot = document.createElement('div'); foot.className = 'tour-foot';
    // Leaving must be obvious: a plain Close button, not just the ×.
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tour-btn'; closeBtn.textContent = 'Close';
    closeBtn.addEventListener('click', () => hide());
    // "Don't show on startup" is a TOGGLE of the auto-open setting, not an exit: it shows its own
    // state and can be turned back off. It deliberately does NOT close the card — that's Close's job.
    // Named for what it does: Help ▸ Interactive tutorial reopens the card either way, so this only
    // ever governs whether a new session greets you with it.
    const never = document.createElement('label'); never.className = 'tour-never';
    neverCb = document.createElement('input'); neverCb.type = 'checkbox';
    neverCb.addEventListener('change', () => write(SEEN_KEY, neverCb.checked ? '1' : '0'));
    never.appendChild(neverCb);
    never.appendChild(document.createTextNode(" Don't show on startup"));
    never.title = 'Stop the tutorial opening by itself on a new session';
    const left = document.createElement('div'); left.className = 'tour-left';
    left.appendChild(closeBtn); left.appendChild(never);
    // No Back, no Next, no "4 of 8". Early testing showed people could not tell the difference
    // between scrolling within a card and stepping to the next one — so there is now only one
    // kind of movement in the tutorial, and it is scrolling.
    foot.appendChild(left);

    el.appendChild(head); el.appendChild(bodyEl); el.appendChild(foot);

    // The whole bottom edge is a height grip, so the card is easy to pull up off a module it covers;
    // the corner grip takes both axes.
    const gripY = document.createElement('div'); gripY.className = 'tour-resize-y';
    gripY.addEventListener('pointerdown', startResize('y'));
    const gripX = document.createElement('div'); gripX.className = 'tour-resize-x';
    gripX.addEventListener('pointerdown', startResize('x'));
    const gripXY = document.createElement('div'); gripXY.className = 'tour-resize-xy';
    gripXY.addEventListener('pointerdown', startResize('xy'));
    el.appendChild(gripY); el.appendChild(gripX); el.appendChild(gripXY);

    document.body.appendChild(el);

    // The card resizes like a window (CSS `resize`), which fires no event — so watch it. Only a
    // USER resize is remembered: `resize` writes inline width/height, whereas the card growing or
    // shrinking to fit a new step doesn't. Without that test, stepping between cards would save the
    // auto height and freeze every later card at it.
    const saved = readJSON(SIZE_KEY);
    if (saved && saved.w > 0) { el.style.width = saved.w + 'px'; el.style.height = saved.h + 'px'; }
    if (window.ResizeObserver) new ResizeObserver(() => {
      refreshCurrentSection();              // a resize moves every heading
      if (!el.style.width && !el.style.height) return;
      write(SIZE_KEY, JSON.stringify({ w: el.offsetWidth, h: el.offsetHeight }));
    }).observe(el);
  };

  // One part of a step: prose, or a "Do this" block. The label is inline rather than a heading —
  // a stacked one would cost a line every time, and a step may carry several.
  const renderPart = (part) => {
    if (typeof part === 'string') {
      const p = document.createElement('div');
      p.className = 'tour-p';
      p.innerHTML = part;                   // copy is ours, not user input — it may carry <b> and links
      return p;
    }
    const box = document.createElement('div');
    box.className = 'tour-try';
    const lab = document.createElement('b');
    lab.className = 'tour-try-label';
    lab.textContent = part.label || 'Do this';
    const text = document.createElement('span');
    text.innerHTML = part.try;               // ours, not user input — a task may carry <b> or a link
    box.appendChild(lab);
    box.appendChild(document.createTextNode(' — '));
    box.appendChild(text);
    return box;
  };

  // Render the WHOLE tutorial, once, as one continuous document. There are no cards: each `##`
  // in tutorial.md becomes a section with a heading, and the reader scrolls.
  //
  // The eyes still pair with their targets by document order, but PER SECTION rather than across
  // the whole file. That matters now the file is one flow: paired globally, a single missing
  // `{see:}` would shift every callout after it for the rest of the document instead of breaking
  // one section. The reader cannot tell the difference; the failure mode is much smaller.
  // A contents section is recognised by its title alone, so the markdown decides whether the
  // tutorial has one at all — remove the "## Contents" heading and everything renumbers itself.
  const isContents = (t) => slug(t) === 'contents';
  const contentsBefore = (i) => steps.slice(0, i).filter((x) => isContents(x.title)).length;

  const renderAll = () => {
    bodyEl.textContent = '';
    sections = [];
    steps.forEach((s, i) => {
      const sec = document.createElement('section');
      sec.className = 'tour-section';
      sec.id = 'sec-' + slug(s.title);
      if (i > 0) sec.appendChild(document.createElement('hr'));   // sections need a visible seam
      // Numbered, so a section can be referred to by number — in conversation, in a bug report,
      // or in the head, where the number is what tells you how far down the document you are.
      // The CONTENTS is the exception: it is the list OF the numbered sections, not one of them,
      // so it carries no number and the count starts after it. Otherwise its own entries would
      // read 2 to 8 and the list would look like it had lost its first item.
      const num = isContents(s.title) ? 0 : i + 1 - contentsBefore(i);
      const h = document.createElement('h2');
      h.className = 'tour-h';
      h.textContent = num ? num + '. ' + s.title : s.title;
      sec.appendChild(h);
      const parts = Array.isArray(s.body) ? s.body : [s.body];
      for (const part of parts) sec.appendChild(renderPart(part));
      bodyEl.appendChild(sec);
      sections.push({ title: s.title, num, label: num ? num + '. ' + s.title : s.title, el: sec, id: sec.id });
      wireEyes(sec, s.sees || []);
    });
    wireLinks();
    bodyEl.scrollTop = 0;
    refreshCurrentSection();
  };

  // SHOW-ME buttons. A PEEK, driven by hover: rest the pointer on a ? and its subject is ringed
  // on the rack with an arrow drawn to it; move off and both go. Nothing to click, nothing to
  // dismiss, and — because a callout cannot outlive the pointer that is on its button — no tail
  // to drag along behind a scroll. One at a time falls out of the mechanism rather than being
  // enforced: the pointer is only ever on one button.
  //
  // A button whose subject isn't in the rack (the reader deleted that module) shows as
  // unavailable rather than doing nothing. Checked on each hover, not at render, because the
  // card can open before a saved session has finished restoring its modules.
  //
  // The buttons carry no target of their own, so nothing extra is read aloud when a paragraph is
  // spoken or copied — the pairing lives in JS, keyed by order within this section.
  const wireEyes = (root, eyeTargets) => {
    [...root.querySelectorAll('.tour-eye')].forEach((eye, i) => {
      const target = eyeTargets[i];
      if (!target) return;
      eye.addEventListener('pointerenter', () => {
        // Re-evaluated BOTH ways on every hover. Under the old click behaviour marking a button
        // unavailable was a deliberate, rare act, so the mark could be one-way; under hover the
        // pointer crosses buttons incidentally on its way down the page, and a one-way mark meant
        // a module that merely happened to be absent greyed its buttons for the rest of the
        // session — still grey after the reader added the module back.
        const ok = !canSee || canSee(target);
        eye.classList.toggle('unavailable', !ok);
        eye.title = ok ? '' : 'Not in your rack';
        if (!ok) return;
        clearCallout();
        if (onSee && onSee(target, eye)) eye.classList.add('lit');
      });
      eye.addEventListener('pointerleave', clearCallout);
      // The button is no longer a control, so a click on it should do nothing at all rather than
      // select the paragraph around it or fall through to the card.
      eye.addEventListener('pointerdown', (ev) => ev.preventDefault());
      eye.addEventListener('click', (ev) => { ev.preventDefault(); ev.stopPropagation(); });
    });
  };

  // An in-tutorial link — href "#slug", matching a section title — now SCROLLS to that section
  // rather than switching cards. A normal URL goes to the caller (Electron opens it in the real
  // browser). A #slug whose section doesn't exist yet drops back to plain text, so an outline
  // entry becomes live automatically the moment its section is written.
  const wireLinks = () => {
    for (const a of [...bodyEl.querySelectorAll('a[href]')]) {
      const href = a.getAttribute('href') || '';
      if (href.startsWith('#')) {
        const sec = sections.find((x) => x.id === 'sec-' + href.slice(1));
        if (sec) {
          // Number the contents entry from the section it points at, rather than asking the
          // markdown to hard-code a number that would rot the moment a section moved.
          if (sec.num && !/^\d+\.\s/.test(a.textContent)) a.textContent = sec.num + '. ' + a.textContent;
          a.addEventListener('click', (e) => { e.preventDefault(); scrollToSection(sec); });
        }
        else a.replaceWith(document.createTextNode(a.textContent));
      } else if (onExternal) {
        a.addEventListener('click', (e) => { e.preventDefault(); onExternal(href); });
      }
    }
  };

  const scrollToSection = (sec) => {
    if (!sec || !bodyEl) return;
    bodyEl.scrollTo({ top: Math.max(0, offsetInBody(sec.el) - 4), behavior: 'smooth' });
  };

  const hide = () => { if (el) el.style.display = 'none'; };

  // Match the app's faceplate mode. Called on open, and pushed by the app when the mode is switched
  // while the card is up (same `theme-dark` convention the context menus use).
  const applyTheme = () => { if (el) el.classList.toggle('theme-dark', !!(isDark && isDark())); };

  // Put the card where it was left, or low-centre on a first run. At boot the window can still
  // measure 0 (Electron opens hidden until ready-to-show; a browser settles its flex layout a beat
  // later) — placing then would strand the card in a corner, so wait for a real measurement.
  const placeInitial = (tries = 0) => {
    const saved = readJSON(POS_KEY);
    if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') { place(saved.x, saved.y); return; }
    if ((!window.innerWidth || !el.offsetWidth) && tries < 10) { requestAnimationFrame(() => placeInitial(tries + 1)); return; }
    // First run: sit just clear of the rack if there's room for it there, so the card doesn't cover
    // the very modules it's describing. Otherwise fall back to low-centre.
    const home = homePos && homePos(el.offsetWidth || 340, el.offsetHeight || 200);
    if (home) { place(home.x, home.y); return; }
    place((window.innerWidth - (el.offsetWidth || 340)) / 2, window.innerHeight * 0.62);
  };

  return {
    isOpen: () => !!el && el.style.display !== 'none',
    // `at` is an optional section — an index or a slug — to open scrolled to. Rendering happens
    // once per open rather than once per step, since there is only one document now.
    open(at) {
      if (!steps.length) return;
      const first = !el;
      if (first) build();
      el.style.display = '';
      applyTheme();
      neverCb.checked = tourSeen();   // the toggle shows the live setting, however it was last left
      if (first) renderAll();
      if (at != null) {
        const sec = typeof at === 'number' ? sections[at]
          : sections.find((x) => x.id === 'sec-' + String(at).replace(/^#/, ''));
        if (sec) scrollToSection(sec); else bodyEl.scrollTop = 0;
      }
      refreshCurrentSection();
      placeInitial();
    },
    close: hide,
    applyTheme,
  };
}
