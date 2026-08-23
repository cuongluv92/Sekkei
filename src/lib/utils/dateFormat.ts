/**
 * App-wide date/time display always uses Japanese locale formatting
 * (year-month-day order, 24-hour time), independent of the ja/vi UI-text
 * toggle (`LanguageProvider`) — that toggle only translates interface
 * copy, not how dates render. Using the runtime's default locale here
 * would silently follow the host OS/browser locale instead (e.g. showing
 * Vietnamese-style dates on a vi-VN machine), so "ja-JP" is always passed
 * explicitly rather than omitted.
 */
export function formatJaTime(value: string | number | Date): string {
  return new Date(value).toLocaleTimeString("ja-JP");
}

export function formatJaDate(value: string | number | Date): string {
  return new Date(value).toLocaleDateString("ja-JP");
}

export function formatJaDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString("ja-JP");
}
