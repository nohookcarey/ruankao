import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BottomTabs } from './components/BottomTabs';
import { Today } from './pages/Today';
import { Home } from './pages/Home';
import { Play } from './pages/Play';
import { Exam } from './pages/Exam';
import { Mock } from './pages/Mock';
import { MockRun } from './pages/MockRun';
import { Topics } from './pages/Topics';
import { Wrong } from './pages/Wrong';
import { Stats } from './pages/Stats';
import { Settings } from './pages/Settings';
import { StateProvider } from './model/StateContext';

function Shell() {
  const loc = useLocation();
  const immersive =
    loc.pathname.startsWith('/play') ||
    loc.pathname.startsWith('/exam') ||
    loc.pathname.startsWith('/mock/');

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/study" element={<Home />} />
        <Route path="/topics" element={<Topics />} />
        <Route path="/wrong" element={<Wrong />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/play/chapter/:areaId" element={<Play />} />
        <Route path="/play/tag/:tag" element={<Play />} />
        <Route path="/play/:kind" element={<Play />} />
        <Route path="/exam" element={<Exam />} />
        <Route path="/mock" element={<Mock />} />
        <Route path="/mock/:part/:key" element={<MockRun />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!immersive && <BottomTabs />}
    </div>
  );
}

export default function App() {
  return (
    <StateProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </StateProvider>
  );
}
