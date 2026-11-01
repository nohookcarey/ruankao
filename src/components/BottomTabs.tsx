import { NavLink } from 'react-router-dom';
import { IconPractice, IconSettings, IconStats, IconWrong } from './Icons';

const items = [
  { to: '/', label: '刷题', Icon: IconPractice, end: true },
  { to: '/wrong', label: '错题', Icon: IconWrong, end: false },
  { to: '/stats', label: '统计', Icon: IconStats, end: false },
  { to: '/settings', label: '设置', Icon: IconSettings, end: false },
];

export function BottomTabs() {
  return (
    <nav className="tabs">
      <div className="tabs__inner">
        {items.map(({ to, label, Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `tab${isActive ? ' is-active' : ''}`}
          >
            <Icon />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
