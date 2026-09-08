import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PiSpinnerGap, PiWarningCircle } from 'react-icons/pi';
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
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-muted bg-bg">
        <PiSpinnerGap size={40} className="animate-spin mb-4 text-accent" />
        <p>Loading result...</p>
      </div>
    );
  }

  if (error || !candidate) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-muted bg-bg">
        <PiWarningCircle size={40} className="text-error mb-4" />
        <p className="text-error">{error || 'Resume not found'}</p>
        <button
          className="mt-6 h-10 px-5 rounded-lg border border-line-strong bg-transparent text-text font-sans text-sm hover:border-accent hover:text-accent transition-colors"
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
