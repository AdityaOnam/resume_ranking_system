import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import CandidateProfile from './CandidateProfile';
import { getResumeById } from '../services/api';

const ResumeResultPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: candidate, isLoading: loading, isError, error: queryError } = useQuery({
    queryKey: ['resume', id],
    queryFn: () => getResumeById(id).then(r => r.data),
  });

  const error = isError
    ? (queryError?.response?.status === 404 ? 'Resume not found.' : 'Failed to load resume details.')
    : null;

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-on-surface-variant">
        <span className="material-symbols-outlined text-4xl animate-spin mb-4">refresh</span>
        <p>Loading result...</p>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-on-surface-variant">
        <span className="material-symbols-outlined text-4xl text-error mb-4">error</span>
        <p className="text-error">{error || 'Resume not found'}</p>
        <button 
          className="mt-6 btn btn-outline"
          onClick={() => navigate('/')}
        >
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 h-full overflow-hidden flex flex-col relative">
      <CandidateProfile candidate={candidate} onClose={() => navigate('/')} />
    </div>
  );
};

export default ResumeResultPage;
