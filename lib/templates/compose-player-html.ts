const UNSAFE_SCRIPT_CHARS = new RegExp(`[<${String.fromCharCode(0x2028)}${String.fromCharCode(0x2029)}]`, "g");

const ESCAPES: Record<string, string> = {
  "<": "\\u003c",
  [String.fromCharCode(0x2028)]: "\\u2028",
  [String.fromCharCode(0x2029)]: "\\u2029",
};

export function composePlayerHtml(htmlPlayer: string, content: unknown): string {
  // Lesson content is AI-generated free text (teacher-supplied source, not
  // trusted) - escape sequences that would let it break out of the <script>
  // tag (e.g. a literal "</script>" inside a vocab/dialogue string) or that
  // are invalid inside a JS string literal per spec (U+2028/U+2029).
  const json = JSON.stringify(content).replace(UNSAFE_SCRIPT_CHARS, (char) => ESCAPES[char]);
  const script = `<script>window.LESSON_DATA = ${json};</script>`;
  // Some template sections size wider than the viewport, leaving a
  // page-level horizontal scrollbar in the run iframe. Contain it at the
  // document level here (our own composition step) rather than touching
  // the client-supplied template files.
  const style = `<style>html, body { overflow-x: hidden; }</style>`;
  const headMatch = htmlPlayer.match(/<head[^>]*>/i);
  if (headMatch) {
    const index = headMatch.index! + headMatch[0].length;
    return htmlPlayer.slice(0, index) + style + script + htmlPlayer.slice(index);
  }
  return style + script + htmlPlayer;
}
