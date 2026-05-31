// js/pages/dashboard.js — v2
// KPIs + alertas de vencimento + acesso rápido ao relatório

PAGE_RENDERS.dashboard = async function() {
  const el = document.getElementById('dashboard-content');
  el.innerHTML = `<div class="loading-wrap"><div class="spinner"></div> Carregando…</div>`;

  try {
    const [{ data: propostas }, { data: parcelas }, { data: devedores }] = await Promise.all([
      sb.from('propostas_emprestimo').select('*'),
      sb.from('parcelas').select('*'),
      sb.from('devedores').select('id,nome'),
    ]);

    const ativas   = (propostas||[]).filter(p => ['EM_DIA','INADIMPLENTE','AGUARDANDO_ASSINATURA'].includes(p.status));
    const carteira = ativas.reduce((a,p) => a + (p.valor_solicitado_centavos||0), 0);

    const emAberto  = (parcelas||[]).filter(p => p.status !== 'PAGA');
    const atrasadas = emAberto.filter(p => diasAte(p.data_vencimento) < 0);
    const totalMultas = atrasadas.reduce((a,p) => {
      const at = calcAtraso(p.valor_total_centavos, p.data_vencimento);
      return a + at.multa + at.mora;
    }, 0);

    // Vencimentos próximos (hoje + 7 dias)
    const hoje3  = emAberto.filter(p => { const d = diasAte(p.data_vencimento); return d >= 0 && d <= 3; });
    const hoje7  = emAberto.filter(p => { const d = diasAte(p.data_vencimento); return d > 3 && d <= 7; });
    const hoje15 = emAberto.filter(p => { const d = diasAte(p.data_vencimento); return d > 7 && d <= 15; });

    const nomeDev = id => (devedores||[]).find(d => d.id === id)?.nome || '—';

    // Enriquece parcelas com nome do devedor via proposta
    const propMap = {};
    (propostas||[]).forEach(p => { propMap[p.id] = p; });

    const nomeParc = parc => {
      const prop = propMap[parc.proposta_id];
      return prop ? nomeDev(prop.devedor_id) : '—';
    };

    // Últimos empréstimos
    const recentes = [...(propostas||[])]
      .sort((a,b) => new Date(b.criado_em) - new Date(a.criado_em))
      .slice(0, 6)
      .map(p => ({ ...p, nome: nomeDev(p.devedor_id) }));

    // Mês atual para relatório rápido
    const agora = new Date();
    const mesNome = agora.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

    el.innerHTML = `
      <!-- KPIs -->
      <div class="kgrid">
        <div class="kcard">
          <div class="klabel">Total emprestado</div>
          <div class="kval">${fmt(carteira)}</div>
          <div class="ksub">${ativas.length} contrato${ativas.length!==1?'s':''} ativo${ativas.length!==1?'s':''}</div>
        </div>
        <div class="kcard">
          <div class="klabel">Em dia</div>
          <div class="kval g">${(propostas||[]).filter(p=>p.status==='EM_DIA').length}</div>
          <div class="ksub">pagando normalmente</div>
        </div>
        <div class="kcard">
          <div class="klabel">Atrasadas</div>
          <div class="kval t">${atrasadas.length}</div>
          <div class="ksub">${atrasadas.length > 0 ? 'parcela'+( atrasadas.length>1?'s':'')+' em atraso' : 'tudo em ordem'}</div>
        </div>
        <div class="kcard">
          <div class="klabel">Multas acumuladas</div>
          <div class="kval a">${fmt(totalMultas)}</div>
          <div class="ksub">multa + mora a receber</div>
        </div>
      </div>

      <!-- Alertas de vencimento -->
      ${(hoje3.length + atrasadas.length) > 0 ? `
        <div class="sec-label">⚠️ Atenção urgente</div>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:20px">
          ${atrasadas.slice(0,5).map(p => {
            const at = calcAtraso(p.valor_total_centavos, p.data_vencimento);
            return `<div style="display:flex;align-items:center;justify-content:space-between;background:var(--card);border:1px solid var(--terra-bd);border-left:3px solid var(--terra);border-radius:8px;padding:10px 16px;flex-wrap:wrap;gap:8px">
              <div>
                <div style="font-size:13px;font-weight:500;color:var(--text)">${nomeParc(p)}</div>
                <div style="font-size:11px;color:var(--muted)">Parcela ${String(p.numero).padStart(2,'0')} · Venceu ${fmtData(p.data_vencimento)} · ${at.dias}d atraso</div>
              </div>
              <div style="display:flex;align-items:center;gap:10px">
                <div style="text-align:right">
                  <div style="font-size:13px;font-weight:600;color:var(--terra)">${fmt(at.total)}</div>
                  <div style="font-size:11px;color:var(--muted)">+${fmt(at.multa+at.mora)} encargos</div>
                </div>
                <button class="btn btn-terra btn-sm" onclick="abrirPagamento('${p.id}',${p.valor_total_centavos},'${p.data_vencimento}')">Pagar</button>
              </div>
            </div>`;
          }).join('')}
          ${hoje3.slice(0,3).map(p => {
            const dias = diasAte(p.data_vencimento);
            return `<div style="display:flex;align-items:center;justify-content:space-between;background:var(--card);border:1px solid var(--amber-bd);border-left:3px solid var(--amber);border-radius:8px;padding:10px 16px;flex-wrap:wrap;gap:8px">
              <div>
                <div style="font-size:13px;font-weight:500;color:var(--text)">${nomeParc(p)}</div>
                <div style="font-size:11px;color:var(--muted)">Parcela ${String(p.numero).padStart(2,'0')} · Vence ${fmtData(p.data_vencimento)} · ${dias === 0 ? 'hoje!' : dias+'d'}</div>
              </div>
              <div style="display:flex;align-items:center;gap:10px">
                <div style="font-size:13px;font-weight:600;color:var(--amber)">${fmt(p.valor_total_centavos)}</div>
                <button class="btn btn-ghost btn-sm" onclick="abrirPagamento('${p.id}',${p.valor_total_centavos},'${p.data_vencimento}')">Pagar</button>
              </div>
            </div>`;
          }).join('')}
        </div>` : ''}

      ${hoje7.length > 0 ? `
        <div class="sec-label">Vencem em 7 dias</div>
        <div style="display:flex;flex-direction:column;gap:5px;margin-bottom:20px">
          ${hoje7.slice(0,4).map(p => {
            const dias = diasAte(p.data_vencimento);
            return `<div style="display:flex;align-items:center;justify-content:space-between;background:var(--card);border:1px solid var(--border);border-radius:8px;padding:9px 16px;flex-wrap:wrap;gap:6px">
              <div>
                <span style="font-size:13px;font-weight:500">${nomeParc(p)}</span>
                <span style="font-size:11px;color:var(--muted);margin-left:8px">Parc. ${String(p.numero).padStart(2,'0')} · ${fmtData(p.data_vencimento)}</span>
              </div>
              <div style="display:flex;align-items:center;gap:10px">
                <span class="dias-warn">${dias}d</span>
                <span style="font-size:13px;font-weight:500">${fmt(p.valor_total_centavos)}</span>
              </div>
            </div>`;
          }).join('')}
        </div>` : ''}

      <!-- Relatório rápido do mês -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div class="sec-label" style="margin:0">Empréstimos recentes</div>
        <button class="btn btn-ghost btn-sm" onclick="goPage('relatorio')">📊 Relatório de ${mesNome} →</button>
      </div>

      <div class="twrap">
        <div class="twrap-head">
          <span class="twrap-title">${(propostas||[]).length} empréstimo${(propostas||[]).length!==1?'s':''} no total</span>
          <button class="btn btn-ghost btn-sm" onclick="goPage('emprestimos')">Ver todos →</button>
        </div>
        <table class="ttable">
          <thead><tr><th>Devedor</th><th>Valor</th><th>Prazo</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${recentes.map(p => `
              <tr>
                <td><b>${p.nome}</b></td>
                <td>${fmt(p.valor_solicitado_centavos)}</td>
                <td style="color:var(--muted);font-size:12px">${p.tipo_taxa==='FLAT'?'Flat':`${p.prazo_meses}x ${p.sistema_amortizacao}`}</td>
                <td>${tagStatus(p.status)}</td>
                <td><button class="btn btn-ghost btn-sm" onclick="goPage('emprestimos');setTimeout(()=>abrirDetalhe('${p.id}'),300)">Ver →</button></td>
              </tr>`).join('') || `<tr><td colspan="5" class="empty">Nenhum empréstimo ainda.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  } catch(err) {
    el.innerHTML = `<div class="alert alert-bad">Erro: ${err.message}</div>`;
  }
};
