/**
 * Theme management for the Uplink support site (standalone).
 * Mirrors the customer-portal pattern: 'light' | 'dark' | 'system',
 * default 'system'. The init script runs before paint to avoid FOUC.
 */

export type Theme = "light" | "dark" | "system";

export const THEME_COOKIE = "uplink_theme";
export const THEME_STORAGE_KEY = "uplink-theme";

export function isTheme(v: unknown): v is Theme {
	return v === "light" || v === "dark" || v === "system";
}

export const themeInitScript = `(function(){try{
  var s=localStorage.getItem('${THEME_STORAGE_KEY}');
  var sys=window.matchMedia('(prefers-color-scheme: dark)').matches;
  var dark = s==='dark' || (s!=='light' && sys);
  if(dark){document.documentElement.classList.add('dark');}
  else{document.documentElement.classList.remove('dark');}
}catch(e){}})();`;
