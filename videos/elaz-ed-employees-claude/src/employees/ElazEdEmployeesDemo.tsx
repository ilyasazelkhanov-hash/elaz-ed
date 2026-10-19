// Композиция ElazEdEmployeesDemo: общий зимний фон, восемь сцен со своим таймингом и звук.
import React from 'react';
import { AbsoluteFill, Html5Audio, interpolate, Sequence, staticFile, useCurrentFrame } from 'remotion';
import { loadFonts } from './fonts';
import { DemoContext, SceneLengthContext, type EmployeesDemoProps } from './props';
import { AdventScene } from './scenes/AdventScene';
import { AfterScene } from './scenes/AfterScene';
import { CustomizeScene } from './scenes/CustomizeScene';
import { EventScene } from './scenes/EventScene';
import { FinalScene } from './scenes/FinalScene';
import { GamesScene } from './scenes/GamesScene';
import { HookScene } from './scenes/HookScene';
import { QuizScene } from './scenes/QuizScene';
import { placedCues } from './sound';
import { clamp, ease } from './style';
import { OVERLAP, PLACED, TOTAL_FRAMES, type SceneId } from './timeline';
import { Backdrop } from './ui/Backdrop';

loadFonts();

const SCENE_COMPONENTS: Record<SceneId, React.FC> = {
  hook: HookScene,
  advent: AdventScene,
  quiz: QuizScene,
  games: GamesScene,
  event: EventScene,
  after: AfterScene,
  customize: CustomizeScene,
  final: FinalScene,
};

/** Мягкая смена сцен: новая проявляется, старая уходит за OVERLAP кадров. */
const SceneFade: React.FC<{ duration: number; first: boolean; last: boolean; children: React.ReactNode }> = ({ duration, first, last, children }) => {
  const frame = useCurrentFrame();
  const fadeIn = first ? 1 : ease(frame, [0, OVERLAP]);
  const fadeOut = last ? 1 : 1 - ease(frame, [duration, duration + OVERLAP], [0, 1], (t) => t * t);
  return (
    <SceneLengthContext.Provider value={last ? Infinity : duration}>
      <AbsoluteFill style={{ opacity: Math.min(fadeIn, fadeOut) }}>{children}</AbsoluteFill>
    </SceneLengthContext.Provider>
  );
};

const src = (path: string) => (/^https?:/.test(path) ? path : staticFile(path));

export const ElazEdEmployeesDemo: React.FC<EmployeesDemoProps> = (props) => {
  const hasVoice = Boolean(props.voiceSrc);
  const musicBase = hasVoice ? props.musicVolumeUnderVoice : props.musicVolume;

  return (
    <DemoContext.Provider value={props}>
      <AbsoluteFill style={{ backgroundColor: '#071630' }}>
        <Backdrop />
        {PLACED.map((scene, i) => {
          const Scene = SCENE_COMPONENTS[scene.id];
          const last = i === PLACED.length - 1;
          return (
            <Sequence key={scene.id} name={`${i + 1}. ${scene.name}`} from={scene.from} durationInFrames={scene.durationInFrames + (last ? 0 : OVERLAP)}>
              <SceneFade duration={scene.durationInFrames} first={i === 0} last={last}>
                <Scene />
              </SceneFade>
            </Sequence>
          );
        })}

        {props.musicSrc && (
          <Html5Audio
            src={src(props.musicSrc)}
            volume={(f) => musicBase * interpolate(f, [0, 20, TOTAL_FRAMES - 60, TOTAL_FRAMES], [0, 1, 1, 0], clamp)}
          />
        )}
        {hasVoice && <Html5Audio src={src(props.voiceSrc)} />}
        {placedCues().map((cue) => {
          const file = props.sfx[cue.kind];
          if (!file) return null;
          return (
            <Sequence key={`${cue.scene}-${cue.at}-${cue.kind}`} name={`звук: ${cue.note}`} from={cue.frame} durationInFrames={75} layout="none">
              <Html5Audio src={src(file)} volume={cue.volume} />
            </Sequence>
          );
        })}
      </AbsoluteFill>
    </DemoContext.Provider>
  );
};
