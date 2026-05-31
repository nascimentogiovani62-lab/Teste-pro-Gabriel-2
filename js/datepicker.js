// js/datepicker.js — Date Picker para Creditadora
(function () {
  const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                 'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const DIAS  = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

  function createPicker(original) {
    if (original.dataset.dpDone) return;
    original.dataset.dpDone = '1';

    const wrap = document.createElement('div');
    wrap.className = 'dp-wrap';
    original.parentNode.insertBefore(wrap, original);
    wrap.appendChild(original);

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'dp-trigger';
    trigger.setAttribute('tabindex', '0');
    trigger.innerHTML = '<span class="dp-text dp-placeholder">Selecione a data</span><span class="dp-arrow">▼</span>';
    wrap.appendChild(trigger);

    const pop = document.createElement('div');
    pop.className = 'dp-popover';
    pop.innerHTML =
      '<div class="dp-header">' +
        '<button type="button" class="dp-nav dp-prev">◀</button>' +
        '<span class="dp-month-label"></span>' +
        '<button type="button" class="dp-nav dp-next">▶</button>' +
      '</div>' +
      '<div class="dp-weekdays">' +
        DIAS.map(d => `<div class="dp-weekday">${d}</div>`).join('') +
      '</div>' +
      '<div class="dp-days"></div>' +
      '<div class="dp-footer">' +
        '<button type="button" class="dp-today-btn">Hoje</button>' +
        '<button type="button" class="dp-clear-btn">Limpar</button>' +
      '</div>';
    wrap.appendChild(pop);

    let viewDate     = new Date();
    let selectedDate = null;

    if (original.value) {
      const [y, m, d] = original.value.split('-').map(Number);
      selectedDate = new Date(y, m - 1, d);
      viewDate     = new Date(selectedDate);
      updateTrigger();
    }

    function updateTrigger() {
      const txtEl = trigger.querySelector('.dp-text');
      if (selectedDate) {
        const dd = String(selectedDate.getDate()).padStart(2,'0');
        const mm = String(selectedDate.getMonth()+1).padStart(2,'0');
        txtEl.textContent = `${dd}/${mm}/${selectedDate.getFullYear()}`;
        txtEl.classList.remove('dp-placeholder');
      } else {
        txtEl.textContent = 'Selecione a data';
        txtEl.classList.add('dp-placeholder');
      }
    }

    function commitValue() {
      if (selectedDate) {
        const dd = String(selectedDate.getDate()).padStart(2,'0');
        const mm = String(selectedDate.getMonth()+1).padStart(2,'0');
        original.value = `${selectedDate.getFullYear()}-${mm}-${dd}`;
      } else {
        original.value = '';
      }
      original.dispatchEvent(new Event('change', { bubbles: true }));
      original.dispatchEvent(new Event('input',  { bubbles: true }));
    }

    function renderDays() {
      pop.querySelector('.dp-month-label').textContent =
        `${MESES[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

      const grid = pop.querySelector('.dp-days');
      grid.innerHTML = '';

      const year    = viewDate.getFullYear();
      const month   = viewDate.getMonth();
      const firstDay    = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const daysInPrev  = new Date(year, month, 0).getDate();
      const today = new Date(); today.setHours(0,0,0,0);

      // dias do mês anterior
      for (let i = firstDay - 1; i >= 0; i--) {
        const d = daysInPrev - i;
        const btn = dayBtn(d, 'other-month', month - 1, d, year);
        grid.appendChild(btn);
      }

      // dias do mês atual
      for (let d = 1; d <= daysInMonth; d++) {
        const thisDate = new Date(year, month, d);
        let cls = '';
        if (thisDate.getTime() === today.getTime()) cls += ' today';
        if (selectedDate && thisDate.getTime() === selectedDate.getTime()) cls += ' selected';
        grid.appendChild(dayBtn(d, cls.trim(), month, d, year));
      }

      // dias do próximo mês
      const total = grid.children.length;
      const remaining = total <= 35 ? 35 - total : 42 - total;
      for (let j = 1; j <= remaining; j++) {
        grid.appendChild(dayBtn(j, 'other-month', month + 1, j, year));
      }
    }

    function dayBtn(num, cls, m, d, y) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dp-day' + (cls ? ' ' + cls : '');
      b.textContent = num;
      b.dataset.m = m; b.dataset.d = d; b.dataset.y = y;
      return b;
    }

    function toggle() {
      const isOpen = pop.classList.contains('open');
      closeAll();
      if (!isOpen) {
        const rect = wrap.getBoundingClientRect();
        pop.classList.toggle('above', window.innerHeight - rect.bottom < 320);
        pop.classList.add('open');
        trigger.classList.add('open');
        renderDays();
      }
    }

    trigger.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); toggle(); });
    trigger.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      if (e.key === 'Escape') closeAll();
    });

    pop.querySelector('.dp-days').addEventListener('click', e => {
      const btn = e.target.closest('.dp-day');
      if (!btn) return;
      selectedDate = new Date(+btn.dataset.y, +btn.dataset.m, +btn.dataset.d);
      viewDate = new Date(selectedDate);
      updateTrigger();
      commitValue();
      renderDays();
      setTimeout(() => { pop.classList.remove('open'); trigger.classList.remove('open'); }, 120);
    });

    pop.querySelector('.dp-prev').addEventListener('click', e => {
      e.stopPropagation();
      viewDate.setMonth(viewDate.getMonth() - 1);
      renderDays();
    });
    pop.querySelector('.dp-next').addEventListener('click', e => {
      e.stopPropagation();
      viewDate.setMonth(viewDate.getMonth() + 1);
      renderDays();
    });
    pop.querySelector('.dp-today-btn').addEventListener('click', e => {
      e.stopPropagation();
      const t = new Date(); t.setHours(0,0,0,0);
      selectedDate = t; viewDate = new Date(t);
      updateTrigger(); commitValue(); renderDays();
      setTimeout(() => { pop.classList.remove('open'); trigger.classList.remove('open'); }, 120);
    });
    pop.querySelector('.dp-clear-btn').addEventListener('click', e => {
      e.stopPropagation();
      selectedDate = null;
      updateTrigger(); commitValue(); renderDays();
    });
  }

  function closeAll() {
    document.querySelectorAll('.dp-popover.open').forEach(p => p.classList.remove('open'));
    document.querySelectorAll('.dp-trigger.open').forEach(t => t.classList.remove('open'));
  }

  document.addEventListener('click', e => { if (!e.target.closest('.dp-wrap')) closeAll(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });

  function initAll() {
    document.querySelectorAll('input[type="date"]:not([data-dp-done])').forEach(inp => {
      inp.dataset.dpDone = '1';
      createPicker(inp);
    });
  }

  function boot() {
    initAll();
    setTimeout(initAll, 800);
    setTimeout(initAll, 2500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  const obs = new MutationObserver(() => {
    document.querySelectorAll('input[type="date"]:not([data-dp-done])').forEach(inp => {
      inp.dataset.dpDone = '1';
      createPicker(inp);
    });
  });
  obs.observe(document.body, { childList: true, subtree: true });

})();
