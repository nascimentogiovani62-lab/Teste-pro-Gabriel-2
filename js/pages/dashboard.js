// js/pages/dashboard.js
PAGE_RENDERS.dashboard = async function() {
  const el = document.getElementById('dashboard-content');
  el.innerHTML = `<div class="loading-wrap"><div class="spinner"></div> Carregando…</div>`;

  try {
    const [{ data: propostas }, { data: parcelas }, { data: perfis }] = await Promise.all([
      sb.from('propostas_emprestimo').select('*'),
      sb.from('parcelas').select('*'),
      sb.from('perfis').select('id, nome_completo'),
    ]);

    const ativas   = (propostas || []).filter(p => ['EM_DIA','PAGO','INADIMPLENTE','AGUARDANDO_ASSINATURA'].includes(p.status));
    const inadim   = (propostas || []).filter(p => p.status === 'INADIMPLENTE');
    const carteira = ativas.reduce((a, p) => a + (p.valor_solicitado_centavos || 0), 0);

    const atrasadas   = (parcelas || []).filter(p => p.status !== 'PAGA' && diasAte(p.data_vencimento) < 0);
    const totalMultas = atrasadas.reduce((a, p) => {
      const at = calcAtraso(p.valor_total_centavos, p.data_vencimento);
      return a + at.multa + at.mora;
    }, 0);

    const recentes = [...(propostas || [])]
      .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))
      .slice(0, 8)
      .map(p => ({ ...p, nome: (perfis || []).find(pf => pf.id === p.usuario_id)?.nome_completo || '—' }));

    el.innerHTML = `
      <div class="kgrid">
        <div class="kcard">
          <div class="klabel">Total emprestado</div>
          <div class="kval">${fmt(carteira)}</div>
          <div class="ksub">${ativas.length} contrato${ativas.length !== 1 ? 's' : ''} ativo${ativas.length !== 1 ? 's' : ''}</div>
        </div>
        <div class="kcard">
          <div class="klabel">Em dia</div>
          <div class="kval g">${(propostas||[]).filter(p=>p.status==='EM_DIA').length}</div>
          <div class="ksub">pagando normalmente</div>
        </div>
        <div class="kcard">
          <div class="klabel">Inadimplentes</div>
          <div class="kval t">${inadim.length}</div>
          <div class="ksub">${atrasadas.length} parcela${atrasadas.length !== 1 ? 's' : ''} em atraso</div>
        </div>
        <div class="kcard">
          <div class="klabel">Multas acumuladas</div>
          <div class="kval a">${fmt(totalMultas)}</div>
          <div class="ksub">multa + mora a receber</div>
        </div>
      </div>

      <div class="sec-label">Empréstimos recentes</div>
      <div class="twrap">
        <div class="twrap-head">
          <span class="twrap-title">${(propostas||[]).length} empréstimo${(propostas||[]).length !== 1 ? 's' : ''} no total</span>
          <button class="btn btn-ghost btn-sm" onclick="goPage('emprestimos')">Ver todos →</button>
        </div>
        <table class="ttable">
          <thead><tr>
            <th>Devedor</th><th>Valor</th><th>Prazo</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            ${recentes.map(p => `
              <tr>
                <td><b>${p.nome}</b></td>
                <td>${fmt(p.valor_solicitado_centavos)}</td>
                <td style="color:var(--muted);font-family:var(--mono);font-size:12px">${p.prazo_meses}x ${p.sistema_amortizacao}</td>
                <td>${tagStatus(p.status)}</td>
                <td><button class="btn btn-ghost btn-sm" onclick="goPage('emprestimos');setTimeout(()=>abrirDetalhe('${p.id}'),300)">Ver →</button></td>
              </tr>`).join('') || `<tr><td colspan="5" class="empty">Nenhum empréstimo ainda. Crie o primeiro.</td></tr>`}
          </tbody>
        </table>
      </div>

      ${atrasadas.length > 0 ? `
        <div class="sec-label">Atenção — parcelas em atraso</div>
        <div class="alert alert-bad">
          <b>${atrasadas.length} parcela${atrasadas.length > 1 ? 's' : ''} em atraso.</b>
          Multa de 2% + mora de 1%/mês sendo aplicada automaticamente.
          <span style="cursor:pointer;text-decoration:underline;margin-left:8px" onclick="goPage('parcelas')">Ver parcelas →</span>
        </div>
      ` : ''}
    `;
  } catch (err) {
    el.innerHTML = `<div class="alert alert-bad">Erro ao carregar: ${err.message}</div>`;
  }
};
