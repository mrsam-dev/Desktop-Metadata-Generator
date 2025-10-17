# ExifTool Setup for Desktop App

## The Problem

The ExifTool bundled in `vendor/exiftool-mac/` is incomplete. It's missing the required Perl library files, which causes this error:

```
Can't locate Image/ExifTool.pm in @INC
```

## Solution: Download Complete ExifTool

### For macOS:

**Option 1: Using Homebrew (Recommended)**
```bash
brew install exiftool
```

Then update `main.js` to use system ExifTool:
```javascript
function getExifToolPath() {
    // Use system ExifTool if available
    return 'exiftool';  // This will use the system PATH
}
```

**Option 2: Manual Installation**

1. Download the full ExifTool distribution:
   - Visit: https://exiftool.org/
   - Download the **"MacOS Package"** (not the standalone executable)
   - Or download: https://exiftool.org/Image-ExifTool-12.70.tar.gz (or latest version)

2. Extract the complete package:
   ```bash
   cd ~/Downloads
   tar -xzf Image-ExifTool-12.70.tar.gz
   ```

3. Copy the complete ExifTool to your vendor folder:
   ```bash
   # Remove the incomplete exiftool
   rm -rf desktop-app/vendor/exiftool-mac
   
   # Create new directory
   mkdir -p desktop-app/vendor/exiftool-mac
   
   # Copy the exiftool executable
   cp Image-ExifTool-12.70/exiftool desktop-app/vendor/exiftool-mac/
   
   # Copy the lib directory (THIS IS CRITICAL!)
   cp -r Image-ExifTool-12.70/lib desktop-app/vendor/exiftool-mac/
   
   # Make it executable
   chmod +x desktop-app/vendor/exiftool-mac/exiftool
   ```

4. Your vendor folder should now have:
   ```
   desktop-app/vendor/exiftool-mac/
   ├── exiftool          (the main script)
   └── lib/
       └── Image/
           ├── ExifTool.pm
           └── ExifTool/
               └── (many .pm files)
   ```

### For Windows:

1. Download: https://exiftool.org/exiftool-12.70.zip
2. Extract to `desktop-app/vendor/exiftool-win/`
3. Should contain:
   - `exiftool(-k).exe`
   - Rename it to `exiftool.exe`

## Verification

After setup, test ExifTool:

```bash
# macOS
desktop-app/vendor/exiftool-mac/exiftool -ver

# Should output: 12.70 (or your version number)
```

## For Production Build

When building the Electron app with electron-builder, make sure to include the vendor folder:

In `package.json`:
```json
{
  "build": {
    "extraResources": [
      {
        "from": "vendor",
        "to": "vendor",
        "filter": ["**/*"]
      }
    ]
  }
}
```

## Quick Fix for Development

If you just want to test quickly, use system ExifTool:

1. Install via Homebrew:
   ```bash
   brew install exiftool
   ```

2. Update `getExifToolPath()` in `main.js`:
   ```javascript
   function getExifToolPath() {
       // For development, use system ExifTool
       if (process.platform === 'darwin') {
           return '/opt/homebrew/bin/exiftool';  // or '/usr/local/bin/exiftool'
       }
       // ... rest of code
   }
   ```

## Current Status

✅ Folder names now match Flask app:
- `Processed_Files` (contains injected files)
- `CSV_Processed_Output` (contains marketplace CSV)

⚠️ ExifTool needs proper installation (see above)

