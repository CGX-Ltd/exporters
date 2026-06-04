import { Supernova, PulsarContext, RemoteVersionIdentifier, AnyOutputFile, TokenType, Token, TokenGroup, TokenTheme } from "@supernovaio/sdk-exporters"
import { ExporterConfiguration, ThemeExportStyle, OutputType } from "../config"
import { indexOutputFile } from "./files/index-file"
import { styleOutputFile } from "./files/style-file"
import { typesOutputFile } from "./files/types-file"
import { folderIndexOutputFile } from "./files/folder-index-file"
import { jsMergedSuffixStyleFiles } from "./files/merged-suffix-style-file"
import { generateStyleFiles as generateCssStyleFiles, mergedSuffixStyleFiles, ThemeSuffixSet } from "./files/css-style-file"
import { cssIndexOutputFile } from "./files/css-index-file"
import { StringCase, ThemeHelper, WriteTokenPropStore } from "@supernovaio/export-utils"
import { tokenObjectKeyName } from "./content/token"
import { tokenVariableName } from "./content/css-token"

/** Exporter configuration from the resolved default configuration and user overrides */
export const exportConfiguration = Pulsar.exportConfig<ExporterConfiguration>()

/** Filters out null values from an array of output files */
function processOutputFiles(files: Array<AnyOutputFile | null>): Array<AnyOutputFile> {
  return files.filter((file): file is AnyOutputFile => file !== null)
}

/** Builds the per-theme override sets used by the merged-theme-suffix mode (shared by CSS and JS). */
function buildThemeSuffixSets(sdk: Supernova, tokens: Array<Token>, themesToApply: Array<TokenTheme>): Array<ThemeSuffixSet> {
  return themesToApply.map((theme) => ({
    suffix: ThemeHelper.getThemeIdentifier(theme),
    themedTokens: sdk.tokens.computeTokensByApplyingThemes(tokens, tokens, [theme]),
    theme,
  }))
}

/**
 * Generates the CSS-in-JS (.ts) output files.
 * When `themesToApply` is null, only base files are generated (also used after ApplyDirectly).
 */
function generateJsFiles(
  sdk: Supernova,
  tokens: Array<Token>,
  tokenGroups: Array<TokenGroup>,
  themesToApply: Array<TokenTheme> | null
): Array<AnyOutputFile> {
  const baseFiles = (toks: Array<Token>): Array<AnyOutputFile | null> =>
    exportConfiguration.exportBaseValues
      ? [
          ...Object.values(TokenType).map((type) => styleOutputFile(type, toks, tokenGroups)),
          ...(exportConfiguration.generateFolderIndexFiles
            ? [folderIndexOutputFile(toks, exportConfiguration.baseStyleFilePath)]
            : []),
        ]
      : []

  const typeDefs = (toks: Array<Token>): Array<AnyOutputFile | null> =>
    exportConfiguration.generateTypeDefinitions ? [typesOutputFile(toks, tokenGroups)] : []

  // No themes (or themes applied directly) → base files only
  if (!themesToApply) {
    return processOutputFiles([
      ...baseFiles(tokens),
      ...(exportConfiguration.generateIndexFile ? [indexOutputFile(tokens)] : []),
      ...typeDefs(tokens),
    ])
  }

  switch (exportConfiguration.exportThemesAs) {
    case ThemeExportStyle.SeparateFiles: {
      const themeFiles = themesToApply.flatMap((theme) => {
        const themedTokens = sdk.tokens.computeTokensByApplyingThemes(tokens, tokens, [theme])
        const themePath = ThemeHelper.getThemeIdentifier(theme, StringCase.camelCase)
        const files: Array<AnyOutputFile | null> = Object.values(TokenType).map((type) =>
          styleOutputFile(type, themedTokens, tokenGroups, themePath, theme)
        )
        if (exportConfiguration.generateFolderIndexFiles) {
          files.push(folderIndexOutputFile(themedTokens, themePath, theme))
        }
        return files
      })

      return processOutputFiles([
        ...baseFiles(tokens),
        ...themeFiles,
        ...(exportConfiguration.generateIndexFile ? [indexOutputFile(tokens, themesToApply)] : []),
        ...typeDefs(tokens),
      ])
    }

    case ThemeExportStyle.MergedTheme: {
      const themedTokens = sdk.tokens.computeTokensByApplyingThemes(tokens, tokens, themesToApply)
      const mergedThemeFiles = Object.values(TokenType).map((type) =>
        styleOutputFile(type, themedTokens, tokenGroups, "themed", themesToApply[0])
      )
      return processOutputFiles([
        ...baseFiles(tokens),
        ...mergedThemeFiles,
        ...(exportConfiguration.generateIndexFile ? [indexOutputFile(tokens, ["themed"])] : []),
        ...typeDefs(tokens),
      ])
    }

    case ThemeExportStyle.MergedThemeSuffix: {
      const themeSets = buildThemeSuffixSets(sdk, tokens, themesToApply)
      const suffixFiles = jsMergedSuffixStyleFiles(tokens, tokenGroups, themeSets)
      return processOutputFiles([
        ...suffixFiles,
        ...(exportConfiguration.generateFolderIndexFiles
          ? [folderIndexOutputFile(tokens, exportConfiguration.baseStyleFilePath)]
          : []),
        ...(exportConfiguration.generateIndexFile ? [indexOutputFile(tokens)] : []),
        ...typeDefs(tokens),
      ])
    }

    default:
      return []
  }
}

/**
 * Generates the CSS variable (.css) output files.
 * When `themesToApply` is null, only base files are generated (also used after ApplyDirectly).
 */
function generateCssFiles(
  sdk: Supernova,
  tokens: Array<Token>,
  tokenGroups: Array<TokenGroup>,
  themesToApply: Array<TokenTheme> | null
): Array<AnyOutputFile> {
  const baseFiles = (toks: Array<Token>): Array<AnyOutputFile> =>
    exportConfiguration.exportBaseValues ? generateCssStyleFiles(toks, tokenGroups, "", undefined) : []

  // No themes (or themes applied directly) → base files only
  if (!themesToApply) {
    return processOutputFiles([...baseFiles(tokens), cssIndexOutputFile(tokens)])
  }

  switch (exportConfiguration.exportThemesAs) {
    case ThemeExportStyle.SeparateFiles: {
      const themeFiles = themesToApply.flatMap((theme) => {
        const themedTokens = sdk.tokens.computeTokensByApplyingThemes(tokens, tokens, [theme])
        return generateCssStyleFiles(themedTokens, tokenGroups, ThemeHelper.getThemeIdentifier(theme), theme)
      })
      return processOutputFiles([...baseFiles(tokens), ...themeFiles, cssIndexOutputFile(tokens, themesToApply)])
    }

    case ThemeExportStyle.MergedTheme: {
      const themedTokens = sdk.tokens.computeTokensByApplyingThemes(tokens, tokens, themesToApply)
      const mergedThemeFiles = generateCssStyleFiles(themedTokens, tokenGroups, "themed", themesToApply[0])
      return processOutputFiles([...baseFiles(tokens), ...mergedThemeFiles, cssIndexOutputFile(tokens, ["themed"])])
    }

    case ThemeExportStyle.MergedThemeSuffix: {
      const themeSets = buildThemeSuffixSets(sdk, tokens, themesToApply)
      const suffixFiles = mergedSuffixStyleFiles(tokens, tokenGroups, themeSets)
      return processOutputFiles([...suffixFiles, cssIndexOutputFile(tokens)])
    }

    default:
      return []
  }
}

/**
 * Main export function. Generates CSS variables, CSS-in-JS, or both (per `outputType`) from design
 * tokens, supporting per-theme files, a merged theme, themes applied directly, or themes merged into
 * the base files with a theme-name suffix.
 */
Pulsar.export(async (sdk: Supernova, context: PulsarContext): Promise<Array<AnyOutputFile>> => {
  const remoteVersionIdentifier: RemoteVersionIdentifier = {
    designSystemId: context.dsId,
    versionId: context.versionId,
  }

  let tokens = await sdk.tokens.getTokens(remoteVersionIdentifier)
  let tokenGroups = await sdk.tokens.getTokenGroups(remoteVersionIdentifier)

  // Filter by brand if specified
  if (context.brandId) {
    const brands = await sdk.brands.getBrands(remoteVersionIdentifier)
    const brand = brands.find((brand) => brand.id === context.brandId || brand.idInVersion === context.brandId)
    if (!brand) {
      throw new Error(`Unable to find brand ${context.brandId}.`)
    }
    tokens = tokens.filter((token) => token.brandId === brand.id)
    tokenGroups = tokenGroups.filter((tokenGroup) => tokenGroup.brandId === brand.id)
  }

  // Resolve requested themes
  let themesToApply: Array<TokenTheme> | null = null
  if (context.themeIds && context.themeIds.length > 0) {
    const themes = await sdk.tokens.getTokenThemes(remoteVersionIdentifier)
    themesToApply = context.themeIds.map((themeId) => {
      const theme = themes.find((theme) => theme.id === themeId || theme.idInVersion === themeId)
      if (!theme) {
        throw new Error(`Unable to find theme ${themeId}`)
      }
      return theme
    })

    // ApplyDirectly: bake themes into the tokens and emit them as the (themeless) base output
    if (exportConfiguration.exportThemesAs === ThemeExportStyle.ApplyDirectly) {
      tokens = sdk.tokens.computeTokensByApplyingThemes(tokens, tokens, themesToApply)
      themesToApply = null
    }
  }

  // Dispatch by output format
  const outputFiles: Array<AnyOutputFile> = []
  if (exportConfiguration.outputType === OutputType.CSS || exportConfiguration.outputType === OutputType.Both) {
    outputFiles.push(...generateCssFiles(sdk, tokens, tokenGroups, themesToApply))
  }
  if (exportConfiguration.outputType === OutputType.JS || exportConfiguration.outputType === OutputType.Both) {
    outputFiles.push(...generateJsFiles(sdk, tokens, tokenGroups, themesToApply))
  }

  // Write the generated variable name back to each token if configured
  if (!context.isPreview && exportConfiguration.writeNameToProperty) {
    const writeStore = new WriteTokenPropStore(sdk, remoteVersionIdentifier)
    await writeStore.writeTokenProperties(exportConfiguration.propertyToWriteNameTo, tokens, (token) => {
      // JS-only output writes the JS object key; CSS / Both write the CSS variable name
      if (exportConfiguration.outputType === OutputType.JS) {
        return tokenObjectKeyName(token, tokenGroups)
      }
      return exportConfiguration.propertyToWriteNameToIncludesVar
        ? `var(--${tokenVariableName(token, tokenGroups)})`
        : tokenVariableName(token, tokenGroups)
    })
  }

  return outputFiles
})
