// Таймлайн ролика: длительности сцен в кадрах (30 fps). Сцены идут подряд,
// каждая начинается там, где закончилась предыдущая. Меняйте durationInFrames —
// старты пересчитаются сами; общая длина ролика тоже.

export const FPS = 30;
export const WIDTH = 1080;
export const HEIGHT = 1920;

/** Сколько кадров соседние сцены перекрываются при смене (мягкий наплыв). */
export const OVERLAP = 14;

export type SceneId =
  | 'hook'
  | 'advent'
  | 'quiz'
  | 'games'
  | 'event'
  | 'after'
  | 'customize'
  | 'final';

export type SceneSpec = {
  id: SceneId;
  name: string;
  durationInFrames: number;
  /** Надписи сцены — дублируют смысл диктора, чтобы ролик читался без звука. */
  captions: string[];
  /** Подстрочники экранной версии: смысл реплики, если звук выключен или голоса нет. */
  sublines: string[];
  /** Точная реплика диктора. */
  voice: string;
};

export const SCENES: SceneSpec[] = [
  {
    id: 'hook',
    name: 'Хук',
    durationInFrames: 150,
    captions: ['Ваша команда уже в Telegram'],
    sublines: ['Дайте ей повод собраться'],
    voice: 'Ваша команда уже в Telegram. Дайте ей повод собраться.',
  },
  {
    id: 'advent',
    name: 'Корпоративный адвент',
    durationInFrames: 210,
    captions: ['Ваш корпоративный адвент'],
    sublines: ['Ваш бренд и задание на каждый день'],
    voice:
      'Создадим корпоративное приложение: с вашим брендом, новогодним адвентом и заданиями на каждый день.',
  },
  {
    id: 'quiz',
    name: 'Знакомство и участие',
    durationInFrames: 270,
    captions: ['Узнать. Попробовать. Поучаствовать.'],
    sublines: ['Истории компании, уроки и квизы'],
    voice:
      'Короткие истории компании, полезные уроки и квизы помогают знакомиться с продуктом и включаться в общую жизнь.',
  },
  {
    id: 'games',
    name: 'Игровые поводы вернуться',
    durationInFrames: 240,
    captions: ['Маленький повод зайти каждый день'],
    sublines: ['Игры, личный рейтинг и награды'],
    voice:
      'Добавим игры, личный рейтинг и награды. Появится маленький повод зайти снова и поучаствовать.',
  },
  {
    id: 'event',
    name: 'Событие и подарки',
    durationInFrames: 210,
    captions: ['До праздника. На празднике.'],
    sublines: ['Сначала задания, потом подарки'],
    voice:
      'До корпоратива — задания и новости. К празднику — подарки и розыгрыши с понятными правилами.',
  },
  {
    id: 'after',
    name: 'После Нового года',
    durationInFrames: 240,
    captions: ['Один праздник — начало общей привычки'],
    sublines: ['Новости, онбординг и обучение'],
    voice:
      'А после праздника пространство останется: новости, вводные материалы для новичков и обучение сотрудников круглый год.',
  },
  {
    id: 'customize',
    name: 'Гибкая разработка и управление',
    durationInFrames: 270,
    captions: ['Под ваш бренд', 'Под вашу задачу', 'Контент и статистика под рукой'],
    sublines: ['Оформление и логотип', 'Разделы, даты, задания и призы', 'Управление для организаторов'],
    voice:
      'Разработаем под вашу компанию: оформление, разделы, задания и призы. У команды будет своё пространство, у организаторов — управление и статистика.',
  },
  {
    id: 'final',
    name: 'Продающий финал',
    durationInFrames: 210,
    captions: ['Соберём приложение для вашей команды', 'Напишите @elazart: КОМАНДА'],
    sublines: ['К Новому году, корпоративу или на постоянку'],
    voice:
      'К Новому году, корпоративу или на постоянку. Напишите «Команда» — обсудим приложение для ваших сотрудников.',
  },
];

export type PlacedScene = SceneSpec & { from: number };

export const PLACED: PlacedScene[] = SCENES.reduce<PlacedScene[]>((acc, s) => {
  const prev = acc[acc.length - 1];
  acc.push({ ...s, from: prev ? prev.from + prev.durationInFrames : 0 });
  return acc;
}, []);

export const TOTAL_FRAMES = SCENES.reduce((sum, s) => sum + s.durationInFrames, 0);

export const sceneStart = (id: SceneId) => PLACED.find((s) => s.id === id)!.from;
export const sceneEnd = (id: SceneId) => {
  const s = PLACED.find((p) => p.id === id)!;
  return s.from + s.durationInFrames;
};

/** Таймкод для документации: кадр → «мм:сс.кк». */
export const timecode = (frame: number) => {
  const sec = Math.floor(frame / FPS);
  const f = frame % FPS;
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}.${String(f).padStart(2, '0')}`;
};

export const sceneSpec = (id: SceneId) => PLACED.find((s) => s.id === id)!;
