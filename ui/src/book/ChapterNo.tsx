// A chapter number in a three-character column: " 9." and "10." put their periods in the same place, so that the
// titles after them start at the same position (in headings, the sidebar and the contents page alike). The space
// before a one-digit number is a real half-width space, kept by white-space: pre in a monospaced column.
// A page under a chapter (国債先物・CTD under 2, PRDC under 11) is numbered "2.1", "11.1" in its own column, so that
// it never reads as a chapter with a missing number between two numbered ones.

export const chapterNoText = (n: number, sub?: number) => (sub ? `${n}.${sub}` : `${n < 10 ? " " : ""}${n}.`);

export function ChapterNo({ n, sub }: { n: number; sub?: number }) {
  return <span className={sub ? "chapter-no chapter-sub-no" : "chapter-no"}>{chapterNoText(n, sub)}</span>;
}
