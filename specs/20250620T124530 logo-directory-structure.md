# Logo Directory Structure Plan

## Overview
Create a well-organized directory structure for storing logo variations for the "wellcrafted" TypeScript error handling library.

## Todo Items
- [ ] Create main `assets` directory in project root
- [ ] Create `assets/logo` subdirectory for all logo files
- [ ] Create subdirectories for different logo formats and variations
- [ ] Create a README.md file documenting the logo structure and usage guidelines

## Proposed Directory Structure

```
/assets/
  /logo/
    /svg/               # Vector source files (scalable)
      logo.svg          # Primary logo
      logo-icon.svg     # Icon-only version
      logo-wordmark.svg # Text-only version
    
    /png/               # Raster exports for various uses
      /1x/              # Standard resolution
        logo.png
        logo-icon.png
        logo-wordmark.png
      /2x/              # Retina/high-DPI
        logo@2x.png
        logo-icon@2x.png
        logo-wordmark@2x.png
      /favicon/         # Favicon sizes
        favicon-16x16.png
        favicon-32x32.png
        favicon-192x192.png
        favicon-512x512.png
    
    /variants/          # Color and theme variations
      /light/           # For light backgrounds
        logo-light.svg
        logo-light.png
      /dark/            # For dark backgrounds
        logo-dark.svg
        logo-dark.png
      /monochrome/      # Single color versions
        logo-black.svg
        logo-white.svg
    
    README.md           # Logo usage guidelines
```

## Logo Naming Convention
- **Primary logo**: `logo.*` - Full logo with icon and text
- **Icon only**: `logo-icon.*` - Just the symbol/icon
- **Wordmark only**: `logo-wordmark.*` - Just the text
- **Variants**: `logo-{variant}.*` - e.g., `logo-dark.svg`
- **Resolutions**: `logo@{multiplier}x.*` - e.g., `logo@2x.png`

## File Formats
- **SVG**: Primary source format, scalable and editable
- **PNG**: For web and application use
  - 1x: Standard resolution (e.g., 200px height)
  - 2x: High-DPI displays (e.g., 400px height)
- **Favicon**: Standard web favicon sizes

## Additional Considerations
- All logo files should be optimized for file size
- SVG files should be cleaned of unnecessary metadata
- PNG files should be exported with transparency where applicable
- Consider adding `.ico` file for legacy Windows support if needed