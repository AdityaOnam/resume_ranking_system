import api from './api';

export const getMissingSkills = () => api.get('/analytics/missing-skills');
export const getCompanyDemand = () => api.get('/analytics/company-demand');
export const getInsights = () => api.get('/analytics/insights');
export const getDepartmentComparison = () => api.get('/analytics/department-comparison');
export const getAtsHistory = () => api.get('/analytics/ats-history');
export const getVersionComparison = () => api.get('/analytics/version-comparison');
