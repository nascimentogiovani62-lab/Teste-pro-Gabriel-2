// js/pages/devedores.js — v3
// Usa tabela "devedores" em vez de "perfis"

PAGE_RENDERS.devedores = async function() {
  const el = document.getElementById('devedores-content');
  el.innerHTML = `<div class="loading-wrap"><div class="spinner"></div> Carregando…</div>`;

  try {
    const [{ data: devedores, error: errDev }, { data: propostas }, { data: parcelas }] = await Promise.all([
      sb.from('devedores').select('*').order('nome'),
      sb.from('propostas_emprestimo').select('id,devedor_id,valor_solicitado_centavos,valor_flat_centavos,tipo_taxa,status,prazo_meses'),
      sb.from('parcelas').select('proposta_id,valor_total_centavos,multa_centavos,mora_centavos,status'),
    ]);

    if (errDev) throw errDev;

    // Saldo por devedor
    const saldoPor = {};
    (devedores||[]).forEach(d => {
      const props = (propostas||[]).filter(p =>
        p.devedor_id === d.id && ['EM_DIA','INADIMPLENTE','PAGO','AGUARDANDO_ASSINATURA'].includes(p.status)
      );
      let devido = 0, pago = 0;
      props.forEach(pr => {
        const parcs = (parcelas||[]).filter(pa => pa.proposta_id === pr.id);
        devido += pr.tipo_taxa === 'FLAT'
          ? (pr.valor_flat_centavos || pr.valor_solicitado_centavos)
          : parcs.reduce((a,pa) => a + pa.valor_total_centavos, 0);
        pago += parcs.filter(pa => pa.status === 'PAGA')
          .reduce((a,pa) => a + pa.valor_total_centavos + (pa.multa_centavos||0) + (pa.mora_centavos||0), 0);
      });
      saldoPor[d.id] = { contratos: props.length, devido, pago, saldo: Math.max(devido - pago, 0) };
    });

    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div style="font-size:13px;color:var(--muted)">${(devedores||[]).length} devedor${(devedores||[]).length!==1?'es':''} cadastrado${(devedores||[]).length!==1?'s':''}</div>
        <button class="btn btn-dark btn-sm" onclick="novoDevedor()">+ Novo Devedor</button>
      </div>

      <div class="twrap">
        <table class="ttable">
          <thead><tr><th>Nome</th><th>Contratos</th><th>Total Devido</th><th>Já Pago</th><th>Saldo</th><th>Telefone</th><th></th></tr></thead>
          <tbody>
            ${(devedores||[]).map(d => {
              const s = saldoPor[d.id] || {};
              return `<tr>
                <td><b>${d.nome}</b>${!d.ativo?'<span class="tag tag-bad" style="margin-left:6px">Inativo</span>':''}</td>
                <td style="color:var(--muted);font-size:12px">${s.contratos||0}</td>
                <td>${s.devido ? fmt(s.devido) : '—'}</td>
                <td style="color:var(--green)">${s.pago ? fmt(s.pago) : '—'}</td>
                <td><b style="color:${s.saldo>0?'var(--terra)':'var(--green)'}">${s.saldo>0?fmt(s.saldo):'Quitado ✓'}</b></td>
                <td style="color:var(--muted);font-size:12px">${d.telefone||'—'}</td>
                <td style="display:flex;gap:5px">
                  <button class="btn btn-ghost btn-sm" onclick="editarDevedor('${d.id}')">✏️</button>
                  <button class="btn btn-ghost btn-sm" onclick="verFichaDevedor('${d.id}','${d.nome.replace(/'/g,"\\'")}')">Ficha →</button>
                </td>
              </tr>`;
            }).join('') || `<tr><td colspan="7" class="empty">Nenhum devedor cadastrado.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div id="ficha-wrap"></div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="alert alert-bad">Erro: ${err.message}</div>`;
  }
};

// ── Ficha completa ────────────────────────────────────────
async function verFichaDevedor(devedorId, nomeDevedor) {
  const el = document.getElementById('ficha-wrap');
  if (!el) return;
  el.innerHTML = `<div class="loading-wrap"><div class="spinner"></div> Carregando ficha…</div>`;

  const [{ data: propostas }, { data: parcelas }, { data: postits }] = await Promise.all([
    sb.from('propostas_emprestimo').select('*').eq('devedor_id', devedorId).order('criado_em', { ascending: false }),
    sb.from('parcelas').select('*').order('data_vencimento'),
    sb.from('postits').select('*').eq('perfil_id', devedorId).order('criado_em', { ascending: false }),
  ]);

  let devido = 0, pago = 0;
  (propostas||[]).filter(p => ['EM_DIA','INADIMPLENTE','PAGO','AGUARDANDO_ASSINATURA'].includes(p.status))
    .forEach(pr => {
      const parcs = (parcelas||[]).filter(pa => pa.proposta_id === pr.id);
      devido += pr.tipo_taxa === 'FLAT'
        ? (pr.valor_flat_centavos || pr.valor_solicitado_centavos)
        : parcs.reduce((a,pa) => a + pa.valor_total_centavos, 0);
      pago += parcs.filter(pa => pa.status === 'PAGA')
        .reduce((a,pa) => a + pa.valor_total_centavos + (pa.multa_centavos||0) + (pa.mora_centavos||0), 0);
    });
  const saldo = Math.max(devido - pago, 0);

  el.innerHTML = `
    <div class="sec-label" style="margin-top:24px">Ficha — ${nomeDevedor}</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:16px">
      <div style="background:var(--card);padding:18px"><div class="klabel">Total devido</div><div class="kval" style="font-size:22px">${fmt(devido)}</div></div>
      <div style="background:var(--card);padding:18px"><div class="klabel">Já pago</div><div class="kval g" style="font-size:22px">${fmt(pago)}</div></div>
      <div style="background:var(--card);padding:18px"><div class="klabel">Saldo devedor</div><div class="kval ${saldo>0?'t':'g'}" style="font-size:22px">${saldo>0?fmt(saldo):'Quitado ✓'}</div></div>
    </div>

    <div class="sec-label">Contratos (${(propostas||[]).length})</div>
    <div class="twrap" style="margin-bottom:16px">
      <table class="ttable">
        <thead><tr><th>Valor</th><th>Tipo</th><th>Status</th><th>Garantia</th><th>Data</th><th></th></tr></thead>
        <tbody>
          ${(propostas||[]).map(p => {
            const isFlat = p.tipo_taxa === 'FLAT';
            return `<tr>
              <td>${fmt(p.valor_solicitado_centavos)}${isFlat&&p.valor_flat_centavos?` → <b>${fmt(p.valor_flat_centavos)}</b>`:''}</td>
              <td style="font-size:12px;color:var(--muted)">${isFlat?'Flat':`${p.prazo_meses}x ${p.sistema_amortizacao}`}</td>
              <td>${tagStatus(p.status)}</td>
              <td style="font-size:12px;color:var(--muted)">${p.garantia||'—'}</td>
              <td style="font-size:12px;color:var(--muted)">${fmtData(p.criado_em?.split('T')[0])}</td>
              <td><button class="btn btn-ghost btn-sm" onclick="goPage('emprestimos');setTimeout(()=>abrirDetalhe('${p.id}'),300)">Ver →</button></td>
            </tr>`;
          }).join('') || `<tr><td colspan="6" class="empty">Nenhum contrato.</td></tr>`}
        </tbody>
      </table>
    </div>

    <div class="sec-label">Post-its — ${nomeDevedor}
      <button class="btn btn-ghost btn-sm" onclick="abrirNovoPostit('${devedorId}')">+ Novo</button>
    </div>
    <div id="postits-devedor-${devedorId}">
      ${renderPostitsList(postits||[], devedorId)}
    </div>
  `;
}

function renderPostitsList(postits, devedorId) {
  if (!postits.length) return `<div class="empty" style="padding:20px">Nenhum post-it ainda.</div>`;
  const cores = { amarelo:'#92600a', verde:'var(--green)', vermelho:'var(--terra)', azul:'var(--blue)', cinza:'var(--muted)' };
  return `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
    ${postits.map(p => `
      <div style="display:flex;align-items:flex-start;gap:12px;background:var(--card);border:1px solid var(--border);border-left:3px solid ${cores[p.cor]||'var(--muted)'};border-radius:8px;padding:12px 16px">
        <div style="flex:1">
          <div style="font-size:13px;color:var(--text);line-height:1.6">${p.conteudo.replace(/</g,'&lt;')}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px">${new Date(p.criado_em).toLocaleString('pt-BR')}</div>
        </div>
        <button class="btn btn-ghost btn-sm" style="color:var(--terra)" onclick="deletarPostit('${p.id}','${devedorId}')">✕</button>
      </div>`).join('')}
  </div>`;
}

async function abrirNovoPostit(devedorId) {
  const overlay = document.createElement('div');
  overlay.id = 'postit-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(26,26,24,.6);backdrop-filter:blur(3px);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.onclick = e => { if(e.target===overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:24px;width:100%;max-width:400px" onclick="event.stopPropagation()">
      <div class="modal-title">Novo Post-it</div>
      <div class="fg" style="margin-bottom:12px">
        <label>Anotação *</label>
        <textarea id="postit-texto" rows="4" placeholder="Ex: Ligou dizendo que paga na quinta..." style="resize:none;font-size:13px" maxlength="500"></textarea>
      </div>
      <div class="fg" style="margin-bottom:16px">
        <label>Cor</label>
        <select id="postit-cor">
          <option value="amarelo">🟡 Amarelo</option>
          <option value="verde">🟢 Verde</option>
          <option value="vermelho">🔴 Vermelho</option>
          <option value="azul">🔵 Azul</option>
          <option value="cinza">⬜ Cinza</option>
        </select>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="document.getElementById('postit-overlay').remove()">Cancelar</button>
        <button class="btn btn-dark" onclick="salvarPostit('${devedorId}')">Salvar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => document.getElementById('postit-texto')?.focus(), 100);
}

async function salvarPostit(devedorId) {
  const conteudo = document.getElementById('postit-texto').value.trim();
  const cor      = document.getElementById('postit-cor').value;
  if (!conteudo) { toast('Escreva algo.', 'err'); return; }
  const { data: { user } } = await sb.auth.getUser();
  const { error } = await sb.from('postits').insert({ usuario_id: user.id, perfil_id: devedorId, conteudo, cor });
  if (error) { toast(error.message, 'err'); return; }
  document.getElementById('postit-overlay').remove();
  toast('Post-it salvo!', 'ok2');
  const { data: postits } = await sb.from('postits').select('*').eq('perfil_id', devedorId).order('criado_em', { ascending: false });
  const listEl = document.getElementById(`postits-devedor-${devedorId}`);
  if (listEl) listEl.innerHTML = renderPostitsList(postits||[], devedorId);
}

async function deletarPostit(id, devedorId) {
  if (!confirm('Excluir post-it?')) return;
  await sb.from('postits').delete().eq('id', id);
  toast('Post-it excluído.');
  const { data: postits } = await sb.from('postits').select('*').eq('perfil_id', devedorId).order('criado_em', { ascending: false });
  const listEl = document.getElementById(`postits-devedor-${devedorId}`);
  if (listEl) listEl.innerHTML = renderPostitsList(postits||[], devedorId);
}

// ── Modal devedor — usa overlay dinâmico ──────────────────
function novoDevedor() {
  _abrirModalDevedor(null);
}

async function editarDevedor(id) {
  const { data } = await sb.from('devedores').select('*').eq('id', id).single();
  if (data) _abrirModalDevedor(data);
}

function _abrirModalDevedor(dados) {
  document.getElementById('dev-overlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'dev-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(26,26,24,.6);backdrop-filter:blur(3px);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.onclick = e => { if(e.target===overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:28px;width:100%;max-width:420px" onclick="event.stopPropagation()">
      <div class="modal-title">${dados ? 'Editar Devedor' : 'Novo Devedor'}</div>
      <div class="modal-desc">Cadastre os dados de quem vai receber o empréstimo.</div>
      <input type="hidden" id="dov-id" value="${dados?.id||''}">
      <div class="fg" style="margin-bottom:12px">
        <label>Nome Completo *</label>
        <input type="text" id="dov-nome" placeholder="João da Silva" value="${dados?.nome||''}">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="fg"><label>Telefone</label><input type="text" id="dov-tel" placeholder="(16) 99999-9999" value="${dados?.telefone||''}"></div>
        <div class="fg"><label>Renda Mensal (R$)</label><input type="number" id="dov-renda" placeholder="3000" step="100" value="${dados?.renda_centavos ? (dados.renda_centavos/100).toFixed(0) : ''}"></div>
      </div>
      <div class="fg" style="margin-bottom:16px">
        <label>Observação</label>
        <input type="text" id="dov-obs" placeholder="Ex: cliente antigo, referência..." value="${dados?.observacao||''}">
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="document.getElementById('dev-overlay').remove()">Cancelar</button>
        <button class="btn btn-dark" onclick="salvarDevedor()">Salvar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  setTimeout(() => document.getElementById('dov-nome')?.focus(), 100);
}

async function salvarDevedor() {
  const nome  = document.getElementById('dov-nome').value.trim();
  const tel   = document.getElementById('dov-tel').value.trim();
  const renda = parseFloat(document.getElementById('dov-renda').value) || 0;
  const obs   = document.getElementById('dov-obs').value.trim();
  const id    = document.getElementById('dov-id').value;

  if (!nome) { toast('Nome é obrigatório.', 'err'); return; }

  const dados = {
    nome,
    telefone:       tel  || null,
    renda_centavos: renda ? Math.round(renda * 100) : null,
    observacao:     obs  || null,
    ativo:          true,
  };

  let error;
  if (id) {
    ({ error } = await sb.from('devedores').update(dados).eq('id', id));
  } else {
    ({ error } = await sb.from('devedores').insert(dados));
  }

  if (error) { toast(error.message, 'err'); return; }
  toast(id ? 'Devedor atualizado!' : 'Devedor cadastrado!', 'ok2');
  document.getElementById('dev-overlay').remove();
  PAGE_RENDERS.devedores();
}

window.novoDevedor       = novoDevedor;
window.editarDevedor     = editarDevedor;
window.salvarDevedor     = salvarDevedor;
window.verFichaDevedor   = verFichaDevedor;
window.abrirNovoPostit   = abrirNovoPostit;
window.salvarPostit      = salvarPostit;
window.deletarPostit     = deletarPostit;
