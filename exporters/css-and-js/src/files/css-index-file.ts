import { FileHelper, FileNameHelper, ThemeHelper } from "@supernovaio/export-utils"
import { OutputTextFile, Token, TokenType, TokenTheme } from "@supernovaio/sdk-exporters"
import { exportConfiguration } from ".."
import { DEFAULT_STYLE_FILE_NAMES } from "../constants/defaults"
import { FileStructure } from "../../config"

/** CSS file name for a token type, honoring customizeStyleFileNames and forcing a `.css` extension. */
function cssFileNameFor(type: TokenType): string {
  const raw = exportConfiguration.customizeStyleFileNames
    ? exportConfiguration.styleFileNames[type]
    : DEFAULT_STYLE_FILE_NAMES[type]
  return FileNameHelper.ensureFileExtension(raw.replace(/\.(ts|css)$/i, ""), ".css")
}

/**
 * Generates the CSS index file (`@import` statements) for base and theme style files.
 *
 * @param tokens - Array of design tokens (used to determine which token types exist)
 * @param themes - Themes to import (empty for base-only / merged-suffix output)
 */
export function cssIndexOutputFile(tokens: Array<Token>, themes: Array<TokenTheme | string> = []): OutputTextFile | null {
  if (!exportConfiguration.generateIndexFile) {
    return null
  }

  const fileName = FileNameHelper.ensureFileExtension(exportConfiguration.cssIndexFileName, ".css")

  // Single combined file mode -> import tokens.css (+ tokens.{theme}.css)
  if (exportConfiguration.fileStructure === FileStructure.SingleFile) {
    const baseImport = exportConfiguration.exportBaseValues ? `/* Base tokens */\n@import "./tokens.css";` : ""

    const themeImports = themes
      .map((theme) => {
        const themePath = ThemeHelper.getThemeIdentifier(theme)
        const themeName = ThemeHelper.getThemeName(theme)
        return `/* Theme: ${themeName} */\n@import "./tokens.${themePath}.css";`
      })
      .join("\n\n")

    const separator = baseImport && themeImports ? "\n\n" : ""

    return FileHelper.createTextFile({
      relativePath: exportConfiguration.baseIndexFilePath,
      fileName,
      content: baseImport + separator + themeImports,
    })
  }

  // Separate-by-type mode
  const types = [...new Set(tokens.map((token) => token.tokenType))]

  const imports = exportConfiguration.exportBaseValues
    ? `/* Base tokens */\n` +
      types.map((type) => `@import "${exportConfiguration.baseStyleFilePath}/${cssFileNameFor(type)}";`).join("\n")
    : ""

  const themeImports = themes
    .map((theme) => {
      const themePath = ThemeHelper.getThemeIdentifier(theme)
      const themeName = ThemeHelper.getThemeName(theme)

      const themeTypes =
        exportConfiguration.exportOnlyThemedTokens && typeof theme !== "string"
          ? types.filter((type) => ThemeHelper.hasThemedTokens(tokens, type, theme))
          : types

      return themeTypes
        .map((type, index) => {
          const themeComment = index === 0 ? `/* Theme: ${themeName} */\n` : ""
          return `${themeComment}@import "./${themePath}/${cssFileNameFor(type)}";`
        })
        .join("\n")
    })
    .join("\n\n")

  const separator = imports && themeImports ? "\n\n" : ""

  return FileHelper.createTextFile({
    relativePath: exportConfiguration.baseIndexFilePath,
    fileName,
    content: imports + separator + themeImports,
  })
}
