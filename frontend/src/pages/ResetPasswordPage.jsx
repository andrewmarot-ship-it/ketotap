import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../api/client';
import './AuthPage.css';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newPassword !== confirm) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      await authApi.resetPassword(email, newPassword);
      setSuccess('Password updated! You can now sign in.');
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-logo">
        <div className="auth-icon">⚡🥑</div>
        <h1 className="auth-brand">KetoTap</h1>
      </div>

      <div className="auth-card card">
        <h2>Reset Password</h2>
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field">
            <label>Email</label>
            <input
              className="input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="field">
            <label>New Password</label>
            <input
              className="input"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Min 6 characters"
              required
            />
          </div>
          <div className="field">
            <label>Confirm New Password</label>
            <input
              className="input"
              type="password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Re-enter password"
              required
            />
          </div>

          {error && <p className="error-msg">{error}</p>}
          {success && <p className="success-msg">{success}</p>}

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </form>

        <div className="auth-links">
          <Link to="/login">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
