// js/auth.js
async function doLogin() {
  const email = document.getElementById('auth-email').value.trim();
  const senha  = document.getElementById('auth-pass').value;
  const btn    = document.getElementById('auth-btn');
  const msg    = document.getElementById('auth-msg');

  if (!email || !senha) {
    msg.textContent = 'Preencha e-mail e senha.';
    msg.className = 'auth-msg err'; return;
  }
  btn.disabled = true; btn.textContent = 'Entrando…'; msg.textContent = '';

  const { data, error } = await sb.auth.signInWithPassword({ email, password: senha });
  if (error) {
    msg.textContent = 'E-mail ou senha incorretos.';
    msg.className = 'auth-msg err';
    btn.disabled = false; btn.textContent = 'Entrar'; return;
  }
  iniciarApp(data.user);
}

async function doLogout() {
  await sb.auth.signOut();
  document.getElementById('app').classList.remove('show');
  document.getElementById('mob-header').style.display = 'none';
  document.getElementById('auth-screen').classList.add('show');
  document.getElementById('auth-email').value = '';
  document.getElementById('auth-pass').value  = '';
  document.getElementById('auth-msg').textContent = '';
  document.getElementById('auth-btn').textContent = 'Entrar';
  document.getElementById('auth-btn').disabled = false;
}

(async function verificarSessao() {
  const { data: { session } } = await sb.auth.getSession();
  if (session?.user) {
    iniciarApp(session.user);
  } else {
    document.getElementById('auth-screen').classList.add('show');
  }
})();

window.doLogin  = doLogin;
window.doLogout = doLogout;
