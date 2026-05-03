'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { signIn, signUp, resetPassword } from '@/lib/actions/auth';
import { toast } from 'sonner';
import { Loader2, Mail, ArrowLeft, X } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [fullName, setFullName] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isSignUp) {
        if (!fullName.trim()) {
          toast.error('Full name is required');
          setIsLoading(false);
          return;
        }
        const { error } = await signUp(email, password, fullName);
        if (error) {
          toast.error(error);
          setIsLoading(false);
          return;
        }
        toast.success('Account created! Please check your email to confirm your account.');
        setIsSignUp(false);
        setIsLoading(false);
        return;
      }

      const { error } = await signIn(email, password);
      if (error) {
        toast.error(error);
        setIsLoading(false);
        return;
      }

      toast.success('Welcome back!');
      router.push('/dashboard');
      router.refresh();
    } catch {
      toast.error('Something went wrong');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black uppercase tracking-tighter text-white mb-2">
            Global Essentials
          </h1>
          <p className="text-white/60 text-sm">POS & Debt Management</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-white/60 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-tactical-slate border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-tactical-blue"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-white/60 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-tactical-slate border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-tactical-blue"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {isSignUp && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-white/60 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-tactical-slate border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-tactical-blue"
                placeholder="John Banda"
                required={isSignUp}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="btn-tactical w-full h-14 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              isSignUp ? 'Create Account' : 'Sign In'
            )}
          </button>
        </form>

        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="w-full mt-4 text-center text-sm text-white/60 hover:text-tactical-blue transition-colors"
        >
          {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </button>

        {!isSignUp && !showForgotPassword && (
          <button
            onClick={() => setShowForgotPassword(true)}
            className="w-full mt-3 text-center text-xs text-white/40 hover:text-white/60 transition-colors"
          >
            Forgot password?
          </button>
        )}

        {showForgotPassword && !resetSent && (
          <div className="mt-4 p-4 bg-tactical-slate rounded-xl border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Reset Password</p>
              <button onClick={() => setShowForgotPassword(false)}>
                <X className="w-4 h-4 text-white/40" />
              </button>
            </div>
            <p className="text-xs text-white/50">
              Enter your email and we&apos;ll send you a password reset link.
            </p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full h-12 px-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-tactical-blue"
              required
            />
            <button
              onClick={async () => {
                if (!email) {
                  toast.error('Please enter your email');
                  return;
                }
                setIsLoading(true);
                const { error } = await resetPassword(email);
                setIsLoading(false);
                if (error) {
                  toast.error(error);
                } else {
                  setResetSent(true);
                }
              }}
              disabled={isLoading}
              className="w-full btn-tactical h-12 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Mail className="w-4 h-4" />
                  Send Reset Link
                </>
              )}
            </button>
          </div>
        )}

        {showForgotPassword && resetSent && (
          <div className="mt-4 p-4 bg-tactical-slate rounded-xl border border-white/10 space-y-3 text-center">
            <p className="text-sm font-semibold text-tactical-neon">Check your email</p>
            <p className="text-xs text-white/50">
              A password reset link has been sent to <span className="text-white/70">{email}</span>
            </p>
            <button
              onClick={() => {
                setShowForgotPassword(false);
                setResetSent(false);
                setEmail('');
              }}
              className="text-xs text-white/40 hover:text-white/60 transition-colors"
            >
              ← Back to login
            </button>
          </div>
        )}

        <div className="mt-8 text-center">
          <a href="/catalog" className="text-xs text-white/40 hover:text-white/60">
            Browse public catalog →
          </a>
        </div>
      </div>
    </div>
  );
}