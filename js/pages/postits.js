//alguma coisa//

PAGE_RENDERS.postits = async function() {
  const el = document.getElementById('postits-content');
  el.innerHTML = `<div class="loading-wrap"><div class="spinner"></div> Carregando…</div>`;

  try {
    const [{ data: postits }, { data: perfis }] = await Promise.all([
      sb.from('postits').select('*').order('criado_em', { ascending: false }),
      sb.from('perfis').select('id,nome_completo'),
    ]);

    const nomeDevedor = id => id ? (perfis||[]).find(p => p.id === id)?.nome_completo : null;
    const cores = { amarelo:'#92600a', verde:'var(--green)', vermelho:'var(--terra)', azul:'var(--blue)', cinza:'var(--muted)' };

    const gerais   = (postits||[]).filter(p => !p.perfil_id);
    const vinculados = (postits||[]).filter(p => !!p.perfil_id);

    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div style="font-size:13px;color:var(--muted)">${(postits||[]).length} post-it${(postits||[]).length!==1?'s':''} no total</div>
        <button class="btn btn-dark btn-sm" onclick="abrirNovoPostitGeral()">+ Novo Post-it</button>
      </div>

      ${gerais.length ? `
        <div class="sec-label">Mural Geral (${gerais.length})</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:24px">
          ${gerais.map(p => `
            <div style="display:flex;align-items:flex-start;gap:12px;background:var(--card);border:1px solid var(--border);border-left:3px solid ${cores[p.cor]||'var(--muted)'};border-radius:8px;padding:12px 16px">
              <div style="flex:1">
                <div style="font-size:13px;color:var(--text);line-height:1.6">${p.conteudo.replace(/</g,'&lt;')}</div>
                <div style="font-size:11px;color:var(--muted);margin-top:4px">${new Date(p.criado_em).toLocaleString('pt-BR')}</div>
              </div>
              <button class="btn btn-ghost btn-sm" style="color:var(--terra);border-color:var(--terra-bd)" onclick="deletarPostitGeral('${p.id}')">✕</button>
            </div>`).join('')}
        </div>` : ''}

      ${vinculados.length ? `
        <div class="sec-label">Vinculados a Devedores (${vinculados.length})</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${vinculados.map(p => {
            const devNome = nomeDevedor(p.perfil_id);
            return `
              <div style="display:flex;align-items:flex-start;gap:12px;background:var(--card);border:1px solid var(--border);border-left:3px solid ${cores[p.cor]||'var(--muted)'};border-radius:8px;padding:12px 16px">
                <div style="flex:1">
                  ${devNome ? `<div style="font-size:11px;font-weight:600;color:var(--text);margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px">${devNome}</div>` : ''}
                  <div style="font-size:13px;color:var(--text);line-height:1.6">${p.conteudo.replace(/</g,'&lt;')}</div>
                  <div style="font-size:11px;color:var(--muted);margin-top:4px">${new Date(p.criado_em).toLocaleString('pt-BR')}</div>
                </div>
                <button class="btn btn-ghost btn-sm" style="color:var(--terra);border-color:var(--terra-bd)" onclick="deletarPostitGeral('${p.id}')">✕</button>
              </div>`;
          }).join('')}
        </div>` : ''}

      ${!postits?.length ? `<div class="empty" style="padding:48px">Nenhum post-it ainda. Crie o primeiro!</div>` : ''}
    `;
  } catch (err) {
    el.innerHTML = `<div class="alert alert-bad">Erro: ${err.message}</div>`;
  }
};

async function abrirNovoPostitGeral() {
  const { data: perfis } = await sb.from('perfis').select('id,nome_completo').order('nome_completo');

  const overlay = document.createElement('div');
  overlay.id = 'postit-geral-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(26,26,24,.6);backdrop-filter:blur(3px);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.onclick = e => { if(e.target===overlay) overlay.remove(); };
  overlay.innerHTML = `
    <div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:24px;width:100%;max-width:400px" onclick="event.stopPropagation()">
      <div class="modal-title">Novo Post-it</div>
      <div class="fg" style="margin-bottom:12px">
        <label>Anotação *</label>
        <textarea id="pg-texto" rows="4" placeholder="Escreva sua nota aqui..." style="resize:none;font-size:13px" maxlength="500"></textarea>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
        <div class="fg">
          <label>Cor</label>
          <select id="pg-cor">
            <option value="amarelo">🟡 Amarelo</option>
            <option value="verde">🟢 Verde</option>
            <option value="vermelho">🔴 Vermelho</option>
            <option value="azul">🔵 Azul</option>
            <option value="cinza">⬜ Cinza</option>
          </select>
        </div>
        <div class="fg">
          <label>Vincular a devedor</label>
          <select id="pg-devedor">
            <option value="">— Geral —</option>
            ${(perfis||[]).map(p => `<option value="${p.id}">${p.nome_completo}</option>`).join('')}
          </select>
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:flex-end">
        <button class="btn btn-ghost" onclick="document.getElementById('postit-geral-overlay').remove()">Cancelar</button>
        <button class="btn btn-dark" onclick="salvarPostitGeral()">Salvar</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => document.getElementById('pg-texto').focus(), 100);
}

async function salvarPostitGeral() {
  const conteudo  = document.getElementById('pg-texto').value.trim();
  const cor       = document.getElementById('pg-cor').value;
  const devedorId = document.getElementById('pg-devedor').value || null;
  if (!conteudo) { toast('Escreva algo.', 'err'); return; }

  const { data: { user } } = await sb.auth.getUser();
  const { error } = await sb.from('postits').insert({
    usuario_id: user.id,
    perfil_id: devedorId,
    conteudo, cor,
  });
  if (error) { toast(error.message, 'err'); return; }

  document.getElementById('postit-geral-overlay').remove();
  toast('Post-it salvo!', 'ok2');
  PAGE_RENDERS.postits();
}

async function deletarPostitGeral(id) {
  if (!confirm('Excluir este post-it?')) return;
  await sb.from('postits').delete().eq('id', id);
  toast('Post-it excluído.');
  PAGE_RENDERS.postits();
}

window.abrirNovoPostitGeral = abrirNovoPostitGeral;
window.salvarPostitGeral    = salvarPostitGeral;
window.deletarPostitGeral   = deletarPostitGeral;
