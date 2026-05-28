import DOMPurify from 'dompurify'

const ALLOWED = {
  ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 's', 'h2', 'h3', 'ul', 'ol', 'li', 'blockquote', 'img'],
  ALLOWED_ATTR: ['src', 'alt', 'title'],
  FORBID_ATTR: ['style', 'class', 'onerror', 'onload', 'onclick', 'onmouseover'],
  ALLOW_DATA_ATTR: false,
}

export function sanitizeHtml(html: string): string {
  if (typeof window === 'undefined') return html
  return DOMPurify.sanitize(html, ALLOWED)
}
