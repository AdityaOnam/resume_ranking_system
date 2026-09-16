import api from './api';

export const getMissingSkills = () => api.get('/analytics/missing-skills');
export const getCompanyDemand = () => api.get('/analytics/company-demand');
export const getInsights = () => api.get('/analytics/insights');
export const getAtsHistory = () => api.get('/analytics/ats-history');
export const getBenchmark = () => api.get('/analytics/benchmark');
