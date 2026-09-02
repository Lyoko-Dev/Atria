(function () {
  function array(value) { return Array.isArray(value) ? value : []; }
  function number(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
  function transaction(input, fallbackAlterId) {
    const t = input || {};
    return {
      id: String(t.id || ''), type: t.type === 'gasto' ? 'gasto' : 'ingreso',
      description: String(t.description || ''), amount: number(t.amount),
      date: String(t.date || ''), category: String(t.category || '_sin'),
      account: String(t.account || ''), source: String(t.source || ''),
      recur: t.recur || 'none', note: String(t.note || ''),
      alterId: t.alterId || fallbackAlterId || null,
      _recurOrigin: t._recurOrigin || null, _recurAuto: !!t._recurAuto,
    };
  }
  function create(load, save, alterId) {
    const read = (section, fallback) => array(load(section, fallback));
    return {
      transactions() { return read('transactions', []).map(t => transaction(t, alterId)); },
      saveTransactions(list) { save('transactions', array(list).map(t => transaction(t, alterId))); },
      budgets() { return read('presupuestos', []).map(p => ({ ...p, limit: number(p.limit) })); },
      saveBudgets(list) { save('presupuestos', array(list)); },
      savings() { return read('ahorros', []).map(a => ({ ...a, current: number(a.current), target: number(a.target) })); },
      saveSavings(list) { save('ahorros', array(list)); },
      categories(fallback) { return read('categories', fallback); },
      recurringRules() {
        const rules = new Map();
        this.transactions().filter(t => t.recur !== 'none' && t._recurOrigin).forEach(t => {
          if (!rules.has(t._recurOrigin)) rules.set(t._recurOrigin, {
            id: t._recurOrigin, transactionId: t.id, frequency: t.recur,
            startDate: t.date, type: t.type, description: t.description,
            amount: t.amount, category: t.category, note: t.note,
          });
        });
        return [...rules.values()];
      },
    };
  }
  window.AtriaFinanceStore = { create, normalizeTransaction: transaction };
})();
