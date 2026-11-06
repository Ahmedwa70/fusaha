// Minimal NextResponse stand-in for the play-frame route tests. The route
// only constructs responses (status + headers + string body); it never uses
// NextResponse-specific APIs (cookies, redirect, json), so extending the real
// Web Response keeps status/headers/body semantics fully faithful.
export class NextResponse extends Response {}
