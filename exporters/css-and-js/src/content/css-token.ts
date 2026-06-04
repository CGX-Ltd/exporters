import { NamingHelper, CSSHelper, GeneralHelper } from "@supernovaio/export-utils"
import { Token, TokenGroup, TokenType } from "@supernovaio/sdk-exporters"
import { exportConfiguration } from ".."
import { DEFAULT_TOKEN_PREFIXES } from "../constants/defaults"

/**
 * Gets the prefix for a specific token type based on configuration.
 * Uses either custom prefixes from configuration or default prefixes.
 */
export function getTokenPrefix(tokenType: TokenType): string {
  return exportConfiguration.customizeTokenPrefixes ? exportConfiguration.tokenPrefixes[tokenType] : DEFAULT_TOKEN_PREFIXES[tokenType]
}

/**
 * Generates a code-safe CSS variable name for a token based on its properties and configuration.
 * Includes the type-specific prefix and the token group hierarchy.
 *
 * @param token - The token to generate a name for
 * @param tokenGroups - Array of token groups for determining token hierarchy
 * @param themeSuffix - Optional theme identifier appended as a BEM-style modifier (e.g. `--dark`)
 * @returns Formatted variable name string (without the leading `--`)
 */
export function tokenVariableName(token: Token, tokenGroups: Array<TokenGroup>, themeSuffix?: string): string {
  const prefix = getTokenPrefix(token.tokenType)
  const parent = tokenGroups.find((group) => group.id === token.parentGroupId)!

  let name = NamingHelper.codeSafeVariableNameForToken(
    token,
    exportConfiguration.cssTokenNameStyle,
    parent,
    [exportConfiguration.globalNamePrefix, prefix].filter(Boolean).join("-")
  )

  // Append the theme name as a BEM-style modifier for the merged-theme-suffix mode
  if (themeSuffix) {
    name = `${name}--${themeSuffix}`
  }

  return name
}

/**
 * Analyzes tokens to identify which color tokens need RGB utility versions.
 * A color token needs an RGB utility if it's referenced by shadow, border, or gradient tokens
 * that have custom opacity values.
 */
export function analyzeTokensForRgbUtilities(tokens: Array<Token>): Set<string> {
  const colorTokensNeedingRgb = new Set<string>()
  const mappedTokens = new Map(tokens.map((token) => [token.id, token]))

  tokens.forEach((token) => {
    if (token.tokenType === TokenType.shadow) {
      const shadowToken = token as any
      shadowToken.value.forEach((shadowLayer: any) => {
        if (shadowLayer.opacity && shadowLayer.color.referencedTokenId) {
          const referencedColorToken = mappedTokens.get(shadowLayer.color.referencedTokenId)
          if (referencedColorToken && referencedColorToken.tokenType === TokenType.color) {
            colorTokensNeedingRgb.add(referencedColorToken.id)
          }
        }
      })
    } else if (token.tokenType === TokenType.border) {
      const borderToken = token as any
      if (borderToken.value.opacity && borderToken.value.color.referencedTokenId) {
        const referencedColorToken = mappedTokens.get(borderToken.value.color.referencedTokenId)
        if (referencedColorToken && referencedColorToken.tokenType === TokenType.color) {
          colorTokensNeedingRgb.add(referencedColorToken.id)
        }
      }
    } else if (token.tokenType === TokenType.gradient) {
      const gradientToken = token as any
      gradientToken.value.forEach((gradientLayer: any) => {
        gradientLayer.stops.forEach((stop: any) => {
          if (stop.opacity && stop.color.referencedTokenId) {
            const referencedColorToken = mappedTokens.get(stop.color.referencedTokenId)
            if (referencedColorToken && referencedColorToken.tokenType === TokenType.color) {
              colorTokensNeedingRgb.add(referencedColorToken.id)
            }
          }
        })
      })
    }
  })

  return colorTokensNeedingRgb
}

/**
 * Converts a token to its raw CSS value without following references.
 * Used to generate fallback values for references.
 */
export function getTokenRawValue(token: Token, mappedTokens: Map<string, Token>): string {
  return CSSHelper.tokenToCSS(token, mappedTokens, {
    allowReferences: false,
    decimals: exportConfiguration.colorPrecision,
    colorFormat: exportConfiguration.colorFormat,
    forceRemUnit: exportConfiguration.forceRemUnit,
    remBase: exportConfiguration.remBase,
    tokenToVariableRef: () => "",
  })
}

/**
 * Converts a color token to its raw RGB values without following references.
 */
export function getColorTokenRgbValue(token: Token): string {
  if (token.tokenType !== TokenType.color) {
    throw new Error(`Expected color token, got ${token.tokenType}`)
  }

  const colorValue = (token as any).value
  const r = Math.round(colorValue.color.r)
  const g = Math.round(colorValue.color.g)
  const b = Math.round(colorValue.color.b)

  return `${r}, ${g}, ${b}`
}

/**
 * Generates an RGB utility variable for a color token (e.g. `--rgb-color-primary: 16, 80, 198;`).
 */
export function generateRgbUtilityVariable(token: Token, tokenGroups: Array<TokenGroup>, themeSuffix?: string): string {
  const name = tokenVariableName(token, tokenGroups, themeSuffix)
  const rgbName = `rgb-${name}`

  const colorValue = (token as any).value
  const r = Math.round(colorValue.color.r)
  const g = Math.round(colorValue.color.g)
  const b = Math.round(colorValue.color.b)

  const indentString = GeneralHelper.indent(exportConfiguration.indent)

  if (exportConfiguration.showDescriptions && token.description) {
    return `${indentString}/* RGB utility for ${token.description.trim()} */\n${indentString}--${rgbName}: ${r}, ${g}, ${b};`
  }
  return `${indentString}--${rgbName}: ${r}, ${g}, ${b};`
}

/**
 * Converts a design token into its CSS custom property representation.
 *
 * @param token - The design token to convert
 * @param mappedTokens - Map of all tokens for resolving references
 * @param tokenGroups - Array of token groups for determining token hierarchy
 * @param colorTokensNeedingRgb - Set of color token IDs that need RGB utility versions
 * @param themeSuffix - Optional theme identifier appended as a BEM-style modifier (merged-suffix mode)
 * @param overriddenTokenIds - IDs overridden by the current theme; references to these get the same suffix
 * @returns Formatted CSS custom property string with optional description comment and RGB utilities
 */
export function convertedToken(
  token: Token,
  mappedTokens: Map<string, Token>,
  tokenGroups: Array<TokenGroup>,
  colorTokensNeedingRgb?: Set<string>,
  themeSuffix?: string,
  overriddenTokenIds?: Set<string>
): string {
  const name = tokenVariableName(token, tokenGroups, themeSuffix)

  const value = CSSHelper.tokenToCSS(token, mappedTokens, {
    allowReferences: exportConfiguration.useReferences,
    decimals: exportConfiguration.colorPrecision,
    colorFormat: exportConfiguration.colorFormat,
    forceRemUnit: exportConfiguration.forceRemUnit,
    remBase: exportConfiguration.remBase,
    tokenToVariableRef: (t, context) => {
      // In merged-suffix mode, a reference to a token that the SAME theme also overrides
      // must point at that token's suffixed variant; otherwise it points at the base variable.
      const refSuffix = themeSuffix && overriddenTokenIds?.has(t.id) ? themeSuffix : undefined
      const variableName = tokenVariableName(t, tokenGroups, refSuffix)

      if (context?.needsRgb && t.tokenType === TokenType.color && colorTokensNeedingRgb?.has(t.id)) {
        if (exportConfiguration.useFallbackValues) {
          const rgbValue = getColorTokenRgbValue(t)
          return `var(--rgb-${variableName}, ${rgbValue})`
        }
        return `var(--rgb-${variableName})`
      }

      if (exportConfiguration.useFallbackValues) {
        const rawValue = getTokenRawValue(t, mappedTokens)
        return `var(--${variableName}, ${rawValue})`
      }
      return `var(--${variableName})`
    },
  })

  const indentString = GeneralHelper.indent(exportConfiguration.indent)

  let output = ""

  if (exportConfiguration.showDescriptions && token.description) {
    output += `${indentString}/* ${token.description.trim()} */\n`
  }

  output += `${indentString}--${name}: ${value};`

  if (token.tokenType === TokenType.color && colorTokensNeedingRgb?.has(token.id)) {
    output += `\n${generateRgbUtilityVariable(token, tokenGroups, themeSuffix)}`
  }

  return output
}
