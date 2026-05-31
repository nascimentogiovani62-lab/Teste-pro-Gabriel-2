// js/pages/parcelas.js
PAGE_RENDERS.parcelas = async function renderParcelas() {
  const el = document.getElementById('parcelas-content');
  el.innerHTML = `<div style="padding:40px;display:flex;align-items:center;gap:10px;color:var(--muted)"><div class="spinner"></div> Carregando...</div>`;

  try {
    const { data: parcelas } = await sb
      .from('parcelas').select('*')
      .neq('status', 'PAGA')
      .order('data_vencimento');

    const { data: propostas } = await sb.from('propostas_emprestimo').select('id,usuario_id');
    const { data: perfis    } = await sb.from('perfis').select('id,nome_completo');

    const nomeDevedor = (parcelaId) => {
      // acha proposta pela parcela
      // (vindo da parcela, precisamos do proposta_id que já vem no select)
      return '—';
    };

    // Enriquece com nome
    const lista = (parcelas || []).map(p => {
      const prop  = propostas?.find(pr => pr.id === p.proposta_id);
      const nome  = prop ? perfis?.find(pf => pf.id === prop.usuario_id)?.nome_completo : '—';
      const at    = calcAtraso(p.valor_total_centavos, p.data_vencimento);
      return { ...p, nome, at };
    });

    // KPIs
    const atrasadas = lista.filter(p => p.at.dias > 0);
    const hoje7     = lista.filter(p => p.at.dias === 0 && diasAte(p.data_vencimento) <= 7 && diasAte(p.data_vencimento) >= 0);
    const totalEm   = lista.reduce((a, p) => a + p.at.total, 0);
    const totalMultas = atrasadas.reduce((a, p) => a + p.at.multa + p.at.mora, 0);

    el.innerHTML = `
      <div class="kgrid">
        <div class="kcard" style="--kc:var(--brand)">
          <div class="klabel">Em Aberto</div>
          <div class="kval">${lista.length}</div>
          <div class="ksub">parcelas pendentes</div>
        </div>
        <div class="kcard" style="--kc:var(--red)">
          <div class="klabel">Atrasadas</div>
          <div class="kval bad">${atrasadas.length}</div>
          <div class="ksub">com multa e mora</div>
        </div>
        <div class="kcard" style="--kc:var(--amber)">
          <div class="klabel">Vencem em 7 dias</div>
          <div class="kval warn">${hoje7.length}</div>
          <div class="ksub">atenção ao prazo</div>
        </div>
        <div class="kcard" style="--kc:var(--green)">
          <div class="klabel">Total a Receber</div>
          <div class="kval ok">${fmt(totalEm)}</div>
          <div class="ksub">incl. ${fmt(totalMultas)} em multas</div>
        </div>
      </div>

      <div class="shead">Parcelas em Aberto</div>
      <div class="twrap">
        <table class="ttable">
          <thead><tr>
            <th>Devedor</th><th>#</th><th>Vencimento</th><th>Dias</th><th>Valor Original</th><th>Com Encargos</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            ${lista.map(p => {
              const dias = diasAte(p.data_vencimento);
              const dStr = p.at.dias > 0
                ? `<span class="dias-bad">${p.at.dias}d atraso</span>`
                : dias <= 3 ? `<span class="dias-bad">${dias}d</span>`
                : dias <= 7 ? `<span class="dias-warn">${dias}d</span>`
                : `<span class="dias-ok">${dias}d</span>`;
              const encStr = p.at.dias > 0
                ? `<span class="bad">${fmt(p.at.total)}</span><br><span style="font-size:.62rem;color:var(--muted)">multa: ${fmt(p.at.multa)} · mora: ${fmt(p.at.mora)}</span>`
                : `<span style="color:var(--muted)">—</span>`;
              return `<tr>
                <td><b>${p.nome}</b></td>
                <td style="color:var(--muted);font-size:.7rem">${String(p.numero).padStart(2,'0')}</td>
                <td>${fmtData(p.data_vencimento)}</td>
                <td>${dStr}</td>
                <td>${fmt(p.valor_total_centavos)}</td>
                <td>${encStr}</td>
                <td>${tagStatus(p.at.dias > 0 ? 'ATRASADA' : p.status)}</td>
                <td><button class="btn btn-r" style="padding:3px 10px;font-size:.65rem" onclick="abrirPagamento('${p.id}',${p.valor_total_centavos},'${p.data_vencimento}')">Pagar</button></td>
              </tr>`;
            }).join('') || `<tr><td colspan="8" class="empty">Nenhuma parcela em aberto. 🎉</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="alert alert-bad">Erro: ${err.message}</div>`;
  }
};

// ── Registrar pagamento ────────────────────────────────────────────
function abrirPagamento(parcelaId, valorCentavos, dataVenc) {
  const at = calcAtraso(valorCentavos, dataVenc);
  document.getElementById('pay-id').value    = parcelaId;
  document.getElementById('pay-valor').value = (at.total / 100).toFixed(2);

  let info = '';
  if (at.dias > 0) {
    info = `<div class="alert alert-warn" style="margin-bottom:10px">
      ${at.dias} dias de atraso · Multa: ${fmt(at.multa)} · Mora: ${fmt(at.mora)}<br>
      <b>Total com encargos: ${fmt(at.total)}</b>
    </div>`;
  }
  document.getElementById('pay-info').innerHTML = info;
  openMod('pagamento');
}

async function confirmarPagamento() {
  const parcelaId = document.getElementById('pay-id').value;
  const valor     = parseFloat(document.getElementById('pay-valor').value) || 0;
  const metodo    = document.getElementById('pay-metodo').value;

  if (!valor) { toast('Informe o valor.', 'err'); return; }

  const valorCentavos = Math.round(valor * 100);

  // Busca a parcela pra calcular encargos
  const { data: parc } = await sb.from('parcelas').select('*').eq('id', parcelaId).single();
  const at = calcAtraso(parc.valor_total_centavos, parc.data_vencimento);

  // Registra pagamento
  const { error: errPag } = await sb.from('pagamentos').insert({
    parcela_id: parcelaId,
    valor_pago_centavos: valorCentavos,
    valor_multa_centavos: at.multa,
    valor_mora_centavos: at.mora,
    metodo,
  });
  if (errPag) { toast(errPag.message, 'err'); return; }

  // Atualiza parcela
  await sb.from('parcelas').update({
    status: 'PAGA',
    data_pagamento: new Date().toISOString().split('T')[0],
    multa_centavos: at.multa,
    mora_centavos: at.mora,
  }).eq('id', parcelaId);

  // Verifica se todas as parcelas foram pagas
  const { data: pendentes } = await sb.from('parcelas')
    .select('id').eq('proposta_id', parc.proposta_id).neq('status', 'PAGA');

  if (!pendentes?.length) {
    await sb.from('propostas_emprestimo').update({ status: 'EM_DIA' }).eq('id', parc.proposta_id);
  }

  toast('Pagamento registrado!');
  closeMod('pagamento');
  PAGE_RENDERS.parcelas();
}

window.abrirPagamento    = abrirPagamento;
window.confirmarPagamento = confirmarPagamento;
