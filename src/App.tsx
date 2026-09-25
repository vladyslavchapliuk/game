import { useEffect } from 'react';
import { useRoute, go } from './router';
import { useStore } from './state/store';
import { Hud } from './components/Chrome';
import { MapScreen, RoomScreen } from './screens/MapScreens';
import { LevelScreen } from './screens/LevelScreen';
import { OutcomeScreen } from './screens/OutcomeScreen';
import { FactoryFreeScreen, MasteryScreen, SandboxScreen, SettingsScreen, SoonScreen, StudyScreen, WelcomeScreen } from './screens/OtherScreens';
import { isLevelPlayable } from './content/worlds';

export default function App() {
  const parts = useRoute();
  const full = parts.join('/');
  const [head, arg] = [parts[0], (parts[1] ?? '').split('?')[0]];
  const { progress } = useStore();

  useEffect(() => {
    if (!progress.onboarded && head === 'map') go('welcome');
  }, [progress.onboarded, head]);

  let screen;
  switch (head) {
    case 'welcome': screen = <WelcomeScreen />; break;
    case 'room': screen = <RoomScreen worldId={Number(arg)} />; break;
    case 'play': screen = isLevelPlayable(arg) ? <LevelScreen key={full} id={arg} /> : <MapScreen />; break;
    case 'outcome': screen = <OutcomeScreen />; break;
    case 'study': screen = <StudyScreen key={arg} tab={arg} />; break;
    case 'sandbox': screen = <SandboxScreen tab={arg || 'line'} />; break;
    case 'factory': screen = <FactoryFreeScreen />; break;
    case 'mastery': screen = <MasteryScreen />; break;
    case 'settings': screen = <SettingsScreen />; break;
    case 'soon': screen = <SoonScreen which={arg} />; break;
    default: screen = <MapScreen />;
  }
  return (
    <>
      <a className="sr-only" href="#main">Skip to content</a>
      <Hud route={full} />
      <main id="main">{screen}</main>
    </>
  );
}
