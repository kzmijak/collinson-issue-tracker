/** The subset of the GitHub issues-list shape the reader actually relies on. */
export interface Issue {
  id: number;
  number: number;
  title: string;
  state: string;
}
