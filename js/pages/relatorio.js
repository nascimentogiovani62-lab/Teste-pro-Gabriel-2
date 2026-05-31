// js/pages/relatorio.js
// Histórico de pagamentos + Relatório mensal

PAGE_RENDERS.relatorio = async function() {
  const el = document.getElementById('relatorio-content');
  el.innerHTML = `<div class="loading-wrap"><div class="spinner"></div> Carregando…</div>`;

  try {
    const agora   = new Date();
    const anoAtual = agora.getFullYear();
    const mesAtual = agora.getMonth(); // 0-indexed

    // Carrega tudo necessário
    const [{ data: pagamentos }, { data: parcelas }, { data: propostas }, { data: devedores }] = await Promise.all([
      sb.from('pagamentos').select('*').order('criado_em', { ascending: false }),
      sb.from('parcelas').select('*'),
      sb.from('propostas_emprestimo').select('id,devedor_id,tipo_taxa,valor_solicitado_centavos,valor_flat_centavos,prazo_meses,sistema_amortizacao'),
      sb.from('devedores').select('id,nome'),
    ]);

    // Maps para lookup rápido
    const parcMap = {};
    (parcelas||[]).forEach(p => { parcMap[p.id] = p; });

    const propMap = {};
    (propostas||[]).forEach(p => { propMap[p.id] = p; });

    const devNome = id => (devedores||[]).find(d => d.id === id)?.nome || '—';

    // Enriquece pagamentos com info da parcela e devedor
    const pagEnriquecidos = (pagamentos||[]).map(pag => {
      const parc = parcMap[pag.parcela_id] || {};
      const prop = propMap[parc.proposta_id] || {};
      return {
        ...pag,
        data_vencimento: parc.data_vencimento,
        numero_parcela:  parc.numero,
        proposta_id:     parc.proposta_id,
        devedor_id:      prop.devedor_id,
        nome:            devNome(prop.devedor_id),
        tipo_taxa:       prop.tipo_taxa,
      };
    });

    // Meses disponíveis nos pagamentos
    const mesesSet = new Set();
    pagEnriquecidos.forEach(p => {
      if (p.criado_em) {
        const d = new Date(p.criado_em);
        mesesSet.add(`${d.getFullYear()}-${String(d.getMonth()).padStart(2,'0')}`);
      }
    });
    // Garante mês atual sempre disponível
    mesesSet.add(`${anoAtual}-${String(mesAtual).padStart(2,'0')}`);
    const mesesOrdenados = [...mesesSet].sort().reverse();

    // Mês selecionado (padrão = atual)
    window._relatorioMes = window._relatorioMes ||
      `${anoAtual}-${String(mesAtual).padStart(2,'0')}`;

    function renderRelatorio(mesSel) {
      const [anoS, mesS] = mesSel.split('-').map(Number);
      const inicio = new Date(anoS, mesS, 1);
      const fim    = new Date(anoS, mesS + 1, 0, 23, 59, 59);

      // Pagamentos do mês
      const pagMes = pagEnriquecidos.filter(p => {
        const d = new Date(p.criado_em);
        return d >= inicio && d <= fim;
      });

      // Empréstimos criados no mês
      const empMes = (propostas||[]).filter(p => {
        const d = new Date(p.criado_em);
        return d >= inicio && d <= fim;
      });

      // KPIs do mês
      const totalRecebido  = pagMes.reduce((a,p) => a + (p.valor_pago_centavos||0), 0);
      const totalMultas    = pagMes.reduce((a,p) => a + (p.valor_multa_centavos||0) + (p.valor_mora_centavos||0), 0);
      const totalEmprestado = empMes.reduce((a,p) => a + (p.valor_solicitado_centavos||0), 0);
      const totalPrincipal = totalRecebido - totalMultas;

      // Agrupa por devedor
      const porDevedor = {};
      pagMes.forEach(p => {
        const nome = p.nome || '—';
        if (!porDevedor[nome]) porDevedor[nome] = { nome, pagamentos: [], total: 0, multas: 0 };
        porDevedor[nome].pagamentos.push(p);
        porDevedor[nome].total  += p.valor_pago_centavos || 0;
        porDevedor[nome].multas += (p.valor_multa_centavos||0) + (p.valor_mora_centavos||0);
      });
      const devedoresMes = Object.values(porDevedor).sort((a,b) => b.total - a.total);

      const mesLabel = inicio.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

      return `
        <!-- Seletor de mês -->
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
          <div style="font-size:13px;color:var(--muted)">Período:</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${mesesOrdenados.map(m => {
              const [a,ms] = m.split('-').map(Number);
              const lbl = new Date(a,ms,1).toLocaleDateString('pt-BR',{month:'short',year:'2-digit'});
              return `<button class="btn ${m===mesSel?'btn-dark':'btn-ghost'} btn-sm"
                onclick="window._relatorioMes='${m}';PAGE_RENDERS.relatorio()"
                style="font-size:11px;padding:4px 10px">${lbl}</button>`;
            }).join('')}
          </div>
        </div>

        <!-- KPIs do mês -->
        <div class="kgrid" style="margin-bottom:20px">
          <div class="kcard">
            <div class="klabel">Recebido no mês</div>
            <div class="kval g">${fmt(totalRecebido)}</div>
            <div class="ksub">${pagMes.length} pagamento${pagMes.length!==1?'s':''}</div>
          </div>
          <div class="kcard">
            <div class="klabel">Principal recebido</div>
            <div class="kval">${fmt(totalPrincipal)}</div>
            <div class="ksub">sem encargos</div>
          </div>
          <div class="kcard">
            <div class="klabel">Multas e mora</div>
            <div class="kval a">${fmt(totalMultas)}</div>
            <div class="ksub">encargos recebidos</div>
          </div>
          <div class="kcard">
            <div class="klabel">Emprestado no mês</div>
            <div class="kval t">${fmt(totalEmprestado)}</div>
            <div class="ksub">${empMes.length} novo${empMes.length!==1?'s':''} contrato${empMes.length!==1?'s':''}</div>
          </div>
        </div>

        <!-- Resumo por devedor -->
        ${devedoresMes.length ? `
          <div class="sec-label">Recebimentos por devedor — ${mesLabel}</div>
          <div class="twrap" style="margin-bottom:20px">
            <table class="ttable">
              <thead><tr><th>Devedor</th><th>Pagamentos</th><th>Principal</th><th>Multas/Mora</th><th>Total</th></tr></thead>
              <tbody>
                ${devedoresMes.map(d => `
                  <tr>
                    <td><b>${d.nome}</b></td>
                    <td style="color:var(--muted);font-size:12px">${d.pagamentos.length}x</td>
                    <td>${fmt(d.total - d.multas)}</td>
                    <td style="color:var(--amber)">${d.multas > 0 ? fmt(d.multas) : '—'}</td>
                    <td><b>${fmt(d.total)}</b></td>
                  </tr>`).join('')}
                <tr style="background:var(--bg2)">
                  <td><b style="color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.5px">Total</b></td>
                  <td style="color:var(--muted);font-size:12px">${pagMes.length}x</td>
                  <td><b>${fmt(totalPrincipal)}</b></td>
                  <td style="color:var(--amber)"><b>${totalMultas>0?fmt(totalMultas):'—'}</b></td>
                  <td><b style="color:var(--green)">${fmt(totalRecebido)}</b></td>
                </tr>
              </tbody>
            </table>
          </div>` : ''}

        <!-- Histórico completo do mês -->
        <div class="sec-label">Histórico de pagamentos — ${mesLabel}</div>
        <div class="twrap">
          <table class="ttable">
            <thead><tr><th>Data</th><th>Devedor</th><th>Parcela</th><th>Método</th><th>Principal</th><th>Encargos</th><th>Total pago</th></tr></thead>
            <tbody>
              ${pagMes.length ? pagMes.map(p => {
                const enc = (p.valor_multa_centavos||0) + (p.valor_mora_centavos||0);
                const principal = (p.valor_pago_centavos||0) - enc;
                return `<tr>
                  <td style="font-size:12px">${new Date(p.criado_em).toLocaleDateString('pt-BR')}</td>
                  <td><b>${p.nome}</b></td>
                  <td style="font-family:var(--mono);font-size:12px;color:var(--muted)">${p.numero_parcela ? String(p.numero_parcela).padStart(2,'0') : '—'}</td>
                  <td style="font-size:12px;color:var(--muted)">${p.metodo||'—'}</td>
                  <td>${fmt(principal)}</td>
                  <td style="color:var(--amber)">${enc > 0 ? fmt(enc) : '—'}</td>
                  <td><b>${fmt(p.valor_pago_centavos||0)}</b></td>
                </tr>`;
              }).join('') : `<tr><td colspan="7" class="empty">Nenhum pagamento registrado em ${mesLabel}.</td></tr>`}
            </tbody>
          </table>
        </div>

        <!-- Histórico de todos os pagamentos -->
        <div class="sec-label" style="margin-top:24px">Todos os pagamentos</div>
        <div class="twrap">
          <table class="ttable">
            <thead><tr><th>Data</th><th>Devedor</th><th>Parcela</th><th>Método</th><th>Encargos</th><th>Total</th></tr></thead>
            <tbody>
              ${pagEnriquecidos.length ? pagEnriquecidos.map(p => {
                const enc = (p.valor_multa_centavos||0) + (p.valor_mora_centavos||0);
                return `<tr>
                  <td style="font-size:12px">${new Date(p.criado_em).toLocaleDateString('pt-BR')}</td>
                  <td><b>${p.nome}</b></td>
                  <td style="font-family:var(--mono);font-size:12px;color:var(--muted)">${p.numero_parcela ? String(p.numero_parcela).padStart(2,'0') : '—'}</td>
                  <td style="font-size:12px;color:var(--muted)">${p.metodo||'—'}</td>
                  <td style="color:var(--amber)">${enc > 0 ? fmt(enc) : '—'}</td>
                  <td><b>${fmt(p.valor_pago_centavos||0)}</b></td>
                </tr>`;
              }).join('') : `<tr><td colspan="6" class="empty">Nenhum pagamento registrado ainda.</td></tr>`}
            </tbody>
          </table>
        </div>
      `;
    }

    el.innerHTML = renderRelatorio(window._relatorioMes);

  } catch(err) {
    el.innerHTML = `<div class="alert alert-bad">Erro: ${err.message}</div>`;
  }
};
