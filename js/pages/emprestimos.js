// js/pages/emprestimos.js — v3
// Usa devedor_id (tabela devedores), modal 100% dinâmico

let _filtroDevedor = null;
window.abrirDetalhe = abrirDetalhe;

PAGE_RENDERS.emprestimos = async function() {
  const el = document.getElementById('emprestimos-content');
  el.innerHTML = `<div class="loading-wrap"><div class="spinner"></div> Carregando…</div>`;

  try {
    let query = sb.from('propostas_emprestimo').select('*').order('criado_em', { ascending: false });
    if (_filtroDevedor) query = query.eq('devedor_id', _filtroDevedor);

    const [{ data: propostas, error: errP }, { data: devedores }] = await Promise.all([
      query,
      sb.from('devedores').select('id,nome'),
    ]);
    if (errP) throw errP;

    const nome = id => (devedores||[]).find(d => d.id === id)?.nome || '—';

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
              const isFlat = p.tipo_taxa === 'FLAT';
              return `<tr>
                <td><b>${nome(p.devedor_id)}</b>${p.proposta_origem_id?'<span class="tag tag-warn" style="margin-left:6px;font-size:10px">Reneg.</span>':''}</td>
                <td>${fmt(p.valor_solicitado_centavos)}${isFlat&&p.valor_flat_centavos?` → <b style="color:var(--terra)">${fmt(p.valor_flat_centavos)}</b>`:''}</td>
                <td style="font-size:12px;color:var(--muted)">${isFlat?'Flat':`${p.prazo_meses}x ${p.sistema_amortizacao}`}</td>
                <td>${tagStatus(p.status)}</td>
                <td style="font-size:12px;color:var(--muted)">${p.garantia||'—'}</td>
                <td style="color:var(--muted);font-size:12px">${fmtData(p.criado_em?.split('T')[0])}</td>
                <td style="display:flex;gap:6px">
                  <button class="btn btn-ghost btn-sm" onclick="abrirDetalhe('${p.id}')">Ver</button>
                  ${['EM_ANALISE','APROVADA'].includes(p.status)?`<button class="btn btn-green btn-sm" onclick="ativarEmprestimo('${p.id}')">Ativar</button>`:''}
                </td>
              </tr>`;
            }).join('') || `<tr><td colspan="7" class="empty">Nenhum empréstimo.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div id="detalhe-wrap"></div>
    `;
  } catch(err) {
    el.innerHTML = `<div class="alert alert-bad">Erro: ${err.message}</div>`;
  }
};

// ── Detalhe do empréstimo ─────────────────────────────────
async function abrirDetalhe(id) {
  let el = document.getElementById('detalhe-wrap');
  if (!el) { goPage('emprestimos'); setTimeout(() => abrirDetalhe(id), 350); return; }
  el.innerHTML = `<div class="loading-wrap"><div class="spinner"></div> Carregando…</div>`;

  const [{ data: p }, { data: parcelas }] = await Promise.all([
    sb.from('propostas_emprestimo').select('*').eq('id', id).single(),
    sb.from('parcelas').select('*').eq('proposta_id', id).order('numero'),
  ]);
  const { data: dev } = await sb.from('devedores').select('nome').eq('id', p.devedor_id).single();
  const isFlat = p.tipo_taxa === 'FLAT';

  const totalDevido = isFlat
    ? (p.valor_flat_centavos || p.valor_solicitado_centavos)
    : (parcelas||[]).reduce((a,pc) => a + pc.valor_total_centavos, 0);
  const totalPago = (parcelas||[]).filter(pc => pc.status==='PAGA')
    .reduce((a,pc) => a + pc.valor_total_centavos + (pc.multa_centavos||0) + (pc.mora_centavos||0), 0);
  const saldo = Math.max(totalDevido - totalPago, 0);

  el.innerHTML = `
    <div class="sec-label" style="margin-top:24px">Detalhe — ${dev?.nome||'—'}</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:16px">
      <div style="background:var(--card);padding:18px"><div class="klabel">Total a receber</div><div class="kval" style="font-size:22px">${fmt(totalDevido)}</div></div>
      <div style="background:var(--card);padding:18px"><div class="klabel">Já recebido</div><div class="kval g" style="font-size:22px">${fmt(totalPago)}</div></div>
      <div style="background:var(--card);padding:18px"><div class="klabel">Saldo devedor</div><div class="kval ${saldo>0?'t':'g'}" style="font-size:22px">${saldo>0?fmt(saldo):'Quitado ✓'}</div></div>
    </div>

    <div class="twrap" style="margin-bottom:16px">
      <div class="twrap-head">
        <span class="twrap-title">${tagStatus(p.status)}</span>
        <div style="display:flex;gap:8px">
          ${['EM_ANALISE','APROVADA'].includes(p.status)?`<button class="btn btn-green btn-sm" onclick="ativarEmprestimo('${p.id}')">Ativar</button>`:''}
          <button class="btn btn-ghost btn-sm" onclick="abrirRenegociacao('${p.id}','${p.devedor_id}',${p.valor_solicitado_centavos})">↺ Renegociar</button>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0;background:var(--border)">
        ${[
          ['Tipo', isFlat?'Taxa Flat':`${p.prazo_meses}x ${p.sistema_amortizacao}`],
          ['Emprestado', fmt(p.valor_solicitado_centavos)],
          isFlat ? ['A receber', fmt(p.valor_flat_centavos||0)] : ['Taxa', p.taxa_juros_mensal_bp?(p.taxa_juros_mensal_bp/100).toFixed(2)+'%/mês':'—'],
          ['Garantia', p.garantia||'—'],
          ['Observação', p.observacao||'—'],
          ['Data', fmtData(p.criado_em?.split('T')[0])],
        ].map(([l,v]) => `<div style="background:var(--card);padding:14px 18px">
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
              const dStr = parc.status==='PAGA'
                ? `<span style="color:var(--muted);font-size:12px">—</span>`
                : at.dias>0 ? `<span class="dias-bad">${at.dias}d atraso</span>`
                : dias<=3   ? `<span class="dias-bad">${dias}d</span>`
                : dias<=7   ? `<span class="dias-warn">${dias}d</span>`
                : `<span class="dias-ok">${dias}d</span>`;
              const valStr = at.dias>0
                ? `<b style="color:var(--terra)">${fmt(at.total)}</b>`
                : `<b>${fmt(parc.valor_total_centavos)}</b>`;
              return `<tr>
                <td style="font-family:var(--mono);font-size:12px;color:var(--muted)">${String(parc.numero).padStart(2,'0')}</td>
                <td>${fmtData(parc.data_vencimento)}</td>
                <td>${dStr}</td>
                <td>${valStr}</td>
                <td>${tagStatus(parc.status)}</td>
                <td style="font-size:12px;color:var(--muted)">
                  ${parc.nota
                    ? `<span title="${parc.nota}">${parc.nota.slice(0,30)}${parc.nota.length>30?'…':''}</span>`
                    : `<button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="editarNotaParcela('${parc.id}','')">+ nota</button>`}
                </td>
                <td style="display:flex;gap:4px">
                  ${parc.status!=='PAGA'?`<button class="btn btn-ghost btn-sm" onclick="abrirPagamento('${parc.id}',${parc.valor_total_centavos},'${parc.data_vencimento}')">Pagar</button>`:''}
                  ${parc.nota?`<button class="btn btn-ghost btn-sm" style="font-size:11px" onclick="editarNotaParcela('${parc.id}','${(parc.nota||'').replace(/'/g,"\\'")}')">✏️</button>`:''}
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>` : ''}
  `;
}

async function editarNotaParcela(parcelaId, notaAtual) {
  const nota = prompt('Nota para esta parcela:', notaAtual||'');
  if (nota===null) return;
  await sb.from('parcelas').update({ nota: nota||null }).eq('id', parcelaId);
  toast('Nota salva!');
  const { data: parc } = await sb.from('parcelas').select('proposta_id').eq('id', parcelaId).single();
  if (parc) abrirDetalhe(parc.proposta_id);
}

// ── Novo Empréstimo ───────────────────────────────────────
async function abrirNovoEmprestimo() {
  const { data: devedores, error } = await sb.from('devedores').select('id,nome').eq('ativo',true).order('nome');
  if (error || !devedores?.length) {
    toast('Cadastre um devedor primeiro.', 'err');
    goPage('devedores');
    return;
  }

  document.getElementById('emp-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'emp-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(26,26,24,.6);backdrop-filter:blur(3px);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto';
  overlay.onclick = e => { if(e.target===overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:28px;width:100%;max-width:500px;margin:auto" onclick="event.stopPropagation()">
      <div class="modal-title">Novo Empréstimo</div>
      <div class="modal-desc">Configure e simule antes de confirmar.</div>

      <div class="fg" style="margin-bottom:12px">
        <label>Devedor *</label>
        <select id="nemp-devedor">
          ${devedores.map(d => `<option value="${d.id}">${d.nome}</option>`).join('')}
        </select>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="fg"><label>Valor Emprestado (R$) *</label>
          <input type="number" id="nemp-valor" placeholder="5000" step="100" oninput="simularEmprestimo()">
        </div>
        <div class="fg"><label>Tipo de Taxa</label>
          <select id="nemp-tipo" onchange="toggleEmpTipo()">
            <option value="FLAT">Flat — valor fixo</option>
            <option value="COMPOSTO">Parcelado (Price/SAC)</option>
          </select>
        </div>
      </div>

      <!-- FLAT -->
      <div id="nemp-flat-wrap" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="fg"><label>Valor a Receber (R$) *</label>
          <input type="number" id="nemp-flat" placeholder="7500" step="50" oninput="simularEmprestimo()">
        </div>
        <div class="fg"><label>Data de Vencimento *</label>
          <input type="date" id="nemp-flat-venc">
        </div>
      </div>

      <!-- COMPOSTO -->
      <div id="nemp-comp-wrap" style="display:none;display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="fg"><label>Taxa (%/mês) *</label>
          <input type="number" id="nemp-taxa" placeholder="3.5" step="0.1" value="3.5" oninput="simularEmprestimo()">
        </div>
        <div class="fg"><label>Prazo (meses) *</label>
          <input type="number" id="nemp-prazo" placeholder="12" min="1" max="120" oninput="simularEmprestimo()">
        </div>
        <div class="fg"><label>Sistema</label>
          <select id="nemp-sistema" onchange="simularEmprestimo()">
            <option value="PRICE">Price</option>
            <option value="SAC">SAC</option>
          </select>
        </div>
        <div class="fg"><label>Dia Vencimento</label>
          <select id="nemp-dia" onchange="simularEmprestimo()">
            ${[1,5,10,15,20,25,28].map(d=>`<option value="${d}">${d}</option>`).join('')}
          </select>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:4px">
        <div class="fg"><label>Garantia</label>
          <input type="text" id="nemp-garantia" placeholder="iPhone, moto...">
        </div>
        <div class="fg"><label>Observação</label>
          <input type="text" id="nemp-obs" placeholder="Anotação livre...">
        </div>
      </div>

      <div id="nemp-preview"></div>

      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px">
        <button class="btn btn-ghost" onclick="document.getElementById('emp-overlay').remove()">Cancelar</button>
        <button class="btn btn-dark" onclick="salvarEmprestimo()">Confirmar →</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // Esconde comp-wrap corretamente após render
  document.getElementById('nemp-comp-wrap').style.display = 'none';
}

function toggleEmpTipo() {
  const tipo = document.getElementById('nemp-tipo')?.value;
  if (!tipo) return;
  document.getElementById('nemp-flat-wrap').style.display = tipo==='FLAT' ? 'grid' : 'none';
  document.getElementById('nemp-comp-wrap').style.display = tipo==='FLAT' ? 'none' : 'grid';
  simularEmprestimo();
}

function simularEmprestimo() {
  const valor = parseFloat(document.getElementById('nemp-valor')?.value) || 0;
  const tipo  = document.getElementById('nemp-tipo')?.value || 'FLAT';
  const el    = document.getElementById('nemp-preview');
  if (!el || !valor) return;

  if (tipo === 'FLAT') {
    const flat = parseFloat(document.getElementById('nemp-flat')?.value) || 0;
    const venc = document.getElementById('nemp-flat-venc')?.value;
    if (!flat) { el.innerHTML = ''; return; }
    const juros = Math.round((flat - valor) * 100);
    el.innerHTML = `<div class="sim-preview"><div class="sim-grid">
      <div class="sim-item"><div class="sim-item-l">Empresta</div><div class="sim-item-v">${fmt(Math.round(valor*100))}</div></div>
      <div class="sim-item"><div class="sim-item-l">Recebe</div><div class="sim-item-v t">${fmt(Math.round(flat*100))}</div></div>
      <div class="sim-item"><div class="sim-item-l">Juros</div><div class="sim-item-v t">${fmt(juros)}</div></div>
      <div class="sim-item"><div class="sim-item-l">Taxa</div><div class="sim-item-v">${valor>0?(((flat-valor)/valor)*100).toFixed(1)+'%':'—'}</div></div>
      <div class="sim-item"><div class="sim-item-l">Vencimento</div><div class="sim-item-v">${venc?fmtData(venc):'—'}</div></div>
      <div class="sim-item"><div class="sim-item-l">Parcelas</div><div class="sim-item-v">1×</div></div>
    </div></div>`;
    window._parcelasCalc = null;
  } else {
    const taxa  = parseFloat(document.getElementById('nemp-taxa')?.value)  || 0;
    const prazo = parseInt(document.getElementById('nemp-prazo')?.value)   || 0;
    const sis   = document.getElementById('nemp-sistema')?.value || 'PRICE';
    const diaV  = parseInt(document.getElementById('nemp-dia')?.value) || 5;
    if (!taxa || !prazo) { el.innerHTML = ''; return; }
    const principal = Math.round(valor*100);
    const parcelas  = sis==='PRICE' ? Motor.gerarPrice(principal,taxa,prazo,diaV) : Motor.gerarSAC(principal,taxa,prazo,diaV);
    const { total, juros, primeiro } = Motor.resumo(parcelas);
    const iof = Motor.calcIOF(principal, prazo);
    el.innerHTML = `<div class="sim-preview"><div class="sim-grid">
      <div class="sim-item"><div class="sim-item-l">${sis==='SAC'?'1ª Parcela':'Parcela'}</div><div class="sim-item-v">${fmt(primeiro.valorTotal)}</div></div>
      <div class="sim-item"><div class="sim-item-l">Total pago</div><div class="sim-item-v">${fmt(total)}</div></div>
      <div class="sim-item"><div class="sim-item-l">Juros</div><div class="sim-item-v t">${fmt(juros)}</div></div>
      <div class="sim-item"><div class="sim-item-l">IOF</div><div class="sim-item-v">${fmt(iof)}</div></div>
      <div class="sim-item"><div class="sim-item-l">1º Vencimento</div><div class="sim-item-v">${fmtData(primeiro.dataVencimento)}</div></div>
      <div class="sim-item"><div class="sim-item-l">Parcelas</div><div class="sim-item-v">${prazo}×</div></div>
    </div></div>`;
    window._parcelasCalc = parcelas;
    window._iofCalc = iof;
  }
}

async function salvarEmprestimo() {
  const devedorId = document.getElementById('nemp-devedor').value;
  const valor     = parseFloat(document.getElementById('nemp-valor').value) || 0;
  const tipo      = document.getElementById('nemp-tipo').value;
  const garantia  = document.getElementById('nemp-garantia').value.trim();
  const obs       = document.getElementById('nemp-obs').value.trim();
  if (!devedorId || !valor) { toast('Preencha os campos obrigatórios.', 'err'); return; }

  const principal = Math.round(valor * 100);
  let propData = {
    devedor_id: devedorId,
    usuario_id: (await sb.auth.getUser()).data.user.id,
    status: 'EM_DIA', tipo_taxa: tipo,
    valor_solicitado_centavos: principal,
    valor_aprovado_centavos:   principal,
    valor_liberado_centavos:   principal,
    garantia: garantia||null, observacao: obs||null,
    score_no_momento: 0, renda_no_momento_centavos: 0,
    comprometimento_pct: 0, iof_centavos: 0,
    taxa_juros_mensal_bp: 0, prazo_meses: 1, sistema_amortizacao: 'PRICE',
  };
  let parcelasRows = [];

  if (tipo === 'FLAT') {
    const flat = parseFloat(document.getElementById('nemp-flat').value) || 0;
    const venc = document.getElementById('nemp-flat-venc').value;
    if (!flat || !venc) { toast('Informe valor a receber e data.', 'err'); return; }
    propData.valor_flat_centavos = Math.round(flat*100);
    parcelasRows = [{
      numero: 1, status: 'PENDENTE',
      valor_total_centavos:     Math.round(flat*100),
      valor_principal_centavos: principal,
      valor_juros_centavos:     Math.round(flat*100) - principal,
      saldo_devedor_centavos:   0,
      data_vencimento:          venc,
    }];
  } else {
    const taxa  = parseFloat(document.getElementById('nemp-taxa').value) || 0;
    const prazo = parseInt(document.getElementById('nemp-prazo').value)  || 0;
    const sis   = document.getElementById('nemp-sistema').value;
    if (!taxa || !prazo || !window._parcelasCalc?.length) { toast('Preencha taxa e prazo.', 'err'); return; }
    propData.taxa_juros_mensal_bp = Math.round(taxa*100);
    propData.prazo_meses          = prazo;
    propData.sistema_amortizacao  = sis;
    propData.iof_centavos         = window._iofCalc||0;
    propData.valor_liberado_centavos = principal - (window._iofCalc||0);
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
  await sb.from('propostas_emprestimo').update({ status:'EM_DIA' }).eq('id', id);
  await sb.from('parcelas').update({ status:'PENDENTE' }).eq('proposta_id', id);
  toast('Empréstimo ativado!');
  PAGE_RENDERS.emprestimos();
}

// ── Renegociação ──────────────────────────────────────────
function abrirRenegociacao(origemId, devedorId, valorOriginalCentavos) {
  document.getElementById('ren-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'ren-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(26,26,24,.6);backdrop-filter:blur(3px);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.onclick = e => { if(e.target===overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:28px;width:100%;max-width:440px" onclick="event.stopPropagation()">
      <div class="modal-title">↺ Renegociar Contrato</div>
      <div class="modal-desc">Cria novo contrato vinculado e fecha o original.</div>
      <div class="alert alert-warn" style="margin-bottom:16px">Saldo estimado: <b>${fmt(valorOriginalCentavos)}</b> — ajuste conforme o combinado.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="fg"><label>Novo Valor (R$) *</label><input type="number" id="ren-valor" placeholder="0,00" step="100"></div>
        <div class="fg"><label>Tipo de Taxa</label>
          <select id="ren-tipo" onchange="toggleRenTipo()">
            <option value="FLAT">Flat — valor fixo</option>
            <option value="COMPOSTO">Parcelado</option>
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
        <div class="fg"><label>Sistema</label><select id="ren-sistema"><option value="PRICE">Price</option><option value="SAC">SAC</option></select></div>
      </div>
      <div class="fg" style="margin-bottom:16px"><label>Garantia / Obs</label>
        <input type="text" id="ren-garantia" placeholder="iPhone, moto, fiador...">
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="document.getElementById('ren-overlay').remove()">Cancelar</button>
        <button class="btn btn-dark" onclick="confirmarRenegociacao('${origemId}','${devedorId}')">Confirmar →</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
}

function toggleRenTipo() {
  const tipo = document.getElementById('ren-tipo').value;
  document.getElementById('ren-flat-wrap').style.display  = tipo==='FLAT' ? 'grid' : 'none';
  document.getElementById('ren-comp-wrap').style.display  = tipo==='FLAT' ? 'none' : 'grid';
}

async function confirmarRenegociacao(origemId, devedorId) {
  const valor    = parseFloat(document.getElementById('ren-valor').value) || 0;
  const tipo     = document.getElementById('ren-tipo').value;
  const garantia = document.getElementById('ren-garantia').value.trim();
  if (!valor) { toast('Informe o novo valor.', 'err'); return; }

  const principal = Math.round(valor * 100);
  const userId = (await sb.auth.getUser()).data.user.id;
  let propData = {
    devedor_id: devedorId, usuario_id: userId,
    status: 'EM_DIA', proposta_origem_id: origemId,
    tipo_taxa: tipo, valor_solicitado_centavos: principal,
    valor_aprovado_centavos: principal, valor_liberado_centavos: principal,
    garantia: garantia||null, observacao: 'Renegociação',
    score_no_momento: 0, renda_no_momento_centavos: 0,
    comprometimento_pct: 0, iof_centavos: 0,
    taxa_juros_mensal_bp: 0, prazo_meses: 1, sistema_amortizacao: 'PRICE',
  };
  let parcelasRows = [];

  if (tipo === 'FLAT') {
    const flat = parseFloat(document.getElementById('ren-flat').value) || 0;
    const venc = document.getElementById('ren-flat-venc').value;
    if (!flat || !venc) { toast('Informe valor e data.', 'err'); return; }
    propData.valor_flat_centavos = Math.round(flat*100);
    parcelasRows = [{
      numero:1, status:'PENDENTE',
      valor_total_centavos: Math.round(flat*100),
      valor_principal_centavos: principal,
      valor_juros_centavos: Math.round(flat*100)-principal,
      saldo_devedor_centavos: 0, data_vencimento: venc,
    }];
  } else {
    const taxa  = parseFloat(document.getElementById('ren-taxa').value) || 0;
    const prazo = parseInt(document.getElementById('ren-prazo').value)  || 0;
    const sis   = document.getElementById('ren-sistema').value;
    if (!taxa || !prazo) { toast('Preencha taxa e prazo.', 'err'); return; }
    const parcelas = sis==='PRICE' ? Motor.gerarPrice(principal,taxa,prazo,5) : Motor.gerarSAC(principal,taxa,prazo,5);
    propData.taxa_juros_mensal_bp = Math.round(taxa*100);
    propData.prazo_meses = prazo; propData.sistema_amortizacao = sis;
    parcelasRows = parcelas.map(p => ({
      numero:p.numero, status:'PENDENTE',
      valor_total_centavos:p.valorTotal, valor_principal_centavos:p.principal,
      valor_juros_centavos:p.juros, saldo_devedor_centavos:p.saldoDevedor,
      data_vencimento:p.dataVencimento,
    }));
  }

  const { data: nova, error } = await sb.from('propostas_emprestimo').insert(propData).select().single();
  if (error) { toast(error.message,'err'); return; }
  await sb.from('parcelas').insert(parcelasRows.map(r => ({ ...r, proposta_id: nova.id })));
  await sb.from('propostas_emprestimo').update({ status:'RECUSADA' }).eq('id', origemId);

  document.getElementById('ren-overlay')?.remove();
  toast('Renegociação criada!', 'ok2');
  PAGE_RENDERS.emprestimos();
}

window.abrirNovoEmprestimo   = abrirNovoEmprestimo;
window.simularEmprestimo      = simularEmprestimo;
window.salvarEmprestimo       = salvarEmprestimo;
window.ativarEmprestimo       = ativarEmprestimo;
window.abrirRenegociacao      = abrirRenegociacao;
window.confirmarRenegociacao  = confirmarRenegociacao;
window.toggleEmpTipo          = toggleEmpTipo;
window.toggleRenTipo          = toggleRenTipo;
window.editarNotaParcela      = editarNotaParcela;
window._filtroDevedor         = null;
