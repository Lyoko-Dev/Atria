(function () {
  const RECURRENCE_LABELS = {
    es: {
      none: 'Sin repeticion',
      daily: 'Diario',
      weekly: 'Semanal',
      monthly: 'Mensual',
      yearly: 'Anual',
    },
    en: {
      none: 'No repeat',
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      yearly: 'Yearly',
    },
  };

  function getTransactionRecurrenceOptions(lang) {
    const labels = RECURRENCE_LABELS[lang] || RECURRENCE_LABELS.en;
    return ['none', 'daily', 'weekly', 'monthly', 'yearly'].map(id => ({
      id,
      label: labels[id],
    }));
  }

  function advanceDateByRecurrence(date, recur) {
    if (recur === 'daily') date.setDate(date.getDate() + 1);
    else if (recur === 'weekly') date.setDate(date.getDate() + 7);
    else if (recur === 'monthly') date.setMonth(date.getMonth() + 1);
    else if (recur === 'yearly') date.setFullYear(date.getFullYear() + 1);
    else return false;
    return true;
  }

  function processRecurringTransactions({ load, save, uid }) {
    const today = new Date().toISOString().slice(0,10);
    const txs = load('transactions');
    const recurring = txs.filter(t => t.recur && t.recur !== 'none' && t._recurOrigin);
    let added = 0;
    recurring.forEach(origin => {
      let cur = new Date(origin.date);
      const toDate = new Date(today);
      let safety = 0;
      while (safety++ < 500) {
        if (!advanceDateByRecurrence(cur, origin.recur)) break;
        if (cur > toDate) break;
        const isoDate = cur.toISOString().slice(0,10);
        const exists = txs.some(t => t._recurOrigin === origin._recurOrigin && t.date === isoDate);
        if (!exists) {
          txs.push({
            id: uid(),
            type: origin.type,
            description: origin.description,
            amount: origin.amount,
            date: isoDate,
            category: origin.category,
            recur: origin.recur,
            note: origin.note,
            alterId: origin.alterId,
            _recurOrigin: origin._recurOrigin,
            _recurAuto: true,
          });
          added++;
        }
      }
    });
    if (added > 0) save('transactions', txs);
    return added;
  }

  window.AtriaFinanceRecurring = {
    getTransactionRecurrenceOptions,
    processRecurringTransactions,
  };
})();
