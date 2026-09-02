(function () {
  const DAY = 86400000;
  function date(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d; }
  function inPeriod(t, month, year) { const d = date(t.date); return !!d && d.getMonth()+1 === month && d.getFullYear() === year; }
  function filterTransactions(list, options = {}) {
    return list.filter(t => (!options.month || inPeriod(t, options.month, options.year)) && (!options.type || options.type === 'all' || t.type === options.type) && (!options.category || options.category === 'all' || t.category === options.category) && (!options.account || options.account === 'all' || t.account === options.account) && (!options.source || options.source === 'all' || t.source === options.source) && (!options.alterId || t.alterId === options.alterId)).sort((a,b) => new Date(b.date) - new Date(a.date));
  }
  function summarize(list) {
    const income = list.filter(t => t.type === 'ingreso').reduce((s,t) => s + Number(t.amount || 0), 0);
    const expense = list.filter(t => t.type === 'gasto').reduce((s,t) => s + Number(t.amount || 0), 0);
    return { income, expense, balance: income - expense, count: list.length };
  }
  function updateTransaction(list, id, patch, scope = 'one') {
    const current = list.find(t => t.id === id);
    if (!current) return list;
    const origin = current._recurOrigin;
    const currentTime = new Date(current.date).getTime();
    return list.map(t => {
      const sameSeries = origin && t._recurOrigin === origin;
      const applies = scope === 'series' ? sameSeries : scope === 'future' ? sameSeries && new Date(t.date).getTime() >= currentTime : t.id === id;
      if (!applies) return t;
      // Las ocurrencias conservan su propia fecha al editar una serie.
      const scopedPatch = scope !== 'one' && t.id !== id && Object.prototype.hasOwnProperty.call(patch, 'date')
        ? (() => { const copy = { ...patch }; delete copy.date; return copy; })()
        : patch;
      return { ...t, ...scopedPatch };
    });
  }
  function duplicateTransaction(list, source, uid) {
    const copy = { ...source, id: uid(), description: `${source.description} (copy)`, date: new Date().toISOString().slice(0,10), _recurOrigin: null, _recurAuto: false, recur: 'none' };
    return [...list, copy];
  }
  function budgetProgress(budgets, transactions, month, year) {
    return budgets.map(budget => {
      const scoped = transactions.filter(t => t.type === 'gasto' && t.category === budget.categoryId && (() => { const d = date(t.date); return d && d.getFullYear() === year && (budget.period === 'yearly' || d.getMonth()+1 === month); })());
      const used = summarize(scoped).expense;
      const limit = Number(budget.limit || 0);
      return { ...budget, used, remaining: limit - used, percent: limit ? Math.min(100, Math.round(used / limit * 100)) : 0 };
    });
  }
  function savingsProgress(savings) { return savings.map(item => ({ ...item, percent: item.target ? Math.min(100, Math.round(item.current / item.target * 100)) : 0 })); }
  function formatAmount(value, currency = 'EUR', locale = 'en-GB') { return new Intl.NumberFormat(locale, { style:'currency', currency }).format(Number(value || 0)); }
  window.AtriaFinanceService = { DAY, filterTransactions, summarize, updateTransaction, duplicateTransaction, budgetProgress, savingsProgress, formatAmount };
})();
