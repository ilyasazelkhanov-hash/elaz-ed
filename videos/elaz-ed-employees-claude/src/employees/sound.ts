// Звуковые метки: какой эффект, в каком кадре. Кадры считаются от начала сцены,
// поэтому при изменении длительности сцен звук едет вместе с действием.
import { sceneStart, type SceneId } from './timeline';

export type SfxKind = 'tap' | 'gift' | 'reward' | 'whoosh' | 'brand';

type Cue = { scene: SceneId; at: number; kind: SfxKind; volume: number; note: string };

export const CUES: Cue[] = [
  { scene: 'hook', at: 128, kind: 'tap', volume: 0.5, note: 'нажатие «Открыть»' },
  { scene: 'advent', at: 0, kind: 'whoosh', volume: 0.35, note: 'приложение раскрывается' },
  { scene: 'advent', at: 92, kind: 'tap', volume: 0.5, note: 'касание двери №7' },
  { scene: 'advent', at: 126, kind: 'gift', volume: 0.8, note: 'коробка раскрывается — тёплый акцент' },
  { scene: 'quiz', at: 138, kind: 'tap', volume: 0.5, note: 'выбор ответа' },
  { scene: 'quiz', at: 176, kind: 'reward', volume: 0.55, note: '+XP' },
  { scene: 'games', at: 166, kind: 'reward', volume: 0.45, note: 'новый день отмечен' },
  { scene: 'event', at: 40, kind: 'tap', volume: 0.45, note: 'открыть новость' },
  { scene: 'event', at: 102, kind: 'whoosh', volume: 0.35, note: 'окно розыгрыша' },
  { scene: 'after', at: 60, kind: 'brand', volume: 0.5, note: 'дверь в постоянное пространство' },
  { scene: 'after', at: 122, kind: 'tap', volume: 0.45, note: 'курс по продукту' },
  { scene: 'after', at: 197, kind: 'reward', volume: 0.55, note: 'модуль пройден' },
  { scene: 'customize', at: 56, kind: 'tap', volume: 0.45, note: 'выбор палитры' },
  { scene: 'customize', at: 60, kind: 'brand', volume: 0.5, note: 'перекраска под бренд' },
  { scene: 'final', at: 62, kind: 'whoosh', volume: 0.3, note: 'слова собираются в карточку' },
  { scene: 'final', at: 98, kind: 'reward', volume: 0.5, note: 'CTA' },
];

export const placedCues = () => CUES.map((c) => ({ ...c, frame: sceneStart(c.scene) + c.at }));
