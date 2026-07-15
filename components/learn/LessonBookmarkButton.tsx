'use client';

import { useState, useTransition } from 'react';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toggleBookmark } from '@/lib/actions/learn';

/**
 * LessonBookmarkButton (Phase 4 / 4D.2).
 *
 * Small client component that toggles the user's bookmark on the
 * current lesson. Optimistic update — we flip the icon immediately
 * and roll back if the server action fails. The server action does
 * a SELECT-then-UPSERT so it's safe under concurrent clicks.
 *
 * Two visual states:
 *   - Off  → outline Bookmark icon, white/40, "Save" label
 *   - On   → filled BookmarkCheck icon, tactical-neon (green), "Saved"
 *
 * The label is hidden on small screens to keep the header tidy on
 * mobile; the icon alone communicates the state.
 */

interface LessonBookmarkButtonProps {
  lessonId: string;
  initialBookmarked: boolean;
  /** Visual size: 'sm' for the lesson card list, 'md' for the reader header. */
  size?: 'sm' | 'md';
  /** When true, shows a text label next to the icon. */
  showLabel?: boolean;
  /** Optional className for the wrapping button. */
  className?: string;
}

export function LessonBookmarkButton({
  lessonId,
  initialBookmarked,
  size = 'md',
  showLabel = false,
  className,
}: LessonBookmarkButtonProps) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [, startTransition] = useTransition();

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
  const btnSize =
    size === 'sm'
      ? 'w-9 h-9 rounded-lg'
      : 'w-11 h-11 rounded-xl';

  const handleClick = () => {
    // Optimistic flip.
    const next = !bookmarked;
    setBookmarked(next);
    startTransition(async () => {
      const res = await toggleBookmark(lessonId, next);
      if (res.error) {
        // Roll back on failure.
        console.warn('[LessonBookmarkButton] toggle failed:', res.error);
        setBookmarked(!next);
      } else if (typeof res.data?.bookmarked === 'boolean') {
        // Trust the server's view if it returned one (matches our
        // optimistic value, but be defensive).
        setBookmarked(res.data.bookmarked);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={bookmarked}
      aria-label={bookmarked ? 'Remove bookmark' : 'Bookmark this lesson'}
      title={bookmarked ? 'Remove bookmark' : 'Bookmark this lesson'}
      className={cn(
        btnSize,
        'flex items-center justify-center gap-1.5 transition-colors shrink-0',
        'border',
        bookmarked
          ? 'bg-tactical-neon/15 border-tactical-neon/40 text-tactical-neon'
          : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white',
        className
      )}
    >
      {bookmarked ? (
        <BookmarkCheck className={iconSize} />
      ) : (
        <Bookmark className={iconSize} />
      )}
      {showLabel && (
        <span className="text-xs font-bold">
          {bookmarked ? 'Saved' : 'Save'}
        </span>
      )}
    </button>
  );
}
