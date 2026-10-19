import {Audio} from '@remotion/media';
import {AbsoluteFill, Sequence, staticFile, useVideoConfig} from 'remotion';
import {SceneProps} from './design';
import {HookScene} from './scenes/Hook';
import {CalendarScene} from './scenes/Calendar';
import {KnowledgeScene} from './scenes/Knowledge';
import {GamesScene} from './scenes/Games';
import {EventScene} from './scenes/Event';
import {EvergreenScene} from './scenes/Evergreen';
import {CustomizeScene} from './scenes/Customize';
import {FinalScene} from './scenes/Final';

export type DemoProps = SceneProps & {musicVolume: number; voiceoverSrc: string};
export function EmployeesDemo({musicVolume, voiceoverSrc, ...props}: DemoProps) {
  const {fps} = useVideoConfig();
  return <AbsoluteFill>
    <HookScene {...props} from={0} durationInFrames={5 * fps} premountFor={fps}/>
    <CalendarScene {...props} from={5 * fps} durationInFrames={7 * fps} premountFor={fps}/>
    <KnowledgeScene {...props} from={12 * fps} durationInFrames={9 * fps} premountFor={fps}/>
    <GamesScene {...props} from={21 * fps} durationInFrames={8 * fps} premountFor={fps}/>
    <EventScene {...props} from={29 * fps} durationInFrames={7 * fps} premountFor={fps}/>
    <EvergreenScene {...props} from={36 * fps} durationInFrames={8 * fps} premountFor={fps}/>
    <CustomizeScene {...props} from={44 * fps} durationInFrames={9 * fps} premountFor={fps}/>
    <FinalScene {...props} from={53 * fps} durationInFrames={7 * fps} premountFor={fps}/>
    <Audio src={staticFile('audio/winter-orbit.wav')} volume={f => Math.min(1, f / 30, (1800 - f) / 45) * musicVolume * (voiceoverSrc ? 0.4 : 1)}/>
    {voiceoverSrc && <Audio src={voiceoverSrc.startsWith('http') ? voiceoverSrc : staticFile(voiceoverSrc)}/>}
    <Sequence from={Math.round(3.8 * fps)} durationInFrames={8} premountFor={fps}><Audio src={staticFile('audio/tap.wav')} volume={0.55}/></Sequence>
    <Sequence from={Math.round(9.1 * fps)} durationInFrames={36} premountFor={fps}><Audio src={staticFile('audio/open.wav')} volume={0.6}/></Sequence>
    <Sequence from={Math.round(17.2 * fps)} durationInFrames={42} premountFor={fps}><Audio src={staticFile('audio/reward.wav')} volume={0.55}/></Sequence>
    <Sequence from={Math.round(26.4 * fps)} durationInFrames={42} premountFor={fps}><Audio src={staticFile('audio/reward.wav')} volume={0.4}/></Sequence>
    <Sequence from={Math.round(42.3 * fps)} durationInFrames={42} premountFor={fps}><Audio src={staticFile('audio/reward.wav')} volume={0.4}/></Sequence>
  </AbsoluteFill>;
}
