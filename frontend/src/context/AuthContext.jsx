import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('kt_user');
    return stored ? JSON.parse(stored) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('kt_token');
    if (token) {
      authApi.me()
        .then(res => {
          setUser(res.data);
          localStorage.setItem('kt_user', JSON.stringify(res.data));
        })
        .catch(() => {
          localStorage.removeItem('kt_token');
          localStorage.removeItem('kt_user');
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await authApi.login(email, password);
    localStorage.setItem('kt_token', res.data.token);
    localStorage.setItem('kt_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const register = async (email, password) => {
    const res = await authApi.register(email, password);
    localStorage.setItem('kt_token', res.data.token);
    localStorage.setItem('kt_user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('kt_token');
    localStorage.removeItem('kt_user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
