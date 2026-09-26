import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Chrome fires this once, early; keep it so the Profile page can offer an Install button later
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__ktInstallPrompt = e;
  window.dispatchEvent(new Event('kt-install-available'));
});

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => console.error('Service worker registration failed', err));
  });
}
