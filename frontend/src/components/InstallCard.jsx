import { useEffect, useState } from 'react';

function isInstalled() {
  return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export default function InstallCard() {
  const [installed, setInstalled] = useState(isInstalled);
  const [canPrompt, setCanPrompt] = useState(() => !!window.__ktInstallPrompt);

  useEffect(() => {
    const onAvailable = () => setCanPrompt(true);
    const onInstalled = () => setInstalled(true);
    window.addEventListener('kt-install-available', onAvailable);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('kt-install-available', onAvailable);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function handleInstall() {
    const prompt = window.__ktInstallPrompt;
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    window.__ktInstallPrompt = null;
    setCanPrompt(false);
    if (outcome === 'accepted') setInstalled(true);
  }

  if (installed) return null;

  return (
    <div className="card install-card">
      <img src="/icon-192.png" alt="" className="install-icon" />
      <div className="install-body">
        <h3>Install KetoTap</h3>
        {canPrompt ? (
          <>
            <p>Add it to your home screen so it opens like a regular app.</p>
            <button className="btn-primary install-btn" onClick={handleInstall}>Install app</button>
          </>
        ) : isIOS() ? (
          <p>In Safari, tap <strong>Share</strong> <span aria-hidden="true">⎋</span> then <strong>Add to Home Screen</strong>.</p>
        ) : (
          <p>Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
        )}
      </div>
    </div>
  );
}
