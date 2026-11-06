// Actor stub for retire-independence tests. The real DAL needs NextAuth; the
// actions under test only need an authenticated admin id for audit logging.
let currentUser = { id: "00000000-0000-0000-0000-000000000000" };

export function setActor(user) {
  currentUser = user;
}

export async function requirePermission() {
  return currentUser;
}

export async function requireTeacher() {
  return currentUser;
}
