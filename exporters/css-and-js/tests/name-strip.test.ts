import { describe, test, expect, beforeEach } from "@jest/globals"
import { Token, TokenGroup, TokenType } from "@supernovaio/sdk-exporters"
import { StringCase, ColorFormat } from "@supernovaio/export-utils"
import { ThemeExportStyle, TokenSortOrder, OutputType, FileStructure, ExporterConfiguration } from "../config"

// --- Direct unit tests for the helper (no exporter config needed) ---
const { strippedKebabOrNull } = require("../src/utils/name-utils") as typeof import("../src/utils/name-utils")

describe("strippedKebabOrNull", () => {
  test("cuts everything before the first anchor (repeated prefix removed)", () => {
    expect(strippedKebabOrNull("border-radius-semantic-border-radius-small")).toBe("semantic-border-radius-small")
  })

  test("works on camelCase input by normalising to kebab first", () => {
    expect(strippedKebabOrNull("borderRadiusSemanticBorderRadiusSmall")).toBe("semantic-border-radius-small")
  })

  test("recognises 'core' as an anchor too", () => {
    expect(strippedKebabOrNull("color-core-primary")).toBe("core-primary")
  })

  test("returns null when there is no anchor (leaves the name untouched)", () => {
    expect(strippedKebabOrNull("color-primary")).toBeNull()
  })

  test("returns null when the anchor is already the first segment (nothing to strip)", () => {
    expect(strippedKebabOrNull("semantic-color-primary")).toBeNull()
  })
})

// --- End-to-end tests through the CSS and JS name generators ---
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
  exportThemesAs: ThemeExportStyle.SeparateFiles,
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
const setConfig = (overrides: Partial<ExporterConfiguration>) => Object.assign(mockConfig, baseConfig, overrides)

const { tokenObjectKeyName, resetTokenNameTracking } = require("../src/content/token") as typeof import("../src/content/token")
const { tokenVariableName } = require("../src/content/css-token") as typeof import("../src/content/css-token")

// Group "Radius" nested under a "Semantic" ancestor, so the generated name contains the
// anchor segment after the type prefix: color-semantic-radius-small.
const semanticGroup = {
  id: "g-semantic",
  name: "Radius",
  isRoot: false,
  path: ["Semantic"],
  parentGroupId: null,
  tokenType: TokenType.color,
  childrenIds: [],
  tokenIds: [],
} as unknown as TokenGroup

const semanticColor = {
  id: "c-sem-small",
  idInVersion: "c-sem-small",
  name: "Small",
  description: "",
  tokenType: TokenType.color,
  parentGroupId: "g-semantic",
  value: { color: { r: 0, g: 0, b: 0, referencedTokenId: null }, opacity: { measure: 1, unit: "raw", referencedTokenId: null }, referencedTokenId: null },
  origin: null,
  properties: [],
  propertyValues: {},
} as unknown as Token

const groups = [semanticGroup]

describe("redundant prefix stripping in name generation", () => {
  beforeEach(() => {
    setConfig({})
    resetTokenNameTracking()
  })

  test("CSS variable name drops the redundant 'color' prefix before 'semantic' (kebab)", () => {
    expect(tokenVariableName(semanticColor, groups)).toBe("semantic-radius-small")
  })

  test("JS object key drops the redundant 'color' prefix before 'semantic' (camel)", () => {
    expect(tokenObjectKeyName(semanticColor, groups)).toBe("semanticRadiusSmall")
  })

  test("theme suffix is appended after stripping (CSS BEM modifier)", () => {
    expect(tokenVariableName(semanticColor, groups, "dark")).toBe("semantic-radius-small--dark")
  })
})
