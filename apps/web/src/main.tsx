import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@hearth/ui/styles.css';
import './app/global.css';
import { App } from './app/App';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html.');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
