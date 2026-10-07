/** Tiny URL helpers for clean /frame/<slug> deep links on static hosting. */
const FRAME_PATH = /\/frame\/([^/]+)\/?$/;
const KEY = "ff:deeplink";

/** 404.html parks the requested path here before bouncing to the app root; restore it as the visible URL. */
export function restoreDeepLink() {
  try {
    const path = sessionStorage.getItem(KEY);
    if (!path) return;
    sessionStorage.removeItem(KEY);
    history.replaceState(null, "", path);
  } catch (_) { /* storage blocked: the app simply opens at home */ }
}

/** The hosted-frame slug in the current URL, or null for the normal editor. */
export function getFrameSlug(loc = location) {
  const m = loc.pathname.match(FRAME_PATH);
  if (!m) return null;
  try { return decodeURIComponent(m[1]); } catch (_) { return m[1]; }
}
