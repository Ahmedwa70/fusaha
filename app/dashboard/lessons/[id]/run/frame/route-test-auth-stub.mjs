// Auth DAL fake for the play-frame route tests. `state.user` is what
// getCurrentUser() returns; tests mutate it per case.
export const state = {
  user: /** @type {{ id: string; roleName: string } | null} */ ({ id: "teacher-1", roleName: "teacher" }),
};

export async function getCurrentUser() {
  return state.user;
}
