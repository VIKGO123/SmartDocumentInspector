"use client";

interface Props {
  query: string;
  count: number;
  index: number;
  onPrev: () => void;
  onNext: () => void;
}

export function SearchMatchBar({ query, count, index, onPrev, onNext }: Props) {
  const q = query.trim();
  if (!q) return null;
  return (
    <div className="search-match-bar">
      <span className="muted">
        {count === 0 ? `No matches for “${q}”` : `${index + 1} of ${count} matches`}
      </span>
      <div>
        <button
          type="button"
          className="ghost-btn"
          disabled={count === 0}
          aria-label="Previous match"
          onClick={onPrev}
        >
          Prev
        </button>{" "}
        <button
          type="button"
          className="ghost-btn"
          disabled={count === 0}
          aria-label="Next match"
          onClick={onNext}
        >
          Next
        </button>
      </div>
    </div>
  );
}
