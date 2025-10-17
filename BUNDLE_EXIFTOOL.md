# How to Bundle ExifTool for Standalone Distribution

## Goal
Make your Electron app work on **Windows and Mac** without requiring users to install ExifTool separately.

---

## Step 1: Download Complete ExifTool

### For macOS:

```bash
# Download the full ExifTool package
cd ~/Downloads
curl -O https://exiftool.org/Image-ExifTool-12.70.tar.gz

# Extract it
tar -xzf Image-ExifTool-12.70.tar.gz

# Navigate to your desktop app
cd "/Users/shams/Desktop/Agm/Brand new gemini/metadata_generator_tool_V.3_All_Good! /desktop-app"

# Remove incomplete ExifTool
rm -rf vendor/exiftool-mac

# Create fresh directory
mkdir -p vendor/exiftool-mac

# Copy the complete ExifTool (script + libraries)
cp ~/Downloads/Image-ExifTool-12.70/exiftool vendor/exiftool-mac/
cp -r ~/Downloads/Image-ExifTool-12.70/lib vendor/exiftool-mac/

# Make it executable
chmod +x vendor/exiftool-mac/exiftool

# Verify structure
ls -la vendor/exiftool-mac/
# Should show:
# - exiftool (the script)
# - lib/ (directory with Perl modules)
```

### For Windows:

```bash
# Download Windows version
curl -O https://exiftool.org/exiftool-12.70.zip

# Unzip
unzip exiftool-12.70.zip -d exiftool-win-temp

# Copy to vendor
mkdir -p vendor/exiftool-win
cp exiftool-win-temp/exiftool(-k).exe vendor/exiftool-win/exiftool.exe

# Clean up
rm -rf exiftool-win-temp
```

---

## Step 2: Verify Bundled ExifTool Works

### Test macOS version:
```bash
vendor/exiftool-mac/exiftool -ver
# Should output: 12.70
```

### Test Windows version (if you have Wine):
```bash
wine vendor/exiftool-win/exiftool.exe -ver
# Should output: 12.70
```

---

## Step 3: Configure electron-builder

Update your `package.json` to include vendor files in the build:

```json
{
  "name": "desktop-app",
  "version": "1.0.0",
  "main": "main.js",
  "scripts": {
    "start": "electron .",
    "build:mac": "electron-builder --mac",
    "build:win": "electron-builder --win",
    "build:all": "electron-builder --mac --win"
  },
  "build": {
    "appId": "com.yourcompany.metadata-generator",
    "productName": "Metadata Generator",
    "directories": {
      "output": "dist"
    },
    "files": [
      "main.js",
      "preload.js",
      "renderer.js",
      "index.html",
      "node_modules/**/*",
      "prompts/**/*"
    ],
    "extraResources": [
      {
        "from": "vendor",
        "to": "vendor",
        "filter": ["**/*"]
      }
    ],
    "mac": {
      "category": "public.app-category.productivity",
      "icon": "assets/icon.icns",
      "target": [
        "dmg",
        "zip"
      ]
    },
    "win": {
      "icon": "assets/icon.ico",
      "target": [
        "nsis",
        "zip"
      ]
    }
  },
  "devDependencies": {
    "electron": "^31.2.1",
    "electron-builder": "^24.13.3"
  },
  "dependencies": {
    "@google/generative-ai": "^0.24.1",
    "adm-zip": "^0.5.16",
    "csv-parse": "^6.1.0",
    "csv-writer": "^1.6.0",
    "dotenv": "^17.2.3",
    "natural-sort": "^1.0.0"
  }
}
```

---

## Step 4: Update ExifTool Path for Production

The bundled app has a different structure. Update `main.js`:

```javascript
function getExifToolPath() {
    let exiftoolPath;
    
    // In production, resources are in a different location
    const isDev = !app.isPackaged;
    const vendorDir = isDev 
        ? path.join(__dirname, 'vendor')
        : path.join(process.resourcesPath, 'vendor');

    if (process.platform === 'win32') {
        exiftoolPath = path.join(vendorDir, 'exiftool-win', 'exiftool.exe');
    } else if (process.platform === 'darwin') {
        exiftoolPath = path.join(vendorDir, 'exiftool-mac', 'exiftool');
    } else {
        throw new Error(`Unsupported platform: ${process.platform}`);
    }

    console.log(`Looking for ExifTool at: ${exiftoolPath}`);

    if (!fs.existsSync(exiftoolPath)) {
        console.warn(`Bundled ExifTool not found at: ${exiftoolPath}`);
        console.warn('Attempting to use system ExifTool...');
        
        // Fallback to system ExifTool
        if (process.platform === 'darwin') {
            const systemPaths = [
                '/opt/homebrew/bin/exiftool',
                '/usr/local/bin/exiftool',
                'exiftool'
            ];
            
            for (const systemPath of systemPaths) {
                try {
                    const { execFileSync } = require('child_process');
                    execFileSync(systemPath, ['-ver'], { encoding: 'utf8' });
                    console.log(`Found system ExifTool at: ${systemPath}`);
                    return systemPath;
                } catch (e) {
                    // Continue to next path
                }
            }
        }
        
        throw new Error(`ExifTool not found. Please ensure ExifTool is bundled correctly.`);
    }

    if (process.platform === 'darwin') {
        try {
            fs.accessSync(exiftoolPath, fs.constants.X_OK);
        } catch (e) {
            fs.chmodSync(exiftoolPath, 0o755);
        }
    }
    
    console.log(`Using bundled ExifTool at: ${exiftoolPath}`);
    return exiftoolPath;
}
```

---

## Step 5: Build Your App

### Install electron-builder:
```bash
npm install --save-dev electron-builder
```

### Build for macOS (on Mac):
```bash
npm run build:mac
```

### Build for Windows (on Mac with wine):
```bash
brew install wine-stable
npm run build:win
```

### Build for both:
```bash
npm run build:all
```

---

## Step 6: Test the Built App

### On macOS:
1. Open `dist/Metadata Generator.app`
2. Process some files
3. Check if ExifTool works without system installation

### On Windows:
1. Run the installer from `dist/Metadata Generator Setup.exe`
2. Launch the app
3. Process files and verify ExifTool works

---

## Folder Structure After Setup

```
desktop-app/
├── vendor/
│   ├── exiftool-mac/
│   │   ├── exiftool          ← The Perl script
│   │   └── lib/               ← CRITICAL! Perl libraries
│   │       └── Image/
│   │           ├── ExifTool.pm
│   │           └── ExifTool/
│   │               └── (many .pm files)
│   └── exiftool-win/
│       └── exiftool.exe      ← Single executable
├── main.js
├── package.json
└── ...
```

---

## Important Notes

### macOS Signing & Notarization
For distribution outside the App Store, you'll need:
1. Apple Developer account ($99/year)
2. Code signing certificate
3. Notarization (to avoid "unverified developer" warnings)

```json
"build": {
  "mac": {
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "entitlements": "build/entitlements.mac.plist",
    "entitlementsInherit": "build/entitlements.mac.plist"
  },
  "afterSign": "scripts/notarize.js"
}
```

### Windows Signing
For distribution, you should sign the Windows executable to avoid SmartScreen warnings.

---

## File Sizes

- **macOS ExifTool**: ~7 MB (script + lib folder)
- **Windows ExifTool**: ~12 MB (single .exe)
- **Your built app**: ~150-200 MB (includes Electron + Node modules + ExifTool)

---

## Testing Checklist

✅ App launches without system ExifTool installed
✅ Can process files and inject metadata
✅ ExifTool path is correctly resolved in production
✅ Works on fresh system (VM or friend's computer)
✅ Console shows "Using bundled ExifTool at: ..."

---

## Quick Start Commands

```bash
# 1. Set up vendor folder with complete ExifTool
curl -O https://exiftool.org/Image-ExifTool-12.70.tar.gz
tar -xzf Image-ExifTool-12.70.tar.gz
mkdir -p vendor/exiftool-mac
cp Image-ExifTool-12.70/exiftool vendor/exiftool-mac/
cp -r Image-ExifTool-12.70/lib vendor/exiftool-mac/
chmod +x vendor/exiftool-mac/exiftool

# 2. Install electron-builder
npm install --save-dev electron-builder

# 3. Build the app
npm run build:mac  # or build:win or build:all

# 4. Test in dist/ folder
open "dist/Metadata Generator.app"
```

---

## Result

✅ **Standalone app** that works without requiring users to install ExifTool
✅ **Works on Windows and macOS** out of the box
✅ **Professional distribution** ready for end users

