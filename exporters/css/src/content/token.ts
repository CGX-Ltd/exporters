import { DesignSystemCollection } from "@supernovaio/sdk-exporters/build/sdk-typescript/src/model/base/SDKDesignSystemCollection"
import { NamingHelper, CSSHelper, GeneralHelper } from "@supernovaio/export-utils"
import { Token, TokenGroup, TokenType } from "@supernovaio/sdk-exporters"
import { exportConfiguration } from ".."
import { DEFAULT_TOKEN_PREFIXES } from "../constants/defaults"
import { TokenNameStructure } from "../../config"

export function getTokenPrefix(tokenType: TokenType): string {
  return exportConfiguration.customizeTokenPrefixes ? exportConfiguration.tokenPrefixes[tokenType] : DEFAULT_TOKEN_PREFIXES[tokenType]
}

export function analyzeTokensForRgbUtilities(
  tokens: Array<Token>,
  tokenGroups: Array<TokenGroup>,
  collections: Array<DesignSystemCollection> = []
): Set<string> {
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

export function getTokenRawValue(
  token: Token,
  mappedTokens: Map<string, Token>
): string {
  return CSSHelper.tokenToCSS(token, mappedTokens, {
    allowReferences: false,
    decimals: exportConfiguration.colorPrecision,
    colorFormat: exportConfiguration.colorFormat,
    forceRemUnit: exportConfiguration.forceRemUnit,
    remBase: exportConfiguration.remBase,
    tokenToVariableRef: () => "",
  })
}

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

export function generateRgbUtilityVariable(
  token: Token,
  tokenGroups: Array<TokenGroup>,
  collections: Array<DesignSystemCollection> = []
): string {
  const name = tokenVariableName(token, tokenGroups, collections)
  const rgbName = `rgb-${name}`
  
  const colorValue = (token as any).value
  const r = Math.round(colorValue.color.r)
  const g = Math.round(colorValue.color.g)
  const b = Math.round(colorValue.color.b)
  
  const indentString = GeneralHelper.indent(exportConfiguration.indent)
  
  if (exportConfiguration.showDescriptions && token.description) {
    return `${indentString}/* RGB utility for ${token.description.trim()} */\n${indentString}--${rgbName}: ${r}, ${g}, ${b};`
  } else {
    return `${indentString}--${rgbName}: ${r}, ${g}, ${b};`
  }
}

export function convertedToken(
  token: Token,
  mappedTokens: Map<string, Token>,
  tokenGroups: Array<TokenGroup>,
  collections: Array<DesignSystemCollection> = [],
  colorTokensNeedingRgb?: Set<string>
): string {
  const name = tokenVariableName(token, tokenGroups, collections)

  const value = CSSHelper.tokenToCSS(token, mappedTokens, {
    allowReferences: exportConfiguration.useReferences,
    decimals: exportConfiguration.colorPrecision,
    colorFormat: exportConfiguration.colorFormat,
    forceRemUnit: exportConfiguration.forceRemUnit,
    remBase: exportConfiguration.remBase,
    tokenToVariableRef: (t, context) => {
      const variableName = tokenVariableName(t, tokenGroups, collections)
      
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
    output += `\n${generateRgbUtilityVariable(token, tokenGroups, collections)}`
  }
  
  return output
}

export function tokenVariableName(token: Token, tokenGroups: Array<TokenGroup>, collections: Array<DesignSystemCollection> = []): string {
  const prefix = getTokenPrefix(token.tokenType)
  const parent = tokenGroups.find((group) => group.id === token.parentGroupId)!

  let collection: DesignSystemCollection | null = null
  if (exportConfiguration.tokenNameStructure === TokenNameStructure.CollectionPathAndName && token.collectionId) {
    collection = collections.find((c) => c.persistentId === token.collectionId) ?? ({ name: token.collectionId } as DesignSystemCollection)
  }

  const fullPrefix = [exportConfiguration.globalNamePrefix, prefix, collection?.name].filter(Boolean).join('-')

  const rawName = NamingHelper.codeSafeVariableNameForToken(
    token,
    exportConfiguration.tokenNameStyle,
    exportConfiguration.tokenNameStructure !== TokenNameStructure.NameOnly ? parent : null,
    ''
  )

  const segments = `${fullPrefix}-${rawName}`.split('-')
  const deduped = segments.reduce((acc: string[], seg) => {
    if (acc.length === 0 || acc[acc.length - 1] !== seg) acc.push(seg)
    return acc
  }, [])

  return deduped.join('-')
}
