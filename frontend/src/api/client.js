import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('kt_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('kt_token');
      localStorage.removeItem('kt_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  register: (email, password) => api.post('/auth/register', { email, password }),
  login: (email, password) => api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  resetPassword: (email, newPassword) => api.post('/auth/reset-password', { email, newPassword }),
};

export const targetsApi = {
  get: () => api.get('/targets'),
  update: (targets) => api.put('/targets', targets),
};

export const foodsApi = {
  list: () => api.get('/foods'),
  create: (food) => api.post('/foods', food),
  update: (id, food) => api.put(`/foods/${id}`, food),
  delete: (id) => api.delete(`/foods/${id}`),
};

export const logsApi = {
  getDay: (date) => api.get('/logs', { params: { date } }),
  history: () => api.get('/logs/history'),
  historyMonth: (month) => api.get('/logs/history', { params: { month } }),
  historyDay: (date) => api.get(`/logs/history/${date}`),
  add: (food_id, date) => api.post('/logs', { food_id, date }),
  remove: (id) => api.delete(`/logs/${id}`),
  toggleComplete: (date) => api.post('/logs/complete', { date }),
  isCompleted: (date) => api.get(`/logs/complete/${date}`),
};

export default api;
