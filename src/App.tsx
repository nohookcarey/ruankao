import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { BottomTabs } from './components/BottomTabs';
import { Home } from './pages/Home';
import { Play } from './pages/Play';
import { Exam } from './pages/Exam';
import { Wrong } from './pages/Wrong';
import { Stats } from './pages/Stats';
import { Settings } from './pages/Settings';
import { StateProvider } from './model/StateContext';

function Shell() {
  const loc = useLocation();
  const immersive = loc.pathname.startsWith('/play') || loc.pathname.startsWith('/exam');

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/wrong" element={<Wrong />} />
        <Route path="/stats" element={<Stats />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/play/chapter/:areaId" element={<Play />} />
        <Route path="/play/:kind" element={<Play />} />
        <Route path="/exam" element={<Exam />} />
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
