import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { PiEnvelopeSimple, PiEnvelopeOpen, PiSpinnerGap, PiArrowRight } from 'react-icons/pi';

const AuthPage = () => {
  const [step, setStep] = useState('email'); // 'email' | 'sent'
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { sendMagicLink, signInWithGoogle } = useAuth();

  const handleSendLink = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { error } = await sendMagicLink(email);
      if (error) throw error;
      setStep('sent');
    } catch (err) {
      setError(err.message || 'Failed to send link');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setError('');
    setResending(true);
    try {
      const { error } = await sendMagicLink(email);
      if (error) throw error;
    } catch (err) {
      setError(err.message || 'Failed to resend link');
    } finally {
      setResending(false);
    }
  };

  const changeEmail = () => {
    setStep('email');
    setError('');
  };

  const handleGoogle = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const { error } = await signInWithGoogle();
      if (error) throw error;
      // Browser is redirected away to Google here; no further state update needed.
    } catch (err) {
      setError(err.message || 'Failed to start Google sign-in');
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-4 bg-bg">
      <div className="w-full max-w-[420px] bg-surface p-8 rounded-xl border border-line" style={{ boxShadow: 'var(--rr-shadow)' }}>
        <div className="text-center flex flex-col gap-1.5 mb-8">
          <h1 className="m-0 text-2xl tracking-[-0.02em] font-display text-text">
            {step === 'email' ? 'Welcome to ResumeRanker' : 'Check your email'}
          </h1>
          <p className="m-0 text-[13.5px] leading-[1.5] text-muted">
            {step === 'email'
              ? "No password needed — we'll email you a sign-in link."
              : `We sent a sign-in link to ${email}.`}
          </p>
        </div>

        {error && (
          <div className="bg-error/10 border border-error/20 text-error p-4 rounded-lg mb-5 text-sm">
            {error}
          </div>
        )}

        {step === 'email' ? (
          <form onSubmit={handleSendLink} className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] tracking-[0.08em] uppercase text-muted">Email</span>
              <div className="relative">
                <PiEnvelopeSimple className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" size={20} />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-11 bg-surface-2 border border-line rounded-md pl-11 pr-4 text-text placeholder:text-muted focus:outline-none focus:border-accent transition-colors text-sm"
                  placeholder="you@example.com"
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full flex items-center justify-center gap-2 h-11 mt-2 bg-accent text-bg rounded-md font-sans font-medium text-sm transition-opacity disabled:opacity-50 hover:opacity-90"
            >
              {loading ? (
                <PiSpinnerGap className="animate-spin" size={20} />
              ) : (
                <>
                  Send sign-in link
                  <PiArrowRight size={18} />
                </>
              )}
            </button>

            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-line" />
              <span className="text-[11px] text-muted uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-line" />
            </div>

            <button
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading}
              className="w-full flex items-center justify-center gap-2.5 bg-surface border border-line text-text h-11 rounded-md font-medium text-sm transition-colors hover:border-accent disabled:opacity-50"
            >
              {googleLoading ? (
                <PiSpinnerGap className="animate-spin" size={20} />
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.92c1.7-1.57 2.68-3.88 2.68-6.64z"/>
                    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.27c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33C2.44 15.98 5.48 18 9 18z"/>
                    <path fill="#FBBC05" d="M3.97 10.7c-.18-.54-.28-1.11-.28-1.7s.1-1.16.28-1.7V4.97H.96A8.996 8.996 0 000 9c0 1.45.35 2.83.96 4.03l3.01-2.33z"/>
                    <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.97l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
                  </svg>
                  Continue with Google
                </>
              )}
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex justify-center py-2">
              <PiEnvelopeOpen size={48} className="text-accent" />
            </div>

            <div className="flex justify-between items-center pt-2 text-sm">
              <button type="button" onClick={changeEmail} className="text-muted hover:text-text transition-colors">
                Use a different email
              </button>
              <button
                type="button"
                onClick={handleResend}
                disabled={resending}
                className="text-accent hover:opacity-80 font-medium transition-colors disabled:opacity-50"
              >
                {resending ? 'Resending…' : 'Resend link'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthPage;
