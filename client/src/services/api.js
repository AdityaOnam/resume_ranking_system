import axios from 'axios';
import { supabase } from '../contexts/AuthContext';

// In dev, set REACT_APP_API_URI in .env.local to point at the backend (see .env.example).
// In production, the frontend is served from the same domain as the backend, so '/api' works as-is.
const API_URL = process.env.REACT_APP_API_URI || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
  }
  
  return config;
});

export const uploadResume = (formData) => {
  return api.post('/resumes/', formData);
};

export const getUploadStatus = (jobId) => {
  return api.get(`/resumes/status/${jobId}`);
};

export const getResumeById = (id) => {
  return api.get(`/resumes/${id}`);
};

export const getResumes = () => {
  return api.get('/resumes/');
};

export const deleteResume = (id) => {
  return api.delete(`/resumes/${id}`);
};

export const getCompanies = () => {
  return api.get('/companies/');
};

export const parseJobDescription = (text) => {
  return api.post('/companies/parse-jd', { text });
};

export const createCompany = (formData) => {
  return api.post('/companies/', formData);
};

export const apiDocsUrl = `${API_URL}/docs`;

export default api;
