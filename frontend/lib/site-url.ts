/** Absolute URL for opening a site in the browser (adds https:// if missing). */
export function siteUrlHref(raw: string): string {
  const url = raw.trim();
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `https://${url}`;
}
