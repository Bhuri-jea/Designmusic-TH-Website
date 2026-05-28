// src/utils/navigation.ts

// List of non-default languages that have subfolders
const nonDefaultLangs = ['th', 'zh-CN', 'ja'];

export function getLocalizedPath(path: string, currentUrl: URL): string {
  // Extract the first segment of the URL path to find the current language
  const segments = currentUrl.pathname.split('/').filter(Boolean);
  const firstSegment = segments[0];
  
  // Determine if the user is currently browsing a localized subfolder
  const currentLang = nonDefaultLangs.includes(firstSegment) ? firstSegment : 'en';
  
  // Clean up the target path (ensure it starts with a slash)
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  // Condition 1 & 2 Rule: 
  // If current language is English, return the clean path without prefix.
  // Otherwise, prefix the path with the active language code.
  if (currentLang === 'en') {
    return cleanPath;
  } else {
    return `/${currentLang}${cleanPath === '/' ? '' : cleanPath}`;
  }
}

export function getCurrentLang(currentUrl: URL): string {
  const segments = currentUrl.pathname.split('/').filter(Boolean);
  return nonDefaultLangs.includes(segments[0]) ? segments[0] : 'en';
}