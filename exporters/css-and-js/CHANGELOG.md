### CSS and JS Exporter Release Notes
All the updates to this exporter are documented in this file.

## 1.0.0 - 2026-06-04

### 🚀 New

This is the initial release of the CSS and JS Exporter. The exporter is built on the new export engine and is part of the Pulsar 2.0 release.

The CSS and JS exporter comes with extensive configuration options that allow you to customize the output format. Before modifying the code itself, check the configuration options - it's likely you can achieve your desired output through configuration alone.

The generated output is compatible with popular CSS-in-JS libraries like Emotion and Styled Components, allowing seamless integration into your applications. It also provides CSS tokens output as standard for use cases where tokens in both JS and CSS are valuable for a codebase to have access to.

Key features include:
- Support for all token types (colors, typography, spacing, etc.)
- Multiple color format options (HEX, RGB, HSL, OKLCH)
- Various token naming conventions (camelCase, constantCase, etc.)
- Flexible theming and branding support
- Customizable file organization
- Ability to merge theme tokens into a single output file with each themed token suffixed by the theme name