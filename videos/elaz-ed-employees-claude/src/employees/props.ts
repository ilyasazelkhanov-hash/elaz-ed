// Параметры ролика. Всё, что зависит от заказчика, — здесь: название, палитра,
// люди, задания, приз, звук и контакт. В Remotion Studio они редактируются
// на панели Props справа; сцены читают их через useDemo().
import { createContext, useContext } from 'react';

export type Palette = {
  /** Основной цвет бренда: кнопки, акценты, кольцо логотипа. */
  primary: string;
  /** Второй цвет: подарки, призы, тёплые акценты. */
  accent: string;
  /** Фон окна приложения. */
  surface: string;
  /** Карточки внутри приложения. */
  card: string;
  /** Основной текст. */
  ink: string;
  /** Второстепенный текст. */
  mute: string;
};

export type Person = { name: string; role: string; hue: number };

export type EmployeesDemoProps = {
  company: {
    name: string;
    /** Подпись под логотипом. */
    tagline: string;
    palette: Palette;
  };
  /** С чего начинается перекраска в сцене настроек: базовый шаблон Elaz Ed. */
  templatePalette: Palette;
  hero: Person;
  colleague: Person;
  /** Ещё участники для личного рейтинга. */
  people: Person[];
  advent: {
    title: string;
    todayDoor: number;
    totalDoors: number;
    /** Подпись к датам календаря в сцене настроек. */
    dates: string;
  };
  story: { kicker: string; title: string; text: string };
  quiz: { question: string; options: string[]; correct: number; xp: number };
  achievement: string;
  event: {
    title: string;
    date: string;
    program: { time: string; title: string }[];
  };
  prize: { title: string; note: string; stock: number };
  after: {
    sections: { title: string; text: string }[];
    course: { title: string; lessons: string[] };
  };
  contact: string;
  codeWord: string;
  /** Запись диктора в public/. Пусто — экранная версия: под заголовками идут подстрочники. */
  voiceSrc: string;
  musicSrc: string;
  /** Громкость музыки без диктора и под диктором. */
  musicVolume: number;
  musicVolumeUnderVoice: number;
  sfx: { tap: string; gift: string; reward: string; whoosh: string; brand: string };
  /** Показывать подстрочники со смыслом реплик. По умолчанию — да, если нет записи голоса. */
  showSublines: boolean;
};

export const defaultProps: EmployeesDemoProps = {
  company: {
    name: 'Орбита',
    tagline: 'Пространство команды',
    palette: {
      primary: '#5CC8FF',
      accent: '#FFD166',
      surface: '#0C2245',
      card: '#13305C',
      ink: '#F7F2E8',
      mute: '#A9BCD8',
    },
  },
  templatePalette: {
    primary: '#A58BFF',
    accent: '#FF8AC9',
    surface: '#0B0A12',
    card: '#1D1C2B',
    ink: '#F3F1FF',
    mute: '#A39FBF',
  },
  hero: { name: 'Алина', role: 'Клиентский сервис', hue: 18 },
  colleague: { name: 'Марат', role: 'Отдел продукта', hue: 200 },
  people: [
    { name: 'Ксения', role: 'Маркетинг', hue: 330 },
    { name: 'Денис', role: 'Логистика', hue: 140 },
    { name: 'Ольга', role: 'Бухгалтерия', hue: 265 },
  ],
  advent: {
    title: 'Вместе до Нового года',
    todayDoor: 7,
    totalDoors: 24,
    dates: '1–24 декабря',
  },
  story: {
    kicker: 'День 7 · История компании',
    title: 'Как появилась «Орбита»',
    text: 'Первый клиент пришёл с одной задачей. Мы решили её вместе — и так работаем до сих пор.',
  },
  quiz: {
    question: 'Что мы ценим в работе с клиентами?',
    options: ['Скорость любой ценой', 'Помогаем решить задачу', 'Строго по регламенту'],
    correct: 1,
    xp: 30,
  },
  achievement: 'Знаток «Орбиты»',
  event: {
    title: 'Встречаемся на корпоративе',
    date: '26 декабря · 19:00',
    program: [
      { time: '19:00', title: 'Сбор и встреча гостей' },
      { time: '19:40', title: 'Итоги года' },
      { time: '20:30', title: 'Розыгрыш адвента' },
      { time: '21:00', title: 'Ужин и музыка' },
    ],
  },
  prize: { title: 'Набор от компании', note: 'По правилам кампании', stock: 20 },
  after: {
    sections: [
      { title: 'Новости команды', text: 'Что нового на этой неделе' },
      { title: 'Добро пожаловать в компанию', text: 'Вводные материалы для новичков' },
      { title: 'Курс по продукту', text: '5 уроков · вводный модуль' },
    ],
    course: {
      title: 'Курс по продукту',
      lessons: ['Кто наши клиенты', 'Как устроен продукт', 'Путь заявки', 'Тон общения', 'Итоговый квиз'],
    },
  },
  contact: '@elazart',
  codeWord: 'КОМАНДА',
  voiceSrc: '',
  musicSrc: 'audio/music.wav',
  musicVolume: 0.55,
  musicVolumeUnderVoice: 0.22,
  sfx: {
    tap: 'audio/tap.wav',
    gift: 'audio/gift.wav',
    reward: 'audio/reward.wav',
    whoosh: 'audio/whoosh.wav',
    brand: 'audio/brand.wav',
  },
  showSublines: true,
};

export const DemoContext = createContext<EmployeesDemoProps>(defaultProps);

/** Длительность текущей сцены (без наплыва) — чтобы заголовок ушёл раньше, чем придёт следующий. */
export const SceneLengthContext = createContext<number>(Infinity);
export const useDemo = () => useContext(DemoContext);
