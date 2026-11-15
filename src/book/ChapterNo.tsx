// A chapter number in a three-character column: " 9." and "10." put their periods in the same place, so that the
// titles after them start at the same position (in headings, the sidebar and the contents page alike). The space
// before a one-digit number is a real half-width space, kept by white-space: pre in a monospaced column.

export const chapterNoText = (n: number) => `${n < 10 ? " " : ""}${n}.`;

export function ChapterNo({ n }: { n: number }) {
  return <span className="chapter-no" aria-hidden="false">{chapterNoText(n)}</span>;
}
