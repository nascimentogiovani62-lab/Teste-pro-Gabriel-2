// js/pages/parcelas.js
PAGE_RENDERS.parcelas = async function() {
  const el = document.getElementById('parcelas-content');
  el.innerHTML = `<div class="loading-wrap"><div class="spinner"></div> Carregando…</div>`;

  try {
    const [{ data: parcelas }, { data: propostas }, { data: perfis }] = await Promise.all([
      sb.from('parcelas').select('*').neq('status','PAGA').order('data_vencimento'),
      sb.from('propostas_emprestimo').select('id,usuario_id'),
      sb.from('perfis').select('id,nome_completo'),
    ]);

    const lista = (parcelas||[]).map(p => {
      const prop = (propostas||[]).find(pr => pr.id === p.proposta_id);
      const nome = prop ? (perfis||[]).find(pf => pf.id === prop.usuario_id)?.nome_completo : '—';
      const at   = calcAtraso(p.valor_total_centavos, p.data_vencimento);
      return { ...p, nome, at };
    });

    const atrasadas = lista.filter(p => p.at.dias > 0);
    const vence7    = lista.filter(p => p.at.dias === 0 && diasAte(p.data_vencimento) <= 7 && diasAte(p.data_vencimento) >= 0);
    const totalMultas = atrasadas.reduce((a, p) => a + p.at.multa + p.at.mora, 0);
    const totalReceber = lista.reduce((a, p) => a + p.at.total, 0);

    el.innerHTML = `
      <div class="kgrid">
        <div class="kcard"><div class="klabel">Em aberto</div><div class="kval">${lista.length}</div><div class="ksub">parcelas pendentes</div></div>
        <div class="kcard"><div class="klabel">Atrasadas</div><div class="kval t">${atrasadas.length}</div><div class="ksub">com encargos</div></div>
        <div class="kcard"><div class="klabel">Vencem em 7d</div><div class="kval a">${vence7.length}</div><div class="ksub">atenção ao prazo</div></div>
        <div class="kcard"><div class="klabel">Total a receber</div><div class="kval g">${fmt(totalReceber)}</div><div class="ksub">incl. ${fmt(totalMultas)} em multas</div></div>
      </div>

      <div class="sec-label">Parcelas em aberto</div>
      <div class="twrap">
        <table class="ttable">
          <thead><tr><th>Devedor</th><th>#</th><th>Vencimento</th><th>Dias</th><th>Valor</th><th>Encargos</th><th></th></tr></thead>
          <tbody>
            ${lista.map(p => {
              const dias = diasAte(p.data_vencimento);
              const dStr = p.at.dias > 0
                ? `<span class="dias-bad">${p.at.dias}d atraso</span>`
                : dias <= 3 ? `<span class="dias-bad">${dias}d</span>`
                : dias <= 7 ? `<span class="dias-warn">${dias}d</span>`
                : `<span class="dias-ok">${dias}d</span>`;
              const encStr = p.at.dias > 0
                ? `<div style="font-size:12px;color:var(--terra)">+${fmt(p.at.multa+p.at.mora)}</div>
                   <div style="font-size:11px;color:var(--muted)">multa+mora</div>`
                : `<span style="color:var(--muted);font-size:12px">—</span>`;
              return `<tr>
                <td><b>${p.nome}</b></td>
                <td style="font-family:var(--mono);font-size:12px;color:var(--muted)">${String(p.numero).padStart(2,'0')}</td>
                <td style="font-size:13px">${fmtData(p.data_vencimento)}</td>
                <td>${dStr}</td>
                <td><b>${p.at.dias > 0 ? `<span style="color:var(--terra)">${fmt(p.at.total)}</span>` : fmt(p.valor_total_centavos)}</b></td>
                <td>${encStr}</td>
                <td><button class="btn btn-ghost btn-sm" onclick="abrirPagamento('${p.id}',${p.valor_total_centavos},'${p.data_vencimento}')">Pagar</button></td>
              </tr>`;
            }).join('') || `<tr><td colspan="7" class="empty">Todas as parcelas estão em dia! 🎉</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="alert alert-bad">Erro: ${err.message}</div>`;
  }
};

function abrirPagamento(parcelaId, valorCentavos, dataVenc) {
  const at = calcAtraso(valorCentavos, dataVenc);
  document.getElementById('pay-id').value    = parcelaId;
  document.getElementById('pay-valor').value = (at.total / 100).toFixed(2);
  document.getElementById('pay-info').innerHTML = at.dias > 0
    ? `<div class="alert alert-bad" style="margin-bottom:12px">
        <b>${at.dias} dia${at.dias > 1 ? 's' : ''} de atraso</b><br>
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

  await sb.from('pagamentos').insert({
    parcela_id: parcelaId,
    valor_pago_centavos:  Math.round(valor * 100),
    valor_multa_centavos: at.multa,
    valor_mora_centavos:  at.mora,
    metodo,
  });

  await sb.from('parcelas').update({
    status: 'PAGA',
    data_pagamento: new Date().toISOString().split('T')[0],
    multa_centavos: at.multa,
    mora_centavos:  at.mora,
  }).eq('id', parcelaId);

  const { data: restantes } = await sb.from('parcelas')
    .select('id').eq('proposta_id', parc.proposta_id).neq('status','PAGA');
  if (!restantes?.length) {
    await sb.from('propostas_emprestimo').update({ status: 'EM_DIA' }).eq('id', parc.proposta_id);
  } else {
    await sb.from('propostas_emprestimo').update({ status: 'EM_DIA' })
      .eq('id', parc.proposta_id).eq('status','INADIMPLENTE');
  }

  toast('Pagamento registrado!', 'ok2');
  closeMod('pagamento');
  PAGE_RENDERS.parcelas();
}

window.abrirPagamento     = abrirPagamento;
window.confirmarPagamento = confirmarPagamento;
