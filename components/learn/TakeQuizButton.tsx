'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, CheckCircle2, XCircle, ChevronRight, RotateCcw, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  generatePersonalizedQuiz,
  markQuizCompleted,
  type Quiz,
} from '@/lib/actions/learn';
import { cn } from '@/lib/utils';

/**
 * Take Quiz — interactive client component (Phase 4 / 4C.3).
 *
 * Flow:
 *   1. Initial state: a "Take quiz" button.
 *   2. On click: call generatePersonalizedQuiz(lessonId). While
 *      waiting, show a spinner. On error, toast + revert to button.
 *   3. Once the quiz arrives, walk through the questions one at a
 *      time. User taps an option → reveal correct/incorrect + the
 *      explanation. "Next" button advances.
 *   4. After the last question, show the score and a "Done" button.
 *   5. On Done, call markQuizCompleted(lessonId, score) so the
 *      score is saved to user_lesson_progress. Re-take via "Try
 *      again" resets the state.
 *
 * Quiz state is local — the parent page doesn't need to know about
 * it. The score is the only side effect that reaches the server.
 */

interface TakeQuizButtonProps {
  lessonId: string;
  lessonTitle: string;
  /** Optional: render compact (icon only) for tight layouts. */
  compact?: boolean;
}

type QuizState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'in-progress'; quiz: Quiz; currentIndex: number; answers: Array<number | null> }
  | { phase: 'review'; quiz: Quiz; answers: Array<number | null>; scorePct: number; saving: boolean }
  | { phase: 'error'; message: string };

export function TakeQuizButton({ lessonId, lessonTitle, compact = false }: TakeQuizButtonProps) {
  const [state, setState] = useState<QuizState>({ phase: 'idle' });

  async function startQuiz() {
    setState({ phase: 'loading' });
    const { data, error } = await generatePersonalizedQuiz(lessonId);
    if (error || !data) {
      toast.error(error || "Couldn't generate a quiz");
      setState({ phase: 'error', message: error || "Couldn't generate a quiz" });
      return;
    }
    setState({
      phase: 'in-progress',
      quiz: data,
      currentIndex: 0,
      answers: new Array(data.questions.length).fill(null),
    });
  }

  function pickOption(optionIndex: number) {
    if (state.phase !== 'in-progress') return;
    const next = [...state.answers];
    next[state.currentIndex] = optionIndex;
    setState({ ...state, answers: next });
  }

  async function nextQuestion() {
    if (state.phase !== 'in-progress') return;
    const isLast = state.currentIndex >= state.quiz.questions.length - 1;
    if (!isLast) {
      setState({ ...state, currentIndex: state.currentIndex + 1 });
      return;
    }
    // Compute score and switch to review.
    const correct = state.answers.reduce<number>((acc, a, i) => {
      return acc + (a === state.quiz.questions[i].correctIndex ? 1 : 0);
    }, 0);
    const scorePct = Math.round((correct / state.quiz.questions.length) * 100);
    setState({ ...state, phase: 'review', scorePct, saving: true });

    // Save the score.
    const { error } = await markQuizCompleted(lessonId, scorePct);
    if (error) {
      // Non-fatal: show the score anyway. The error is logged for
      // diagnostics.
      console.warn('[TakeQuizButton] markQuizCompleted failed:', error);
    }
    setState((s) => (s.phase === 'review' ? { ...s, saving: false } : s));
  }

  function tryAgain() {
    setState({ phase: 'idle' });
  }

  // ─────────────────────────────────────────────────────────────────
  // Render: button (idle / loading / error)
  // ─────────────────────────────────────────────────────────────────
  if (state.phase === 'idle' || state.phase === 'error') {
    const isError = state.phase === 'error';
    return (
      <button
        onClick={startQuiz}
        className={cn(
          'flex items-center gap-2 rounded-xl font-bold transition-all',
          compact
            ? 'h-10 px-3 text-xs bg-tactical-purple/20 text-tactical-purple hover:bg-tactical-purple/30'
            : 'h-12 px-4 text-sm bg-tactical-purple text-white hover:bg-tactical-purple/90',
          isError && 'ring-1 ring-tactical-red/50'
        )}
      >
        <Sparkles className="w-4 h-4" />
        {isError ? 'Try quiz again' : 'Take quiz'}
      </button>
    );
  }

  if (state.phase === 'loading') {
    return (
      <button
        disabled
        className={cn(
          'flex items-center gap-2 rounded-xl font-bold',
          compact ? 'h-10 px-3 text-xs' : 'h-12 px-4 text-sm',
          'bg-white/10 text-white/50 cursor-not-allowed'
        )}
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        Generating…
      </button>
    );
  }

  // ─────────────────────────────────────────────────────────────────
  // Render: in-progress (one question at a time) + review
  // ─────────────────────────────────────────────────────────────────
  if (state.phase === 'in-progress' || state.phase === 'review') {
    const { quiz, answers, currentIndex, scorePct, saving } =
      state.phase === 'in-progress'
        ? { ...state, scorePct: 0, saving: false }
        : { ...state, currentIndex: 0 };

    const isReview = state.phase === 'review';
    const question = quiz.questions[currentIndex];
    const userAnswer = answers[currentIndex];
    const answered = userAnswer !== null;
    const isCorrect = answered && userAnswer === question.correctIndex;
    const isLast = currentIndex === quiz.questions.length - 1;

    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={isReview ? 'review' : `q-${currentIndex}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          className="card-tactical space-y-4"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
              {isReview ? 'Quiz complete' : `Question ${currentIndex + 1} of ${quiz.questions.length}`}
            </p>
            {!isReview && (
              <div className="h-1.5 w-24 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-tactical-purple transition-all"
                  style={{ width: `${((currentIndex) / quiz.questions.length) * 100}%` }}
                />
              </div>
            )}
          </div>

          {!isReview ? (
            <>
              {/* The question */}
              <p className="text-base font-bold leading-snug">{question.question}</p>

              {/* The options */}
              <div className="space-y-2">
                {question.options.map((opt, i) => {
                  const isPicked = userAnswer === i;
                  const isTheRight = i === question.correctIndex;
                  let cls = 'bg-white/5 border-white/10 hover:bg-white/10';
                  if (answered) {
                    if (isTheRight) {
                      cls = 'bg-tactical-neon/20 border-tactical-neon/50';
                    } else if (isPicked) {
                      cls = 'bg-tactical-red/20 border-tactical-red/50';
                    } else {
                      cls = 'bg-white/5 border-white/10 opacity-50';
                    }
                  }
                  return (
                    <button
                      key={i}
                      onClick={() => pickOption(i)}
                      disabled={answered}
                      className={cn(
                        'w-full text-left p-3 rounded-xl border text-sm transition-all',
                        cls,
                        'disabled:cursor-default'
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {answered && isTheRight && <CheckCircle2 className="w-4 h-4 text-tactical-neon shrink-0" />}
                        {answered && isPicked && !isTheRight && <XCircle className="w-4 h-4 text-tactical-red shrink-0" />}
                        <span>{opt}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Explanation (revealed after answering) */}
              {answered && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className={cn(
                    'rounded-xl p-3 text-xs',
                    isCorrect
                      ? 'bg-tactical-neon/10 border border-tactical-neon/30 text-tactical-neon'
                      : 'bg-tactical-red/10 border border-tactical-red/30 text-tactical-red'
                  )}
                >
                  <p className="font-bold mb-1">
                    {isCorrect ? 'Correct.' : 'Not quite.'}
                  </p>
                  <p className="text-white/80">{question.explanation}</p>
                </motion.div>
              )}

              {/* Next / Finish button */}
              <button
                onClick={nextQuestion}
                disabled={!answered}
                className={cn(
                  'w-full h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all',
                  answered
                    ? 'bg-tactical-neon text-black hover:bg-white'
                    : 'bg-white/10 text-white/30 cursor-not-allowed'
                )}
              >
                {isLast ? 'See your score' : 'Next question'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </>
          ) : (
            <>
              {/* Review: score + breakdown */}
              <div className="text-center py-2">
                <p className="text-5xl font-black text-tactical-neon">
                  {scorePct}
                  <span className="text-2xl text-white/50">/100</span>
                </p>
                <p className="text-sm text-white/60 mt-1">
                  {scorePct === 100
                    ? 'Perfect score. CFO-level.'
                    : scorePct >= 75
                      ? 'Strong — you know this lesson well.'
                      : scorePct >= 50
                        ? 'Passing — re-read the lesson to fill the gaps.'
                        : 'Worth another read. The Apply-to-your-business button below is your friend.'}
                </p>
                {saving && (
                  <p className="text-[10px] text-white/30 mt-1 flex items-center justify-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> Saving score…
                  </p>
                )}
              </div>

              {/* Per-question breakdown */}
              <div className="space-y-1.5">
                {quiz.questions.map((q, i) => {
                  const correct = answers[i] === q.correctIndex;
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-2 text-[11px] text-white/60"
                    >
                      {correct ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-tactical-neon shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-tactical-red shrink-0 mt-0.5" />
                      )}
                      <span className="line-clamp-2">{q.question}</span>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={tryAgain}
                className="w-full h-10 rounded-xl bg-white/5 text-white/80 text-xs font-bold flex items-center justify-center gap-2 hover:bg-white/10"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Try again
              </button>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    );
  }

  // Shouldn't reach here — exhaustive state handling.
  return null;
}
