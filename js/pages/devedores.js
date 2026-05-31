// js/pages/devedores.js
PAGE_RENDERS.devedores = async function() {
  const el = document.getElementById('devedores-content');
  el.innerHTML = `<div class="loading-wrap"><div class="spinner"></div> Carregando…</div>`;

  try {
    const { data: perfis } = await sb.from('perfis').select('*').order('nome_completo');

    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
        <div style="font-size:13px;color:var(--muted)">${(perfis||[]).length} devedor${(perfis||[]).length !== 1 ? 'es' : ''} cadastrado${(perfis||[]).length !== 1 ? 's' : ''}</div>
        <button class="btn btn-dark btn-sm" onclick="novoDevedor()">+ Novo Devedor</button>
      </div>

      <div class="twrap">
        <table class="ttable">
          <thead><tr><th>Nome</th><th>Telefone</th><th>Renda</th><th>Observação</th><th></th></tr></thead>
          <tbody>
            ${(perfis||[]).map(p => `
              <tr>
                <td>
                  <b>${p.nome_completo}</b>
                  ${!p.ativo ? '<span class="tag tag-bad" style="margin-left:6px">Inativo</span>' : ''}
                </td>
                <td style="color:var(--muted)">${p.telefone || '—'}</td>
                <td style="font-family:var(--mono);font-size:12px">${p.renda_declarada_centavos ? fmt(p.renda_declarada_centavos) : '—'}</td>
                <td style="color:var(--muted);font-size:12px">${p.cpf_hash || '—'}</td>
                <td style="display:flex;gap:6px">
                  <button class="btn btn-ghost btn-sm" onclick="editarDevedor('${p.id}')">Editar</button>
                  <button class="btn btn-ghost btn-sm" onclick="window._filtroDevedor='${p.id}';goPage('emprestimos')">Empréstimos →</button>
                </td>
              </tr>`).join('') || `<tr><td colspan="5" class="empty">Nenhum devedor cadastrado ainda.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="alert alert-bad">Erro: ${err.message}</div>`;
  }
};

function novoDevedor() {
  document.getElementById('dev-id').value    = '';
  document.getElementById('dev-nome').value  = '';
  document.getElementById('dev-tel').value   = '';
  document.getElementById('dev-renda').value = '';
  document.getElementById('dev-obs').value   = '';
  document.getElementById('mod-dev-titulo').textContent = 'Novo Devedor';
  openMod('novo-devedor');
}

async function editarDevedor(id) {
  const { data } = await sb.from('perfis').select('*').eq('id', id).single();
  if (!data) return;
  document.getElementById('dev-id').value    = data.id;
  document.getElementById('dev-nome').value  = data.nome_completo || '';
  document.getElementById('dev-tel').value   = data.telefone || '';
  document.getElementById('dev-renda').value = data.renda_declarada_centavos ? (data.renda_declarada_centavos / 100).toFixed(2) : '';
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
    nome_completo:            nome,
    telefone:                 tel || null,
    renda_declarada_centavos: renda ? Math.round(renda * 100) : null,
    cpf_hash:                 obs || null, // usando cpf_hash como campo de obs por ora
    ativo:                    true,
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

window.novoDevedor    = novoDevedor;
window.editarDevedor  = editarDevedor;
window.salvarDevedor  = salvarDevedor;
