import { FileHelper, ThemeHelper, FileNameHelper, GeneralHelper } from "@supernovaio/export-utils"
import { OutputTextFile, Token, TokenGroup, TokenType, TokenTheme } from "@supernovaio/sdk-exporters"
import { exportConfiguration } from ".."
import { convertedToken, analyzeTokensForRgbUtilities } from "../content/css-token"
import { DEFAULT_STYLE_FILE_NAMES } from "../constants/defaults"
import { FileStructure } from "../../config"

/** CSS file name for a token type, honoring customizeStyleFileNames and forcing a `.css` extension. */
function cssFileNameFor(type: TokenType): string {
  const raw = exportConfiguration.customizeStyleFileNames
    ? exportConfiguration.styleFileNames[type]
    : DEFAULT_STYLE_FILE_NAMES[type]
  return FileNameHelper.ensureFileExtension(raw.replace(/\.(ts|css)$/i, ""), ".css")
}

/** Wraps CSS variable declarations in the configured selector and disclaimer. */
function wrapInSelector(cssVariables: string, themePath: string): string {
  const selector = themePath
    ? exportConfiguration.themeSelector.replace("{theme}", themePath)
    : exportConfiguration.cssSelector

  let content = `${selector} {\n${cssVariables}\n}`
  if (exportConfiguration.showGeneratedFileDisclaimer) {
    content = GeneralHelper.addDisclaimer(exportConfiguration.disclaimer, content)
  }
  return content
}

/**
 * Main entry point for generating CSS style files (separate-by-type or single-file).
 *
 * @param tokens - Array of all available tokens (already themed for theme files)
 * @param tokenGroups - Array of token groups for reference
 * @param themePath - Optional path for theme-specific files (e.g. 'dark')
 * @param theme - Optional theme configuration for themed tokens
 */
export function generateStyleFiles(
  tokens: Array<Token>,
  tokenGroups: Array<TokenGroup>,
  themePath: string = "",
  theme?: TokenTheme
): Array<OutputTextFile> {
  if (!exportConfiguration.exportBaseValues && !themePath) {
    return []
  }

  if (exportConfiguration.fileStructure === FileStructure.SingleFile) {
    const result = generateCombinedStyleFile(tokens, tokenGroups, themePath, theme)
    return result ? [result] : []
  }

  const types = [...new Set(tokens.map((token) => token.tokenType))]
  return types
    .map((type) => styleOutputFile(type, tokens, tokenGroups, themePath, theme))
    .filter((file): file is OutputTextFile => file !== null)
}

/**
 * Generates a CSS output file for a specific token type, handling both base and themed tokens.
 */
export function styleOutputFile(
  type: TokenType,
  tokens: Array<Token>,
  tokenGroups: Array<TokenGroup>,
  themePath: string = "",
  theme?: TokenTheme
): OutputTextFile | null {
  if (!exportConfiguration.exportBaseValues && !themePath) {
    return null
  }

  let tokensOfType = tokens.filter((token) => token.tokenType === type)

  if (themePath && theme && exportConfiguration.exportOnlyThemedTokens) {
    tokensOfType = ThemeHelper.filterThemedTokens(tokensOfType, theme)
    if (tokensOfType.length === 0) {
      return null
    }
  }

  if (!exportConfiguration.generateEmptyFiles && tokensOfType.length === 0) {
    return null
  }

  const mappedTokens = new Map(tokens.map((token) => [token.id, token]))
  const colorTokensNeedingRgb = analyzeTokensForRgbUtilities(tokens)

  const cssVariables = tokensOfType
    .map((token) => convertedToken(token, mappedTokens, tokenGroups, colorTokensNeedingRgb))
    .join("\n")

  const content = wrapInSelector(cssVariables, themePath)

  return FileHelper.createTextFile({
    relativePath: themePath ? `./${themePath}` : exportConfiguration.baseStyleFilePath,
    fileName: cssFileNameFor(type),
    content: content,
  })
}

/** Generates a single CSS file containing all token types (single-file mode). */
function generateCombinedStyleFile(
  tokens: Array<Token>,
  tokenGroups: Array<TokenGroup>,
  themePath: string = "",
  theme?: TokenTheme
): OutputTextFile | null {
  let processedTokens = tokens

  if (themePath && theme && exportConfiguration.exportOnlyThemedTokens) {
    processedTokens = ThemeHelper.filterThemedTokens(processedTokens, theme)
    if (processedTokens.length === 0) {
      return null
    }
  }

  if (!exportConfiguration.generateEmptyFiles && processedTokens.length === 0) {
    return null
  }

  const mappedTokens = new Map(tokens.map((token) => [token.id, token]))
  const colorTokensNeedingRgb = analyzeTokensForRgbUtilities(tokens)

  const cssVariables = processedTokens
    .map((token) => convertedToken(token, mappedTokens, tokenGroups, colorTokensNeedingRgb))
    .join("\n")

  const content = wrapInSelector(cssVariables, themePath)

  return FileHelper.createTextFile({
    relativePath: "./",
    fileName: themePath ? `tokens.${themePath}.css` : "tokens.css",
    content: content,
  })
}

/** A theme's overrides, pre-computed by the orchestrator, for merged-suffix generation. */
export type ThemeSuffixSet = {
  /** Theme identifier used as the CSS BEM modifier (e.g. 'dark') */
  suffix: string
  /** Full token set with this theme applied (used for reference resolution) */
  themedTokens: Array<Token>
  /** The theme, used to determine which tokens it overrides */
  theme: TokenTheme
}

/**
 * Generates CSS files for the merged-theme-suffix mode: base values plus, for every token a theme
 * overrides, an additional `--name--theme` declaration carrying the themed value — all in one file
 * (per type, or one combined file) with no theme subfolders.
 */
export function mergedSuffixStyleFiles(
  baseTokens: Array<Token>,
  tokenGroups: Array<TokenGroup>,
  themeSets: Array<ThemeSuffixSet>
): Array<OutputTextFile> {
  const singleFile = exportConfiguration.fileStructure === FileStructure.SingleFile
  const types = singleFile
    ? [null] // single combined file handles all types together
    : ([...new Set(baseTokens.map((t) => t.tokenType))] as Array<TokenType | null>)

  return types
    .map((type) => mergedSuffixFileForType(type, baseTokens, tokenGroups, themeSets))
    .filter((file): file is OutputTextFile => file !== null)
}

function mergedSuffixFileForType(
  type: TokenType | null,
  baseTokens: Array<Token>,
  tokenGroups: Array<TokenGroup>,
  themeSets: Array<ThemeSuffixSet>
): OutputTextFile | null {
  const ofType = (tokens: Array<Token>) => (type === null ? tokens : tokens.filter((t) => t.tokenType === type))

  const baseOfType = ofType(baseTokens)
  const baseRgb = analyzeTokensForRgbUtilities(baseTokens)
  const baseMapped = new Map(baseTokens.map((t) => [t.id, t]))

  const lines: Array<string> = baseOfType.map((token) => convertedToken(token, baseMapped, tokenGroups, baseRgb))

  for (const set of themeSets) {
    const overriddenIds = new Set(set.theme.overriddenTokens.map((o) => o.id))
    const themedMapped = new Map(set.themedTokens.map((t) => [t.id, t]))
    const themedRgb = analyzeTokensForRgbUtilities(set.themedTokens)
    const overriddenOfType = ofType(set.themedTokens).filter((t) => overriddenIds.has(t.id))

    for (const token of overriddenOfType) {
      lines.push(convertedToken(token, themedMapped, tokenGroups, themedRgb, set.suffix, overriddenIds))
    }
  }

  if (lines.length === 0 && !exportConfiguration.generateEmptyFiles) {
    return null
  }

  const content = wrapInSelector(lines.join("\n"), "")

  return FileHelper.createTextFile({
    relativePath: type === null ? "./" : exportConfiguration.baseStyleFilePath,
    fileName: type === null ? "tokens.css" : cssFileNameFor(type),
    content: content,
  })
}
