import { highlightSegments } from '../fuzzy';

/** Renders text with fuzzy-matched characters in <mark>. */
export function Highlight({ text, indices }: { text: string; indices: readonly number[] }) {
  return (
    <>
      {highlightSegments(text, indices).map((s, i) =>
        s.match ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>,
      )}
    </>
  );
}
