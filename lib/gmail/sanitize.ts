// sanitization for email HTML bodies.
// removes the most obvious script vectors so the iframe markup stays readable
// and tracker pixels don't fire on first paint.

const SCRIPT_TAG = /<script[\s\S]*?<\/script>/gi;
const STYLE_TAG = /<style[\s\S]*?<\/style>/gi;
const EVENT_HANDLER_ATTR = /\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi;
const JAVASCRIPT_URL = /\b(href|src|action|formaction)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|javascript:[^\s>]*)/gi;

const IMG_TAG = /<img[\s\S]*?>/gi;

export function sanitizeBodyHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(SCRIPT_TAG, "")
    .replace(STYLE_TAG, "")
    .replace(EVENT_HANDLER_ATTR, "")
    .replace(JAVASCRIPT_URL, "")
    .replace(IMG_TAG, "");
}
