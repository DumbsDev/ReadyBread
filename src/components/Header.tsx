// src/components/Header.tsx
// The header/navigation bar at the top of every page

import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { User } from '../types';

interface HeaderProps {
  user: User | null;  // Current logged-in user (or null)
}

export const Header: React.FC<HeaderProps> = ({ user }) => {
  // useLocation() tells us which page we're on
  const location = useLocation();
  
  // Helper function to add 'active' class to current page link
  const isActive = (path: string) => {
    return location.pathname === path ? 'active' : '';
  };
  
  return (
    <header className="rb-header">
      <h1 className="rb-logo">
        <b>ReadyBread.xyz</b>
      </h1>
      
      <nav className="rb-nav">
        {/* Link components = navigation without page reload! */}
        <Link to="/" className={isActive('/')}>
          Home
        </Link>
        <Link to="/earn" className={isActive('/earn')}>
          Earn
        </Link>
        <Link to="/rewards" className={isActive('/rewards')}>
          Rewards
        </Link>
        <Link to="/dashboard" className={isActive('/dashboard')}>
          Dashboard
        </Link>
        <Link to="/quests" className={isActive('/quests')}>
          Quests
        </Link>
        {!user && (
          <Link to="/login" id="loginLink">
            Login
          </Link>
        )}
        <Link to="/tutorials" className={isActive('/tutorials')}>
          Help
        </Link>
      </nav>
    </header>
  );
};
