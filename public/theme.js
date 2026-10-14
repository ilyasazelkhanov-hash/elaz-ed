// Тему ставим до первой отрисовки, чтобы экран не мигал чужим цветом.
;(function () {
  try {
    var saved = localStorage.getItem('elaz-ed-theme')
    var wa = window.Telegram && window.Telegram.WebApp
    var auto = wa && wa.initData && wa.colorScheme ? wa.colorScheme : matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
    document.documentElement.dataset.theme = saved === 'light' || saved === 'dark' ? saved : auto
  } catch (e) {}
})()
