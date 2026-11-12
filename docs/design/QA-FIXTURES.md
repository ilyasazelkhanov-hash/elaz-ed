# OG: состояния для визуальной приёмки

Работает вместе с [DESIGN.md](../../DESIGN.md). Это спецификация воспроизводимых fixtures, не заявление, что все перечисленные проверки уже выполнены на каждом устройстве.

## Общие условия

- Один exact commit и production bundle. Перед/после сравниваем одинаковые данные, cue, тему и загрузку шрифтов.
- Минимум 320×700 и 390×700 CSS px, светлая/тёмная темы. Для форм и fixed controls также проверяем реальную доступную высоту и safe areas. Iframe/desktop resize не выдаём за Telegram на телефоне.
- Локальные изменяющие сценарии запускаем только через `?demo` или явно названный test harness. Фикстура загружается до boot и помечена как synthetic; не меняем скрыто runtime state через DevTools ради зелёного скриншота. Никаких реальных платежей, наград или публикаций в ходе UI QA.
- Для content fixture сохраняем его JSON, источник и hash. Prepared stories могут использоваться как локальные данные, но не публикуются этим действием.
- Сначала снимаем чистый фон без hover/focus, затем отдельный keyboard-focused кадр. Непрерывную анимацию дополнительно проверяем по нескольким фазам и паузе.

## Матрица

| ID | Данные и действие | Ожидаемый результат / доказательство |
| --- | --- | --- |
| D01 | Dots: `daily:ready`, `start`, длинный article title, строка без пробелов | Полная headline/detail/CTA, natural height. Нет page overflow на 320/390, декор не перехватывает кнопку. Before/after высота с тем же cue |
| D02 | Максимальное имя, voice off/on, keyboard focus | Имя переносится; settings/voice/speech не пересекаются; targets ≥44px. Accessible name речи содержит видимый moment/headline и действие |
| D03 | Два цикла жизни Dots без ввода; pause; settings open/close; hide/show | Motion живой до паузы, стабильный на паузе; покрытый/невидимый персонаж не расходует активные кадры; после возврата нет второго loop |
| H01 | Daily available → keyboard activation/hold → pending → confirmed | Один запрос по смыслу сценария; точные XP у аватара и claimed-state на месте reward. Повторное действие не добавляет повторную награду |
| H02 | Daily failure/timeout, повтор, stale read | Ошибка видима; retry доступен; неподтверждённая награда не превращается в claimed. Failure fixture только в mocked transport |
| H03 | Стрик 0/1/5/7, freezes 0/1/2, большой XP | Дорожка совпадает со значением, meter описан текстом, запас виден. Нет ложного обещания третьей заморозки или обрезанного числа |
| F01 | Empty, loading, error; search no matches; active topic; saved/unread; reset | Никакое состояние не исчезает за disclosure. Сброс действительно восстанавливает выборку, поиск можно очистить. Навигация в блог сохраняет фильтры |
| C01 | Course hero 320/390, несколько фаз за >7s | Курсоры, подписи, результат и pause не перекрываются. Текст и CTA не двигаются. `data-scene=play` и animation iteration не заменяют проверку реально меняющейся позиции |
| C02 | Pause → два transform readings → resume; offscreen/background | На паузе readings одинаковы, после resume меняются. Уход не оставляет активной невидимой сцены. Static composition сохраняет смысл |
| S01 | Prepared offer с текущим, истёкшим и отсутствующим review metadata | Показываются только eligible stories. Истёкшая акция не остаётся действующим предложением; непубликуемая fixture не становится public data |
| S02 | Длинный слайд: минимум 3 viewport content height; scroll до конца | Контент действительно достигает конца. Scroll/select/copy не закрывают overlay и не перелистывают его. Footer controls доступны |
| S03 | Из конца длинного слайда → next короткий → previous → close | Новый слайд имеет scrollTop 0; предыдущий/следующий корректны, close возвращает в прежний контекст. Explicit pause не теряется при смене слайда |
| S04 | Ocean/mint/candy/lime, оба theme contexts, длинная ссылка | Link виден, underline/focus сохранены, wrap без overflow; activation открывает ожидаемый URL. В расчёте контраста учитывается opacity всей цепочки. Ошибка сторонней страницы отдельно от ошибки нашего клика |
| T01 | Русский длинный текст, имя с казахскими буквами, 200% text zoom | Загружены нужные font subsets; не пропадают текст и actions. Дополнительно reflow до 320 CSS px; локальный scroll для code/table разрешён |
| T02 | Проза с `—`/`–`, fenced code, URL и technical literals | Нормализация только prose. Code/URL остаются побайтно корректны, semantic reading time не определяется шаблонной цифрой |
| A01 | Keyboard-only navigation, modal, Back/Escape, reader link | Видимый focus, предсказуемый порядок, focus restoration. Нет nested controls или pointer-only действий |
| A02 | Системный reduced motion до boot и во время работы | Декорации статичны без скрытого текста/CTA; изменение preference прекращает текущую анимацию. Не требуем от человека отключать системную настройку |

### Как проверять geometry

Измеряем `documentElement.scrollWidth` и ширину viewport, а также реальный app scroller и bounding rectangles нужных элементов. Маленький SVG overhang внутри page gutter не равен горизонтальному переполнению страницы. И наоборот, hidden body overflow не доказывает, что текст помещается.

Для курса фиксируем bounding rectangles автора, reviewer, результата и pause target. Минимальные расстояния должны оставаться положительными во всех проверяемых крайних фазах. После CSS breakpoint повторяем цикл целиком, а не только первый screenshot.

Для паузы сравниваем две позиции/transform через достаточный интервал; после resume получаем новую позицию. Если проверка использует screenshots, одинаковые картинки при закрытой/неотрисованной вкладке не доказывают корректную app-level pause.

### Команды исходных регрессий

Имена относятся к baseline 82cfcbd; сначала смотрим `package.json` проверяемой ревизии.

```sh
npm run test:companion
npm run test:home-hierarchy
npm run test:editorial-motion
npm run test:highlights
npm run test:plain-dashes
npm run test:all
```

Unit/SSR/source tests доказывают только свои assertions. Они не заменяют настоящий UI, контраст на всех фонах, screen reader, physical touch или low-end performance. Число прошедших тестов не является числом проверенных UX-состояний.

## Receipt для изменения

Заполняем коротко рядом с release/PR; не коммитим auth state, реальные personal data или browser session.

```text
Source SHA / parent:
Tested build / fixture hash:
Viewport / device / theme / font load:
Requested defect and unchanged behavior:
Fixtures exercised:
Before / after measurements:
Keyboard / reduced motion / pause:
Relevant tests / build / full suite:
Screenshot artifacts:
Known limits (local vs public, CSS width vs physical device):
Public deployment SHA and post-release smoke, if performed:
```

## Известные уроки baseline 82cfcbd

- Dots уменьшился примерно на 31% по высоте при одинаковом cue; не закрепляем это как fixed-height CSS.
- Weekly streak остаётся видимым, но не возвращает отдельный приветственный dashboard-блок.
- Course reviewer перекрывал ✓ на 320. Исправлены пространственные дорожки, не размер текста; несколько actual phases и pause/resume проверены.
- Theme-violet link терялся на ocean. Исправление ограничено story anchors и отдельным contrast regression, без изменения global theme.
- Длинная local story fixture имела 3609px scrollHeight при 542px clientHeight; дошла до scrollTop 3067 без закрытия. Следующий короткий слайд вернулся к 0. Это конкретный desktop smoke, не сертификация всех touch devices.
