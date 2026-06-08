import { describe, test, expect, beforeEach } from "@jest/globals"
import { TokenType } from "@supernovaio/sdk-exporters"
import { StringCase, ColorFormat } from "@supernovaio/export-utils"
import { ThemeExportStyle, TokenSortOrder, OutputType, FileStructure, ExporterConfiguration } from "../config"
import { tokenGroups, allTokens, tokensWithDarkApplied, darkTheme, darkColorOnlyTheme } from "./fixtures/tokens"

const baseConfig: ExporterConfiguration = {
  outputType: OutputType.Both,
  showGeneratedFileDisclaimer: false,
  disclaimer: "",
  generateIndexFile: true,
  generateFolderIndexFiles: true,
  generateEmptyFiles: false,
  showDescriptions: false,
  useReferences: true,
  tokenNameStyle: StringCase.camelCase,
  cssTokenNameStyle: StringCase.kebabCase,
  colorFormat: ColorFormat.smartHashHex,
  colorPrecision: 3,
  indent: 2,
  tokenPrefixes: {} as any,
  styleFileNames: {} as any,
  indexFileName: "index.ts",
  baseStyleFilePath: "./base",
  baseIndexFilePath: "./",
  exportThemesAs: ThemeExportStyle.MergedThemeSuffix,
  exportOnlyThemedTokens: false,
  exportBaseValues: true,
  forceRemUnit: false,
  remBase: 16,
  customizeStyleFileNames: false,
  customizeTokenPrefixes: false,
  globalNamePrefix: "",
  generateTypeDefinitions: false,
  tokenSortOrder: TokenSortOrder.Default,
  writeNameToProperty: false,
  propertyToWriteNameTo: "",
  propertyToWriteNameToIncludesVar: true,
  cssSelector: ":root",
  themeSelector: ".theme-{theme}",
  useFallbackValues: false,
  fileStructure: FileStructure.SeparateByType,
  cssIndexFileName: "index.css",
}

const mockConfig = { ...baseConfig }

jest.mock("../src/index", () => ({
  get exportConfiguration() {
    return mockConfig
  },
}))

const setConfig = (overrides: Partial<ExporterConfiguration>) => {
  Object.assign(mockConfig, baseConfig, overrides)
}

// Import AFTER mock setup
const { mergedSuffixStyleFiles } = require("../src/files/css-style-file") as typeof import("../src/files/css-style-file")
const { jsMergedSuffixStyleFiles } = require("../src/files/merged-suffix-style-file") as typeof import("../src/files/merged-suffix-style-file")
const { styleOutputFile: cssStyleOutputFile, generateStyleFiles: generateCssStyleFiles } =
  require("../src/files/css-style-file") as typeof import("../src/files/css-style-file")
const { partitionThemesForSuffix } = require("../src/utils/theme-utils") as typeof import("../src/utils/theme-utils")

const themeSets = [{ suffix: "dark", themedTokens: tokensWithDarkApplied, theme: darkTheme }]

const colorContent = (files: Array<{ name: string; content: string }>, ext: string) =>
  files.find((f) => f.name === `color.${ext}`)!.content

describe("CSS merged-theme-suffix mode", () => {
  beforeEach(() => setConfig({}))

  test("base values are emitted unsuffixed, overrides get a --theme suffixed variant", () => {
    const content = colorContent(mergedSuffixStyleFiles(allTokens, tokenGroups, themeSets), "css")
    // Base values (all tokens, unsuffixed, kebab-case)
    expect(content).toMatch(/--color-primary: #ffffff;/)
    expect(content).toMatch(/--color-tertiary: var\(--color-primary\);/)
    // Overridden tokens get an extra --dark entry
    expect(content).toMatch(/--color-primary--dark:/)
    expect(content).toMatch(/--color-secondary--dark:/)
  })

  test("only overridden tokens get a suffixed entry (non-overridden tokens do not)", () => {
    const content = colorContent(mergedSuffixStyleFiles(allTokens, tokenGroups, themeSets), "css")
    // color-gray / color-blue are never overridden by darkTheme
    expect(content).not.toMatch(/--color-gray--dark/)
    expect(content).not.toMatch(/--color-blue--dark/)
    // Exactly two suffixed declarations (primary + secondary)
    expect(content.match(/--color[\w-]+--dark:/g)).toHaveLength(2)
  })

  test("a suffixed entry referencing a same-theme override points at the suffixed variable", () => {
    // colorSecondaryDark references c-primary, which dark also overrides → must use --dark var
    const content = colorContent(mergedSuffixStyleFiles(allTokens, tokenGroups, themeSets), "css")
    expect(content).toMatch(/--color-secondary--dark: var\(--color-primary--dark\);/)
  })

  test("a suffixed entry referencing a non-overridden token points at the base variable", () => {
    // colorPrimaryDark references c-base-gray, which dark does NOT override → base var
    const content = colorContent(mergedSuffixStyleFiles(allTokens, tokenGroups, themeSets), "css")
    expect(content).toMatch(/--color-primary--dark: var\(--color-gray\);/)
  })

  test("alphabetical sort groups each base variable with its themed variants", () => {
    setConfig({ tokenSortOrder: TokenSortOrder.Alphabetical })
    const content = colorContent(mergedSuffixStyleFiles(allTokens, tokenGroups, themeSets), "css")
    const order = [
      "--color-blue:",
      "--color-gray:",
      "--color-primary:",
      "--color-primary--dark:",
      "--color-secondary:",
      "--color-secondary--dark:",
      "--color-tertiary:",
    ]
    const indices = order.map((s) => content.indexOf(s))
    expect(indices.every((i) => i >= 0)).toBe(true)
    // strictly increasing → base sits immediately before its --dark variant
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThan(indices[i - 1])
    }
  })

  test("everything lives in a single :root block (no theme subfolders)", () => {
    const files = mergedSuffixStyleFiles(allTokens, tokenGroups, themeSets)
    const colorFile = files.find((f) => f.name === "color.css")!
    expect(colorFile.path).toBe("./base")
    expect(colorFile.content).toMatch(/^:root \{/)
    expect(colorFile.content).not.toMatch(/\.theme-/)
  })
})

describe("CSS base style file", () => {
  beforeEach(() => setConfig({}))

  test("wraps variables in the configured selector", () => {
    const file = cssStyleOutputFile(TokenType.color, allTokens, tokenGroups)!
    expect(file.content).toMatch(/^:root \{/)
    expect(file.content).toMatch(/--color-primary: #ffffff;/)
    expect(file.name).toBe("color.css")
  })
})

describe("merged-theme-suffix: themes kept as separate files (mergedSuffixSeparateThemes)", () => {
  beforeEach(() => setConfig({}))

  test("partition splits a named theme out (case-insensitive) and merges the rest", () => {
    setConfig({ mergedSuffixSeparateThemes: ["dark"] })
    const { merged, separate } = partitionThemesForSuffix([darkTheme, darkColorOnlyTheme])
    expect(separate.map((t) => t.name)).toEqual(["Dark"])
    expect(merged.map((t) => t.name)).toEqual(["DarkColorOnly"])
  })

  test("empty config keeps every theme merged", () => {
    setConfig({ mergedSuffixSeparateThemes: [] })
    const { merged, separate } = partitionThemesForSuffix([darkTheme])
    expect(separate).toHaveLength(0)
    expect(merged).toHaveLength(1)
  })

  test("a separated theme is fully excluded from the merged :root file", () => {
    // Orchestrator builds the merged file from `merged` only — dark is separated, so no themeSets.
    const content = colorContent(mergedSuffixStyleFiles(allTokens, tokenGroups, []), "css")
    expect(content).toMatch(/--color-primary: #ffffff;/)
    expect(content).not.toMatch(/--dark/)
  })

  test("a separated theme is emitted as a .theme-{theme} file under its own folder", () => {
    const files = generateCssStyleFiles(tokensWithDarkApplied, tokenGroups, "dark", darkTheme)
    const colorFile = files.find((f) => f.path === "./dark" && f.name === "color.css")!
    expect(colorFile).toBeDefined()
    expect(colorFile.content).toMatch(/^\.theme-dark \{/)
    expect(colorFile.content).toMatch(/--color-primary: var\(--color-gray\);/)
  })
})

describe("JS merged-theme-suffix mode", () => {
  beforeEach(() => setConfig({}))

  test("base consts/keys plus nameTheme-suffixed consts/keys for overrides", () => {
    const content = colorContent(jsMergedSuffixStyleFiles(allTokens, tokenGroups, themeSets), "ts")
    expect(content).toMatch(/const colorPrimaryDark = /)
    expect(content).toMatch(/const colorSecondaryDark = /)
    // Exported object includes both base and suffixed keys
    expect(content).toMatch(/colorPrimary,/)
    expect(content).toMatch(/colorPrimaryDark,/)
    // Non-overridden token has no Dark variant
    expect(content).not.toMatch(/colorGrayDark/)
  })

  test("suffixed const referencing a same-theme override uses the suffixed identifier", () => {
    const content = colorContent(jsMergedSuffixStyleFiles(allTokens, tokenGroups, themeSets), "ts")
    expect(content).toMatch(/const colorSecondaryDark = colorPrimaryDark;/)
  })

  test("suffixed const referencing a non-overridden token uses the base identifier", () => {
    const content = colorContent(jsMergedSuffixStyleFiles(allTokens, tokenGroups, themeSets), "ts")
    expect(content).toMatch(/const colorPrimaryDark = colorGray;/)
  })
})
