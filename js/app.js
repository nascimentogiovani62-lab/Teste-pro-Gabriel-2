// js/app.js

// ── Helpers de formato ────────────────────────────────────────────
function fmt(centavos) {
  return 'R$\u00a0' + (centavos / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}
function fmtData(str) {
  if (!str) return '—';
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('pt-BR');
}
function diasAte(dataStr) {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const alvo = new Date(dataStr + 'T00:00:00');
  return Math.ceil((alvo - hoje) / 86400000);
}
function calcAtraso(valorCentavos, dataVenc) {
  const dias = Math.max(-diasAte(dataVenc), 0);
  if (dias === 0) return { dias: 0, multa: 0, mora: 0, total: valorCentavos };
  const multa = Math.round(valorCentavos * (CREDITO.MULTA_PCT / 100));
  const mora  = Math.round(valorCentavos * (CREDITO.MORA_MENSAL / 100 / 30) * dias);
  return { dias, multa, mora, total: valorCentavos + multa + mora };
}
function tagStatus(status) {
  const map = {
    EM_ANALISE:'tag-info',APROVADA:'tag-ok',RECUSADA:'tag-bad',
    AGUARDANDO_ASSINATURA:'tag-purple',PAGO:'tag-ok',EM_DIA:'tag-ok',
    INADIMPLENTE:'tag-bad',PENDENTE:'tag-info',PAGA:'tag-ok',ATRASADA:'tag-bad',
  };
  const label = {
    EM_ANALISE:'Em Análise',APROVADA:'Aprovada',RECUSADA:'Recusada',
    AGUARDANDO_ASSINATURA:'Aguard. Assinatura',PAGO:'Pago',EM_DIA:'Em Dia',
    INADIMPLENTE:'Inadimplente',PENDENTE:'Pendente',PAGA:'Paga',ATRASADA:'Atrasada',
  };
  return `<span class="tag ${map[status]||'tag-info'}">${label[status]||status}</span>`;
}
window.fmt = fmt; window.fmtData = fmtData;
window.diasAte = diasAte; window.calcAtraso = calcAtraso;
window.tagStatus = tagStatus;

// ── Toast ─────────────────────────────────────────────────────────
function toast(msg, tipo = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show' + (tipo === 'err' ? ' err' : '');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 3500);
}
window.toast = toast;

// ── Modal ─────────────────────────────────────────────────────────
function openMod(id)  { document.getElementById('mod-' + id)?.classList.add('open'); }
function closeMod(id) { document.getElementById('mod-' + id)?.classList.remove('open'); }
window.openMod = openMod; window.closeMod = closeMod;

// ── Sidebar mobile ────────────────────────────────────────────────
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('mob-open');
  document.getElementById('sidebar-overlay').classList.toggle('show');
}
window.toggleSidebar = toggleSidebar;

// ── Navegação de páginas ──────────────────────────────────────────
const PAGE_TITLES = {
  dashboard: 'Dashboard',
  emprestimos: 'Empréstimos',
  devedores: 'Devedores',
  parcelas: 'Parcelas',
};
const PAGE_RENDERS = {};

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
window.PAGE_RENDERS = PAGE_RENDERS;

// ── Iniciar app após login ────────────────────────────────────────
function iniciarApp(user) {
  document.getElementById('auth-screen').classList.remove('show');
  document.getElementById('app').classList.add('show');
  document.getElementById('mob-header').style.display = '';
  document.getElementById('side-email').textContent = user.email;
  goPage('dashboard');
}
window.iniciarApp = iniciarApp;
