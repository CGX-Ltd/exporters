import { TokenTheme } from "@supernovaio/sdk-exporters"
import { ThemeHelper } from "@supernovaio/export-utils"
import { exportConfiguration } from ".."

/**
 * Splits themes for the merged-theme-suffix mode into those merged into the base files (with a
 * theme-name suffix) and those the user opted to keep as separate `.theme-{theme}` files via
 * `mergedSuffixExcludedThemes`. Matched by theme name, case-insensitive. When the config list is
 * empty, `separate` is empty and behavior is identical to merging every theme.
 */
export function partitionThemesForSuffix(themes: Array<TokenTheme>): {
  merged: Array<TokenTheme>
  separate: Array<TokenTheme>
} {
  const names = new Set(exportConfiguration.mergedSuffixExcludedThemes.map((n) => n.trim().toLowerCase()))
  const isSeparate = (theme: TokenTheme) => names.has(ThemeHelper.getThemeName(theme).trim().toLowerCase())
  return {
    merged: themes.filter((theme) => !isSeparate(theme)),
    separate: themes.filter(isSeparate),
  }
}
