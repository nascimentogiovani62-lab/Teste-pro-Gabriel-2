// js/pages/emprestimos.js
let _filtroDevedor = null;

function filtrarPorDevedor(id) { _filtroDevedor = id; PAGE_RENDERS.emprestimos(); }
window.filtrarPorDevedor = filtrarPorDevedor;

PAGE_RENDERS.emprestimos = async function renderEmprestimos() {
  const el = document.getElementById('emprestimos-content');
  el.innerHTML = `<div style="padding:40px;display:flex;align-items:center;gap:10px;color:var(--muted)"><div class="spinner"></div> Carregando...</div>`;

  try {
    let query = sb.from('propostas_emprestimo').select('*').order('criado_em', { ascending: false });
    if (_filtroDevedor) query = query.eq('usuario_id', _filtroDevedor);
    const { data: propostas } = await query;

    const { data: perfis } = await sb.from('perfis').select('id,nome_completo');
    const nome = id => perfis?.find(p => p.id === id)?.nome_completo || '—';

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        ${_filtroDevedor ? `<div class="alert alert-info" style="margin:0;padding:6px 12px">Filtrando por devedor. <span style="cursor:pointer;text-decoration:underline" onclick="_filtroDevedor=null;PAGE_RENDERS.emprestimos()">Limpar filtro</span></div>` : '<div></div>'}
        <button class="btn btn-r" onclick="abrirNovoEmprestimo()">+ Novo Empréstimo</button>
      </div>
      <div class="twrap">
        <table class="ttable">
          <thead><tr>
            <th>Devedor</th><th>Valor</th><th>Prazo</th><th>Taxa</th><th>Status</th><th>Data</th><th></th>
          </tr></thead>
          <tbody>
            ${(propostas || []).map(p => `
              <tr>
                <td><b>${nome(p.usuario_id)}</b></td>
                <td>${fmt(p.valor_solicitado_centavos)}</td>
                <td>${p.prazo_meses}x · ${p.sistema_amortizacao}</td>
                <td style="color:var(--brand2)">${p.taxa_juros_mensal_bp ? (p.taxa_juros_mensal_bp/100).toFixed(2)+'%/mês' : '—'}</td>
                <td>${tagStatus(p.status)}</td>
                <td style="color:var(--muted)">${fmtData(p.criado_em?.split('T')[0])}</td>
                <td style="display:flex;gap:5px">
                  <button class="btn btn-g" style="padding:3px 9px;font-size:.68rem" onclick="abrirDetalheEmprestimo('${p.id}')">Ver</button>
                  ${['EM_ANALISE','APROVADA'].includes(p.status) ? `<button class="btn btn-r" style="padding:3px 9px;font-size:.68rem" onclick="ativarEmprestimo('${p.id}')">Ativar</button>` : ''}
                </td>
              </tr>`).join('') || `<tr><td colspan="7" class="empty">Nenhum empréstimo.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div id="detalhe-emp"></div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="alert alert-bad">Erro: ${err.message}</div>`;
  }
};

async function abrirDetalheEmprestimo(id) {
  const el = document.getElementById('detalhe-emp');
  if (!el) { goPage('emprestimos'); setTimeout(() => abrirDetalheEmprestimo(id), 400); return; }
  el.innerHTML = `<div style="padding:20px;display:flex;align-items:center;gap:10px;color:var(--muted)"><div class="spinner"></div> Carregando detalhe...</div>`;

  const { data: p } = await sb.from('propostas_emprestimo').select('*').eq('id', id).single();
  const { data: parcelas } = await sb.from('parcelas').select('*').eq('proposta_id', id).order('numero');
  const { data: perfil } = await sb.from('perfis').select('nome_completo').eq('id', p.usuario_id).single();

  el.innerHTML = `
    <div class="shead">Detalhe — ${perfil?.nome_completo || '—'}</div>
    <div class="form-card" style="margin-bottom:14px">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;font-size:.8rem;line-height:2.2">
        <div><span style="color:var(--muted)">Status:</span> ${tagStatus(p.status)}</div>
        <div><span style="color:var(--muted)">Valor:</span> <b>${fmt(p.valor_solicitado_centavos)}</b></div>
        <div><span style="color:var(--muted)">Prazo:</span> ${p.prazo_meses}x ${p.sistema_amortizacao}</div>
        <div><span style="color:var(--muted)">Taxa:</span> ${p.taxa_juros_mensal_bp ? (p.taxa_juros_mensal_bp/100).toFixed(2)+'%/mês' : '—'}</div>
        <div><span style="color:var(--muted)">IOF:</span> ${fmt(p.iof_centavos||0)}</div>
        <div><span style="color:var(--muted)">Comprometimento:</span> ${p.comprometimento_pct}%</div>
      </div>
    </div>

    ${parcelas?.length ? `
      <div class="shead">Parcelas</div>
      <div class="twrap">
        <table class="ttable">
          <thead><tr><th>#</th><th>Vencimento</th><th>Dias</th><th>Valor</th><th>Juros</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${parcelas.map(parc => {
              const dias = diasAte(parc.data_vencimento);
              const at   = calcAtraso(parc.valor_total_centavos, parc.data_vencimento);
              const dStr = at.dias > 0
                ? `<span class="dias-bad">${at.dias}d atraso</span>`
                : dias <= 7 ? `<span class="dias-warn">${dias}d</span>`
                : `<span class="dias-ok">${dias}d</span>`;
              const totalCom = at.dias > 0 ? `<span class="bad">${fmt(at.total)}</span>` : fmt(parc.valor_total_centavos);
              return `<tr>
                <td style="color:var(--muted);font-size:.7rem">${String(parc.numero).padStart(2,'0')}</td>
                <td>${fmtData(parc.data_vencimento)}</td>
                <td>${dStr}</td>
                <td><b>${totalCom}</b></td>
                <td style="color:var(--amber)">${fmt(parc.valor_juros_centavos)}</td>
                <td>${tagStatus(parc.status)}</td>
                <td>${parc.status !== 'PAGA' ? `<button class="btn btn-r" style="padding:3px 9px;font-size:.65rem" onclick="abrirPagamento('${parc.id}',${parc.valor_total_centavos},'${parc.data_vencimento}')">Pagar</button>` : '✓'}</td>
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
  document.getElementById('emp-devedor').innerHTML =
    (perfis || []).map(p => `<option value="${p.id}">${p.nome_completo}</option>`).join('');
  simularEmprestimo();
  openMod('novo-emp');
}

function simularEmprestimo() {
  const valor  = parseFloat(document.getElementById('emp-valor').value) || 0;
  const taxa   = parseFloat(document.getElementById('emp-taxa').value) || 0;
  const prazo  = parseInt(document.getElementById('emp-prazo').value) || 0;
  const sis    = document.getElementById('emp-sistema').value;
  const diaV   = parseInt(document.getElementById('emp-dia').value) || 5;
  const res    = document.getElementById('emp-preview');

  if (!valor || !taxa || !prazo) { res.innerHTML = ''; return; }

  const principal = Math.round(valor * 100);
  const parcelas  = sis === 'PRICE'
    ? Motor.gerarPrice(principal, taxa, prazo, diaV)
    : Motor.gerarSAC(principal, taxa, prazo, diaV);
  const { total, juros } = Motor.resumo(parcelas);
  const iof = Motor.calcIOF(principal, prazo);
  const p0  = parcelas[0];

  res.innerHTML = `
    <div style="background:var(--bg);border-radius:8px;padding:12px;margin-top:12px;font-size:.76rem;line-height:2.1">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
        <div><span style="color:var(--muted)">1ª Parcela:</span><br><b style="color:var(--brand2)">${fmt(p0.valorTotal)}</b></div>
        <div><span style="color:var(--muted)">Total:</span><br><b>${fmt(total)}</b></div>
        <div><span style="color:var(--muted)">Juros:</span><br><b class="bad">${fmt(juros)}</b></div>
        <div><span style="color:var(--muted)">IOF:</span><br>${fmt(iof)}</div>
        <div><span style="color:var(--muted)">1º Venc.:</span><br>${fmtData(p0.dataVencimento)}</div>
        <div><span style="color:var(--muted)">Parcelas:</span><br>${prazo}x</div>
      </div>
    </div>`;

  // Guarda as parcelas calculadas pra salvar depois
  window._parcelasCalculadas = parcelas;
  window._iofCalculado = iof;
}

async function salvarEmprestimo() {
  const devedorId = document.getElementById('emp-devedor').value;
  const valor     = parseFloat(document.getElementById('emp-valor').value) || 0;
  const taxa      = parseFloat(document.getElementById('emp-taxa').value) || 0;
  const prazo     = parseInt(document.getElementById('emp-prazo').value) || 0;
  const sis       = document.getElementById('emp-sistema').value;

  if (!devedorId || !valor || !taxa || !prazo) { toast('Preencha todos os campos.', 'err'); return; }
  if (!window._parcelasCalculadas?.length) { toast('Simule antes de salvar.', 'err'); return; }

  const principal = Math.round(valor * 100);
  const taxaBp    = Math.round(taxa * 100);

  const { data: prop, error } = await sb.from('propostas_emprestimo').insert({
    usuario_id: devedorId,
    status: 'EM_DIA',
    sistema_amortizacao: sis,
    valor_solicitado_centavos: principal,
    valor_aprovado_centavos: principal,
    valor_liberado_centavos: principal - (window._iofCalculado || 0),
    taxa_juros_mensal_bp: taxaBp,
    iof_centavos: window._iofCalculado || 0,
    prazo_meses: prazo,
    score_no_momento: 0,
    renda_no_momento_centavos: 0,
    comprometimento_pct: 0,
  }).select().single();

  if (error) { toast(error.message, 'err'); return; }

  // Insere parcelas
  const rows = window._parcelasCalculadas.map(p => ({
    proposta_id: prop.id,
    numero: p.numero,
    status: 'PENDENTE',
    valor_total_centavos: p.valorTotal,
    valor_principal_centavos: p.principal,
    valor_juros_centavos: p.juros,
    saldo_devedor_centavos: p.saldoDevedor,
    data_vencimento: p.dataVencimento,
  }));

  const { error: errParc } = await sb.from('parcelas').insert(rows);
  if (errParc) { toast(errParc.message, 'err'); return; }

  toast('Empréstimo criado com sucesso!');
  closeMod('novo-emp');
  PAGE_RENDERS.emprestimos();
}

window.abrirDetalheEmprestimo = abrirDetalheEmprestimo;
window.abrirNovoEmprestimo    = abrirNovoEmprestimo;
window.simularEmprestimo      = simularEmprestimo;
window.salvarEmprestimo       = salvarEmprestimo;
window.ativarEmprestimo       = ativarEmprestimo;
