(function(){
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── Nav elevation. A sentinel + IntersectionObserver, so nothing
        runs on the scroll thread. ───────────────────────────────── */
  var nav = document.getElementById('nav');
  var sentinel = document.createElement('div');
  sentinel.setAttribute('aria-hidden','true');
  sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px';
  document.body.prepend(sentinel);
  new IntersectionObserver(function(e){
    nav.classList.toggle('stuck', !e[0].isIntersecting);
  }).observe(sentinel);

  /* ── Scroll reveals ────────────────────────────────────────────── */
  var revealed = new IntersectionObserver(function(entries){
    entries.forEach(function(en){
      if (en.isIntersecting){ en.target.classList.add('in'); revealed.unobserve(en.target); }
    });
  }, { threshold:0.15, rootMargin:'0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach(function(el){ revealed.observe(el); });

  /* ── Mobile menu ───────────────────────────────────────────────── */
  var menu = document.getElementById('menu');
  var openBtn = document.getElementById('menu-open');
  var closeBtn = document.getElementById('menu-close');
  // Everything the panel covers. Marked inert while it is open so the
  // screen-reader cursor cannot wander behind it, not just Tab.
  var behind = [document.getElementById('main'),
                document.getElementById('nav'),
                document.querySelector('.footer'),
                document.querySelector('.announce')];

  function openMenu(){
    menu.hidden = false;
    requestAnimationFrame(function(){ menu.classList.add('open'); });
    openBtn.setAttribute('aria-expanded','true');
    document.body.style.overflow = 'hidden';
    behind.forEach(function(el){ if (el) el.inert = true; });
    closeBtn.focus();
  }
  function closeMenu(){
    menu.classList.remove('open');
    openBtn.setAttribute('aria-expanded','false');
    document.body.style.overflow = '';
    behind.forEach(function(el){ if (el) el.inert = false; });
    var done = function(){ menu.hidden = true; menu.removeEventListener('transitionend', done); };
    if (reduce){ menu.hidden = true; } else { menu.addEventListener('transitionend', done); }
    // Focus returns to the control that opened the panel, always.
    openBtn.focus();
  }
  openBtn.addEventListener('click', openMenu);
  closeBtn.addEventListener('click', closeMenu);
  menu.addEventListener('click', function(e){
    if (e.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', function(e){
    if (menu.hidden) return;
    if (e.key === 'Escape'){ closeMenu(); return; }
    if (e.key !== 'Tab') return;
    // Focus trap: the panel is modal, so Tab must not reach the page behind it.
    var f = menu.querySelectorAll('a[href], button:not([disabled])');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first){ e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last){ e.preventDefault(); first.focus(); }
  });

  /* ── The dose instrument ───────────────────────────────────────── */
  var DOSES = [
    { onset:'15', onsetU:'min', dur:'2', durU:'hrs',
      feel:'Barely there. Your focus stays exactly where you left it.',
      format:'THC Seltzer · 5 mg per can' },
    { onset:'30', onsetU:'min', dur:'3', durU:'hrs',
      feel:'The evening softens. You are still entirely yourself.',
      format:'Social Gummies · 10 mg per piece' },
    { onset:'45', onsetU:'min', dur:'5', durU:'hrs',
      feel:'Clearly lifted. Plan on staying in for the night.',
      format:'Krispies · 25 mg per bag' },
    { onset:'15', onsetU:'min', dur:'6', durU:'hrs',
      feel:'A full climb. For experienced users with a clear day after.',
      format:'THC Seltzer · 50 mg per can' },
    { onset:'45', onsetU:'min', dur:'8', durU:'hrs',
      feel:'Our highest potency. Split it, share it, or save it for a night off the grid.',
      format:'Social Gummies · 100 mg per piece' }
  ];

  var stops = Array.prototype.slice.call(document.querySelectorAll('.stop'));
  var needle = document.getElementById('needle');
  var readout = document.getElementById('readout');
  var foot = document.querySelector('.inst-foot');
  var els = {
    onset: document.getElementById('r-onset'),
    dur:   document.getElementById('r-dur'),
    feel:  document.getElementById('r-feel'),
    format:document.getElementById('r-format')
  };
  var current = 0;

  function select(i, focus){
    if (i === current) return;
    current = i;
    stops.forEach(function(s, n){
      s.setAttribute('aria-checked', n === i ? 'true' : 'false');
      s.tabIndex = n === i ? 0 : -1;
    });
    needle.style.setProperty('--i', i);
    if (focus) stops[i].focus();

    var d = DOSES[i];
    var apply = function(){
      els.onset.textContent = d.onset;
      els.dur.textContent = d.dur;
      els.feel.textContent = d.feel;
      els.format.textContent = d.format;
      els.onset.nextElementSibling.textContent = d.onsetU;
      els.dur.nextElementSibling.textContent = d.durU;
    };
    if (reduce){ apply(); return; }
    // Cross-fade so the numbers read as an instrument settling, not as
    // text being swapped.
    readout.classList.add('swapping'); foot.classList.add('swapping');
    setTimeout(function(){
      apply();
      readout.classList.remove('swapping'); foot.classList.remove('swapping');
    }, 180);
  }

  stops.forEach(function(s){
    s.addEventListener('click', function(){ select(+s.dataset.i, false); });
  });
  document.getElementById('stops').addEventListener('keydown', function(e){
    var i = current, n = stops.length;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') i = (current + 1) % n;
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') i = (current - 1 + n) % n;
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = n - 1;
    else return;
    e.preventDefault();
    select(i, true);
  });

  /* ── Guide form ────────────────────────────────────────────────── */
  var form = document.getElementById('guide-form');
  var email = document.getElementById('email');
  var error = document.getElementById('form-error');
  var note = document.getElementById('form-note');

  function showError(msg){
    error.textContent = msg;
    error.hidden = false;
    email.setAttribute('aria-invalid','true');
    email.setAttribute('aria-describedby','form-error form-note');
  }
  function clearError(){
    error.hidden = true;
    email.removeAttribute('aria-invalid');
    email.setAttribute('aria-describedby','form-note');
  }
  email.addEventListener('input', function(){ if (!error.hidden) clearError(); });

  form.addEventListener('submit', function(e){
    e.preventDefault();
    var v = email.value.trim();
    if (!v){ showError('Enter your email address so we know where to send it.'); email.focus(); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)){
      showError('That address is missing something. Check it and try again.');
      email.focus(); return;
    }
    clearError();
    form.querySelector('.field-row').remove();
    note.textContent = '';
    var ok = document.createElement('p');
    ok.className = 't-sub';
    ok.style.cssText = 'margin:.25rem 0 0;color:var(--ivory)';
    ok.setAttribute('role','status');
    ok.textContent = 'On its way to ' + v + '. Check your inbox in a minute.';
    form.appendChild(ok);
  });
})();
