export function isValidHttpUrl(url: string): boolean {
  // basic validation, does not allow a / at the end of the url
  const regex = /^https?:\/\/[^\s/$.?#].[^\s]*(?!\/)$/;
  return regex.test(url);
}
