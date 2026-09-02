/* ============================================================
   Neotone — shared mobile machinery
   Sheets, scroll lock, back-button handling, the Selection
   (persisted across pages), disclosures, toasts.
   Pages set window.NEO before loading this file.
   ============================================================ */
(function(){
'use strict';

var NEO = window.NEO || {};
var $ = function(id){ return document.getElementById(id); };
function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function money(n){ return '€' + Math.round(n).toLocaleString('en-US'); }

var VAT = { HU:0.27, DE:0.19, FR:0.20, US:null };
var VAT_NAME = { HU:'Hungary', DE:'Germany', FR:'France', US:'United States' };

/* ---- the Selection, kept across pages --------------------- */
var KEY = 'neo.selection', CKEY = 'neo.country';
var selection = [], country = 'HU';
try {
  selection = JSON.parse(localStorage.getItem(KEY) || '[]') || [];
  country = localStorage.getItem(CKEY) || 'HU';
} catch (e) { selection = []; }

function save(){
  try {
    localStorage.setItem(KEY, JSON.stringify(selection));
    localStorage.setItem(CKEY, country);
  } catch (e) {}
}

/* ---- shared markup ---------------------------------------- */
var shared = document.createElement('div');
shared.innerHTML =
  '<div class="scrim" id="scrim"></div>' +

  '<div class="sheet bottom" id="sheet-menu" role="dialog" aria-modal="true" aria-label="Menu">' +
    '<div class="grab"></div>' +
    '<div class="sheet-body">' +
      '<span class="lbl" style="margin-bottom:6px;">Sections</span>' +
      '<div class="rows">' +
        '<a class="row" href="index.html"><span class="grow"><span class="t">Instruments</span></span><span class="arw">→</span></a>' +
        '<a class="row" href="tonefield.html"><span class="grow"><span class="t">Tonefield</span><span class="d">Craft and culture, quarterly</span></span><span class="arw">→</span></a>' +
        '<a class="row" href="manual.html"><span class="grow"><span class="t">Manual &amp; support</span><span class="d">Every control, troubleshooting, contact</span></span><span class="arw">→</span></a>' +
        '<a class="row" href="updates.html"><span class="grow"><span class="t">Updates</span><span class="d">What went out by mail</span></span><span class="arw">→</span></a>' +
        '<a class="row" href="legal.html"><span class="grow"><span class="t">Legal</span></span><span class="arw">→</span></a>' +
      '</div>' +
      '<form class="inline-form" style="margin-top:20px;" id="menu-search">' +
        '<input class="field" type="search" placeholder="Search">' +
        '<button class="btn sm ghost" type="submit">→</button>' +
      '</form>' +
    '</div>' +
  '</div>' +

  '<div class="sheet bottom" id="sheet-selection" role="dialog" aria-modal="true" aria-label="Selection">' +
    '<div class="grab"></div>' +
    '<div class="sheet-bar">' +
      '<span></span><span class="ttl">Selection</span>' +
      '<button data-close="selection" aria-label="Close">✕</button>' +
    '</div>' +
    '<div class="sheet-body" id="sel-body"></div>' +
    '<div class="sheet-foot" style="flex-direction:column;align-items:stretch;gap:8px;">' +
      '<div class="sumline total" style="border-top:0;margin:0;padding:0 0 6px;" id="sel-total-row" hidden>' +
        '<span class="k">Total, incl. VAT</span><span class="v" id="sel-total">—</span>' +
      '</div>' +
      '<button class="btn" id="sel-cta" disabled>Proceed to payment</button>' +
      '<button class="btn quiet" id="sel-save" hidden>Or save this selection by email →</button>' +
    '</div>' +
  '</div>' +

  '<div class="sheet bottom" id="sheet-contact" role="dialog" aria-modal="true" aria-label="Questions">' +
    '<div class="grab"></div>' +
    '<div class="sheet-body">' +
      '<h2>Questions?</h2>' +
      '<p class="small" style="margin-top:6px;">Anything the page has not covered. Someone from the workshop replies.</p>' +
      '<form style="margin-top:16px;" id="contact-form">' +
        '<input class="field" placeholder="Your name" required>' +
        '<input class="field" type="email" placeholder="Email" required>' +
        '<textarea class="field" rows="3" placeholder="Your question" style="resize:vertical;" required></textarea>' +
        '<button class="btn" type="submit" style="margin-top:18px;">Send</button>' +
      '</form>' +
    '</div>' +
  '</div>' +

  '<div class="toast" id="toast"></div>';
document.body.appendChild(shared);

/* ---- sheets ----------------------------------------------- */
var openStack = [], scrollY = 0;

function openSheet(name){
  var el = $('sheet-' + name);
  if (!el || el.classList.contains('show')) return;
  if (name === 'selection') renderSelection();
  if (NEO.onOpenSheet) NEO.onOpenSheet(name);

  if (!openStack.length){
    scrollY = window.pageYOffset;
    document.body.style.top = (-scrollY) + 'px';
    document.body.classList.add('locked');
  }
  openStack.push(name);
  $('scrim').classList.add('show');
  el.classList.add('show');
  history.pushState({ sheet:name }, '', '#' + name);
}

function closeSheet(name){
  var el = $('sheet-' + name);
  if (!el || !el.classList.contains('show')) return;
  el.classList.remove('show');
  openStack = openStack.filter(function(x){ return x !== name; });
  if (!openStack.length){
    $('scrim').classList.remove('show');
    document.body.classList.remove('locked');
    document.body.style.top = '';
    window.scrollTo(0, scrollY);
    if (NEO.onAllSheetsClosed) NEO.onAllSheetsClosed();
  }
}
function closeTop(){
  if (!openStack.length) return;
  var top = openStack[openStack.length - 1];
  if (NEO.onBack && NEO.onBack(top) === false) return;  /* the page may step back inside its own sheet */
  closeSheet(top);
}
function topSheet(){ return openStack.length ? openStack[openStack.length - 1] : null; }

$('scrim').onclick = closeTop;
document.addEventListener('click', function(e){
  var t = e.target.closest('[data-open],[data-close]');
  if (!t) return;
  e.preventDefault();
  if (t.dataset.open) openSheet(t.dataset.open);
  else closeSheet(t.dataset.close);
});
window.addEventListener('popstate', function(){
  if (openStack.length && NEO.onBack && NEO.onBack(topSheet()) === false){
    history.pushState({ sheet:topSheet() }, '', '#' + topSheet());
    return;
  }
  if (openStack.length) closeSheet(topSheet());
});
document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeTop(); });

/* ---- Selection -------------------------------------------- */
function addToSelection(items){
  items.forEach(function(i){ selection.push(i); });
  save(); renderSelection();
}
function removeItem(i){ selection.splice(i, 1); save(); renderSelection(); }

function renderSelection(){
  var n = selection.length;
  var badge = $('selcount');
  if (badge){ badge.textContent = n; badge.classList.toggle('on', n > 0); }

  var body = $('sel-body');
  if (!body) return;
  if (!n){
    body.innerHTML = '<p class="small" style="padding:24px 0;text-align:center;">Your selection is empty.</p>';
    $('sel-total-row').hidden = true;
    $('sel-save').hidden = true;
    $('sel-cta').disabled = true;
    return;
  }
  var h = '', sub = 0;
  selection.forEach(function(it, i){
    sub += it.price;
    h += '<div class="selrow">' +
           '<span class="thumb">' + (it.img ? '<img src="' + it.img + '" alt="">' : '') + '</span>' +
           '<span style="flex:1;min-width:0;">' +
             '<span style="font-size:15px;font-weight:500;display:block;">' + esc(it.name) + '</span>' +
             '<span style="font-size:12.5px;color:var(--muted);display:block;">' + esc(it.detail) + '</span>' +
           '</span>' +
           '<span style="font-size:14px;font-variant-numeric:tabular-nums;white-space:nowrap;">' + money(it.price) + '</span>' +
           '<button class="x" data-remove="' + i + '" aria-label="Remove">✕</button>' +
         '</div>';
  });
  var rate = VAT[country];
  var vat = rate === null ? 0 : Math.round(sub * rate);
  h += '<div class="sumline muted" style="border-bottom:0;">' +
       '<span class="k">' + (rate === null ? 'No VAT · import duties may apply'
          : Math.round(rate * 100) + '% VAT · ' + VAT_NAME[country]) + '</span>' +
       '<span class="v">' + (rate === null ? '—' : money(vat)) + '</span></div>';
  body.innerHTML = h;

  $('sel-total').textContent = money(sub + vat);
  $('sel-total-row').hidden = false;
  $('sel-save').hidden = false;
  $('sel-cta').disabled = false;
}
document.addEventListener('click', function(e){
  var t = e.target.closest('[data-remove]');
  if (t) removeItem(+t.dataset.remove);
});
$('sel-cta').onclick = function(){ window.location.href = 'checkout.html'; };
$('sel-save').onclick = function(){ toast('Saves the selection by email — not wired up'); };

/* ---- disclosures ------------------------------------------ */
document.addEventListener('click', function(e){
  var t = e.target.closest('[data-disc]');
  if (!t) return;
  e.preventDefault();
  var el = t.closest('.disc') || $(t.dataset.disc);
  if (el) el.classList.toggle('open');
});

/* ---- toast ------------------------------------------------ */
var toastT;
function toast(msg){
  var t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(function(){ t.classList.remove('show'); }, 1900);
}
document.addEventListener('click', function(e){
  var t = e.target.closest('[data-stub]');
  if (!t) return;
  e.preventDefault();
  toast(t.dataset.stub + ' — not wired up');
});

/* ---- forms that only need to acknowledge ------------------ */
document.addEventListener('submit', function(e){
  var f = e.target;
  if (f.id === 'contact-form'){ e.preventDefault(); f.reset(); closeTop(); toast('Sent to the workshop'); return; }
  if (f.id === 'menu-search'){ e.preventDefault(); toast('Search — not wired up'); return; }
  if (f.dataset.subscribe !== undefined){
    e.preventDefault(); f.reset();
    var note = f.parentNode.querySelector('[data-subnote]');
    if (note) note.hidden = false;
    return;
  }
});

/* ---- reading progress ------------------------------------- */
var prog = document.querySelector('.progress');
if (prog){
  var onProg = function(){
    var h = document.documentElement.scrollHeight - window.innerHeight;
    prog.style.width = (h > 0 ? Math.min(100, (window.pageYOffset / h) * 100) : 0) + '%';
  };
  window.addEventListener('scroll', onProg, { passive:true });
  window.addEventListener('resize', onProg);
  onProg();
}

/* ---- boot ------------------------------------------------- */
if (location.hash) history.replaceState(null, '', location.pathname);
renderSelection();

/* ---- exports ---------------------------------------------- */
window.neo = {
  openSheet: openSheet, closeSheet: closeSheet, closeTop: closeTop, topSheet: topSheet,
  toast: toast, money: money, esc: esc,
  VAT: VAT, VAT_NAME: VAT_NAME,
  addToSelection: addToSelection, renderSelection: renderSelection,
  getCountry: function(){ return country; },
  setCountry: function(v){ country = v; save(); renderSelection(); },
  getSelection: function(){ return selection; },
  clearSelection: function(){ selection = []; save(); renderSelection(); }
};
})();
