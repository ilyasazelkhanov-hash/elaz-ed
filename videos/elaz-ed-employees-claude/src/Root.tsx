import React from 'react';
import { Composition } from 'remotion';
import { ElazEdEmployeesDemo } from './employees/ElazEdEmployeesDemo';
import { defaultProps } from './employees/props';
import { FPS, HEIGHT, TOTAL_FRAMES, WIDTH } from './employees/timeline';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="ElazEdEmployeesDemo"
    component={ElazEdEmployeesDemo}
    durationInFrames={TOTAL_FRAMES}
    fps={FPS}
    width={WIDTH}
    height={HEIGHT}
    defaultProps={defaultProps}
  />
);
