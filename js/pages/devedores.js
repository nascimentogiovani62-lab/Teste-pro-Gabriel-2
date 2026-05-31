// js/pages/devedores.js — v2.1
// Inclui: saldo devedor por cliente, post-its vinculados

PAGE_RENDERS.devedores = async function() {
  const el = document.getElementById('devedores-content');
  el.innerHTML = `<div class="loading-wrap"><div class="spinner"></div> Carregando…</div>`;

  try {
    const [{ data: perfis }, { data: propostas }, { data: parcelas }] = await Promise.all([
      sb.from('perfis').select('*').order('nome_completo'),
      sb.from('propostas_emprestimo').select('id,usuario_id,valor_solicitado_centavos,valor_flat_centavos,tipo_taxa,status,prazo_meses'),
      sb.from('parcelas').select('proposta_id,valor_total_centavos,multa_centavos,mora_centavos,status,data_vencimento'),
    ]);

    // Calcula saldo por devedor
    const saldoPorDevedor = {};
    (perfis||[]).forEach(p => {
      const propsDevedor = (propostas||[]).filter(pr =>
        pr.usuario_id === p.id && ['EM_DIA','INADIMPLENTE','PAGO','AGUARDANDO_ASSINATURA'].includes(pr.status)
      );
      let totalDevido = 0, totalPago = 0;
      propsDevedor.forEach(pr => {
        const parcsProps = (parcelas||[]).filter(pa => pa.proposta_id === pr.id);
        const devido = pr.tipo_taxa === 'FLAT'
          ? (pr.valor_flat_centavos || pr.valor_solicitado_centavos)
          : parcsProps.reduce((a, pa) => a + pa.valor_total_centavos, 0);
        const pago = parcsProps.filter(pa => pa.status === 'PAGA')
          .reduce((a, pa) => a + pa.valor_total_centavos + (pa.multa_centavos||0) + (pa.mora_centavos||0), 0);
        totalDevido += devido;
        totalPago   += pago;
      });
      saldoPorDevedor[p.id] = {
        contratos: propsDevedor.length,
        totalDevido,
        totalPago,
        saldo: Math.max(totalDevido - totalPago, 0),
      };
    });

    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div style="font-size:13px;color:var(--muted)">${(perfis||[]).length} devedor${(perfis||[]).length!==1?'es':''} cadastrado${(perfis||[]).length!==1?'s':''}</div>
        <button class="btn btn-dark btn-sm" onclick="novoDevedor()">+ Novo Devedor</button>
      </div>

      <div class="twrap">
        <table class="ttable">
          <thead><tr><th>Nome</th><th>Contratos</th><th>Total Devido</th><th>Já Pago</th><th>Saldo Devedor</th><th>Telefone</th><th></th></tr></thead>
          <tbody>
            ${(perfis||[]).map(p => {
              const s = saldoPorDevedor[p.id] || { contratos:0, totalDevido:0, totalPago:0, saldo:0 };
              return `<tr>
                <td><b>${p.nome_completo}</b>${!p.ativo?'<span class="tag tag-bad" style="margin-left:6px">Inativo</span>':''}</td>
                <td style="color:var(--muted);font-size:12px">${s.contratos}</td>
                <td>${s.totalDevido > 0 ? fmt(s.totalDevido) : '—'}</td>
                <td style="color:var(--green)">${s.totalPago > 0 ? fmt(s.totalPago) : '—'}</td>
                <td><b style="color:${s.saldo>0?'var(--terra)':'var(--green)'}">${s.saldo>0?fmt(s.saldo):'Quitado ✓'}</b></td>
                <td style="color:var(--muted);font-size:12px">${p.telefone||'—'}</td>
                <td style="display:flex;gap:5px;flex-wrap:wrap">
                  <button class="btn btn-ghost btn-sm" onclick="editarDevedor('${p.id}')">✏️</button>
                  <button class="btn btn-ghost btn-sm" onclick="verFichaDevedor('${p.id}','${p.nome_completo.replace(/'/g,"\\'")}')" style="white-space:nowrap">Ficha →</button>
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

// ── Ficha completa do devedor ─────────────────────────────
async function verFichaDevedor(devedorId, nomeDevedor) {
  const el = document.getElementById('ficha-wrap');
  if (!el) return;
  el.innerHTML = `<div class="loading-wrap"><div class="spinner"></div> Carregando ficha…</div>`;

  const [{ data: propostas }, { data: parcelas }, { data: postits }] = await Promise.all([
    sb.from('propostas_emprestimo').select('*').eq('usuario_id', devedorId).order('criado_em', { ascending: false }),
    sb.from('parcelas').select('*').order('data_vencimento'),
    sb.from('postits').select('*').eq('perfil_id', devedorId).order('criado_em', { ascending: false }),
  ]);

  // Calcula saldo geral
  let totalDevido = 0, totalPago = 0;
  (propostas||[]).filter(p => ['EM_DIA','INADIMPLENTE','PAGO','AGUARDANDO_ASSINATURA'].includes(p.status))
    .forEach(pr => {
      const parcsProps = (parcelas||[]).filter(pa => pa.proposta_id === pr.id);
      const devido = pr.tipo_taxa === 'FLAT'
        ? (pr.valor_flat_centavos || pr.valor_solicitado_centavos)
        : parcsProps.reduce((a,pa) => a + pa.valor_total_centavos, 0);
      const pago = parcsProps.filter(pa => pa.status === 'PAGA')
        .reduce((a,pa) => a + pa.valor_total_centavos + (pa.multa_centavos||0) + (pa.mora_centavos||0), 0);
      totalDevido += devido;
      totalPago   += pago;
    });
  const saldo = Math.max(totalDevido - totalPago, 0);

  el.innerHTML = `
    <div class="sec-label" style="margin-top:24px">Ficha — ${nomeDevedor}</div>

    <!-- Saldo geral -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:16px">
      <div style="background:var(--card);padding:18px">
        <div class="klabel">Total devido</div>
        <div class="kval" style="font-size:22px">${fmt(totalDevido)}</div>
      </div>
      <div style="background:var(--card);padding:18px">
        <div class="klabel">Já pago</div>
        <div class="kval g" style="font-size:22px">${fmt(totalPago)}</div>
      </div>
      <div style="background:var(--card);padding:18px">
        <div class="klabel">Saldo devedor</div>
        <div class="kval ${saldo>0?'t':'g'}" style="font-size:22px">${saldo>0?fmt(saldo):'Quitado ✓'}</div>
      </div>
    </div>

    <!-- Contratos -->
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

    <!-- Post-its do devedor -->
    <div class="sec-label">Post-its — ${nomeDevedor}
      <button class="btn btn-ghost btn-sm" onclick="abrirNovoPostit('${devedorId}')">+ Novo</button>
    </div>
    <div id="postits-devedor-${devedorId}">
      ${renderPostitsList(postits||[], devedorId)}
    </div>
  `;
}

// ── Post-its ──────────────────────────────────────────────
function renderPostitsList(postits, devedorId) {
  if (!postits.length) return `<div class="empty" style="padding:20px">Nenhum post-it. Clique em "+ Novo" para adicionar.</div>`;
  const cores = { amarelo:'#92600a', verde:'var(--green)', vermelho:'var(--terra)', azul:'var(--blue)', cinza:'var(--muted)' };
  return `<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px">
    ${postits.map(p => `
      <div style="display:flex;align-items:flex-start;gap:12px;background:var(--card);border:1px solid var(--border);border-left:3px solid ${cores[p.cor]||'var(--muted)'};border-radius:8px;padding:12px 16px">
        <div style="flex:1">
          <div style="font-size:13px;color:var(--text);line-height:1.6">${p.conteudo.replace(/</g,'&lt;')}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px">${new Date(p.criado_em).toLocaleString('pt-BR')}</div>
        </div>
        <button class="btn btn-ghost btn-sm" style="color:var(--terra);border-color:var(--terra-bd)" onclick="deletarPostit('${p.id}','${devedorId}')">✕</button>
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
      <div class="modal-desc">Anotação vinculada a este devedor.</div>
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
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => document.getElementById('postit-texto').focus(), 100);
}

async function salvarPostit(devedorId) {
  const conteudo = document.getElementById('postit-texto').value.trim();
  const cor      = document.getElementById('postit-cor').value;
  if (!conteudo) { toast('Escreva algo no post-it.', 'err'); return; }

  const { data: { user } } = await sb.auth.getUser();
  const { error } = await sb.from('postits').insert({
    usuario_id: user.id,
    perfil_id:  devedorId || null,
    conteudo, cor,
  });
  if (error) { toast(error.message, 'err'); return; }

  document.getElementById('postit-overlay').remove();
  toast('Post-it salvo!', 'ok2');

  // Atualiza a lista
  const { data: postits } = await sb.from('postits').select('*').eq('perfil_id', devedorId).order('criado_em', { ascending: false });
  const listEl = document.getElementById(`postits-devedor-${devedorId}`);
  if (listEl) listEl.innerHTML = renderPostitsList(postits||[], devedorId);
}

async function deletarPostit(postitId, devedorId) {
  if (!confirm('Excluir este post-it?')) return;
  await sb.from('postits').delete().eq('id', postitId);
  toast('Post-it excluído.');
  const { data: postits } = await sb.from('postits').select('*').eq('perfil_id', devedorId).order('criado_em', { ascending: false });
  const listEl = document.getElementById(`postits-devedor-${devedorId}`);
  if (listEl) listEl.innerHTML = renderPostitsList(postits||[], devedorId);
}

// ── Formulário de devedor ─────────────────────────────────
function novoDevedor() {
  ['dev-id','dev-nome','dev-tel','dev-renda','dev-obs'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const titulo = document.getElementById('mod-dev-titulo');
  if (titulo) titulo.textContent = 'Novo Devedor';
  openMod('novo-devedor');
}

async function editarDevedor(id) {
  const { data } = await sb.from('perfis').select('*').eq('id', id).single();
  if (!data) return;
  document.getElementById('dev-id').value    = data.id;
  document.getElementById('dev-nome').value  = data.nome_completo || '';
  document.getElementById('dev-tel').value   = data.telefone || '';
  document.getElementById('dev-renda').value = data.renda_declarada_centavos ? (data.renda_declarada_centavos/100).toFixed(2) : '';
  document.getElementById('dev-obs').value   = data.cpf_hash || '';
  document.getElementById('mod-dev-titulo').textContent = 'Editar Devedor';
  openMod('novo-devedor');
}

async function salvarDevedor() {
  const nome  = document.getElementById('dev-nome').value.trim();
  const tel   = document.getElementById('dev-tel').value.trim();
  const renda = parseFloat(document.getElementById('dev-renda').value) || 0;
  const obs   = document.getElementById('dev-obs').value.trim();
  const id    = document.getElementById('dev-id').value;
  if (!nome) { toast('Nome é obrigatório.', 'err'); return; }

  const dados = {
    nome_completo: nome,
    telefone: tel || null,
    renda_declarada_centavos: renda ? Math.round(renda*100) : null,
    cpf_hash: obs || null,
    ativo: true,
  };

  let error;
  if (id) {
    ({ error } = await sb.from('perfis').update(dados).eq('id', id));
  } else {
    ({ error } = await sb.from('perfis').insert({ ...dados, id: crypto.randomUUID() }));
  }
  if (error) { toast(error.message, 'err'); return; }
  toast(id ? 'Devedor atualizado!' : 'Devedor cadastrado!', 'ok2');
  closeMod('novo-devedor');
  PAGE_RENDERS.devedores();
}

window.novoDevedor       = novoDevedor;
window.editarDevedor     = editarDevedor;
window.salvarDevedor     = salvarDevedor;
window.verFichaDevedor   = verFichaDevedor;
window.abrirNovoPostit   = abrirNovoPostit;
window.salvarPostit      = salvarPostit;
window.deletarPostit     = deletarPostit;
