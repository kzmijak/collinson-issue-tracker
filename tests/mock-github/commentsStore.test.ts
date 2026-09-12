import { describe, expect, it } from 'vitest';
import { CommentsStore } from '../../src/mock-github/commentsStore.js';

describe('CommentsStore', () => {
  it('starts every issue with no comments', () => {
    const store = new CommentsStore();

    expect(store.getCommentsCount(1)).toBe(0);
    expect(store.getComments(1)).toEqual([]);
  });

  it('appends comments in order and reflects them in the count', () => {
    const store = new CommentsStore();

    store.addComment(1, 'Hello World!');
    store.addComment(1, "I've been here!");

    expect(store.getCommentsCount(1)).toBe(2);
    expect(store.getComments(1).map((c) => c.body)).toEqual(['Hello World!', "I've been here!"]);
  });

  it('keeps issues independent of one another', () => {
    const store = new CommentsStore();

    store.addComment(1, 'Hello World!');

    expect(store.getCommentsCount(2)).toBe(0);
  });

  it('stamps every comment with a created_at timestamp', () => {
    const store = new CommentsStore();

    const comment = store.addComment(1, 'Hello World!');

    expect(() => new Date(comment.created_at).toISOString()).not.toThrow();
  });
});
