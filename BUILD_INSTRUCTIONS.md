# Build Instructions for Standalone Distribution

## Quick Answer: YES! ✅

**After following these instructions, your app WILL work on Windows and Mac without users needing to install ExifTool.**

---

## Current Status

❌ **NOT Ready for Distribution** - ExifTool is incomplete  
✅ **Can Be Fixed in 5 Minutes** - Just run the setup script

---

## Quick Setup (5 Minutes)

### Step 1: Install ExifTool for Bundling

```bash
cd desktop-app

# Run the automated setup script
./setup-exiftool.sh

# Choose option 3 (Setup for both macOS and Windows)
```

**That's it!** The script will:
- Download complete ExifTool for macOS (with Perl libraries)
- Download ExifTool executable for Windows
- Place them in the correct `vendor/` folders
- Verify everything works

### Step 2: Install electron-builder

```bash
npm install --save-dev electron-builder
```

### Step 3: Build Your App

```bash
# Build for macOS (on Mac)
npm run build:mac

# Build for Windows (on Mac with Wine)
npm run build:win

# Or build both at once
npm run build:all
```

### Step 4: Test

```bash
# macOS
open "dist/Metadata Generator.app"

# Windows
# Transfer the .exe to a Windows machine and test
```

---

## What Gets Bundled

Your final app will include:

```
Metadata Generator.app/
├── Contents/
│   ├── MacOS/
│   │   └── Metadata Generator
│   └── Resources/
│       ├── app.asar               ← Your code & prompts
│       ├── vendor/                ← ExifTool files
│       │   ├── exiftool-mac/
│       │   │   ├── exiftool
│       │   │   └── lib/           ← Perl libraries (CRITICAL!)
│       │   └── exiftool-win/
│       │       └── exiftool.exe
│       └── node_modules/
```

**Total app size:** ~150-200 MB

---

## Verification Checklist

After building, verify:

✅ App launches without system ExifTool installed
✅ Console shows: "Using bundled ExifTool at: /path/to/vendor..."
✅ Can process files and inject metadata
✅ ZIP output contains:
  - `Processed_Files/` folder
  - `CSV_Processed_Output/` folder
✅ ExifTool metadata is visible in processed files

---

## Testing on Fresh System

### macOS
```bash
# Create a new test user account or use a VM
# Don't install ExifTool via Homebrew
# Launch your built app
# Try processing files
```

### Windows
```bash
# Test on a Windows machine without ExifTool
# Run the installer from dist/
# Launch the app
# Try processing files
```

---

## Troubleshooting

### "ExifTool not found" error in built app

**Cause:** Bundled ExifTool is incomplete or missing

**Fix:**
```bash
# Verify your vendor folder structure
ls -la vendor/exiftool-mac/
# Should show: exiftool (file) and lib/ (directory)

ls -la vendor/exiftool-mac/lib/Image/
# Should show: ExifTool.pm and ExifTool/ directory

# If missing, run setup script again
./setup-exiftool.sh
```

### "Can't locate Image/ExifTool.pm" error

**Cause:** The `lib/` folder is missing from ExifTool

**Fix:**
```bash
# Re-download complete ExifTool
curl -O https://exiftool.org/Image-ExifTool-12.70.tar.gz
tar -xzf Image-ExifTool-12.70.tar.gz

# Copy BOTH exiftool script and lib folder
rm -rf vendor/exiftool-mac
mkdir -p vendor/exiftool-mac
cp Image-ExifTool-12.70/exiftool vendor/exiftool-mac/
cp -r Image-ExifTool-12.70/lib vendor/exiftool-mac/  # ← CRITICAL!
chmod +x vendor/exiftool-mac/exiftool
```

### App works in dev but not in built version

**Cause:** Resource paths are different in production

**Status:** ✅ Already fixed in main.js
- Uses `app.isPackaged` to detect production
- Uses `process.resourcesPath` for bundled resources

### Windows build fails on Mac

**Solution:** Install Wine
```bash
brew install wine-stable
npm run build:win
```

Or build on a Windows machine directly.

---

## Distribution Options

### Option 1: DMG for macOS (Recommended)
```bash
npm run build:mac
# Creates: dist/Metadata Generator-1.0.0.dmg
```

Users: Double-click DMG → Drag to Applications

### Option 2: ZIP for macOS
```bash
npm run build:mac
# Also creates: dist/Metadata Generator-1.0.0-mac.zip
```

Users: Extract ZIP → Move to Applications

### Option 3: NSIS Installer for Windows
```bash
npm run build:win
# Creates: dist/Metadata Generator Setup 1.0.0.exe
```

Users: Run installer → Follow wizard

### Option 4: ZIP for Windows (Portable)
```bash
npm run build:win
# Also creates: dist/Metadata Generator-1.0.0-win.zip
```

Users: Extract anywhere → Run .exe directly

---

## Code Signing (Optional but Recommended)

### macOS
To avoid "Unverified Developer" warnings:

1. Join Apple Developer Program ($99/year)
2. Get a Developer ID certificate
3. Update package.json:

```json
"build": {
  "mac": {
    "identity": "Developer ID Application: Your Name (TEAM_ID)"
  }
}
```

### Windows
To avoid SmartScreen warnings:

1. Get a code signing certificate (~$100-300/year)
2. Sign the .exe using signtool

---

## Final Checklist Before Distribution

- [ ] ExifTool bundled correctly (run `./setup-exiftool.sh`)
- [ ] electron-builder installed (`npm install --save-dev electron-builder`)
- [ ] Built for target platforms (`npm run build:mac` or `build:win`)
- [ ] Tested on fresh system without ExifTool installed
- [ ] Verified metadata injection works
- [ ] Verified ZIP output has correct folder structure
- [ ] Updated version number in package.json
- [ ] (Optional) Code signed for easier distribution

---

## Summary

**Question:** Will the app work without users installing ExifTool?

**Answer:** 

✅ **YES** - After running `./setup-exiftool.sh` and building with electron-builder

❌ **NO** - If you distribute without bundling complete ExifTool

---

## File Sizes

- **macOS ExifTool:** ~7 MB (script + lib folder)
- **Windows ExifTool:** ~12 MB (single .exe)
- **Your App (macOS):** ~180 MB (includes everything)
- **Your App (Windows):** ~190 MB (includes everything)

---

## Next Steps

1. Run `./setup-exiftool.sh` (choose option 3)
2. Run `npm install --save-dev electron-builder`
3. Run `npm run build:all`
4. Test `dist/Metadata Generator.app`
5. Distribute! 🚀

---

## Support

If you encounter issues:
1. Check `EXIFTOOL_SETUP.md` for detailed instructions
2. Check `BUNDLE_EXIFTOOL.md` for technical details
3. Verify vendor folder structure matches examples
4. Test in development first: `npm start`

