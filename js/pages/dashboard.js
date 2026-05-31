// js/pages/dashboard.js
PAGE_RENDERS.dashboard = async function renderDashboard() {
  const el = document.getElementById('dashboard-content');
  el.innerHTML = `<div style="padding:40px;display:flex;align-items:center;gap:10px;color:var(--muted)"><div class="spinner"></div> Carregando...</div>`;

  try {
    const { data: propostas } = await sb.from('propostas_emprestimo').select('*');
    const { data: parcelas   } = await sb.from('parcelas').select('*');
    const { data: perfis     } = await sb.from('perfis').select('id, nome_completo');

    const total     = propostas?.length || 0;
    const ativas    = propostas?.filter(p => ['EM_DIA','PAGO','INADIMPLENTE'].includes(p.status)) || [];
    const inadim    = propostas?.filter(p => p.status === 'INADIMPLENTE') || [];
    const carteira  = ativas.reduce((a, p) => a + (p.valor_solicitado_centavos || 0), 0);

    const parcsAtrasadas = parcelas?.filter(p => p.status === 'ATRASADA') || [];
    const totalMultas = parcsAtrasadas.reduce((a, p) => {
      const at = calcAtraso(p.valor_total_centavos, p.data_vencimento);
      return a + at.multa + at.mora;
    }, 0);

    // Últimas propostas com nome do devedor
    const recentes = (propostas || [])
      .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))
      .slice(0, 8)
      .map(p => ({
        ...p,
        nome: perfis?.find(pf => pf.id === p.usuario_id)?.nome_completo || '—',
      }));

    el.innerHTML = `
      <div class="kgrid">
        <div class="kcard" style="--kc:var(--brand)">
          <div class="klabel">Total Empréstimos</div>
          <div class="kval">${total}</div>
          <div class="ksub">todas as propostas</div>
        </div>
        <div class="kcard" style="--kc:var(--green)">
          <div class="klabel">Carteira Ativa</div>
          <div class="kval ok">${fmt(carteira)}</div>
          <div class="ksub">${ativas.length} contratos ativos</div>
        </div>
        <div class="kcard" style="--kc:var(--red)">
          <div class="klabel">Inadimplentes</div>
          <div class="kval bad">${inadim.length}</div>
          <div class="ksub">${parcsAtrasadas.length} parcelas em atraso</div>
        </div>
        <div class="kcard" style="--kc:var(--amber)">
          <div class="klabel">Multas a Receber</div>
          <div class="kval warn">${fmt(totalMultas)}</div>
          <div class="ksub">multa + mora acumulados</div>
        </div>
      </div>

      <div class="shead">Empréstimos Recentes</div>
      <div class="twrap">
        <div class="twrap-head">
          <span class="twrap-title">Últimas propostas</span>
          <button class="btn btn-r" onclick="goPage('emprestimos')">Ver todos →</button>
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
                <td>${p.prazo_meses}x</td>
                <td>${tagStatus(p.status)}</td>
                <td><button class="btn btn-g" style="padding:3px 10px;font-size:.68rem" onclick="abrirDetalheEmprestimo('${p.id}')">Ver →</button></td>
              </tr>`).join('') || `<tr><td colspan="5" class="empty">Nenhum empréstimo ainda.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="alert alert-bad">Erro ao carregar: ${err.message}</div>`;
  }
};
