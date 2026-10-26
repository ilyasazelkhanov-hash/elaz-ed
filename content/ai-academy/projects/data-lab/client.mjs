const status = document.getElementById('kpis')
const select = document.getElementById('channel')
try {
  const response = await fetch('report.json')
  if (!response.ok) throw Error('report_unavailable')
  const data = await response.json()
  if (!Array.isArray(data.rows) || !Array.isArray(data.rejected)) throw Error('report_invalid')
  document.getElementById('cleaning').textContent = `Принято заказов: ${data.rows.length}; исходных строк исключено: ${data.rejected.length}.`
  function render() {
    const rows = data.rows.filter(row => select.value === 'all' || row.channel === select.value)
    const revenue = rows.reduce((sum, row) => sum + row.total_kzt, 0)
    const late = rows.filter(row => row.actual_days > row.promised_days).length
    status.textContent = `Заказов: ${rows.length}. Выручка: ${revenue} ₸. Средний чек: ${rows.length ? (revenue / rows.length).toFixed(2) : 'нет данных'} ₸. Доля задержек: ${rows.length ? (late / rows.length * 100).toFixed(1) : 'нет данных'}%.`
    document.getElementById('rows').replaceChildren(...rows.map(row => {
      const tr = document.createElement('tr')
      for (const value of [row.order_id, row.total_kzt, row.channel, row.actual_days > row.promised_days ? 'да' : 'нет']) {
        const td = document.createElement('td')
        td.textContent = String(value)
        tr.append(td)
      }
      return tr
    }))
  }
  select.onchange = render
  render()
} catch {
  select.disabled = true
  status.setAttribute('role', 'alert')
  status.textContent = 'Не удалось открыть учебный отчёт. Обновите страницу; если файл отсутствует, восстановите его из архива или пересоберите по README.'
}
