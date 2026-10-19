import type { Entity, EntityKind, ModuleId, PresetId, Data } from '../src/platform/contracts.ts'

const make = (
  id: string,
  kind: EntityKind,
  module: ModuleId,
  title: string,
  subtitle: string,
  data: Data = {},
  rest: Partial<Entity> = {},
): Entity => ({
  id,
  kind,
  module,
  title,
  subtitle,
  body: subtitle,
  tag: 'ДЛЯ ВАС',
  cover: 'orbit',
  published: true,
  publishAt: null,
  audience: 'all',
  price: 0,
  capacity: null,
  data,
  ...rest,
})
export function buildCatalog(preset: PresetId = 'club', brandName = 'Azelkhanov'): Entity[] {
  const future = (days: number, hour = 13, minute = 30) => {
    const date = new Date(Date.now() + days * 86400000)
    date.setUTCHours(hour, minute, 0, 0)
    return date.toISOString()
  }
  const start = (daysAgo: number) => new Date(Date.now() - daysAgo * 86400000).toISOString()
  const end = (daysAhead: number) => new Date(Date.now() + daysAhead * 86400000).toISOString()
  const team = preset === 'team',
    academy = preset === 'academy',
    service = preset === 'services'
  const catalog: Entity[] = [
    make(
      'story-welcome',
      'story',
      'content',
      'Место, где вы — свои',
      'Знакомимся с вашим новым пространством',
      {
        slides: [
          {
            title: 'Вы здесь не случайно.',
            body: 'Здесь встречаются любопытные люди, хорошие идеи и маленькие поводы улыбнуться.',
            art: 'orbit',
          },
          {
            title: 'Действуйте. Открывайте. Растите.',
            body: 'Пройдите задание, загляните на встречу, поделитесь идеей — за каждое действие получайте прогресс.',
            art: 'star',
          },
          {
            title: 'Лучшее — впереди.',
            body: 'Забирайте привилегии, собирайте впечатления и создавайте свою историю вместе с нами.',
            art: 'gift',
          },
        ],
      },
      { cover: 'cobalt', tag: 'НАЧНИТЕ ЗДЕСЬ' },
    ),
    make(
      'story-week',
      'story',
      'content',
      'Планы на неделю',
      'Три хороших повода зайти',
      {
        slides: [
          {
            title: 'Ваша новая традиция',
            body: 'Каждый день — небольшое открытие. Сегодня начните с задания дня.',
            art: 'star',
          },
          { title: 'Встретимся?', body: 'В афише появились новые встречи. Количество мест ограничено.', art: 'orbit' },
        ],
      },
      { cover: 'lime' },
    ),
    make(
      'story-people',
      'story',
      'content',
      'Люди клуба',
      'Истории тех, кто рядом',
      {
        slides: [
          {
            title: 'У каждого — своя история.',
            body: 'Расскажите в сообществе, что вас вдохновляет. Возможно, именно ваша идея объединит нас завтра.',
            art: 'flower',
          },
        ],
      },
      { cover: 'peach' },
    ),
    make(
      'story-gifts',
      'story',
      'content',
      'Маленькие радости',
      'Что можно получить за баллы',
      {
        slides: [
          {
            title: 'Хорошее возвращается.',
            body: 'За участие вы получаете баллы. Обменивайте их на подарки и сохраняйте купоны в профиле.',
            art: 'gift',
          },
        ],
      },
      { cover: 'lilac' },
    ),
    make(
      'article-slow',
      'article',
      'content',
      team
        ? 'Большие идеи начинаются с разговора'
        : academy
          ? 'Как превратить идею в первый результат'
          : 'Искусство замечать хорошее',
      'Пять маленьких привычек, которые делают обычный день особенным.',
      {},
      {
        tag: 'ОБРАЗ ЖИЗНИ',
        cover: 'flower',
        body: '## Внимание — новая привилегия\n\nИногда достаточно замедлиться, чтобы заметить то, что уже рядом: приятный разговор, новый маршрут или вкус любимого напитка.\n\n### Попробуйте сегодня\n\n1. Пройдите привычный путь по новой улице.\n2. Напишите человеку, с которым давно не общались.\n3. Сохраните одну хорошую идею и сделайте первый шаг.\n\nБольшие перемены начинаются с небольших действий. Поделитесь своим открытием в сообществе.',
      },
    ),
    make(
      'article-guide',
      'article',
      'content',
      'Ваш гид по клубным привилегиям',
      'Баллы, впечатления и подарки: как всё устроено.',
      {},
      {
        tag: 'ГИД ПО КЛУБУ',
        cover: 'gift',
        body: '## Каждый шаг имеет значение\n\nОткрывайте задания, посещайте встречи и участвуйте в жизни сообщества. За проверенные действия начисляются баллы.\n\n**XP** показывает ваш прогресс. **Баллы** можно обменять на подарки. Это разные счётчики.\n\nПодарок появится в вашем кошельке. Покажите код сотруднику — он подтвердит получение. У каждого купона есть срок действия.',
      },
    ),
    make(
      'article-story',
      'article',
      'content',
      'Люди, которые создают атмосферу',
      'Знакомимся с теми, кто делает привычное необычным.',
      {},
      {
        tag: 'ЛЮДИ',
        cover: 'peach',
        body: '## Пространство начинается с людей\n\nНам нравятся люди, которым не всё равно. Которые придумывают, пробуют, делятся и помогают другим расти.\n\nРасскажите о себе в разделе «Сообщество»: чем вы занимаетесь и какую идею хотите воплотить?',
      },
    ),
    make(
      'course-first',
      'course',
      'learning',
      academy ? 'От идеи до первого проекта' : 'Навык видеть возможности',
      'Три коротких урока, одно новое начало.',
      { lessonIds: ['lesson-1', 'lesson-2', 'lesson-3'], stars: 0 },
      {
        cover: 'orbit',
        tag: 'БЕСПЛАТНЫЙ КУРС',
        body: 'Программа из трёх коротких уроков: найдите идею, превратите её в план и сделайте первый шаг. После прохождения — именной сертификат.',
      },
    ),
    make(
      'course-pro',
      'course',
      'learning',
      'Творческая практика PRO',
      'Переходите от вдохновения к системе.',
      { lessonIds: ['lesson-pro'], stars: 250 },
      {
        price: 250,
        cover: 'lilac',
        tag: 'УГЛУБЛЁННЫЙ КУРС',
        body: 'Закрытая программа с практикой, проверкой наставником и обратной связью.',
      },
    ),
    make(
      'lesson-1',
      'lesson',
      'learning',
      '01. Замечать возможности',
      'Идея ближе, чем кажется.',
      {
        courseId: 'course-first',
        order: 1,
        dripDays: 0,
        xp: 40,
        questions: [
          {
            question: 'С чего лучше начать новый проект?',
            options: ['С небольшой проверяемой идеи', 'С покупки всех инструментов', 'С идеального логотипа'],
            correct: 0,
            explain: 'Маленький проверяемый шаг помогает получить обратную связь раньше.',
          },
        ],
      },
      {
        tag: 'УРОК · 4 МИН',
        cover: 'lime',
        body: '## Большие идеи вырастают из наблюдений\n\nОбратите внимание на то, что люди делают каждый день. Где им неудобно? Что радует? Что они хотели бы изменить?\n\nЗапишите три наблюдения. Выберите одно, которое можете проверить за день.\n\n**Практика:** опишите свою идею одним предложением и отправьте её наставнику.',
      },
    ),
    make(
      'lesson-2',
      'lesson',
      'learning',
      '02. Первый прототип',
      'Покажите идею миру.',
      {
        courseId: 'course-first',
        order: 2,
        dripDays: 0,
        xp: 50,
        questions: [
          {
            question: 'Зачем нужен прототип?',
            options: [
              'Чтобы сразу продавать дорого',
              'Чтобы быстро проверить предположение',
              'Чтобы заменить разговор с пользователем',
            ],
            correct: 1,
            explain: 'Прототип отвечает на конкретный вопрос, а не доказывает совершенство идеи.',
          },
        ],
      },
      {
        tag: 'УРОК · 6 МИН',
        cover: 'cobalt',
        body: '## Сделайте идею видимой\n\nПервый прототип может быть схемой, бумажным макетом или простым интерактивным экраном.\n\nПокажите его одному человеку. Спросите: что понятно, что вызывает вопросы, что хочется попробовать?',
      },
    ),
    make(
      'lesson-3',
      'lesson',
      'learning',
      '03. От проверки к привычке',
      'Маленькие действия дают большие результаты.',
      {
        courseId: 'course-first',
        order: 3,
        dripDays: 0,
        xp: 60,
        questions: [
          {
            question: 'Что помогает продолжать?',
            options: ['Ждать вдохновения', 'Делать небольшой шаг регулярно', 'Не показывать результат до идеала'],
            correct: 1,
            explain: 'Регулярная практика превращает отдельные попытки в навык.',
          },
        ],
      },
      {
        tag: 'УРОК · 5 МИН',
        cover: 'peach',
        body: '## Регулярность важнее рывка\n\nВыберите понятный ритм: один шаг каждый день. В конце недели посмотрите, чему научились.\n\nПоблагодарите тех, кто помогал. И начните следующий цикл.',
      },
    ),
    make(
      'lesson-pro',
      'lesson',
      'learning',
      'Система творческого роста',
      'Соберите личную систему практики.',
      { courseId: 'course-pro', order: 1, dripDays: 0, xp: 80, questions: [] },
      {
        cover: 'lilac',
        body: '## Ваш следующий уровень\n\nВыберите проект на месяц. Разделите его на четыре недельные цели. Для каждой определите маленький измеримый результат.',
      },
    ),
    make(
      'campaign-october',
      'campaign',
      'campaigns',
      team ? 'Сильнее вместе' : academy ? '14 дней новых идей' : 'Сезон маленьких радостей',
      'Открывайте новое каждый день. Соберите свою историю.',
      { startsAt: start(16), endsAt: end(7), days: 24, game: 'mixed' },
      {
        tag: 'НОВЫЙ СЕЗОН',
        cover: 'lime',
        body: '24 открытия, задания и подарки. Сегодня — идеальный день, чтобы начать. Пропущенные задания остаются доступны до конца сезона.',
      },
    ),
    make(
      'campaign-weekend',
      'campaign',
      'campaigns',
      'Выходные с характером',
      'Три дня для себя, друзей и новых впечатлений.',
      { startsAt: start(1), endsAt: end(1), days: 3, game: 'memory' },
      { tag: 'СПЕЦПРОЕКТ', cover: 'peach' },
    ),
    ...(['quiz', 'scratch', 'wheel', 'memory', 'reaction', 'arcade'] as const).map((game, i) =>
      make(
        `mission-${game}`,
        'mission',
        'campaigns',
        [
          'Вопрос с изюминкой',
          'Сотрите границы',
          'Колесо впечатлений',
          'Найдите пару',
          'Поймайте момент',
          'Поймайте настроение',
        ][i],
        [
          'Проверьте интуицию за минуту',
          'Ваш сюрприз под защитным слоем',
          'Один поворот — новое открытие',
          'Небольшая тренировка внимания',
          'На старт. Внимание. Сейчас!',
          'Соберите как можно больше искр',
        ][i],
        {
          campaignId: 'campaign-october',
          day: i + 1,
          game,
          xp: 25,
          questions:
            game === 'quiz'
              ? [
                  {
                    question: 'Какое действие приносит самый долгий эффект?',
                    options: ['Небольшая привычка каждый день', 'Один грандиозный рывок', 'Бесконечное планирование'],
                    correct: 0,
                    explain: 'Регулярные небольшие действия складываются в устойчивый результат.',
                  },
                ]
              : [],
        },
        {
          tag: `ЗАДАНИЕ ${String(i + 1).padStart(2, '0')}`,
          cover: ['cobalt', 'peach', 'lilac', 'lime', 'orbit', 'flower'][i],
        },
      ),
    ),
    make(
      'reward-coffee',
      'reward',
      'loyalty',
      'Напиток за наш счёт',
      'Ваш любимый вкус — наш маленький комплимент.',
      { pointsCost: 150, expiresDays: 30, pointIds: ['main'], campaignId: null },
      { price: 150, capacity: 100, cover: 'cup', tag: '150 БАЛЛОВ' },
    ),
    make(
      'reward-tote',
      'reward',
      'loyalty',
      'Вещи с историей',
      'Фирменный шоппер для больших планов.',
      { pointsCost: 450, expiresDays: 30, pointIds: ['main'], campaignId: null },
      { price: 450, capacity: 30, cover: 'bag', tag: '450 БАЛЛОВ' },
    ),
    make(
      'reward-pass',
      'reward',
      'loyalty',
      'Билет в новое',
      'Приглашение на закрытую встречу клуба.',
      { pointsCost: 300, expiresDays: 60, pointIds: ['main'], campaignId: null },
      { price: 300, capacity: 20, cover: 'ticket', tag: '300 БАЛЛОВ' },
    ),
    make(
      'product-cup',
      'product',
      'commerce',
      'Everyday cup',
      'Та самая чашка для ваших утренних ритуалов.',
      {
        variants: [
          { name: 'Кобальт', price: 7900 },
          { name: 'Молочный', price: 7900 },
        ],
        unit: 'шт.',
      },
      { price: 7900, capacity: 50, cover: 'cup', tag: 'THE EVERYDAY COLLECTION' },
    ),
    make(
      'product-tote',
      'product',
      'commerce',
      'Carry your ideas',
      'Плотный хлопок. Много места для вдохновения.',
      {
        variants: [
          { name: 'Натуральный', price: 5900 },
          { name: 'Чёрный', price: 5900 },
        ],
      },
      { price: 5900, capacity: 50, cover: 'bag', tag: 'СОЗДАНО ДЛЯ ВАС' },
    ),
    make(
      'product-notebook',
      'product',
      'commerce',
      'A new chapter',
      'Блокнот для того, что ещё не придумано.',
      {
        variants: [
          { name: 'Лайм', price: 3900 },
          { name: 'Кобальт', price: 3900 },
        ],
      },
      { price: 3900, capacity: 100, cover: 'notebook', tag: 'НОВИНКА' },
    ),
    make(
      'service-session',
      'service',
      'commerce',
      service ? 'Консультация по вашему проекту' : 'Творческая сессия 1:1',
      'Вместе найдём следующий шаг для вашей идеи.',
      {
        variants: [{ name: '60 минут', price: 25000 }],
        briefFields: [
          { id: 'project', label: 'Ваш проект', type: 'text', required: true },
          { id: 'goal', label: 'Что хотите получить', type: 'textarea', required: true },
          { id: 'contact', label: 'Как с вами связаться', type: 'text', required: true },
          { id: 'time', label: 'Удобное время', type: 'text', required: false },
        ],
      },
      { price: 25000, cover: 'orbit', tag: 'ЛИЧНАЯ ВСТРЕЧА' },
    ),
    make(
      'event-talk',
      'event',
      'events',
      team ? 'Пятница больших идей' : 'Разговоры, которые вдохновляют',
      'Знакомимся, обмениваемся идеями и смотрим на привычное по-новому.',
      {
        startsAt: future(14),
        location: 'Azelkhanov Space · зал 01',
        pointId: 'main',
        agenda: ['18:30 — знакомство', '19:00 — разговор с гостем', '20:00 — идеи и общение'],
      },
      { capacity: 24, cover: 'peach', tag: '18 ДЕК · 18:30' },
    ),
    make(
      'event-workshop',
      'event',
      'events',
      'Сделаем что-то настоящее',
      'Практическая встреча для тех, кто любит пробовать.',
      {
        startsAt: future(21, 7, 0),
        location: 'Azelkhanov Space · мастерская',
        pointId: 'main',
        agenda: ['12:00 — знакомство с материалами', '12:30 — практика', '14:00 — показываем результат'],
      },
      { capacity: 12, cover: 'lime', tag: '20 ДЕК · 12:00' },
    ),
    make(
      'slot-consult',
      'slot',
      'events',
      'Личная консультация',
      'Один час фокуса на вашей задаче.',
      { startsAt: future(7, 10, 0), location: 'Онлайн · ссылка после подтверждения', pointId: 'main' },
      { capacity: 1, cover: 'cobalt', tag: '21 ДЕК · 15:00' },
    ),
    make(
      'team-creators',
      'team',
      'team',
      'Создатели',
      'Из идей — в действие.',
      { goal: 5000 },
      { cover: 'cobalt', tag: 'КОМАНДА 01' },
    ),
    make(
      'team-explorers',
      'team',
      'team',
      'Исследователи',
      'Всегда на шаг ближе к новому.',
      { goal: 5000 },
      { cover: 'lime', tag: 'КОМАНДА 02' },
    ),
    make(
      'poll-next',
      'poll',
      'team',
      'Какая встреча будет следующей?',
      'Ваш голос определяет наши планы.',
      { options: ['Творческая мастерская', 'Спортивный день', 'Разговор с экспертом', 'Волонтёрская акция'] },
      { cover: 'peach', tag: 'ГОЛОС КОМАНДЫ' },
    ),
    make(
      'program-onboarding',
      'program',
      'team',
      'Ваши первые семь дней',
      'Знакомство с командой, ценностями и возможностями.',
      {
        courseId: 'course-first',
        teamId: null,
        steps: ['Расскажите о себе', 'Пройдите вводный курс', 'Познакомьтесь с коллегами', 'Посетите первую встречу'],
      },
      { cover: 'orbit', tag: 'ДОБРО ПОЖАЛОВАТЬ' },
    ),
  ]
  const games = ['quiz', 'scratch', 'wheel', 'memory', 'reaction', 'arcade']
  const titles = [
    'Идея, которую стоит сохранить',
    'Маленькое открытие',
    'Ваш удачный поворот',
    'Внимание к деталям',
    'Время действовать',
    'Ещё немного искр',
    'Что делает день лучше?',
    'Подарите себе минуту',
    'Новый виток вдохновения',
    'Найдите общее',
    'Чувствуйте момент',
    'Энергия нового дня',
    'Хороший вопрос',
    'Всё только начинается',
    'Радости по кругу',
    'Соберите картину',
    'Здесь и сейчас',
    'Финальная искра',
  ]
  for (let i = 6; i < 24; i++)
    catalog.push(
      make(
        `mission-${String(i + 1).padStart(2, '0')}`,
        'mission',
        'campaigns',
        titles[i - 6],
        'Небольшое действие — новая страница вашей истории.',
        {
          campaignId: 'campaign-october',
          day: i + 1,
          game: games[i % 6],
          xp: 25,
          questions:
            i % 6 === 0
              ? [
                  {
                    question: 'Что помогает идее вырасти?',
                    options: [
                      'Небольшие действия и обратная связь',
                      'Бесконечное ожидание',
                      'Сравнение со всеми вокруг',
                    ],
                    correct: 0,
                    explain: 'Пробуйте, замечайте результат и делайте следующий небольшой шаг.',
                  },
                ]
              : [],
        },
        {
          cover: ['cobalt', 'peach', 'lilac', 'lime', 'orbit', 'flower'][i % 6],
          tag: `ЗАДАНИЕ ${String(i + 1).padStart(2, '0')}`,
        },
      ),
    )
  for (let i = 0; i < 3; i++)
    catalog.push(
      make(
        `weekend-${i + 1}`,
        'mission',
        'campaigns',
        ['Встречайте новое', 'Один хороший момент', 'Воспоминания рядом'][i],
        'Три маленьких открытия для ваших выходных.',
        {
          campaignId: 'campaign-weekend',
          day: i + 1,
          game: ['memory', 'scratch', 'reaction'][i],
          xp: 25,
          questions: [],
        },
        { cover: ['peach', 'lime', 'lilac'][i], tag: `ДЕНЬ ${i + 1}` },
      ),
    )
  catalog.push(
    make(
      'campaign-weekly',
      'campaign',
      'campaigns',
      'Четыре недели хороших привычек',
      'Одна новая идея каждую неделю.',
      { startsAt: start(16), endsAt: end(11), days: 28, game: 'mixed' },
      { tag: 'НЕДЕЛЬНЫЙ ЧЕЛЛЕНДЖ', cover: 'lilac' },
    ),
  )
  for (let week = 0; week < 4; week++)
    catalog.push(
      make(
        `weekly-${week + 1}`,
        'mission',
        'campaigns',
        ['Посмотрите под другим углом', 'Найдите свою пару', 'Откройте маленькую радость', 'Соберите новые идеи'][week],
        'Задание недели. Откройте его в удобный момент.',
        {
          campaignId: 'campaign-weekly',
          day: 1 + week * 7,
          game: ['reaction', 'memory', 'scratch', 'arcade'][week],
          xp: 40,
          questions: [],
        },
        { tag: `НЕДЕЛЯ ${week + 1}`, cover: ['lime', 'lilac', 'peach', 'cobalt'][week] },
      ),
    )
  catalog.push(
    make(
      'club-membership',
      'course',
      'learning',
      'Клуб · 30 дней',
      'Демо: регулярная подписка Telegram Stars',
      { subscription: true, periodDays: 30 },
      {
        price: 490,
        tag: 'КЛУБ',
        body: 'Демонстрационный клуб: ежемесячный разбор, библиотека приёмов и подготовка к встрече. Подписка на 30 дней с автоматическим продлением в Telegram. Стоимость и содержание редактирует организатор.',
      },
    ),
  )
  catalog.push(
    make(
      'service-miniapp-brief',
      'service',
      'commerce',
      'Обсудить Mini App',
      'Обсуждение проекта, без оплаты',
      {
        purpose: 'miniapp-brief',
        briefFields: [
          { id: 'company', label: 'Компания или проект', type: 'text', required: true },
          { id: 'contact', label: 'Контакт для связи', type: 'text', required: true },
          { id: 'goal', label: 'Задача проекта', type: 'textarea', required: true },
          { id: 'industry', label: 'Отрасль', type: 'text', required: false },
        ],
      },
      { price: 0, body: 'Обсуждение проекта, без оплаты', cover: 'notebook' },
    ),
  )
  ;[
    [
      'club-review',
      'Ежемесячный разбор',
      'Разберите одну свою работу: сформулируйте цель, выпишите три наблюдения и выберите одно улучшение.',
    ],
    [
      'club-library',
      'Библиотека приёмов',
      'Приём недели: начните с результата для зрителя, уберите лишнее и проверьте ясность на одном примере.',
    ],
    [
      'club-preparation',
      'Подготовка к встрече',
      'Запишите вопрос, приложите контекст и опишите, какое решение хотите принять. Это материал для подготовки, а не обещание назначенной встречи.',
    ],
  ].forEach(([id, title, body], order) =>
    catalog.push(
      make(
        id,
        'lesson',
        'learning',
        title,
        'Материал клуба',
        { courseId: 'club-membership', order, xp: 20 },
        { body, cover: 'notebook' },
      ),
    ),
  )
  catalog.push(
    make(
      'coffee-flat-white',
      'product',
      'commerce',
      'Флэт уайт',
      'Двойной эспрессо и молоко. Самовывоз после подтверждения.',
      { industry: 'coffee', variants: [{ name: '250 мл', price: 1400 }] },
      { price: 1400, cover: 'cup', capacity: 30 },
    ),
    make(
      'coffee-filter',
      'product',
      'commerce',
      'Фильтр дня',
      'Чёрный кофе из текущего зерна. Уточните у бариста состав.',
      { industry: 'coffee', variants: [{ name: '300 мл', price: 1000 }] },
      { price: 1000, cover: 'cup', capacity: 30 },
    ),
    make(
      'fashion-everyday',
      'product',
      'commerce',
      'Городской слой',
      'Редакторский образ: свободная рубашка и прямой силуэт. Наличие подтверждает менеджер.',
      { industry: 'fashion', variants: [{ name: 'Консультация по образу', price: 0 }] },
      { price: 0, cover: 'bag' },
    ),
    make(
      'construction-consultation',
      'service',
      'commerce',
      'Осмотр и обсуждение объекта',
      'Заявка без оплаты. Состав работ и смету согласовываем отдельно.',
      {
        industry: 'construction',
        estimateRates: [{label:'Базовый',price:45000},{label:'Расширенный',price:80000}],
        briefFields: [
          { id: 'project', label: 'Объект и адрес', type: 'text', required: true },
          { id: 'goal', label: 'Работы и пожелания', type: 'textarea', required: true },
          { id: 'contact', label: 'Контакт', type: 'text', required: true },
          { id: 'time', label: 'Сроки', type: 'text', required: false },
        ],
      },
      { price: 0, cover: 'notebook' },
    ),
    make(
      'company-welcome',
      'article',
      'content',
      'Первые ориентиры',
      'Дни 1–7: познакомьтесь с пространством и командой.',
      { industry: 'company', xp: 15 },
      {
        body: 'Найдите профиль коллеги в разделе команды. Прочитайте правила пространства. Запишите, к кому обратитесь с первым рабочим вопросом. После знакомства отметьте материал завершённым.',
      },
    ),
    make(
      'company-habits',
      'article',
      'content',
      'Рабочий ритм',
      'Дни 8–14: закрепите понятный способ совместной работы.',
      { industry: 'company', xp: 15 },
      {
        body: 'Сформулируйте ожидаемый результат вашей задачи. Обсудите срок с руководителем. Разделите задачу на три шага и выберите ближайший. После этого завершите материал.',
      },
    ),
    make(
      'company-practice',
      'article',
      'content',
      'Первая самостоятельная задача',
      'Дни 15–30: соберите результат и обратную связь.',
      { industry: 'company', xp: 15 },
      {
        body: 'Покажите коллегам результат первой самостоятельной задачи. Запишите, что получилось и что улучшите. Поблагодарите человека, который помог, в разделе команды.',
      },
    ),
  )
  catalog.push(make('fashion-early','product','commerce','Капсула клуба','Раннее знакомство с новой подборкой для действующих участников клуба.',{industry:'fashion',earlyAccessPlanId:'club-membership'},{price:0,cover:'bag'}))
  const brandValue = (value: unknown): unknown =>
    typeof value === 'string'
      ? value.replaceAll('Azelkhanov', brandName)
      : Array.isArray(value)
        ? value.map(brandValue)
        : value && typeof value === 'object'
          ? Object.fromEntries(Object.entries(value).map(([key, v]) => [key, brandValue(v)]))
          : value
  return brandValue(catalog) as Entity[]
}
