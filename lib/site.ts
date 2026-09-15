const fallbackSiteUrl = "https://jazamila.com";

export function getSiteUrl(): URL {
  try {
    return new URL(process.env.NEXT_PUBLIC_APP_URL?.trim() || fallbackSiteUrl);
  } catch {
    return new URL(fallbackSiteUrl);
  }
}

export function absoluteSiteUrl(pathname: string): string {
  return new URL(pathname, getSiteUrl()).toString();
}
