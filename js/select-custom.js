// js/select-custom.js — Custom Select para Creditadora
(function () {

  function createSelect(original) {
    if (original.dataset.scDone) return;
    original.dataset.scDone = '1';

    const wrap = document.createElement('div');
    wrap.className = 'sc-wrap';
    original.parentNode.insertBefore(wrap, original);
    wrap.appendChild(original);

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'sc-trigger';
    trigger.innerHTML = '<span class="sc-text sc-placeholder"></span><span class="sc-arrow">▼</span>';
    wrap.appendChild(trigger);

    const pop = document.createElement('div');
    pop.className = 'sc-popover';
    wrap.appendChild(pop);

    function buildOptions() {
      pop.innerHTML = '';
      original.querySelectorAll('option').forEach(opt => {
        const item = document.createElement('div');
        item.className = 'sc-option' + (opt.value === original.value ? ' selected' : '');
        item.textContent = opt.textContent;
        item.dataset.value = opt.value;
        pop.appendChild(item);
      });
    }

    function updateTrigger() {
      const sel = original.options[original.selectedIndex];
      const txtEl = trigger.querySelector('.sc-text');
      if (sel) {
        txtEl.textContent = sel.textContent;
        txtEl.classList.remove('sc-placeholder');
      } else {
        txtEl.textContent = 'Selecione...';
        txtEl.classList.add('sc-placeholder');
      }
    }

    function open() {
      closeAll();
      buildOptions();
      const rect = wrap.getBoundingClientRect();
      pop.classList.toggle('above', window.innerHeight - rect.bottom < 260);
      pop.classList.add('open');
      trigger.classList.add('open');
      const sel = pop.querySelector('.sc-option.selected');
      if (sel) setTimeout(() => sel.scrollIntoView({ block: 'nearest' }), 50);
    }

    function close() {
      pop.classList.remove('open');
      trigger.classList.remove('open');
    }

    trigger.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      pop.classList.contains('open') ? close() : open();
    });

    pop.addEventListener('click', e => {
      const item = e.target.closest('.sc-option');
      if (!item) return;
      e.stopPropagation();
      original.value = item.dataset.value;
      original.dispatchEvent(new Event('change', { bubbles: true }));
      original.dispatchEvent(new Event('input',  { bubbles: true }));
      updateTrigger();
      pop.querySelectorAll('.sc-option').forEach(o => o.classList.remove('selected'));
      item.classList.add('selected');
      setTimeout(close, 100);
    });

    trigger.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
      if (e.key === 'Escape') close();
    });

    // Sincroniza quando o valor do select muda por JS
    const obs = new MutationObserver(updateTrigger);
    obs.observe(original, { attributes: true, childList: true });
    original.addEventListener('change', updateTrigger);

    updateTrigger();
  }

  function closeAll() {
    document.querySelectorAll('.sc-popover.open').forEach(p => p.classList.remove('open'));
    document.querySelectorAll('.sc-trigger.open').forEach(t => t.classList.remove('open'));
  }

  document.addEventListener('click', e => {
    if (!e.target.closest('.sc-wrap')) closeAll();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAll();
  });

  function initAll() {
    document.querySelectorAll('.fg select:not([data-sc-done])').forEach(createSelect);
  }

  function boot() {
    initAll();
    setTimeout(initAll, 600);
    setTimeout(initAll, 2000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  // Observer pra selects criados dinamicamente (overlays, modais)
  const obs = new MutationObserver(() => {
    document.querySelectorAll('.fg select:not([data-sc-done])').forEach(createSelect);
  });
  obs.observe(document.body, { childList: true, subtree: true });

})();
