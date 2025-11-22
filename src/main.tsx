import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';

// Attach the React app to the #root div in index.html
const container = document.getElementById('root');

if (!container) {
  throw new Error('Root container #root not found in index.html');
}

const root = ReactDOM.createRoot(container as HTMLElement);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
