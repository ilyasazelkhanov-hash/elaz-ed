# Elaz Ed — «Команда открывает праздник»

Remotion-проект демо-ролика `ElazEdEmployeesDemo` для HR и внутренних коммуникаций:
60 с, 1080×1920, 30 fps. Сценарий, точный текст диктора, таблица таймингов и звуковые метки — в [docs/SCRIPT.md](docs/SCRIPT.md).

## Устройство

```
src/
  Root.tsx                      композиция ElazEdEmployeesDemo
  employees/
    timeline.ts                 длительности сцен, надписи, реплики диктора
    props.ts                    параметры: компания, палитра, люди, задания, приз, звук, контакт
    sound.ts                    звуковые метки по сценам
    style.ts                    цвета ролика, безопасная зона, помощники анимации
    fonts.ts                    Onest и Unbounded из public/fonts
    ElazEdEmployeesDemo.tsx     фон, сцены через <Sequence>, музыка, голос, эффекты
    ui/                         фон со снегом, гирлянда, коробка, окно мини-аппа, подписи
    scenes/                     8 сцен — по компоненту на сцену
scripts/
  make-audio.mjs                синтез музыки и UI-звуков → public/audio
  stills.mjs                    контрольные кадры и прогон всех кадров → out/check
```

Анимация считается только от кадра (`useCurrentFrame`, `interpolate`, `spring`), снег, гирлянды, искры и игровые
предметы — от фиксированных seed через `random()`. Данные экранов зашиты в параметры: ни базы, ни Telegram, ни аккаунтов.

## Команды

```bash
npm install
npm run dev       # Remotion Studio
npm run stills    # проверка: out/check/keys (24 кадра), out/check/all (все 1800), out/check/sheet.html
npm run render    # MP4 — по отдельному запросу
```
