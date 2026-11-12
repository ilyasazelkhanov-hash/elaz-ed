# Dots Plush: настоящее растровое тельце вместо геометрии

## Почему изменили подход

Пользователь отверг геометрический/пластиковый вид, попросил плавное полноценное тельце с лёгким пушком и изучение OpenAI Dots. В прошлой проверочной среде WebGL был отключён: увеличение полигонов не изменило бы увиденный SVG. Поэтому новый основной вид вообще не зависит от GPU или Three.js. Удалены прежние renderer, rig и SVG-персонаж; возвращения к прежней фигуре при отсутствии WebGL нет.

## Проверенные визуальные источники

- [Официальный анонс OpenAI Dots](https://openai.com/index/introducing-dots/): фактически просмотрены art-card и кадры introduction animation.
- [Официальная документация Dots](https://learn.chatgpt.com/docs/dots): просмотрены опубликованные портреты Felipe, Alfred, Iggy и Todd.
- Общие визуальные признаки: цельный плавный силуэт, плотный короткий ворс по поверхности и краю, маленькие простые чёрные глаза, мягкий рассеянный свет, один выразительный аксессуар. Официальная анимация не доказывает наличие конкретных tap/tilt механик в OpenAI; наши взаимодействия разработаны отдельно.
- Пользовательские картинки OpenDots/CopilotKit и LumaDock остаются сторонним moodboard, не названы официальными источниками.

## Собственный персонаж OG CRE8R

Все три атласа созданы встроенным **image_gen**, не скачаны у OpenAI. Это оригинальный лавандовый микроплюшевый спутник с интегрированными ручками и двумя маленькими ступнями. На каждом атласе шесть согласованных поз: спокойный, моргание, радость, подмигивание, удивление, приветственный жест. Три варианта силуэта: мягкий боб, кругляш и органичная искра с изогнутым хохолком. Не используется логотип OpenAI или имена его персонажей.

Файлы: `public/companion/plush-{soft,round,spark}-v1.webp`. Исходный RGBA размер 1536×1024; шесть квадратных ячеек 512×512. Сохранена настоящая альфа с ворсом, фон не замаскирован круглой плашкой. Выполнена только производственная WebP-компрессия изображения, не замена нарисованного содержания кодовой текстурой. Выбранный атлас загружается один раз, остальные формы только при их выборе. Итоговые размеры и хеши находятся в `public/companion/provenance.json`.

## Генерационные инструкции

Базовый prompt: original premium tactile lilac learning-app companion, complete smoothly rounded asymmetric pear/bean body with integrated small soft arms and feet; short dense micro-fur / peach-fuzz velvet, small glossy black oval eyes and restrained smile; soft warm studio key light and cool fill; 3×2 transparent sprite atlas, six consistent poses at identical scale and baseline; no text, logos, geometric facets, plastic, giant cartoon eyes or branded character copy.

Round edit: preserve atlas, identity, fur, lighting, expressions and placement; change only silhouette to a distinctly rounder, slightly wider and shorter organic plush body.

Spark edit: preserve atlas and identity; change only silhouette to an organic upright droplet with a gently curved integrated tuft. No pointed polygon, sharp star, horns or detached sphere.

Spark alpha correction: preserve every character and cell; remove all backdrop/haze between characters and at cell corners, preserve natural fur edge and a small contact shadow.

## Движение и совместимость

- Дыхание и мягкий отклик на касание разделены на слои. Движение ограничено несколькими пикселями, не меняет высоту блока и не мешает чтению.
- Моргание использует настоящий закрытый кадр атласа. Таймер выключается, когда персонаж скрыт, перекрыт, анимации выключены или действует reduced-motion.
- Наклон/взгляд делается мягким 2.5D-поворотом слоя. Это растровая анимация, не заявление о настоящем вращении 3D-модели.
- Сохранены имя, четыре цвета, три формы, аксессуары, лампа в сцене, ручное чтение, opt-in датчики и реальные CTA. Декоративные аксессуары накладываются отдельным небольшим слоем, лицо и тельце остаются изображением.
- Ошибка выбранного файла даёт один локальный запасной атлас. Если ни один не загрузился, действия остаются работоспособными. Поздние load/error от предыдущей формы игнорируются.
- Никаких новых запросов разрешений, автоматического голоса, чтения яркости/аппаратного mute или включения камеры/физического фонарика.

## Проверки и честные границы

Новый `dots-scene.test.mjs` проверяет кадры, таймеры, остановку, гонки картинок, локальные WebP с альфой и лимитом размера, все 48 сочетаний предпочтений, отсутствие зависимости от WebGL и обрезки speech bubble. Device/motion тесты сохранены.

Статические исходные изображения и прозрачность просмотрены. Финальные фактические browser QA и release identity фиксируются отдельно после развёртывания. 320/390px, системный reduced-motion и реальные датчики нельзя считать проверенными только по исходникам или по desktop-кадру.
