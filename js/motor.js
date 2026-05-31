// js/motor.js — Motor de crédito (roda no browser, sem backend)

const Motor = {
  gerarPrice(principalCentavos, taxaMensal, prazoMeses, diaVenc = 5) {
    const i = taxaMensal / 100;
    const n = prazoMeses;
    const pmt = Math.round((principalCentavos * i) / (1 - Math.pow(1 + i, -n)));
    const hoje = new Date();
    const parcelas = [];
    let saldo = principalCentavos;

    for (let k = 1; k <= n; k++) {
      const juros  = Math.round(saldo * i);
      const amort  = k === n ? saldo : Math.min(pmt - juros, saldo);
      const venc   = new Date(hoje.getFullYear(), hoje.getMonth() + k, diaVenc);
      const ymd    = venc.toISOString().split('T')[0];
      parcelas.push({
        numero: k,
        valorTotal: amort + juros,
        principal: amort,
        juros,
        saldoDevedor: saldo - amort,
        dataVencimento: ymd,
      });
      saldo -= amort;
    }
    return parcelas;
  },

  gerarSAC(principalCentavos, taxaMensal, prazoMeses, diaVenc = 5) {
    const i = taxaMensal / 100;
    const amortFixa = Math.round(principalCentavos / prazoMeses);
    const hoje = new Date();
    const parcelas = [];
    let saldo = principalCentavos;

    for (let k = 1; k <= prazoMeses; k++) {
      const amort = k === prazoMeses ? saldo : amortFixa;
      const juros = Math.round(saldo * i);
      const venc  = new Date(hoje.getFullYear(), hoje.getMonth() + k, diaVenc);
      const ymd   = venc.toISOString().split('T')[0];
      parcelas.push({
        numero: k,
        valorTotal: amort + juros,
        principal: amort,
        juros,
        saldoDevedor: saldo - amort,
        dataVencimento: ymd,
      });
      saldo -= amort;
    }
    return parcelas;
  },

  calcIOF(valorCentavos, prazoMeses) {
    const dias = Math.min(prazoMeses * 30, 365);
    return Math.round(valorCentavos * 0.0038) + Math.round(valorCentavos * 0.000082 * dias);
  },

  resumo(parcelas) {
    const total  = parcelas.reduce((a, p) => a + p.valorTotal, 0);
    const juros  = parcelas.reduce((a, p) => a + p.juros, 0);
    return { total, juros };
  },
};

window.Motor = Motor;
