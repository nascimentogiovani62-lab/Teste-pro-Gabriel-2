// js/pages/emprestimos.js
let _filtroDevedor = null;
window.abrirDetalhe = abrirDetalhe;

PAGE_RENDERS.emprestimos = async function() {
  const el = document.getElementById('emprestimos-content');
  el.innerHTML = `<div class="loading-wrap"><div class="spinner"></div> Carregando…</div>`;

  try {
    let query = sb.from('propostas_emprestimo').select('*').order('criado_em', { ascending: false });
    if (_filtroDevedor) query = query.eq('usuario_id', _filtroDevedor);
    const [{ data: propostas }, { data: perfis }] = await Promise.all([
      query,
      sb.from('perfis').select('id,nome_completo'),
    ]);
    const nome = id => (perfis||[]).find(p => p.id === id)?.nome_completo || '—';

    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;flex-wrap:wrap;gap:10px">
        ${_filtroDevedor ? `<div class="alert alert-info" style="margin:0;padding:6px 14px;font-size:12px">
          Filtrado por devedor — <span style="cursor:pointer;text-decoration:underline" onclick="_filtroDevedor=null;PAGE_RENDERS.emprestimos()">Limpar</span>
        </div>` : '<div></div>'}
        <button class="btn btn-dark btn-sm" onclick="abrirNovoEmprestimo()">+ Novo Empréstimo</button>
      </div>

      <div class="twrap">
        <table class="ttable">
          <thead><tr><th>Devedor</th><th>Valor</th><th>Prazo</th><th>Taxa</th><th>Status</th><th>Data</th><th></th></tr></thead>
          <tbody>
            ${(propostas||[]).map(p => `
              <tr>
                <td><b>${nome(p.usuario_id)}</b></td>
                <td>${fmt(p.valor_solicitado_centavos)}</td>
                <td style="color:var(--muted);font-family:var(--mono);font-size:12px">${p.prazo_meses}x ${p.sistema_amortizacao}</td>
                <td style="font-family:var(--mono);font-size:12px;color:var(--muted)">${p.taxa_juros_mensal_bp ? (p.taxa_juros_mensal_bp/100).toFixed(2)+'%/mês' : '—'}</td>
                <td>${tagStatus(p.status)}</td>
                <td style="color:var(--muted);font-size:12px">${fmtData(p.criado_em?.split('T')[0])}</td>
                <td style="display:flex;gap:6px;align-items:center">
                  <button class="btn btn-ghost btn-sm" onclick="abrirDetalhe('${p.id}')">Ver</button>
                  ${['EM_ANALISE','APROVADA'].includes(p.status) ? `<button class="btn btn-green btn-sm" onclick="ativarEmprestimo('${p.id}')">Ativar</button>` : ''}
                </td>
              </tr>`).join('') || `<tr><td colspan="7" class="empty">Nenhum empréstimo cadastrado.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div id="detalhe-wrap"></div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="alert alert-bad">Erro: ${err.message}</div>`;
  }
};

async function abrirDetalhe(id) {
  let el = document.getElementById('detalhe-wrap');
  if (!el) { goPage('emprestimos'); setTimeout(() => abrirDetalhe(id), 350); return; }
  el.innerHTML = `<div class="loading-wrap"><div class="spinner"></div> Carregando detalhe…</div>`;

  const [{ data: p }, { data: parcelas }] = await Promise.all([
    sb.from('propostas_emprestimo').select('*').eq('id', id).single(),
    sb.from('parcelas').select('*').eq('proposta_id', id).order('numero'),
  ]);
  const { data: perfil } = await sb.from('perfis').select('nome_completo').eq('id', p.usuario_id).single();

  el.innerHTML = `
    <div class="sec-label" style="margin-top:24px">Detalhe — ${perfil?.nome_completo || '—'}</div>
    <div class="twrap" style="margin-bottom:16px">
      <div class="twrap-head">
        <span class="twrap-title">${tagStatus(p.status)}</span>
        <div style="display:flex;gap:8px">
          ${['EM_ANALISE','APROVADA'].includes(p.status) ? `<button class="btn btn-green btn-sm" onclick="ativarEmprestimo('${p.id}')">Ativar</button>` : ''}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0;background:var(--border)">
        ${[
          ['Valor', fmt(p.valor_solicitado_centavos)],
          ['Prazo', `${p.prazo_meses}x ${p.sistema_amortizacao}`],
          ['Taxa', p.taxa_juros_mensal_bp ? (p.taxa_juros_mensal_bp/100).toFixed(2)+'%/mês' : '—'],
          ['IOF', fmt(p.iof_centavos||0)],
          ['Comprometimento', p.comprometimento_pct+'%'],
          ['Data', fmtData(p.criado_em?.split('T')[0])],
        ].map(([l,v]) => `
          <div style="background:var(--card);padding:14px 18px">
            <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">${l}</div>
            <div style="font-size:14px;font-weight:500;color:var(--text)">${v}</div>
          </div>`).join('')}
      </div>
    </div>

    ${parcelas?.length ? `
      <div class="sec-label">Parcelas (${parcelas.length})</div>
      <div class="twrap">
        <table class="ttable">
          <thead><tr><th>#</th><th>Vencimento</th><th>Dias</th><th>Valor</th><th>Juros</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${parcelas.map(parc => {
              const at  = calcAtraso(parc.valor_total_centavos, parc.data_vencimento);
              const dias = diasAte(parc.data_vencimento);
              const dStr = parc.status === 'PAGA'
                ? `<span style="color:var(--muted);font-size:12px">—</span>`
                : at.dias > 0 ? `<span class="dias-bad">${at.dias}d atraso</span>`
                : dias <= 3 ? `<span class="dias-bad">${dias}d</span>`
                : dias <= 7 ? `<span class="dias-warn">${dias}d</span>`
                : `<span class="dias-ok">${dias}d</span>`;
              const valStr = at.dias > 0
                ? `<b style="color:var(--terra)">${fmt(at.total)}</b>`
                : `<b>${fmt(parc.valor_total_centavos)}</b>`;
              return `<tr>
                <td style="font-family:var(--mono);font-size:12px;color:var(--muted)">${String(parc.numero).padStart(2,'0')}</td>
                <td>${fmtData(parc.data_vencimento)}</td>
                <td>${dStr}</td>
                <td>${valStr}</td>
                <td style="font-family:var(--mono);font-size:12px;color:var(--muted)">${fmt(parc.valor_juros_centavos)}</td>
                <td>${tagStatus(parc.status)}</td>
                <td>${parc.status !== 'PAGA' ? `<button class="btn btn-ghost btn-sm" onclick="abrirPagamento('${parc.id}',${parc.valor_total_centavos},'${parc.data_vencimento}')">Pagar</button>` : ''}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : ''}
  `;
}

async function ativarEmprestimo(id) {
  await sb.from('propostas_emprestimo').update({ status: 'EM_DIA' }).eq('id', id);
  await sb.from('parcelas').update({ status: 'PENDENTE' }).eq('proposta_id', id);
  toast('Empréstimo ativado!');
  PAGE_RENDERS.emprestimos();
}

async function abrirNovoEmprestimo() {
  const { data: perfis } = await sb.from('perfis').select('id,nome_completo').order('nome_completo');
  const sel = document.getElementById('emp-devedor');
  sel.innerHTML = (perfis||[]).map(p => `<option value="${p.id}">${p.nome_completo}</option>`).join('');
  if (!perfis?.length) {
    toast('Cadastre um devedor primeiro.', 'err'); goPage('devedores'); return;
  }
  document.getElementById('emp-preview').innerHTML = '';
  simularEmprestimo();
  openMod('novo-emp');
}

function simularEmprestimo() {
  const valor  = parseFloat(document.getElementById('emp-valor')?.value) || 0;
  const taxa   = parseFloat(document.getElementById('emp-taxa')?.value)  || 0;
  const prazo  = parseInt(document.getElementById('emp-prazo')?.value)   || 0;
  const sis    = document.getElementById('emp-sistema')?.value || 'PRICE';
  const diaV   = parseInt(document.getElementById('emp-dia')?.value) || 5;
  const el     = document.getElementById('emp-preview');
  if (!valor || !taxa || !prazo || !el) return;

  const principal = Math.round(valor * 100);
  const parcelas  = sis === 'PRICE'
    ? Motor.gerarPrice(principal, taxa, prazo, diaV)
    : Motor.gerarSAC(principal, taxa, prazo, diaV);
  const { total, juros, primeiro } = Motor.resumo(parcelas);
  const iof = Motor.calcIOF(principal, prazo);

  el.innerHTML = `
    <div class="sim-preview">
      <div class="sim-grid">
        <div class="sim-item"><div class="sim-item-l">${sis === 'SAC' ? '1ª Parcela' : 'Parcela'}</div><div class="sim-item-v">${fmt(primeiro.valorTotal)}</div></div>
        <div class="sim-item"><div class="sim-item-l">Total pago</div><div class="sim-item-v">${fmt(total)}</div></div>
        <div class="sim-item"><div class="sim-item-l">Total juros</div><div class="sim-item-v t">${fmt(juros)}</div></div>
        <div class="sim-item"><div class="sim-item-l">IOF</div><div class="sim-item-v">${fmt(iof)}</div></div>
        <div class="sim-item"><div class="sim-item-l">1º Vencimento</div><div class="sim-item-v">${fmtData(primeiro.dataVencimento)}</div></div>
        <div class="sim-item"><div class="sim-item-l">Parcelas</div><div class="sim-item-v">${prazo}×</div></div>
      </div>
    </div>`;

  window._parcelasCalc = parcelas;
  window._iofCalc = iof;
}

async function salvarEmprestimo() {
  const devedorId = document.getElementById('emp-devedor').value;
  const valor     = parseFloat(document.getElementById('emp-valor').value) || 0;
  const taxa      = parseFloat(document.getElementById('emp-taxa').value)  || 0;
  const prazo     = parseInt(document.getElementById('emp-prazo').value)   || 0;
  const sis       = document.getElementById('emp-sistema').value;

  if (!devedorId || !valor || !taxa || !prazo) { toast('Preencha todos os campos.', 'err'); return; }
  if (!window._parcelasCalc?.length) { toast('Aguarde a simulação carregar.', 'err'); return; }

  const principal = Math.round(valor * 100);
  const taxaBp    = Math.round(taxa * 100);
  const iof       = window._iofCalc || 0;

  const { data: prop, error } = await sb.from('propostas_emprestimo').insert({
    usuario_id: devedorId, status: 'EM_DIA',
    sistema_amortizacao: sis,
    valor_solicitado_centavos: principal,
    valor_aprovado_centavos:  principal,
    valor_liberado_centavos:  principal - iof,
    taxa_juros_mensal_bp: taxaBp,
    iof_centavos: iof,
    prazo_meses: prazo,
    score_no_momento: 0,
    renda_no_momento_centavos: 0,
    comprometimento_pct: 0,
  }).select().single();

  if (error) { toast(error.message, 'err'); return; }

  const rows = window._parcelasCalc.map(p => ({
    proposta_id: prop.id, numero: p.numero, status: 'PENDENTE',
    valor_total_centavos:     p.valorTotal,
    valor_principal_centavos: p.principal,
    valor_juros_centavos:     p.juros,
    saldo_devedor_centavos:   p.saldoDevedor,
    data_vencimento:          p.dataVencimento,
  }));

  const { error: errP } = await sb.from('parcelas').insert(rows);
  if (errP) { toast(errP.message, 'err'); return; }

  toast('Empréstimo criado!', 'ok2');
  closeMod('novo-emp');
  PAGE_RENDERS.emprestimos();
}

window.abrirNovoEmprestimo = abrirNovoEmprestimo;
window.simularEmprestimo   = simularEmprestimo;
window.salvarEmprestimo    = salvarEmprestimo;
window.ativarEmprestimo    = ativarEmprestimo;
window._filtroDevedor      = null;
