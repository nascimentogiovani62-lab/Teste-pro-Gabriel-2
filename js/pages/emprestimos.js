// js/pages/emprestimos.js — v2
// Suporta: taxa flat, datas livres, garantia, renegociação

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
          Filtrado por devedor — <span style="cursor:pointer;text-decoration:underline" onclick="window._filtroDevedor=null;PAGE_RENDERS.emprestimos()">Limpar</span>
        </div>` : '<div></div>'}
        <button class="btn btn-dark btn-sm" onclick="abrirNovoEmprestimo()">+ Novo Empréstimo</button>
      </div>

      <div class="twrap">
        <table class="ttable">
          <thead><tr><th>Devedor</th><th>Valor</th><th>Tipo</th><th>Status</th><th>Garantia</th><th>Data</th><th></th></tr></thead>
          <tbody>
            ${(propostas||[]).map(p => {
              const isReneg = !!p.proposta_origem_id;
              const isFlat  = p.tipo_taxa === 'FLAT';
              return `<tr>
                <td><b>${nome(p.usuario_id)}</b>${isReneg ? ' <span class="tag tag-warn" style="font-size:10px">Reneg.</span>' : ''}</td>
                <td>${fmt(p.valor_solicitado_centavos)}${isFlat && p.valor_flat_centavos ? ` → <b style="color:var(--terra)">${fmt(p.valor_flat_centavos)}</b>` : ''}</td>
                <td style="font-size:12px;color:var(--muted)">${isFlat ? 'Flat' : `${p.prazo_meses}x ${p.sistema_amortizacao}`}</td>
                <td>${tagStatus(p.status)}</td>
                <td style="font-size:12px;color:var(--muted)">${p.garantia || '—'}</td>
                <td style="color:var(--muted);font-size:12px">${fmtData(p.criado_em?.split('T')[0])}</td>
                <td style="display:flex;gap:6px;align-items:center">
                  <button class="btn btn-ghost btn-sm" onclick="abrirDetalhe('${p.id}')">Ver</button>
                  ${['EM_ANALISE','APROVADA'].includes(p.status) ? `<button class="btn btn-green btn-sm" onclick="ativarEmprestimo('${p.id}')">Ativar</button>` : ''}
                </td>
              </tr>`;
            }).join('') || `<tr><td colspan="7" class="empty">Nenhum empréstimo cadastrado.</td></tr>`}
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
  const isFlat = p.tipo_taxa === 'FLAT';

  // Saldo devedor
  const totalDevido = isFlat
    ? (p.valor_flat_centavos || p.valor_solicitado_centavos)
    : (parcelas||[]).reduce((a, pc) => a + pc.valor_total_centavos, 0);
  const totalPago = (parcelas||[]).filter(pc => pc.status === 'PAGA')
    .reduce((a, pc) => a + pc.valor_total_centavos + (pc.multa_centavos||0) + (pc.mora_centavos||0), 0);
  const saldoDevedor = Math.max(totalDevido - totalPago, 0);

  el.innerHTML = `
    <div class="sec-label" style="margin-top:24px">Detalhe — ${perfil?.nome_completo || '—'}</div>

    <!-- Saldo devedor em destaque -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:16px">
      <div style="background:var(--card);padding:18px">
        <div class="klabel">Total a receber</div>
        <div class="kval" style="font-size:22px">${fmt(totalDevido)}</div>
      </div>
      <div style="background:var(--card);padding:18px">
        <div class="klabel">Já recebido</div>
        <div class="kval g" style="font-size:22px">${fmt(totalPago)}</div>
      </div>
      <div style="background:var(--card);padding:18px">
        <div class="klabel">Saldo devedor</div>
        <div class="kval ${saldoDevedor > 0 ? 't' : 'g'}" style="font-size:22px">${fmt(saldoDevedor)}</div>
      </div>
    </div>

    <div class="twrap" style="margin-bottom:16px">
      <div class="twrap-head">
        <span class="twrap-title">${tagStatus(p.status)} ${p.proposta_origem_id ? '<span class="tag tag-warn">Renegociação</span>' : ''}</span>
        <div style="display:flex;gap:8px">
          ${['EM_ANALISE','APROVADA'].includes(p.status) ? `<button class="btn btn-green btn-sm" onclick="ativarEmprestimo('${p.id}')">Ativar</button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="abrirRenegociacao('${p.id}','${p.usuario_id}',${p.valor_solicitado_centavos})">↺ Renegociar</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0;background:var(--border)">
        ${[
          ['Tipo', isFlat ? 'Taxa Flat' : `${p.prazo_meses}x ${p.sistema_amortizacao}`],
          ['Emprestado', fmt(p.valor_solicitado_centavos)],
          isFlat ? ['A receber', fmt(p.valor_flat_centavos || 0)] : ['Taxa', p.taxa_juros_mensal_bp ? (p.taxa_juros_mensal_bp/100).toFixed(2)+'%/mês' : '—'],
          ['Garantia', p.garantia || '—'],
          ['Observação', p.observacao || '—'],
          ['Data', fmtData(p.criado_em?.split('T')[0])],
        ].map(([l,v]) => `
          <div style="background:var(--card);padding:14px 18px">
            <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">${l}</div>
            <div style="font-size:13px;font-weight:500;color:var(--text)">${v}</div>
          </div>`).join('')}
      </div>
    </div>

    ${parcelas?.length ? `
      <div class="sec-label">Parcelas (${parcelas.length})</div>
      <div class="twrap">
        <table class="ttable">
          <thead><tr><th>#</th><th>Vencimento</th><th>Dias</th><th>Valor</th><th>Status</th><th>Nota</th><th></th></tr></thead>
          <tbody>
            ${parcelas.map(parc => {
              const at   = calcAtraso(parc.valor_total_centavos, parc.data_vencimento);
              const dias = diasAte(parc.data_vencimento);
              const dStr = parc.status === 'PAGA'
                ? `<span style="color:var(--muted);font-size:12px">—</span>`
                : at.dias > 0 ? `<span class="dias-bad">${at.dias}d atraso</span>`
                : dias <= 3  ? `<span class="dias-bad">${dias}d</span>`
                : dias <= 7  ? `<span class="dias-warn">${dias}d</span>`
                : `<span class="dias-ok">${dias}d</span>`;
              const valStr = at.dias > 0
                ? `<b style="color:var(--terra)">${fmt(at.total)}</b>`
                : `<b>${fmt(parc.valor_total_centavos)}</b>`;
              return `<tr>
                <td style="font-family:var(--mono);font-size:12px;color:var(--muted)">${String(parc.numero).padStart(2,'0')}</td>
                <td>${fmtData(parc.data_vencimento)}</td>
                <td>${dStr}</td>
                <td>${valStr}</td>
                <td>${tagStatus(parc.status)}</td>
                <td style="font-size:12px;color:var(--muted);max-width:160px">
                  ${parc.nota
                    ? `<span title="${parc.nota}">${parc.nota.slice(0,30)}${parc.nota.length>30?'…':''}</span>`
                    : `<button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="editarNotaParcela('${parc.id}','${(parc.nota||'').replace(/'/g,"\\'")}')">+ nota</button>`}
                </td>
                <td style="display:flex;gap:4px">
                  ${parc.status !== 'PAGA' ? `<button class="btn btn-ghost btn-sm" onclick="abrirPagamento('${parc.id}',${parc.valor_total_centavos},'${parc.data_vencimento}')">Pagar</button>` : ''}
                  ${parc.nota ? `<button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="editarNotaParcela('${parc.id}','${(parc.nota||'').replace(/'/g,"\\'")}')">✏️</button>` : ''}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : ''}
  `;
}

// ── Nota por parcela ──────────────────────────────────────
async function editarNotaParcela(parcelaId, notaAtual) {
  const nota = prompt('Nota para esta parcela:', notaAtual || '');
  if (nota === null) return;
  await sb.from('parcelas').update({ nota: nota || null }).eq('id', parcelaId);
  toast('Nota salva!');
  // Recarrega o detalhe
  const { data: parc } = await sb.from('parcelas').select('proposta_id').eq('id', parcelaId).single();
  if (parc) abrirDetalhe(parc.proposta_id);
}

// ── Renegociação ──────────────────────────────────────────
function abrirRenegociacao(propostaOrigemId, devedorId, valorOriginalCentavos) {
  const overlay = document.createElement('div');
  overlay.id = 'ren-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(26,26,24,.6);backdrop-filter:blur(3px);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.onclick = e => { if(e.target===overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:28px;width:100%;max-width:440px" onclick="event.stopPropagation()">
      <div class="modal-title">↺ Renegociar Contrato</div>
      <div class="modal-desc">Cria um novo contrato vinculado a este e marca o original como renegociado. O saldo devedor atual fica como referência.</div>

      <div class="alert alert-warn" style="margin-bottom:16px">
        Saldo atual estimado: <b>${fmt(valorOriginalCentavos)}</b> — ajuste o novo valor conforme o combinado.
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="fg"><label>Novo Valor (R$) *</label><input type="number" id="ren-valor" placeholder="0,00" step="100"></div>
        <div class="fg"><label>Tipo de Taxa</label>
          <select id="ren-tipo" onchange="toggleRenTipo()">
            <option value="FLAT">Flat — valor fixo</option>
            <option value="COMPOSTO">Parcelado (Price/SAC)</option>
          </select>
        </div>
      </div>

      <div id="ren-flat-wrap" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="fg"><label>Valor a Receber (R$) *</label><input type="number" id="ren-flat" placeholder="0,00" step="50"></div>
        <div class="fg"><label>Data de Vencimento *</label><input type="date" id="ren-flat-venc"></div>
      </div>

      <div id="ren-comp-wrap" style="display:none;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="fg"><label>Taxa (%/mês)</label><input type="number" id="ren-taxa" value="3.5" step="0.1"></div>
        <div class="fg"><label>Prazo (meses)</label><input type="number" id="ren-prazo" placeholder="12"></div>
        <div class="fg"><label>Sistema</label>
          <select id="ren-sistema"><option value="PRICE">Price</option><option value="SAC">SAC</option></select>
        </div>
      </div>

      <div class="fg" style="margin-bottom:16px"><label>Garantia / Observação</label>
        <input type="text" id="ren-garantia" placeholder="Ex: iPhone 13, moto, fiador...">
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="document.getElementById('ren-overlay').remove()">Cancelar</button>
        <button class="btn btn-dark" onclick="confirmarRenegociacao('${propostaOrigemId}','${devedorId}')">Confirmar Renegociação →</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function toggleRenTipo() {
  const tipo = document.getElementById('ren-tipo').value;
  document.getElementById('ren-flat-wrap').style.display  = tipo === 'FLAT' ? 'grid' : 'none';
  document.getElementById('ren-comp-wrap').style.display  = tipo === 'FLAT' ? 'none' : 'grid';
}

async function confirmarRenegociacao(propostaOrigemId, devedorId) {
  const valor    = parseFloat(document.getElementById('ren-valor').value) || 0;
  const tipo     = document.getElementById('ren-tipo').value;
  const garantia = document.getElementById('ren-garantia').value.trim();
  if (!valor) { toast('Informe o novo valor.', 'err'); return; }

  const principal = Math.round(valor * 100);
  let propData = {
    usuario_id: devedorId,
    status: 'EM_DIA',
    proposta_origem_id: propostaOrigemId,
    tipo_taxa: tipo,
    valor_solicitado_centavos: principal,
    valor_aprovado_centavos:   principal,
    valor_liberado_centavos:   principal,
    garantia: garantia || null,
    observacao: 'Renegociação',
    score_no_momento: 0,
    renda_no_momento_centavos: 0,
    comprometimento_pct: 0,
    iof_centavos: 0,
    taxa_juros_mensal_bp: 0,
    prazo_meses: 1,
    sistema_amortizacao: 'PRICE',
  };

  let parcelasRows = [];

  if (tipo === 'FLAT') {
    const flatVal  = parseFloat(document.getElementById('ren-flat').value) || 0;
    const flatVenc = document.getElementById('ren-flat-venc').value;
    if (!flatVal || !flatVenc) { toast('Preencha valor e data de vencimento.', 'err'); return; }
    propData.valor_flat_centavos = Math.round(flatVal * 100);
    propData.prazo_meses = 1;
    parcelasRows = [{
      numero: 1, status: 'PENDENTE',
      valor_total_centavos:     Math.round(flatVal * 100),
      valor_principal_centavos: principal,
      valor_juros_centavos:     Math.round(flatVal * 100) - principal,
      saldo_devedor_centavos:   0,
      data_vencimento:          flatVenc,
    }];
  } else {
    const taxa  = parseFloat(document.getElementById('ren-taxa').value) || 0;
    const prazo = parseInt(document.getElementById('ren-prazo').value) || 0;
    const sis   = document.getElementById('ren-sistema').value;
    if (!taxa || !prazo) { toast('Preencha taxa e prazo.', 'err'); return; }
    const parcelas = sis === 'PRICE'
      ? Motor.gerarPrice(principal, taxa, prazo, 5)
      : Motor.gerarSAC(principal, taxa, prazo, 5);
    propData.prazo_meses          = prazo;
    propData.taxa_juros_mensal_bp = Math.round(taxa * 100);
    propData.sistema_amortizacao  = sis;
    parcelasRows = parcelas.map(p => ({
      numero: p.numero, status: 'PENDENTE',
      valor_total_centavos:     p.valorTotal,
      valor_principal_centavos: p.principal,
      valor_juros_centavos:     p.juros,
      saldo_devedor_centavos:   p.saldoDevedor,
      data_vencimento:          p.dataVencimento,
    }));
  }

  // Cria novo contrato
  const { data: novaProp, error } = await sb.from('propostas_emprestimo').insert(propData).select().single();
  if (error) { toast(error.message, 'err'); return; }

  // Insere parcelas
  const rows = parcelasRows.map(r => ({ ...r, proposta_id: novaProp.id }));
  await sb.from('parcelas').insert(rows);

  // Marca o original como renegociado
  await sb.from('propostas_emprestimo').update({ status: 'RECUSADA', motivo_recusa: 'POLITICA_INTERNA' }).eq('id', propostaOrigemId);

  document.getElementById('ren-overlay').remove();
  toast('Renegociação criada!', 'ok2');
  PAGE_RENDERS.emprestimos();
}

// ── Novo empréstimo ───────────────────────────────────────
async function abrirNovoEmprestimo() {
  const { data: perfis } = await sb.from('perfis').select('id,nome_completo').order('nome_completo');
  if (!perfis?.length) { toast('Cadastre um devedor primeiro.', 'err'); goPage('devedores'); return; }

  const overlay = document.createElement('div');
  overlay.id = 'emp-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(26,26,24,.6);backdrop-filter:blur(3px);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.onclick = e => { if(e.target===overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:28px;width:100%;max-width:500px;max-height:90vh;overflow-y:auto" onclick="event.stopPropagation()">
      <div class="modal-title">Novo Empréstimo</div>
      <div class="modal-desc">Configure e simule antes de confirmar.</div>

      <div class="fg" style="margin-bottom:12px">
        <label>Devedor *</label>
        <select id="emp-devedor">${perfis.map(p => `<option value="${p.id}">${p.nome_completo}</option>`).join('')}</select>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="fg"><label>Valor Emprestado (R$) *</label><input type="number" id="emp-valor" placeholder="5000" step="100" oninput="simularEmprestimo()"></div>
        <div class="fg"><label>Tipo de Taxa</label>
          <select id="emp-tipo" onchange="toggleEmpTipo()">
            <option value="FLAT">Flat — valor fixo</option>
            <option value="COMPOSTO">Parcelado (Price/SAC)</option>
          </select>
        </div>
      </div>

      <!-- FLAT -->
      <div id="emp-flat-wrap" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="fg"><label>Valor a Receber (R$) *</label><input type="number" id="emp-flat" placeholder="750" step="50" oninput="simularEmprestimo()"></div>
        <div class="fg"><label>Data de Vencimento *</label><input type="date" id="emp-flat-venc"></div>
      </div>

      <!-- COMPOSTO -->
      <div id="emp-comp-wrap" style="display:none;flex-wrap:wrap;gap:12px;margin-bottom:12px">
        <div class="fg" style="min-width:120px;flex:1"><label>Taxa (%/mês) *</label><input type="number" id="emp-taxa" placeholder="3.5" step="0.1" value="3.5" oninput="simularEmprestimo()"></div>
        <div class="fg" style="min-width:100px;flex:1"><label>Prazo (meses) *</label><input type="number" id="emp-prazo" placeholder="12" min="1" max="120" oninput="simularEmprestimo()"></div>
        <div class="fg" style="min-width:100px;flex:1"><label>Sistema</label>
          <select id="emp-sistema" onchange="simularEmprestimo()">
            <option value="PRICE">Price</option>
            <option value="SAC">SAC</option>
          </select>
        </div>
        <div class="fg" style="min-width:100px;flex:1"><label>Dia Vencimento</label>
          <select id="emp-dia" onchange="simularEmprestimo()">
            ${[1,5,10,15,20,25,28].map(d=>`<option value="${d}">${d}</option>`).join('')}
          </select>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:4px">
        <div class="fg"><label>Garantia</label><input type="text" id="emp-garantia" placeholder="iPhone, moto, fiador..."></div>
        <div class="fg"><label>Observação</label><input type="text" id="emp-obs" placeholder="Anotação livre..."></div>
      </div>

      <div id="emp-preview"></div>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
        <button class="btn btn-ghost" onclick="document.getElementById('emp-overlay').remove()">Cancelar</button>
        <button class="btn btn-dark" onclick="salvarEmprestimo()">Confirmar →</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  simularEmprestimo();
}

function toggleEmpTipo() {
  const tipo = document.getElementById('emp-tipo').value;
  document.getElementById('emp-flat-wrap').style.display = tipo === 'FLAT' ? 'grid' : 'none';
  document.getElementById('emp-comp-wrap').style.display = tipo === 'FLAT' ? 'none' : 'flex';
  simularEmprestimo();
}

function simularEmprestimo() {
  const valor = parseFloat(document.getElementById('emp-valor')?.value) || 0;
  const tipo  = document.getElementById('emp-tipo')?.value || 'FLAT';
  const el    = document.getElementById('emp-preview');
  if (!el || !valor) return;

  if (tipo === 'FLAT') {
    const flat = parseFloat(document.getElementById('emp-flat')?.value) || 0;
    const venc = document.getElementById('emp-flat-venc')?.value;
    if (!flat) { el.innerHTML = ''; return; }
    const juros = Math.round((flat - valor) * 100);
    el.innerHTML = `
      <div class="sim-preview">
        <div class="sim-grid">
          <div class="sim-item"><div class="sim-item-l">Empresta</div><div class="sim-item-v">${fmt(Math.round(valor*100))}</div></div>
          <div class="sim-item"><div class="sim-item-l">Recebe</div><div class="sim-item-v t">${fmt(Math.round(flat*100))}</div></div>
          <div class="sim-item"><div class="sim-item-l">Juros</div><div class="sim-item-v t">${fmt(juros)}</div></div>
          <div class="sim-item"><div class="sim-item-l">Taxa</div><div class="sim-item-v">${valor > 0 ? (((flat-valor)/valor)*100).toFixed(1)+'%' : '—'}</div></div>
          <div class="sim-item"><div class="sim-item-l">Vencimento</div><div class="sim-item-v">${venc ? fmtData(venc) : '—'}</div></div>
          <div class="sim-item"><div class="sim-item-l">Parcelas</div><div class="sim-item-v">1×</div></div>
        </div>
      </div>`;
    window._parcelasCalc = null;
    window._iofCalc      = 0;
  } else {
    const taxa  = parseFloat(document.getElementById('emp-taxa')?.value)  || 0;
    const prazo = parseInt(document.getElementById('emp-prazo')?.value)   || 0;
    const sis   = document.getElementById('emp-sistema')?.value || 'PRICE';
    const diaV  = parseInt(document.getElementById('emp-dia')?.value) || 5;
    if (!taxa || !prazo) { el.innerHTML = ''; return; }

    const principal = Math.round(valor * 100);
    const parcelas  = sis === 'PRICE'
      ? Motor.gerarPrice(principal, taxa, prazo, diaV)
      : Motor.gerarSAC(principal, taxa, prazo, diaV);
    const { total, juros, primeiro } = Motor.resumo(parcelas);
    const iof = Motor.calcIOF(principal, prazo);

    el.innerHTML = `
      <div class="sim-preview">
        <div class="sim-grid">
          <div class="sim-item"><div class="sim-item-l">${sis==='SAC'?'1ª Parcela':'Parcela'}</div><div class="sim-item-v">${fmt(primeiro.valorTotal)}</div></div>
          <div class="sim-item"><div class="sim-item-l">Total pago</div><div class="sim-item-v">${fmt(total)}</div></div>
          <div class="sim-item"><div class="sim-item-l">Total juros</div><div class="sim-item-v t">${fmt(juros)}</div></div>
          <div class="sim-item"><div class="sim-item-l">IOF</div><div class="sim-item-v">${fmt(iof)}</div></div>
          <div class="sim-item"><div class="sim-item-l">1º Vencimento</div><div class="sim-item-v">${fmtData(primeiro.dataVencimento)}</div></div>
          <div class="sim-item"><div class="sim-item-l">Parcelas</div><div class="sim-item-v">${prazo}×</div></div>
        </div>
      </div>`;
    window._parcelasCalc = parcelas;
    window._iofCalc      = iof;
  }
}

async function salvarEmprestimo() {
  const devedorId = document.getElementById('emp-devedor').value;
  const valor     = parseFloat(document.getElementById('emp-valor').value) || 0;
  const tipo      = document.getElementById('emp-tipo').value;
  const garantia  = document.getElementById('emp-garantia').value.trim();
  const obs       = document.getElementById('emp-obs').value.trim();
  if (!devedorId || !valor) { toast('Preencha os campos obrigatórios.', 'err'); return; }

  const principal = Math.round(valor * 100);
  let propData = {
    usuario_id: devedorId, status: 'EM_DIA',
    tipo_taxa: tipo, valor_solicitado_centavos: principal,
    valor_aprovado_centavos: principal, valor_liberado_centavos: principal,
    garantia: garantia || null, observacao: obs || null,
    score_no_momento: 0, renda_no_momento_centavos: 0,
    comprometimento_pct: 0, iof_centavos: 0,
    taxa_juros_mensal_bp: 0, prazo_meses: 1, sistema_amortizacao: 'PRICE',
  };
  let parcelasRows = [];

  if (tipo === 'FLAT') {
    const flat = parseFloat(document.getElementById('emp-flat').value) || 0;
    const venc = document.getElementById('emp-flat-venc').value;
    if (!flat || !venc) { toast('Preencha valor e data de vencimento.', 'err'); return; }
    propData.valor_flat_centavos = Math.round(flat * 100);
    parcelasRows = [{
      numero: 1, status: 'PENDENTE',
      valor_total_centavos:     Math.round(flat * 100),
      valor_principal_centavos: principal,
      valor_juros_centavos:     Math.round(flat * 100) - principal,
      saldo_devedor_centavos:   0,
      data_vencimento:          venc,
    }];
  } else {
    const taxa  = parseFloat(document.getElementById('emp-taxa').value) || 0;
    const prazo = parseInt(document.getElementById('emp-prazo').value)  || 0;
    const sis   = document.getElementById('emp-sistema').value;
    if (!taxa || !prazo || !window._parcelasCalc?.length) { toast('Simule o empréstimo antes de confirmar.', 'err'); return; }
    propData.taxa_juros_mensal_bp = Math.round(taxa * 100);
    propData.prazo_meses          = prazo;
    propData.sistema_amortizacao  = sis;
    propData.iof_centavos         = window._iofCalc || 0;
    propData.valor_liberado_centavos = principal - (window._iofCalc || 0);
    parcelasRows = window._parcelasCalc.map(p => ({
      numero: p.numero, status: 'PENDENTE',
      valor_total_centavos:     p.valorTotal,
      valor_principal_centavos: p.principal,
      valor_juros_centavos:     p.juros,
      saldo_devedor_centavos:   p.saldoDevedor,
      data_vencimento:          p.dataVencimento,
    }));
  }

  const { data: prop, error } = await sb.from('propostas_emprestimo').insert(propData).select().single();
  if (error) { toast(error.message, 'err'); return; }

  await sb.from('parcelas').insert(parcelasRows.map(r => ({ ...r, proposta_id: prop.id })));

  document.getElementById('emp-overlay')?.remove();
  toast('Empréstimo criado!', 'ok2');
  PAGE_RENDERS.emprestimos();
}

async function ativarEmprestimo(id) {
  await sb.from('propostas_emprestimo').update({ status: 'EM_DIA' }).eq('id', id);
  await sb.from('parcelas').update({ status: 'PENDENTE' }).eq('proposta_id', id);
  toast('Empréstimo ativado!');
  PAGE_RENDERS.emprestimos();
}

window.abrirNovoEmprestimo = abrirNovoEmprestimo;
window.simularEmprestimo   = simularEmprestimo;
window.salvarEmprestimo    = salvarEmprestimo;
window.ativarEmprestimo    = ativarEmprestimo;
window.abrirRenegociacao   = abrirRenegociacao;
window.confirmarRenegociacao = confirmarRenegociacao;
window.toggleEmpTipo       = toggleEmpTipo;
window.toggleRenTipo       = toggleRenTipo;
window.editarNotaParcela   = editarNotaParcela;
window._filtroDevedor      = null;
