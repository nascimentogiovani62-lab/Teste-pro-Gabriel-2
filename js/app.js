// js/app.js

// ── Formatação ────────────────────────────────────────
function fmt(centavos) {
  return 'R$\u00a0' + (centavos / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2
  });
}
function fmtData(str) {
  if (!str) return '—';
  return new Date(str + 'T00:00:00').toLocaleDateString('pt-BR');
}
function diasAte(dataStr) {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  return Math.ceil((new Date(dataStr + 'T00:00:00') - hoje) / 86400000);
}
function calcAtraso(valorCentavos, dataVenc) {
  const dias = Math.max(-diasAte(dataVenc), 0);
  if (dias === 0) return { dias: 0, multa: 0, mora: 0, total: valorCentavos };
  const multa = Math.round(valorCentavos * (CREDITO.MULTA_PCT / 100));
  const mora  = Math.round(valorCentavos * (CREDITO.MORA_MENSAL / 100 / 30) * dias);
  return { dias, multa, mora, total: valorCentavos + multa + mora };
}
function tagStatus(status) {
  const cls = {
    EM_DIA:'tag-ok', PAGO:'tag-ok', APROVADA:'tag-ok',
    INADIMPLENTE:'tag-bad', RECUSADA:'tag-bad', ATRASADA:'tag-bad',
    PENDENTE:'tag-info', EM_ANALISE:'tag-info',
    AGUARDANDO_ASSINATURA:'tag-warn', PAGA:'tag-ok',
  };
  const lbl = {
    EM_DIA:'Em Dia', PAGO:'Pago', APROVADA:'Aprovada',
    INADIMPLENTE:'Inadimplente', RECUSADA:'Renegociado', ATRASADA:'Atrasada',
    PENDENTE:'Pendente', EM_ANALISE:'Em Análise',
    AGUARDANDO_ASSINATURA:'Ag. Assinatura', PAGA:'Paga',
  };
  return `<span class="tag ${cls[status]||'tag-neu'}">${lbl[status]||status}</span>`;
}
window.fmt = fmt; window.fmtData = fmtData;
window.diasAte = diasAte; window.calcAtraso = calcAtraso;
window.tagStatus = tagStatus;

// ── Toast ─────────────────────────────────────────────
function toast(msg, tipo = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show' + (tipo === 'err' ? ' err' : tipo === 'ok2' ? ' ok2' : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3200);
}
window.toast = toast;

// ── Modal ─────────────────────────────────────────────
function openMod(id)  { document.getElementById('mod-' + id)?.classList.add('open'); }
function closeMod(id) { document.getElementById('mod-' + id)?.classList.remove('open'); }
window.openMod = openMod; window.closeMod = closeMod;

// ── Sidebar mobile ────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('mob-open');
  document.getElementById('sidebar-overlay').classList.toggle('show');
}
window.toggleSidebar = toggleSidebar;

// ── Navegação ─────────────────────────────────────────
const PAGE_TITLES = {
  dashboard:   'Dashboard',
  emprestimos: 'Empréstimos',
  parcelas:    'Parcelas',
  devedores:   'Devedores',
  postits:     'Post-its',
  relatorio:   'Relatório',
};
window.PAGE_RENDERS = {};

function goPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('act'));
  document.querySelectorAll('.ni').forEach(n => n.classList.remove('act'));
  document.getElementById('page-' + id)?.classList.add('act');
  document.getElementById('nav-' + id)?.classList.add('act');
  document.getElementById('tbtitle').textContent = PAGE_TITLES[id] || id;
  document.getElementById('sidebar').classList.remove('mob-open');
  document.getElementById('sidebar-overlay').classList.remove('show');
  PAGE_RENDERS[id]?.();
}
window.goPage = goPage;

// ── Iniciar app ───────────────────────────────────────
function iniciarApp(user) {
  document.getElementById('auth-screen').classList.remove('show');
  document.getElementById('app').classList.add('show');
  document.getElementById('mob-header').style.display = '';
  const inicial = (user.email || 'S')[0].toUpperCase();
  const av = document.getElementById('side-avatar');
  if (av) { av.textContent = inicial; av.title = user.email; }
  goPage('dashboard');
}
window.iniciarApp = iniciarApp;
