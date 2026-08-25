/* ══════════════════════════════════════════════════════════════════
   SHERPA

   Every block below is guarded. This file now runs on ~33 pages and
   only the homepage has the dose instrument, only product pages have
   the variant pickers, only /company/contact/ has the contact form.
   Before the site had more than one page this was a single flat IIFE
   that dereferenced getElementById('stops') unconditionally, which
   throws a TypeError on every other page and kills everything
   registered after it.
   ══════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ── Nav elevation ───────────────────────────────────────────────
     A sentinel plus IntersectionObserver, so nothing runs on the
     scroll thread. */
  (function () {
    var nav = document.getElementById('nav');
    if (!nav) return;
    var sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px';
    document.body.prepend(sentinel);
    new IntersectionObserver(function (e) {
      nav.classList.toggle('stuck', !e[0].isIntersecting);
    }).observe(sentinel);
  })();

  /* ── Corner stack (homepage only) ───────────────────────────────────
     Same sentinel + IntersectionObserver technique as the nav elevation
     above, so visibility runs off the compositor thread rather than a
     scroll listener. Shown once the visitor has scrolled roughly past
     the hero (60vh), not from the very top. */
  (function () {
    var stack = document.getElementById('corner-stack');
    if (!stack) return;
    var sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:60vh;height:1px;width:1px';
    document.body.prepend(sentinel);
    new IntersectionObserver(function (e) {
      stack.classList.toggle('is-visible', !e[0].isIntersecting);
    }).observe(sentinel);

    var topBtn = document.getElementById('back-to-top');
    if (topBtn) {
      topBtn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      });
    }
  })();

  /* ── Scroll reveals ──────────────────────────────────────────────── */
  (function () {
    var els = $$('.reveal');
    if (!els.length) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (el) { io.observe(el); });
  })();

  /* ── Dialogs ─────────────────────────────────────────────────────
     One implementation for the mobile menu and the compliance
     disclosure. Both inert the page behind them so a screen-reader
     cursor cannot wander out, both trap Tab, both close on Escape,
     and both return focus to whatever opened them. */
  function makeDialog(panel, opts) {
    if (!panel) return null;
    opts = opts || {};
    var lastOpener = null;

    function behind() {
      return [document.getElementById('main'), document.getElementById('nav'),
              $('.footer'), $('.announce'), document.getElementById('corner-stack')].filter(Boolean);
    }

    function open(opener) {
      lastOpener = opener || null;
      panel.hidden = false;
      // Two frames: the element has to be laid out before the class
      // that transitions it can take effect.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { panel.classList.add('open'); });
      });
      document.body.style.overflow = 'hidden';
      behind().forEach(function (el) { el.inert = true; });
      var first = opts.initialFocus && $(opts.initialFocus, panel);
      (first || panel.querySelector('button, a[href]') || panel).focus();
    }

    function close() {
      panel.classList.remove('open');
      document.body.style.overflow = '';
      behind().forEach(function (el) { el.inert = false; });
      var done = function () { panel.hidden = true; panel.removeEventListener('transitionend', done); };
      if (reduce) { panel.hidden = true; } else { panel.addEventListener('transitionend', done); }
      if (lastOpener) { lastOpener.focus(); lastOpener = null; }
    }

    document.addEventListener('keydown', function (e) {
      if (panel.hidden) return;
      if (e.key === 'Escape') { close(); return; }
      if (e.key !== 'Tab') return;
      var f = $$('a[href], button:not([disabled]), input, select, textarea', panel)
                .filter(function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    return { open: open, close: close, panel: panel };
  }

  /* Mobile menu */
  (function () {
    var dlg = makeDialog(document.getElementById('menu'));
    var openBtn = document.getElementById('menu-open');
    var closeBtn = document.getElementById('menu-close');
    if (!dlg || !openBtn) return;
    openBtn.addEventListener('click', function () { dlg.open(openBtn); });
    if (closeBtn) closeBtn.addEventListener('click', dlg.close);
    dlg.panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) dlg.close();
    });
  })();

  /* Compliance disclosure */
  (function () {
    var dlg = makeDialog(document.getElementById('compliance-modal'),
                         { initialFocus: '#compliance-close' });
    if (!dlg) return;
    $$('[data-compliance-open]').forEach(function (btn) {
      btn.addEventListener('click', function () { dlg.open(btn); });
    });
    $$('[data-compliance-close], #compliance-close', dlg.panel).forEach(function (el) {
      el.addEventListener('click', dlg.close);
    });
  })();

  /* ── Radio-group helper ──────────────────────────────────────────
     The dose instrument and the product variant pickers are the same
     control: a roving-tabindex radio group driven by arrow keys. */
  function radioGroup(container, items, onChange) {
    // Start from whatever the markup already checked, not from index 0.
    // Product pickers open on the flagship strength and the one
    // photographed flavour, neither of which is necessarily first.
    var current = items.findIndex(function (el) {
      return el.getAttribute('aria-checked') === 'true';
    });
    if (current < 0) current = 0;
    function select(i, focus) {
      if (i === current) return;
      current = i;
      items.forEach(function (el, n) {
        el.setAttribute('aria-checked', n === i ? 'true' : 'false');
        el.tabIndex = n === i ? 0 : -1;
      });
      if (focus) items[i].focus();
      onChange(i);
    }
    items.forEach(function (el, i) {
      el.addEventListener('click', function () { select(i, false); });
    });
    container.addEventListener('keydown', function (e) {
      var i = current, n = items.length;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') i = (current + 1) % n;
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') i = (current - 1 + n) % n;
      else if (e.key === 'Home') i = 0;
      else if (e.key === 'End') i = n - 1;
      else return;
      e.preventDefault();
      select(i, true);
    });
    return { index: function () { return current; } };
  }

  /* ── The dose instrument (homepage) ──────────────────────────────── */
  (function () {
    var stopsWrap = document.getElementById('stops');
    var needle = document.getElementById('needle');
    var readout = document.getElementById('readout');
    if (!stopsWrap || !needle || !readout) return;

    var DOSES = [
      { onset: '15', onsetU: 'min', dur: '2', durU: 'hrs',
        feel: 'Barely there. Your focus stays exactly where you left it.',
        format: 'THC Seltzer · 5 mg per can' },
      { onset: '30', onsetU: 'min', dur: '3', durU: 'hrs',
        feel: 'The evening softens. You are still entirely yourself.',
        format: 'Social Gummies · 10 mg per piece' },
      { onset: '45', onsetU: 'min', dur: '5', durU: 'hrs',
        feel: 'Clearly lifted. Plan on staying in for the night.',
        format: 'Krispies · 25 mg per bag' },
      { onset: '15', onsetU: 'min', dur: '6', durU: 'hrs',
        feel: 'A full climb. For experienced users with a clear day after.',
        format: 'THC Seltzer · 50 mg per can' },
      { onset: '45', onsetU: 'min', dur: '8', durU: 'hrs',
        feel: 'Our highest potency. Split it, share it, or save it for a night off the grid.',
        format: 'Social Gummies · 100 mg per piece' }
    ];

    var stops = $$('.stop', stopsWrap);
    var foot = $('.inst-foot');
    var els = {
      onset: document.getElementById('r-onset'),
      dur: document.getElementById('r-dur'),
      feel: document.getElementById('r-feel'),
      format: document.getElementById('r-format')
    };

    radioGroup(stopsWrap, stops, function (i) {
      needle.style.setProperty('--i', i);
      var d = DOSES[i];
      var apply = function () {
        els.onset.textContent = d.onset;
        els.dur.textContent = d.dur;
        els.feel.textContent = d.feel;
        els.format.textContent = d.format;
        els.onset.nextElementSibling.textContent = d.onsetU;
        els.dur.nextElementSibling.textContent = d.durU;
      };
      if (reduce) { apply(); return; }
      // Cross-fade, so the numbers read as an instrument settling
      // rather than as text being swapped.
      readout.classList.add('swapping');
      if (foot) foot.classList.add('swapping');
      setTimeout(function () {
        apply();
        readout.classList.remove('swapping');
        if (foot) foot.classList.remove('swapping');
      }, 180);
    });
  })();

  /* ── Product variant pickers ─────────────────────────────────────
     Catalog only: there is no cart yet, so these report the current
     selection rather than pricing it. */
  (function () {
    var pickers = $$('.picker[data-picker]');
    var out = $('[data-selection]');
    if (!pickers.length) return;

    var chosen = {};
    function render() {
      if (!out) return;
      var parts = Object.keys(chosen).map(function (k) { return chosen[k]; });
      out.textContent = parts.length ? parts.join(' · ') : '';
    }

    pickers.forEach(function (picker) {
      var group = $('.picker-opts', picker);
      var opts = $$('.picker-opt', picker);
      if (!group || !opts.length) return;
      var key = picker.dataset.picker;
      var checked = opts.filter(function (o) { return o.getAttribute('aria-checked') === 'true'; })[0];
      chosen[key] = (checked || opts[0]).dataset.value;
      radioGroup(group, opts, function (i) {
        chosen[key] = opts[i].dataset.value;
        render();
      });
    });
    render();

    // Variant sync: swaps the photo, price and per-strength specs by dose.
    // Watches aria-checked with a MutationObserver rather than hooking
    // radioGroup's click handler directly, so it fires identically whether
    // the dose was picked by click or by arrow key, and needs nothing extra
    // exposed from radioGroup itself.
    (function () {
      var dataEl = document.getElementById('variant-data');
      var doseWrap = $('.picker[data-picker="dose"] .picker-opts');
      var img = document.getElementById('pdp-image');
      if (!dataEl || !doseWrap || !img) return;

      var variants = JSON.parse(dataEl.textContent);
      var byDose = {};
      variants.forEach(function (v) { byDose[v.dose] = v; });
      var view = 'front';

      function setText(id, val) {
        var el = document.getElementById(id);
        if (el) el.textContent = val;
      }

      function apply() {
        var checked = doseWrap.querySelector('[aria-checked="true"]');
        var v = (checked && byDose[checked.dataset.dose]) || variants[0];
        img.src = view === 'back' ? v.back : v.front;
        img.alt = view === 'back' ? v.backAlt : v.frontAlt;
        var price = document.getElementById('pdp-price');
        if (price) price.textContent = '$' + v.price.toFixed(2);
        setText('pdp-spec-dose', v.dose);
        setText('pdp-spec-total', v.totalMg);
        setText('pdp-spec-count', v.count);
        setText('pdp-spec-cal', v.calories);
      }

      new MutationObserver(apply).observe(doseWrap, {
        attributes: true, attributeFilter: ['aria-checked'], subtree: true
      });

      $$('.viewtab').forEach(function (btn) {
        btn.addEventListener('click', function () {
          $$('.viewtab').forEach(function (b) {
            b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
          });
          view = btn.dataset.view;
          apply();
        });
      });
    })();

    var buy = $('[data-buy]');
    if (buy) {
      buy.addEventListener('click', function () {
        var note = $('.pdp-buynote');
        if (note) {
          note.textContent = 'Checkout is not connected yet, so nothing was added. ' +
                             'The selection above is what a cart would receive.';
          note.classList.add('is-loud');
        }
      });
    }
  })();

  /* ── Guide form (homepage CTA) ───────────────────────────────────── */
  (function () {
    var form = document.getElementById('guide-form');
    if (!form) return;
    var email = document.getElementById('email');
    var error = document.getElementById('form-error');
    var note = document.getElementById('form-note');

    function showError(msg) {
      error.textContent = msg;
      error.hidden = false;
      email.setAttribute('aria-invalid', 'true');
      email.setAttribute('aria-describedby', 'form-error form-note');
    }
    function clearError() {
      error.hidden = true;
      email.removeAttribute('aria-invalid');
      email.setAttribute('aria-describedby', 'form-note');
    }
    email.addEventListener('input', function () { if (!error.hidden) clearError(); });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = email.value.trim();
      if (!v) { showError('Enter your email address so we know where to send it.'); email.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) {
        showError('That address is missing something. Check it and try again.');
        email.focus(); return;
      }
      clearError();
      form.querySelector('.field-row').remove();
      note.textContent = '';
      var ok = document.createElement('p');
      ok.className = 't-sub';
      ok.style.cssText = 'margin:.25rem 0 0;color:var(--ivory)';
      ok.setAttribute('role', 'status');
      ok.textContent = 'On its way to ' + v + '. Check your inbox in a minute.';
      form.appendChild(ok);
    });
  })();

  /* ── Contact form ────────────────────────────────────────────────
     Validates and reports, but does not claim to have sent anything:
     there is no endpoint behind it yet. */
  (function () {
    var form = document.getElementById('contact-form');
    if (!form) return;

    function fieldError(input, msg) {
      var p = $('[data-error-for="' + input.id + '"]', form);
      if (!p) return;
      if (msg) {
        p.textContent = msg;
        p.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        input.setAttribute('aria-describedby', p.id || '');
      } else {
        p.hidden = true;
        input.removeAttribute('aria-invalid');
      }
    }

    $$('input, textarea', form).forEach(function (el) {
      el.addEventListener('input', function () { fieldError(el, null); });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('c-name');
      var email = document.getElementById('c-email');
      var msg = document.getElementById('c-msg');
      var bad = null;

      if (!msg.value.trim()) { fieldError(msg, 'Tell us what you need and we will come back to you.'); bad = bad || msg; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.value.trim())) {
        fieldError(email, 'That address is missing something. Check it and try again.'); bad = bad || email;
      }
      if (!name.value.trim()) { fieldError(name, 'Enter your name so we know who we are replying to.'); bad = bad || name; }

      if (bad) { bad.focus(); return; }

      var note = $('.cform-note', form);
      note.textContent = 'This form has no endpoint behind it yet, so nothing was sent. ' +
                         'Reach us at exploresherpa.com in the meantime.';
      note.classList.add('is-loud');
    });
  })();

})();
