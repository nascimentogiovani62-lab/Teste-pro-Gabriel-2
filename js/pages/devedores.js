// js/pages/devedores.js
PAGE_RENDERS.devedores = async function renderDevedores() {
  const el = document.getElementById('devedores-content');
  el.innerHTML = `<div style="padding:40px;display:flex;align-items:center;gap:10px;color:var(--muted)"><div class="spinner"></div> Carregando...</div>`;

  try {
    const { data: perfis } = await sb.from('perfis').select('*').order('nome_completo');

    el.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px">
        <div class="shead" style="margin:0">Devedores Cadastrados</div>
        <button class="btn btn-r" onclick="openMod('novo-devedor')">+ Novo Devedor</button>
      </div>
      <div class="twrap">
        <table class="ttable">
          <thead><tr>
            <th>Nome</th><th>CPF</th><th>Telefone</th><th>Renda</th><th>Score</th><th></th>
          </tr></thead>
          <tbody id="devedores-tbody">
            ${(perfis || []).map(p => `
              <tr>
                <td><b>${p.nome_completo}</b></td>
                <td style="color:var(--muted);font-size:.72rem">${p.cpf_hash ? '***.***.***-**' : '—'}</td>
                <td>${p.telefone || '—'}</td>
                <td>${p.renda_declarada_centavos ? fmt(p.renda_declarada_centavos) : '—'}</td>
                <td>${p.score_bureau ? `<span class="tag ${p.score_bureau >= 700 ? 'tag-ok' : p.score_bureau >= 500 ? 'tag-warn' : 'tag-bad'}">${p.score_bureau}</span>` : '—'}</td>
                <td style="display:flex;gap:6px">
                  <button class="btn btn-g" style="padding:3px 9px;font-size:.68rem" onclick="editarDevedor('${p.id}')">✏️</button>
                  <button class="btn btn-r" style="padding:3px 9px;font-size:.68rem" onclick="goPage('emprestimos');filtrarPorDevedor('${p.id}')">Empréstimos</button>
                </td>
              </tr>`).join('') || `<tr><td colspan="6" class="empty">Nenhum devedor cadastrado.</td></tr>`}
          </tbody>
        </table>
      </div>
    `;
  } catch (err) {
    el.innerHTML = `<div class="alert alert-bad">Erro: ${err.message}</div>`;
  }
};

async function salvarDevedor() {
  const nome  = document.getElementById('dev-nome').value.trim();
  const tel   = document.getElementById('dev-tel').value.trim();
  const renda = parseFloat(document.getElementById('dev-renda').value) || 0;
  const score = parseInt(document.getElementById('dev-score').value) || null;
  const id    = document.getElementById('dev-id').value;

  if (!nome) { toast('Nome é obrigatório.', 'err'); return; }

  const dados = {
    nome_completo: nome,
    telefone: tel || null,
    renda_declarada_centavos: renda ? Math.round(renda * 100) : null,
    score_bureau: score,
    ativo: true,
  };

  let erro;
  if (id) {
    ({ error: erro } = await sb.from('perfis').update(dados).eq('id', id));
  } else {
    ({ error: erro } = await sb.from('perfis').insert({ ...dados, id: crypto.randomUUID() }));
  }

  if (erro) { toast(erro.message, 'err'); return; }
  toast(id ? 'Devedor atualizado!' : 'Devedor cadastrado!');
  closeMod('novo-devedor');
  PAGE_RENDERS.devedores();
}

async function editarDevedor(id) {
  const { data } = await sb.from('perfis').select('*').eq('id', id).single();
  if (!data) return;
  document.getElementById('dev-id').value    = data.id;
  document.getElementById('dev-nome').value  = data.nome_completo || '';
  document.getElementById('dev-tel').value   = data.telefone || '';
  document.getElementById('dev-renda').value = data.renda_declarada_centavos ? (data.renda_declarada_centavos / 100).toFixed(2) : '';
  document.getElementById('dev-score').value = data.score_bureau || '';
  document.getElementById('mod-novo-devedor-titulo').textContent = 'Editar Devedor';
  openMod('novo-devedor');
}

function novoDevedor() {
  document.getElementById('dev-id').value    = '';
  document.getElementById('dev-nome').value  = '';
  document.getElementById('dev-tel').value   = '';
  document.getElementById('dev-renda').value = '';
  document.getElementById('dev-score').value = '';
  document.getElementById('mod-novo-devedor-titulo').textContent = 'Novo Devedor';
  openMod('novo-devedor');
}

window.salvarDevedor = salvarDevedor;
window.editarDevedor = editarDevedor;
window.novoDevedor   = novoDevedor;
