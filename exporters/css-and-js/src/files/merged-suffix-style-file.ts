import { FileHelper, CSSHelper, GeneralHelper, FileNameHelper } from "@supernovaio/export-utils"
import { OutputTextFile, Token, TokenGroup, TokenType } from "@supernovaio/sdk-exporters"
import { exportConfiguration } from ".."
import { tokenObjectKeyName, resetTokenNameTracking } from "../content/token"
import { DEFAULT_STYLE_FILE_NAMES } from "../constants/defaults"
import { formatTokenValue } from "../utils/value-formatter"
import { ThemeSuffixSet } from "./css-style-file"

/** File name (without extension) for a token type, honoring customizeStyleFileNames. */
function fileNameFor(type: TokenType): string {
  const raw = exportConfiguration.customizeStyleFileNames
    ? exportConfiguration.styleFileNames[type]
    : DEFAULT_STYLE_FILE_NAMES[type]
  return raw.replace(/\.ts$/, "")
}

/** A single token to emit in the merged-suffix file, with the theme context it belongs to. */
type Entry = {
  token: Token
  suffix?: string
  mappedTokens: Map<string, Token>
  overriddenIds: Set<string>
}

/** True when the token's value references another token. */
function hasReference(token: Token): boolean {
  return !!(token as any)?.value?.referencedTokenId
}

/**
 * Generates CSS-in-JS files for the merged-theme-suffix mode: each type file contains the base
 * consts/keys plus, for every token a theme overrides, a `nameTheme`-suffixed const/key carrying
 * the themed value. All files live in the base directory (no theme subfolders); cross-type
 * references import the sibling type file, whose exported object already holds the suffixed keys.
 */
export function jsMergedSuffixStyleFiles(
  baseTokens: Array<Token>,
  tokenGroups: Array<TokenGroup>,
  themeSets: Array<ThemeSuffixSet>
): Array<OutputTextFile> {
  const types = [...new Set(baseTokens.map((t) => t.tokenType))]
  return types
    .map((type) => mergedSuffixFileForType(type, baseTokens, tokenGroups, themeSets))
    .filter((file): file is OutputTextFile => file !== null)
}

function mergedSuffixFileForType(
  type: TokenType,
  baseTokens: Array<Token>,
  tokenGroups: Array<TokenGroup>,
  themeSets: Array<ThemeSuffixSet>
): OutputTextFile | null {
  resetTokenNameTracking()

  const baseMapped = new Map(baseTokens.map((t) => [t.id, t]))

  // Build the ordered list of entries: base tokens first, then each theme's overrides.
  const entries: Array<Entry> = baseTokens
    .filter((t) => t.tokenType === type)
    .map((token) => ({ token, mappedTokens: baseMapped, overriddenIds: new Set<string>() }))

  for (const set of themeSets) {
    const overriddenIds = new Set(set.theme.overriddenTokens.map((o) => o.id))
    const themedMapped = new Map(set.themedTokens.map((t) => [t.id, t]))
    set.themedTokens
      .filter((t) => t.tokenType === type && overriddenIds.has(t.id))
      .forEach((token) => entries.push({ token, suffix: set.suffix, mappedTokens: themedMapped, overriddenIds }))
  }

  if (entries.length === 0 && !exportConfiguration.generateEmptyFiles) {
    return null
  }

  // Declare non-referencing tokens before referencing ones to avoid use-before-declaration.
  const ordered = [...entries].sort((a, b) => {
    const aRef = hasReference(a.token)
    const bRef = hasReference(b.token)
    return aRef === bRef ? 0 : aRef ? 1 : -1
  })

  const crossTypeImports = new Set<TokenType>()

  const constDeclarations = ordered
    .map((entry) => {
      const name = tokenObjectKeyName(entry.token, tokenGroups, false, entry.suffix)
      const value = CSSHelper.tokenToCSS(entry.token, entry.mappedTokens, {
        allowReferences: exportConfiguration.useReferences,
        decimals: exportConfiguration.colorPrecision,
        colorFormat: exportConfiguration.colorFormat,
        forceRemUnit: exportConfiguration.forceRemUnit,
        remBase: exportConfiguration.remBase,
        tokenToVariableRef: (t) => {
          // A reference to a token the same theme overrides points at its suffixed variant.
          const refSuffix = entry.suffix && entry.overriddenIds.has(t.id) ? entry.suffix : undefined
          const refName = tokenObjectKeyName(t, tokenGroups, false, refSuffix)

          // Same-type tokens (base or suffixed) are declared in this file → bare identifier.
          if (t.tokenType === type) {
            return `\${${refName}}`
          }

          // Cross-type → import the sibling type file and read from its exported object.
          crossTypeImports.add(t.tokenType)
          return `\${${t.tokenType}Tokens.${refName}}`
        },
      })
      return `const ${name} = ${formatTokenValue(value)};`
    })
    .join("\n")

  const imports = Array.from(crossTypeImports)
    .map((t) => `import { ${t}Tokens } from "./${fileNameFor(t)}";`)
    .join("\n")

  const objectProperties = generateObjectProperties(entries, tokenGroups)

  let content = imports
  if (imports) content += "\n\n"
  content += constDeclarations
  content += `\n\nexport const ${type}Tokens = {\n${objectProperties}\n}`

  if (exportConfiguration.showGeneratedFileDisclaimer) {
    content = GeneralHelper.addDisclaimer(exportConfiguration.disclaimer, content)
  }

  return FileHelper.createTextFile({
    relativePath: exportConfiguration.baseStyleFilePath,
    fileName: exportConfiguration.customizeStyleFileNames
      ? FileNameHelper.ensureFileExtension(exportConfiguration.styleFileNames[type], ".ts")
      : DEFAULT_STYLE_FILE_NAMES[type],
    content: content,
  })
}

function generateObjectProperties(entries: Array<Entry>, tokenGroups: Array<TokenGroup>): string {
  const indentString = GeneralHelper.indent(exportConfiguration.indent)

  let ordered = [...entries]
  if (exportConfiguration.tokenSortOrder === "alphabetical") {
    ordered.sort((a, b) => {
      const nameA = tokenObjectKeyName(a.token, tokenGroups, true, a.suffix)
      const nameB = tokenObjectKeyName(b.token, tokenGroups, true, b.suffix)
      return nameA.localeCompare(nameB)
    })
  }

  return ordered
    .map((entry) => {
      const name = tokenObjectKeyName(entry.token, tokenGroups, true, entry.suffix)
      if (exportConfiguration.showDescriptions && entry.token.description) {
        return `${indentString}/** ${entry.token.description.trim()} */\n${indentString}${name},`
      }
      return `${indentString}${name},`
    })
    .join("\n")
}
