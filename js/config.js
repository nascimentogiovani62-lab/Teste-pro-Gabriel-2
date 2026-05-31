// js/config.js
const SUPA_URL = 'https://ocyuygnlxduaopsgvdui.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jeXV5Z25seGR1YW9wc2d2ZHVpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxNzMzNTcsImV4cCI6MjA5NTc0OTM1N30.J5hMDxQ6pU4_QZWErH_N8fyZn06WPXuuYqYiy5k1_-Y';

// Inicializa cliente Supabase (SDK carregado no index.html)
const sb = window.supabase.createClient(SUPA_URL, SUPA_KEY);

// Regras do motor de crédito (ajuste conforme sua política)
const CREDITO = {
  MULTA_PCT:     2,      // % flat ao atrasar
  MORA_MENSAL:   1,      // % ao mês sobre o valor
};

window.sb      = sb;
window.CREDITO = CREDITO;
