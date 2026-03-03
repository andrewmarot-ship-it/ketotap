import { useState } from 'react';
import './AuthPage.css';
import './BetaGatePage.css';

export default function BetaGatePage({ onAccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const validUser = import.meta.env.VITE_BETA_USERNAME;
    const validPass = import.meta.env.VITE_BETA_PASSWORD;

    if (username === validUser && password === validPass) {
      onAccess();
    } else {
      setError('Invalid access credentials');
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-logo">
        <div className="auth-icon">⚡🥑</div>
        <div className="auth-brand">KetoTap</div>
        <div className="auth-tagline">Tap. Track. Keto.</div>
      </div>

      <div className="auth-card">
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <span className="beta-badge">Closed Beta</span>
          <h2 style={{ marginBottom: 4 }}>Beta Access</h2>
          <p className="beta-subtitle">Enter your beta credentials to continue</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="field">
            <label>Username</label>
            <input
              className="input"
              type="text"
              placeholder="Beta username"
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="field">
            <label>Password</label>
            <input
              className="input"
              type="password"
              placeholder="Beta password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </div>

          {error && <p className="error-msg">{error}</p>}

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Checking…' : 'Enter Beta'}
          </button>
        </form>
      </div>
    </div>
  );
}
