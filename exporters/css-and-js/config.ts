import { StringCase, ColorFormat } from "@supernovaio/export-utils"
import { TokenType } from "@supernovaio/sdk-exporters"

/**
 * Main configuration of the exporter - type interface. Default values for it can be set through `config.json` and users can override the behavior when creating the pipelines.
 */
export enum ThemeExportStyle {
  ApplyDirectly = "applyDirectly",
  SeparateFiles = "separateFiles",
  MergedTheme = "mergedTheme",
  /** Merge every theme's overrides into the base files, suffixing each themed variable with the theme name (e.g. --margin--dark / marginDark) */
  MergedThemeSuffix = "mergedThemeSuffix",
}

export enum TokenSortOrder {
  Default = "default",
  Alphabetical = "alphabetical",
}

/** Which artifact(s) the exporter emits */
export enum OutputType {
  CSS = "css",
  JS = "js",
  Both = "both",
}

/** Controls how CSS token styles are organized into files */
export enum FileStructure {
  SeparateByType = "separateByType",
  SingleFile = "singleFile",
}

export type ExporterConfiguration = {
  /** Which artifact(s) to emit: CSS variables, CSS-in-JS, or both */
  outputType: OutputType
  /** When enabled, a disclaimer showing the fact that the file was generated automatically and should not be changed manually will appear in all style styles */
  showGeneratedFileDisclaimer: boolean
  /** When enabled, a disclaimer showing the fact that the file was generated automatically and should not be changed manually will appear in all style styles */
  disclaimer: string
  /** When enabled, file with all css style files imported will be generated */
  generateIndexFile: boolean
  /** When enabled, generates an index.ts in each theme/base folder */
  generateFolderIndexFiles: boolean
  /** When enabled, empty style files will be generated. Otherwise empty are omitted */
  generateEmptyFiles: boolean
  /** When enabled, token description will be shown as code comments for every exported token */
  showDescriptions: boolean
  /** When enabled, values will use references to other tokens where applicable */
  useReferences: boolean
  /** Style of exported token names (used for CSS-in-JS object keys) */
  tokenNameStyle: StringCase
  /** Style of exported CSS custom property names (CSS output only). Defaults to kebab-case to match standard CSS variable conventions */
  cssTokenNameStyle: StringCase
  /** Format of the exported colors */
  colorFormat: ColorFormat
  /** Max number of decimals in colors */
  colorPrecision: number
  /** Number of spaces used for indentation in generated files */
  indent: number
  /** When set, will prefix each token name with this identifier */
  tokenPrefixes: Record<TokenType, string>
  /** Name of each file that will be generated. Tokens are grouped by type */
  styleFileNames: Record<TokenType, string>
  /** Name of the index file that will be generated */
  indexFileName: string
  /** All files will be written to this directory (relative to export root) */
  baseStyleFilePath: string
  /** Index file will be written to this directory (relative to export root) */
  baseIndexFilePath: string
  /** Controls how themes are exported in the generated files */
  exportThemesAs: ThemeExportStyle
  /** Theme names (as shown in Supernova) to emit as separate .theme-{theme} files instead of
   *  merging them into the suffix output. Only applies when exportThemesAs === mergedThemeSuffix. */
  mergedSuffixSeparateThemes: Array<string>
  /** When enabled, themed files will only include tokens that have different values from the base theme */
  exportOnlyThemedTokens: boolean
  /** When enabled, base token values will be exported along with themes */
  exportBaseValues: boolean
  /** When enabled, converts pixel values to rem units */
  forceRemUnit: boolean
  /** Base pixel value for rem conversion (default: 16) */
  remBase: number
  /** When enabled, allows customization of style file names */
  customizeStyleFileNames: boolean
  /** When enabled, allows customization of token prefixes */
  customizeTokenPrefixes: boolean
  /** Global prefix for all token names. When set, all tokens will be prefixed with this value */
  globalNamePrefix: string
  /** When enabled, generates TypeScript type definitions file */
  generateTypeDefinitions: boolean
  /** Controls how tokens are sorted in the generated files */
  tokenSortOrder: TokenSortOrder
  /** When enabled, generated variable names will be saved back to tokens as custom properties */
  writeNameToProperty: boolean
  /** Name of the custom property where generated variable names will be saved */
  propertyToWriteNameTo: string
  /** If enabled, the resulting written properties will be encapsulated in var() syntax for easier copying (CSS output only) */
  propertyToWriteNameToIncludesVar: boolean
  /** CSS selector where base variables will be defined (CSS output only) */
  cssSelector: string
  /** CSS selector pattern for themes, {theme} will be replaced with theme name (CSS output only) */
  themeSelector: string
  /** When enabled, CSS references will include fallback values as raw token values (CSS output only) */
  useFallbackValues: boolean
  /** Controls how CSS token styles are organized into files (CSS output only) */
  fileStructure: FileStructure
  /** Name of the CSS index file that will be generated (CSS output only) */
  cssIndexFileName: string
}
