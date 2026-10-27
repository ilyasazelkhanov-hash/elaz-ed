import {Composition, Folder} from 'remotion';
import {UsersDemo,CustomersDemo} from './AudienceDemos';
import {EmployeesDemo} from './EmployeesDemo';
import {HookScene} from './scenes/Hook';
import {CalendarScene} from './scenes/Calendar';
import {KnowledgeScene} from './scenes/Knowledge';
import {GamesScene} from './scenes/Games';
import {EventScene} from './scenes/Event';
import {EvergreenScene} from './scenes/Evergreen';
import {CustomizeScene} from './scenes/Customize';
import {FinalScene} from './scenes/Final';
import './styles.css';

export const RemotionRoot = () => <>
  <Composition id="ElazEdUsersDemo" component={UsersDemo} durationInFrames={1800} fps={30} width={1080} height={1920}/>
  <Composition id="ElazEdCustomersDemo" component={CustomersDemo} durationInFrames={1800} fps={30} width={1080} height={1920}/>
  <Composition id="ElazEdEmployeesDemo" component={EmployeesDemo} durationInFrames={1800} fps={30} width={1080} height={1920} defaultProps={{brandName: 'Орбита', accentColor: '#FFD166', contact: '@elazart', musicVolume: 0.65, voiceoverSrc: ''}}/>
  <Folder name="Scenes">
    <Composition id="Hook" component={HookScene} durationInFrames={150} fps={30} width={1080} height={1920} defaultProps={{brandName: 'Орбита', accentColor: '#FFD166', contact: '@elazart'}}/>
    <Composition id="Calendar" component={CalendarScene} durationInFrames={210} fps={30} width={1080} height={1920} defaultProps={{brandName: 'Орбита', accentColor: '#FFD166', contact: '@elazart'}}/>
    <Composition id="Knowledge" component={KnowledgeScene} durationInFrames={270} fps={30} width={1080} height={1920} defaultProps={{brandName: 'Орбита', accentColor: '#FFD166', contact: '@elazart'}}/>
    <Composition id="Games" component={GamesScene} durationInFrames={240} fps={30} width={1080} height={1920} defaultProps={{brandName: 'Орбита', accentColor: '#FFD166', contact: '@elazart'}}/>
    <Composition id="Event" component={EventScene} durationInFrames={210} fps={30} width={1080} height={1920} defaultProps={{brandName: 'Орбита', accentColor: '#FFD166', contact: '@elazart'}}/>
    <Composition id="Evergreen" component={EvergreenScene} durationInFrames={240} fps={30} width={1080} height={1920} defaultProps={{brandName: 'Орбита', accentColor: '#FFD166', contact: '@elazart'}}/>
    <Composition id="Customize" component={CustomizeScene} durationInFrames={270} fps={30} width={1080} height={1920} defaultProps={{brandName: 'Орбита', accentColor: '#FFD166', contact: '@elazart'}}/>
    <Composition id="Final" component={FinalScene} durationInFrames={210} fps={30} width={1080} height={1920} defaultProps={{brandName: 'Орбита', accentColor: '#FFD166', contact: '@elazart'}}/>
  </Folder>
</>;
