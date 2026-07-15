'use client';

import { useEffect, useRef, useState } from 'react';
import { Play, Pause, Square, Volume2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * LessonAudioButton (Phase 4 / 4B.2).
 *
 * Two-tier audio strategy:
 *
 *   1. If `audioUrl` is set on the lesson (e.g. a pre-generated MP3
 *      from ElevenLabs / OpenAI TTS in a future phase), play it as
 *      a normal HTMLAudioElement. This is the "good" path.
 *
 *   2. Otherwise, fall back to the browser's built-in SpeechSynthesis
 *      API. Free, zero-config, runs on the user's phone. Voice quality
 *      is OS-dependent (robotic on some Android skins) but it's
 *      always available and never costs us a cent.
 *
 * Why this design:
 *   - The user explicitly asked for audio but Groq has no TTS
 *   - Web Speech is the only zero-cost option
 *   - `audio_url` already exists in the schema, so this leaves a
 *     clean upgrade path: when the user later adds a paid TTS
 *     provider, we just populate the column and the button upgrades
 *     itself without code changes.
 *
 * Buttons: Play / Pause (only for pre-generated audio) and a
 * combined Play/Stop toggle for the Web Speech path.
 */

interface LessonAudioButtonProps {
  /** Pre-generated audio URL (mp3 / m4a / wav). If set, takes priority. */
  audioUrl?: string | null;
  /** Plain-text body of the lesson, used for Web Speech fallback. */
  bodyText: string;
  /** Lesson title — prepended to the spoken text so listeners get context. */
  lessonTitle: string;
  /** Pillars color hint for the active state. */
  colorClass?: string;
}

type State = 'idle' | 'playing' | 'paused' | 'unsupported' | 'blocked';

export function LessonAudioButton({
  audioUrl,
  bodyText,
  lessonTitle,
  colorClass = 'bg-tactical-blue/20 border-tactical-blue/40 text-tactical-blue',
}: LessonAudioButtonProps) {
  const [state, setState] = useState<State>('idle');
  // For pre-generated audio (HTMLAudioElement).
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // For the Web Speech fallback (SpeechSynthesisUtterance).
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Detect Web Speech support on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (audioUrl) {
      // We always support HTMLAudio. No detection needed.
      return;
    }
    if (typeof window.speechSynthesis === 'undefined') {
      setState('unsupported');
    }
  }, [audioUrl]);

  // Tear down on unmount so the user can navigate away without
  // leaving speech running in the background.
  useEffect(() => {
    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function stop() {
    try {
      audioRef.current?.pause();
      audioRef.current = null;
    } catch {
      // ignore
    }
    try {
      window.speechSynthesis?.cancel();
      utteranceRef.current = null;
    } catch {
      // ignore
    }
  }

  function playPreGenerated() {
    if (!audioUrl) return;
    if (!audioRef.current) {
      const audio = new Audio(audioUrl);
      audio.preload = 'auto';
      audio.addEventListener('ended', () => {
        setState('idle');
        audioRef.current = null;
      });
      audio.addEventListener('error', () => {
        setState('idle');
        audioRef.current = null;
      });
      audioRef.current = audio;
    }
    audioRef.current.play().then(
      () => setState('playing'),
      () => {
        // Autoplay blocked (e.g. user hasn't interacted with the
        // page yet). The next click will retry.
        setState('blocked');
      }
    );
  }

  function pausePreGenerated() {
    audioRef.current?.pause();
    setState('paused');
  }

  function resumePreGenerated() {
    audioRef.current?.play().then(
      () => setState('playing'),
      () => setState('blocked')
    );
  }

  function playWithSpeech() {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setState('unsupported');
      return;
    }
    if (state === 'playing') {
      stop();
      setState('idle');
      return;
    }
    // Some browsers get into a stuck "paused" state; cancel + restart
    // to be safe.
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      `${lessonTitle}. ${bodyText}`
    );
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => {
      setState('idle');
      utteranceRef.current = null;
    };
    utterance.onerror = () => {
      setState('idle');
      utteranceRef.current = null;
    };
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
    setState('playing');
  }

  function stopSpeech() {
    stop();
    setState('idle');
  }

  if (state === 'unsupported') {
    return (
      <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/30">
        <AlertCircle className="w-3 h-3" />
        Audio not supported on this device
      </div>
    );
  }

  // Pre-generated audio path: Play / Pause toggle.
  if (audioUrl) {
    if (state === 'playing') {
      return (
        <button
          type="button"
          onClick={pausePreGenerated}
          className={cn(
            'inline-flex items-center gap-2 h-10 px-4 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors',
            colorClass
          )}
        >
          <Pause className="w-4 h-4" />
          Pause narration
          <Volume2 className="w-3 h-3 opacity-50" />
        </button>
      );
    }
    if (state === 'paused') {
      return (
        <button
          type="button"
          onClick={resumePreGenerated}
          className={cn(
            'inline-flex items-center gap-2 h-10 px-4 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors',
            'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
          )}
        >
          <Play className="w-4 h-4" />
          Resume narration
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={playPreGenerated}
        className={cn(
          'inline-flex items-center gap-2 h-10 px-4 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors',
          'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
        )}
      >
        <Play className="w-4 h-4" />
        Listen to this lesson
      </button>
    );
  }

  // Web Speech fallback path: Play / Stop toggle.
  if (state === 'playing') {
    return (
      <button
        type="button"
        onClick={stopSpeech}
        className={cn(
          'inline-flex items-center gap-2 h-10 px-4 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors',
          colorClass
        )}
      >
        <Square className="w-4 h-4" />
        Stop narration
        <Volume2 className="w-3 h-3 opacity-50 animate-pulse" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={playWithSpeech}
      className={cn(
        'inline-flex items-center gap-2 h-10 px-4 rounded-xl text-xs font-black uppercase tracking-widest border transition-colors',
        'bg-white/5 border-white/10 text-white/60 hover:bg-white/10 hover:text-white'
      )}
      title="Uses your device's built-in text-to-speech"
    >
      <Play className="w-4 h-4" />
      Listen to this lesson
    </button>
  );
}
