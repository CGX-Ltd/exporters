import { NamingHelper, StringCase } from "@supernovaio/export-utils"

/**
 * Segments that mark the "real" start of a token name. Anything before the first occurrence of one
 * of these is treated as a redundant prefix (e.g. a type prefix that the token's group path repeats)
 * and stripped. Adjust this list if your taxonomy uses different anchor groups.
 */
const ANCHOR_SEGMENTS = ["core", "semantic"]

/**
 * Removes redundant leading segments from a generated token name by cutting to the first
 * `core` / `semantic` anchor. For example `border-radius-semantic-border-radius-small`
 * becomes `semantic-border-radius-small`.
 *
 * Returns the cleaned name as a kebab-case string, or `null` when there is nothing to strip
 * (no anchor, or the anchor is already the first segment) so callers can leave the original
 * name — and its case / uniqueness handling — untouched.
 *
 * @param name - A previously generated token name in any case style
 */
export function strippedKebabOrNull(name: string): string | null {
  const kebab = NamingHelper.codeSafeVariableName(name, StringCase.kebabCase)
  const segments = kebab.split("-")
  const anchorIndex = segments.findIndex((s) => ANCHOR_SEGMENTS.includes(s.toLowerCase()))
  return anchorIndex > 0 ? segments.slice(anchorIndex).join("-") : null
}
