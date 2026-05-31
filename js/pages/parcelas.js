// js/pages/parcelas.js — v2
// Parcelas agrupadas por contrato (empréstimo), expansível

PAGE_RENDERS.parcelas = async function() {
  const el = document.getElementById('parcelas-content');
  el.innerHTML = `<div class="loading-wrap"><div class="spinner"></div> Carregando…</div>`;

  try {
    const [{ data: parcelas }, { data: propostas }, { data: devedores }] = await Promise.all([
      sb.from('parcelas').select('*').neq('status','PAGA').order('data_vencimento'),
      sb.from('propostas_emprestimo').select('id,devedor_id,valor_solicitado_centavos,valor_flat_centavos,tipo_taxa,status,prazo_meses,sistema_amortizacao,criado_em').order('criado_em', { ascending: false }),
      sb.from('devedores').select('id,nome'),
    ]);

    const nomeDevedor = id => (devedores||[]).find(d => d.id === id)?.nome || '—';

    // Agrupa parcelas por proposta
    const grupos = {};
    (parcelas||[]).forEach(p => {
      if (!grupos[p.proposta_id]) grupos[p.proposta_id] = [];
      grupos[p.proposta_id].push(p);
    });

    // KPIs globais
    const todasParcelas = Object.values(grupos).flat();
    const atrasadas  = todasParcelas.filter(p => diasAte(p.data_vencimento) < 0);
    const vence7     = todasParcelas.filter(p => { const d = diasAte(p.data_vencimento); return d >= 0 && d <= 7; });
    const totalMultas   = atrasadas.reduce((a,p) => { const at = calcAtraso(p.valor_total_centavos, p.data_vencimento); return a + at.multa + at.mora; }, 0);
    const totalReceber  = todasParcelas.reduce((a,p) => { const at = calcAtraso(p.valor_total_centavos, p.data_vencimento); return a + at.total; }, 0);

    const propostasComParcelas = (propostas||[]).filter(pr => grupos[pr.id]?.length > 0);

    el.innerHTML = `
      <div class="kgrid">
        <div class="kcard"><div class="klabel">Contratos em aberto</div><div class="kval">${propostasComParcelas.length}</div><div class="ksub">${todasParcelas.length} parcelas pendentes</div></div>
        <div class="kcard"><div class="klabel">Atrasadas</div><div class="kval t">${atrasadas.length}</div><div class="ksub">com encargos</div></div>
        <div class="kcard"><div class="klabel">Vencem em 7d</div><div class="kval a">${vence7.length}</div><div class="ksub">atenção ao prazo</div></div>
        <div class="kcard"><div class="klabel">Total a receber</div><div class="kval g">${fmt(totalReceber)}</div><div class="ksub">incl. ${fmt(totalMultas)} em multas</div></div>
      </div>

      <div class="sec-label">Contratos com parcelas em aberto</div>
      <div id="grupos-parcelas">
        ${propostasComParcelas.map(pr => renderGrupo(pr, grupos[pr.id]||[], nomeDevedor)).join('')}
        ${propostasComParcelas.length === 0 ? `<div class="empty" style="padding:48px">Todas as parcelas estão em dia! 🎉</div>` : ''}
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="alert alert-bad">Erro: ${err.message}</div>`;
  }
};

function renderGrupo(pr, parcs, nomeDevedor) {
  const nome    = nomeDevedor(pr.devedor_id);
  const isFlat  = pr.tipo_taxa === 'FLAT';
  const atrasadas = parcs.filter(p => diasAte(p.data_vencimento) < 0);
  const proxVenc  = parcs.sort((a,b) => new Date(a.data_vencimento) - new Date(b.data_vencimento))[0];
  const diasProx  = proxVenc ? diasAte(proxVenc.data_vencimento) : null;

  // Status badge do grupo
  let grupoBadge = '';
  if (atrasadas.length > 0) {
    grupoBadge = `<span class="tag tag-bad">${atrasadas.length} atrasada${atrasadas.length>1?'s':''}</span>`;
  } else if (diasProx !== null && diasProx <= 7) {
    grupoBadge = `<span class="tag tag-warn">Vence em ${diasProx}d</span>`;
  } else {
    grupoBadge = `<span class="tag tag-ok">Em dia</span>`;
  }

  const totalAberto = parcs.reduce((a,p) => {
    const at = calcAtraso(p.valor_total_centavos, p.data_vencimento);
    return a + at.total;
  }, 0);

  const grupoId = `grupo-${pr.id}`;

  return `
    <div class="twrap" style="margin-bottom:12px">
      <!-- Cabeçalho do grupo — clicável para expandir -->
      <div class="twrap-head" style="cursor:pointer" onclick="toggleGrupo('${grupoId}')">
        <div style="display:flex;flex-direction:column;gap:4px">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span style="font-weight:600;font-size:14px">${nome}</span>
            ${grupoBadge}
            <span class="tag tag-neu" style="font-size:10px">${isFlat?'Flat':`${pr.prazo_meses}x ${pr.sistema_amortizacao}`}</span>
          </div>
          <div style="font-size:12px;color:var(--muted);display:flex;gap:16px;flex-wrap:wrap">
            <span>${parcs.length} parcela${parcs.length>1?'s':''} em aberto</span>
            <span>Total: <b style="color:var(--text)">${fmt(totalAberto)}</b></span>
            ${proxVenc ? `<span>Próx. venc.: ${fmtData(proxVenc.data_vencimento)}</span>` : ''}
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation();goPage('emprestimos');setTimeout(()=>abrirDetalhe('${pr.id}'),300)">Ver contrato →</button>
          <span style="font-size:11px;color:var(--muted)" id="${grupoId}-arrow">▼</span>
        </div>
      </div>

      <!-- Tabela de parcelas — colapsável -->
      <div id="${grupoId}" style="display:none">
        <table class="ttable">
          <thead><tr><th>#</th><th>Vencimento</th><th>Dias</th><th>Valor</th><th>Encargos</th><th></th></tr></thead>
          <tbody>
            ${parcs.sort((a,b) => a.numero - b.numero).map(p => {
              const at   = calcAtraso(p.valor_total_centavos, p.data_vencimento);
              const dias = diasAte(p.data_vencimento);
              const dStr = at.dias > 0
                ? `<span class="dias-bad">${at.dias}d atraso</span>`
                : dias <= 3 ? `<span class="dias-bad">${dias}d</span>`
                : dias <= 7 ? `<span class="dias-warn">${dias}d</span>`
                : `<span class="dias-ok">${dias}d</span>`;
              const encStr = at.dias > 0
                ? `<span style="font-size:12px;color:var(--terra)">+${fmt(at.multa+at.mora)}</span>`
                : `<span style="color:var(--muted)">—</span>`;
              const valStr = at.dias > 0
                ? `<b style="color:var(--terra)">${fmt(at.total)}</b>`
                : `<b>${fmt(p.valor_total_centavos)}</b>`;
              return `<tr>
                <td style="font-family:var(--mono);font-size:12px;color:var(--muted)">${String(p.numero).padStart(2,'0')}</td>
                <td>${fmtData(p.data_vencimento)}</td>
                <td>${dStr}</td>
                <td>${valStr}</td>
                <td>${encStr}</td>
                <td><button class="btn btn-ghost btn-sm" onclick="abrirPagamento('${p.id}',${p.valor_total_centavos},'${p.data_vencimento}')">Pagar</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function toggleGrupo(id) {
  const el    = document.getElementById(id);
  const arrow = document.getElementById(id + '-arrow');
  if (!el) return;
  const aberto = el.style.display !== 'none';
  el.style.display    = aberto ? 'none' : 'block';
  if (arrow) arrow.textContent = aberto ? '▼' : '▲';
}
window.toggleGrupo = toggleGrupo;

// ── Registrar pagamento ────────────────────────────────────
function abrirPagamento(parcelaId, valorCentavos, dataVenc) {
  const at = calcAtraso(valorCentavos, dataVenc);
  document.getElementById('pay-id').value    = parcelaId;
  document.getElementById('pay-valor').value = (at.total / 100).toFixed(2);
  document.getElementById('pay-info').innerHTML = at.dias > 0
    ? `<div class="alert alert-bad" style="margin-bottom:12px">
        <b>${at.dias} dia${at.dias>1?'s':''} de atraso</b><br>
        Multa: ${fmt(at.multa)} · Mora: ${fmt(at.mora)}<br>
        Total com encargos: <b>${fmt(at.total)}</b>
      </div>` : '';
  openMod('pagamento');
}

async function confirmarPagamento() {
  const parcelaId = document.getElementById('pay-id').value;
  const valor     = parseFloat(document.getElementById('pay-valor').value) || 0;
  const metodo    = document.getElementById('pay-metodo').value;
  if (!valor) { toast('Informe o valor.', 'err'); return; }

  const { data: parc } = await sb.from('parcelas').select('*').eq('id', parcelaId).single();
  const at = calcAtraso(parc.valor_total_centavos, parc.data_vencimento);

  const { error: errPag } = await sb.from('pagamentos').insert({
    parcela_id: parcelaId,
    valor_pago_centavos:  Math.round(valor * 100),
    valor_multa_centavos: at.multa,
    valor_mora_centavos:  at.mora,
    metodo,
  });
  if (errPag) { toast(errPag.message, 'err'); return; }

  await sb.from('parcelas').update({
    status: 'PAGA',
    data_pagamento: new Date().toISOString().split('T')[0],
    multa_centavos: at.multa,
    mora_centavos:  at.mora,
  }).eq('id', parcelaId);

  const { data: restantes } = await sb.from('parcelas')
    .select('id').eq('proposta_id', parc.proposta_id).neq('status','PAGA');

  if (!restantes?.length) {
    await sb.from('propostas_emprestimo').update({ status:'PAGO' }).eq('id', parc.proposta_id);
  }

  toast('Pagamento registrado!', 'ok2');
  closeMod('pagamento');
  PAGE_RENDERS.parcelas();
}

window.abrirPagamento     = abrirPagamento;
window.confirmarPagamento = confirmarPagamento;
