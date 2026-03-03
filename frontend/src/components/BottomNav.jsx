import { NavLink } from 'react-router-dom';
import './BottomNav.css';

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" end className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}>
        <span className="bottom-nav-icon">🏠</span>
        <span className="bottom-nav-label">Home</span>
      </NavLink>
      <NavLink to="/foods" className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}>
        <span className="bottom-nav-icon">🥑</span>
        <span className="bottom-nav-label">Foods</span>
      </NavLink>
      <NavLink to="/history" className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}>
        <span className="bottom-nav-icon">📅</span>
        <span className="bottom-nav-label">History</span>
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}>
        <span className="bottom-nav-icon">👤</span>
        <span className="bottom-nav-label">Profile</span>
      </NavLink>
    </nav>
  );
}
