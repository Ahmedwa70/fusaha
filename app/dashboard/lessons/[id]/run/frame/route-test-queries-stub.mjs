// Play-queries fake for the play-frame route tests. `state.lesson` is what
// getApprovedLessonForPlay() resolves to — null models every fail-closed
// resolution the route must turn into a 404 (including the production
// incident: a legacy lesson whose template was retired and has nothing left
// to serve). The real resolution logic is covered against a real database in
// lib/dashboard/queries/lesson-play-queries.test.ts and
// lib/runtime/lesson-play-cutover.test.ts.
export const state = {
  lesson: /** @type {{ name: string; content: unknown; htmlPlayer: string; playerSource: "runtime" | "template" } | null} */ (null),
  lastCall: /** @type {{ ownerId: string; lessonId: string } | null} */ (null),
};

export async function getApprovedLessonForPlay(ownerId, lessonId) {
  state.lastCall = { ownerId, lessonId };
  return state.lesson;
}

export async function getApprovedLessonByShareToken() {
  throw new Error("the frame route never serves share tokens — not exercised here");
}
