/** Public project links (used for "Report a mistake" and the footer). */
export const REPO_URL = 'https://github.com/DarkwinPR/civics-128';

export function reportIssueUrl(title = '', body = ''): string {
  const params = new URLSearchParams({ template: 'report-mistake.yml' });
  if (title) params.set('title', title);
  if (body) params.set('details', body);
  return `${REPO_URL}/issues/new?${params.toString()}`;
}

/** Public URL of the running app, for share messages. */
export function appUrl(): string {
  return window.location.origin + window.location.pathname;
}
