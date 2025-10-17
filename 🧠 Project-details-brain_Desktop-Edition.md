# 🧠 Stock Metadata Generator - Desktop Edition (Electron)

## Complete Technical Reference & Development Guide

**Version:** 1.0.0  
**Date:** October 2025  
**Status:** Production Ready ✅  
**Repository:** https://github.com/mrsam-dev/Desktop-Metadata-Generator

---

## 📋 Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture](#3-architecture)
4. [Setup & Installation](#4-setup--installation)
5. [Core Features](#5-core-features)
6. [File Structure](#6-file-structure)
7. [Key Functions & Logic](#7-key-functions--logic)
8. [Marketplace CSV Mappings](#8-marketplace-csv-mappings)
9. [ExifTool Integration](#9-exiftool-integration)
10. [Build & Distribution](#10-build--distribution)
11. [Troubleshooting](#11-troubleshooting)
12. [Development History](#12-development-history)

---

## 1. Project Overview

### What It Does

The Stock Metadata Generator is an **Electron desktop application** that automates the creation and embedding of SEO-optimized metadata for stock marketplace assets (Shutterstock, Freepik, Adobe Stock, Vecteezy).

**Workflow:**
1. User provides descriptive prompts (manual, TXT, or CSV)
2. User uploads ZIP file containing image files
3. AI (Gemini) generates metadata (title, description, keywords)
4. App injects metadata into image files using ExifTool
5. App renames files based on metadata
6. Output: ZIP with processed files + marketplace CSV

### Why Desktop Edition?

- **No Server Required** - Runs completely offline (except AI API calls)
- **Native Performance** - Faster file processing
- **Better Privacy** - Files never leave your computer
- **Cross-Platform** - Works on macOS and Windows
- **Bundled Dependencies** - ExifTool included, no system installation needed

### Relation to Flask Version

This Electron app is **100% functionally identical** to the Flask web app. All features, UI layout, CSV mappings, and processing logic are synchronized.

---

## 2. Technology Stack

### Frontend
- **Framework:** Electron 31.2.1
- **UI:** Bootstrap 5.3.3 (Dark/Light/Auto theme)
- **Icons:** Bootstrap Icons
- **JavaScript:** Vanilla (no frameworks)
- **IPC:** Electron's contextBridge & ipcRenderer

### Backend (Node.js)
- **Runtime:** Node.js (via Electron)
- **AI:** @google/generative-ai ^0.24.1
- **File Processing:**
  - adm-zip ^0.5.16 (ZIP handling)
  - csv-parse ^6.1.0 (CSV reading)
  - csv-writer ^1.6.0 (CSV writing)
  - natural-sort ^1.0.0 (Natural filename sorting)
- **Metadata:** ExifTool (bundled in vendor/)
- **Config:** dotenv ^17.2.3

### External Tools
- **ExifTool** - Perl-based metadata injection tool
  - macOS: Script + Perl libraries (lib/Image/ExifTool.pm)
  - Windows: Single executable (exiftool.exe)

---

## 3. Architecture

### Process Model

```
┌─────────────────────────────────────────┐
│         Main Process (main.js)          │
│  - Backend logic                        │
│  - File processing                      │
│  - AI API calls                         │
│  - ExifTool execution                   │
└─────────────────┬───────────────────────┘
                  │ IPC (contextBridge)
┌─────────────────┴───────────────────────┐
│      Renderer Process (renderer.js)     │
│  - UI logic                             │
│  - Form handling                        │
│  - Progress updates                     │
└─────────────────────────────────────────┘
```

### IPC Communication

```javascript
// preload.js - Bridge between main and renderer
contextBridge.exposeInMainWorld('electronAPI', {
  submitForm: (data) => ipcRenderer.send('form:submit', data),
  onUpdate: (callback) => ipcRenderer.on('update-status', callback),
  convertTxtToCsv: (path) => ipcRenderer.send('convert-txt-to-csv', path),
  exportMasterPrompt: (data) => ipcRenderer.send('export-master-prompt', data)
});
```

### Data Flow

```
User Input (prompts + files)
    ↓
Renderer Process (validation)
    ↓
IPC → Main Process
    ↓
Parse Prompts → Get Master Template
    ↓
Call Gemini AI
    ↓
Parse AI Response → Create CSVs
    ↓
Extract ZIP → Process Files
    ↓
ExifTool Injection + Rename
    ↓
Create Output ZIP
    ↓
IPC → Renderer (show save dialog)
    ↓
User Downloads Result
```

---

## 4. Setup & Installation

### Development Setup

```bash
# Clone repository
git clone https://github.com/mrsam-dev/Desktop-Metadata-Generator.git
cd Desktop-Metadata-Generator

# Install dependencies
npm install

# (Optional) Create .env for API key
echo 'GEMINI_API_KEY=your_key_here' > .env

# Install system ExifTool (for development)
brew install exiftool  # macOS
# OR
# Windows: Download from https://exiftool.org/

# Run the app
npm start
```

### Production Build Setup

```bash
# Step 1: Bundle complete ExifTool
./setup-exiftool.sh
# Choose option 3 (both platforms)

# Step 2: Install electron-builder
npm install --save-dev electron-builder

# Step 3: Build
npm run build:mac    # macOS DMG + ZIP
npm run build:win    # Windows installer + ZIP
npm run build:all    # Both platforms

# Output in dist/ folder
```

---

## 5. Core Features

### Feature Matrix

| Feature | Description | AI Required | Offline Support |
|---------|-------------|-------------|-----------------|
| AI Generate & Process | Generate metadata with Gemini | ✅ Yes | ❌ No (API call) |
| Process Existing Metadata | Use your own CSV | ❌ No | ✅ Yes |
| TXT to CSV Converter | Convert prompts to CSV | ❌ No | ✅ Yes |
| Export Master Prompt | Export full AI prompt | ❌ No | ✅ Yes |
| File Renaming | SEO-friendly names | Depends on mode | ✅ Yes |
| Metadata Injection | ExifTool embedding | ❌ No | ✅ Yes |

### Supported Marketplaces

1. **Shutterstock** (7-column CSV)
2. **Freepik** (4-column CSV, lowercase)
3. **Adobe Stock** (4-column CSV)
4. **Vecteezy** (4-column CSV)

### Supported File Formats

| Format | Metadata Injection | Renaming | Notes |
|--------|-------------------|----------|-------|
| .eps   | ✅ Yes            | ✅ Yes   | Vector format |
| .jpg   | ✅ Yes            | ✅ Yes   | Raster format |
| .png   | ✅ Yes            | ✅ Yes   | Raster format |
| .svg   | ❌ No             | ✅ Yes   | ExifTool limitation |

### AI Models Supported

- **gemini-1.5-flash** - Fast, cost-effective
- **gemini-1.5-pro** - Higher quality
- **gemini-2.5-flash** - Latest, fastest
- **gemini-2.5-pro** - Latest, best quality

---

## 6. File Structure

```
desktop-app/
├── main.js                      # Main Electron process
│   ├── createWindow()           # Window creation
│   ├── getExifToolPath()        # ExifTool location
│   ├── parsePrompts()           # Prompt parsing
│   ├── getPrompts()             # Prompt extraction
│   ├── getMasterPrompt()        # Template loading
│   ├── processAiResponse()      # CSV creation
│   ├── processFiles()           # File processing
│   └── IPC handlers             # Event listeners
│
├── preload.js                   # IPC bridge
│   └── electronAPI exposure     # contextBridge setup
│
├── renderer.js                  # Frontend logic
│   ├── Theme switcher           # Dark/light mode
│   ├── Form validation          # Input checking
│   ├── Mode switching           # AI vs Manual
│   ├── Prompt input logic       # Tab handling
│   ├── Progress bar updates     # Status tracking
│   └── IPC listeners            # Event handlers
│
├── index.html                   # UI markup
│   ├── Processing mode selector # AI vs Manual
│   ├── Batch configuration      # Marketplace, media type
│   ├── AI Generation Options    # API key, model, prompts
│   ├── Manual Processing Section# CSV upload
│   ├── Progress bar             # Visual feedback
│   └── Export packet display    # Prompt preview
│
├── package.json                 # Dependencies & build config
│   ├── dependencies             # Runtime packages
│   ├── devDependencies          # Build tools
│   └── build configuration      # electron-builder settings
│
├── prompts/                     # Master prompt templates
│   ├── 2D_Vectors/
│   │   ├── shutterstock.txt     # 2D Shutterstock rules
│   │   ├── freepik.txt          # 2D Freepik rules
│   │   ├── adobe_stock.txt      # 2D Adobe Stock rules
│   │   └── vecteezy.txt         # 2D Vecteezy rules
│   └── 3D_Renders/
│       ├── shutterstock.txt     # 3D Shutterstock rules
│       ├── freepik.txt          # 3D Freepik rules
│       ├── adobe_stock.txt      # 3D Adobe Stock rules
│       └── vecteezy.txt         # 3D Vecteezy rules
│
├── vendor/                      # Bundled ExifTool
│   ├── exiftool-mac/
│   │   ├── exiftool             # Perl script
│   │   └── lib/                 # Perl libraries (CRITICAL!)
│   │       └── Image/
│   │           ├── ExifTool.pm
│   │           └── ExifTool/    # Modules
│   └── exiftool-win/
│       └── exiftool.exe         # Windows executable
│
├── .env                         # API key (gitignored)
├── .gitignore                   # Git exclusions
├── .gemini-context.json        # Development log
│
└── Documentation/
    ├── BUILD_INSTRUCTIONS.md    # Build guide
    ├── BUNDLE_EXIFTOOL.md      # ExifTool bundling
    ├── EXIFTOOL_SETUP.md       # Setup instructions
    ├── setup-exiftool.sh       # Auto-setup script
    └── current_state_for_future_reference.md
```

---

## 7. Key Functions & Logic

### 7.1 Prompt Parsing (`parseGraphicsPromptsRaw`)

**Purpose:** Parse user prompts from various formats into individual prompt blocks.

**Logic:**
```javascript
function parseGraphicsPromptsRaw(rawText) {
    // 1. Check if text contains numbered prompts (1., 2., 3.)
    const hasNumberedPrompts = /^\s*\d+\.\s*/m.test(rawText);
    
    if (!hasNumberedPrompts) {
        // Simple case: split by double newlines
        return rawText.split(/\n+/).filter(p => p.trim());
    }
    
    // 2. Complex case: Process line by line
    const lines = rawText.split('\n');
    let currentPrompt = [];
    const prompts = [];
    
    for (const line of lines) {
        if (/^\s*\d+\.\s*/.test(line)) {
            // Found new numbered prompt
            if (currentPrompt.length > 0) {
                prompts.push(currentPrompt.join('\n').trim());
            }
            currentPrompt = [line];
        } else if (line.trim()) {
            currentPrompt.push(line);
        }
    }
    
    // Don't forget last prompt
    if (currentPrompt.length > 0) {
        prompts.push(currentPrompt.join('\n').trim());
    }
    
    return prompts;
}
```

**Handles:**
- Numbered prompts: "1. Title\nDescription"
- Multi-line prompts
- Empty lines (normalized)
- Unnumbered paragraphs

### 7.2 Master Prompt Assembly

**Purpose:** Combine master template with user prompts and replace placeholders.

```javascript
function assembleFinalPrompt(masterTemplate, prompts, count) {
    return masterTemplate
        .replace(/\{\{GRAPHICS_PROMPTS_LIST\}\}/g, prompts.join('\n'))
        .replace(/\{\{START_FILE_NUMBER\}\}/g, '1')
        .replace(/\{\{END_FILE_NUMBER\}\}/g, count.toString());
}
```

**Key:** Use global regex `/g` flag to replace ALL occurrences.

### 7.3 AI Response Processing

**Purpose:** Parse AI-generated CSV and create two outputs (raw + conformed).

```javascript
async function processAiResponse(responseText, tempDir, marketplace) {
    // 1. Parse CSV from AI
    const records = parse(responseText, { columns: true, trim: true });
    
    // 2. Save RAW CSV
    await saveRawCsv(records, tempDir);
    
    // 3. Create marketplace-conformed CSV
    const conformedRecords = transformToMarketplace(records, marketplace);
    await saveConformedCsv(conformedRecords, tempDir, marketplace);
    
    return records;
}
```

**Output Structure:**
```
temp/
├── CSV_Raw_AI_Output/
│   └── raw_ai_output.csv         # Direct AI response
└── CSV_Processed_Output/
    └── shutterstock_metadata.csv # Marketplace-ready
```

### 7.4 File Processing & Metadata Injection

**Purpose:** Rename files and inject metadata using ExifTool.

```javascript
async function processFiles(tempDir, metadata, targetExt, marketplace) {
    const exiftool = getExifToolPath();
    const files = fs.readdirSync(tempDir).filter(isImage);
    files.sort(naturalSort());
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const meta = metadata[i];
        
        // Extract marketplace-specific columns
        const title = meta[`${marketplace}_Platform_Title`];
        const description = meta['Long_Description_For_Exif'];
        const keywords = meta['Keywords'] || meta['tags'];
        
        // 1. Inject metadata
        execFileSync(exiftool, [
            '-overwrite_original',
            `-XMP-dc:Title=${title}`,
            `-IPTC:ObjectName=${title}`,
            `-XMP-dc:Description=${description}`,
            `-IPTC:Caption-Abstract=${description}`,
            '-sep', ',',
            `-IPTC:Keywords=${keywords}`,
            `-XMP-dc:Subject=${keywords}`,
            file
        ]);
        
        // 2. Rename file
        const newName = sanitizeFilename(title) + targetExt;
        fs.renameSync(file, path.join('Processed_Files', newName));
    }
}
```

### 7.5 ExifTool Path Resolution

**Purpose:** Find ExifTool in bundled or system locations.

```javascript
function getExifToolPath() {
    const isDev = !app.isPackaged;
    
    // In development: use vendor/ in project root
    // In production: use vendor/ in app.asar.unpacked
    const vendorDir = isDev 
        ? path.join(__dirname, 'vendor')
        : path.join(process.resourcesPath, 'vendor');
    
    let exiftoolPath;
    if (process.platform === 'darwin') {
        exiftoolPath = path.join(vendorDir, 'exiftool-mac/exiftool');
    } else {
        exiftoolPath = path.join(vendorDir, 'exiftool-win/exiftool.exe');
    }
    
    // Fallback to system ExifTool if bundled version not found
    if (!fs.existsSync(exiftoolPath)) {
        return findSystemExifTool();
    }
    
    return exiftoolPath;
}
```

---

## 8. Marketplace CSV Mappings

### Data Structure

```javascript
const MARKETPLACE_CSV_MAPPING = {
    "shutterstock": {
        "columns": [
            {"source": "Filename", "target": "Filename"},
            {"source": "Shutterstock_Platform_Title", "target": "Description"},
            {"source": "Keywords", "target": "Keywords"},
            {"source": "Categories", "target": "Categories"},
            {"source": "Editorial", "target": "Editorial"},
            {"source": "Mature Content", "target": "Mature Content"},
            {"source": "Illustration", "target": "Illustration"}
        ]
    },
    "freepik": {
        "columns": [
            {"source": "filename", "target": "File name"},      // lowercase!
            {"source": "Freepik_Platform_Title", "target": "Title"},
            {"source": "tags", "target": "Keywords"},           // lowercase!
            {"source": "category", "target": "Category"}
        ]
    },
    "adobe_stock": {
        "columns": [
            {"source": "Filename", "target": "Filename"},
            {"source": "AdobeStock_Platform_Title", "target": "Title"},
            {"source": "Keywords", "target": "Keywords"},
            {"source": "Category", "target": "Category"}
        ]
    },
    "vecteezy": {
        "columns": [
            {"source": "Filename", "target": "Filename"},
            {"source": "Title", "target": "Title"},
            {"source": "Description", "target": "Description"},
            {"source": "Keywords", "target": "Keywords"}
        ]
    }
};
```

### Transformation Logic

```javascript
function transformToMarketplace(rawRecords, marketplace) {
    const mapping = MARKETPLACE_CSV_MAPPING[marketplace];
    
    return rawRecords.map(record => {
        const transformed = {};
        
        for (const colMap of mapping.columns) {
            const value = record[colMap.source] || '';
            transformed[colMap.target] = value;
        }
        
        return transformed;
    });
}
```

### Expected AI Output Columns

**Shutterstock:**
- Filename, Shutterstock_Platform_Title, Long_Description_For_Exif
- Keywords, Categories, Editorial, Mature Content, Illustration
- Document_Title_For_Exif, Internal Tracking Filename

**Freepik:**
- filename (lowercase!), Freepik_Platform_Title
- tags (lowercase!), category
- Document_Title_For_Exif, Long_Description_For_Exif
- Internal Tracking Filename

**Adobe Stock:**
- Filename, AdobeStock_Platform_Title
- Keywords, Category
- Document_Title_For_Exif, Long_Description_For_Exif
- Internal Tracking Filename

**Vecteezy:**
- Filename, Title, Description, Keywords
- Document_Title_For_Exif
- Internal Tracking Filename

---

## 9. ExifTool Integration

### Metadata Fields Written

| Field | Purpose | Format |
|-------|---------|--------|
| XMP-dc:Title | Document title | String |
| IPTC:ObjectName | Document title (legacy) | String |
| XMP-dc:Description | Long description | String |
| IPTC:Caption-Abstract | Long description (legacy) | String |
| IPTC:Keywords | Keywords | Comma-separated |
| XMP-dc:Subject | Keywords | Comma-separated |

### Command Structure

```bash
exiftool \
  -overwrite_original \
  -XMP-dc:Title="Hard Hat Safety Icon" \
  -IPTC:ObjectName="Hard Hat Safety Icon" \
  -XMP-dc:Description="A detailed description..." \
  -IPTC:Caption-Abstract="A detailed description..." \
  -sep , \
  -IPTC:Keywords="safety,construction,hardhat,icon" \
  -XMP-dc:Subject="safety,construction,hardhat,icon" \
  file.eps
```

### Bundling for Production

**macOS Requirements:**
```
vendor/exiftool-mac/
├── exiftool               # Perl script (~200KB)
└── lib/                   # Perl libraries (~6MB)
    └── Image/
        ├── ExifTool.pm
        └── ExifTool/
            └── *.pm       # 100+ module files
```

**Windows Requirements:**
```
vendor/exiftool-win/
└── exiftool.exe          # Single executable (~12MB)
```

### Setup Script

```bash
#!/bin/bash
# setup-exiftool.sh

EXIFTOOL_VERSION="12.70"

# Download complete ExifTool
curl -O "https://exiftool.org/Image-ExifTool-${EXIFTOOL_VERSION}.tar.gz"
tar -xzf "Image-ExifTool-${EXIFTOOL_VERSION}.tar.gz"

# Copy to vendor folder
mkdir -p vendor/exiftool-mac
cp "Image-ExifTool-${EXIFTOOL_VERSION}/exiftool" vendor/exiftool-mac/
cp -r "Image-ExifTool-${EXIFTOOL_VERSION}/lib" vendor/exiftool-mac/
chmod +x vendor/exiftool-mac/exiftool

# Verify
vendor/exiftool-mac/exiftool -ver
```

---

## 10. Build & Distribution

### Build Configuration (package.json)

```json
{
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
      "target": ["dmg", "zip"]
    },
    "win": {
      "target": ["nsis", "zip"]
    }
  }
}
```

### Build Process

```bash
# 1. Setup ExifTool (one-time)
./setup-exiftool.sh

# 2. Install electron-builder (one-time)
npm install --save-dev electron-builder

# 3. Build
npm run build:mac    # Creates .dmg and .app
npm run build:win    # Creates .exe installer
npm run build:all    # Both platforms
```

### Distribution Files

**macOS:**
- `Metadata Generator.dmg` (180MB) - Drag-and-drop installer
- `Metadata Generator-mac.zip` (170MB) - Portable app

**Windows:**
- `Metadata Generator Setup.exe` (190MB) - NSIS installer
- `Metadata Generator-win.zip` (185MB) - Portable version

### Code Signing (Optional)

**macOS:**
```json
"mac": {
  "identity": "Developer ID Application: Your Name (TEAM_ID)",
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "build/entitlements.mac.plist"
}
```

**Windows:**
```bash
# Use signtool to sign the .exe
signtool sign /f certificate.pfx /p password /t timestamp_url app.exe
```

---

## 11. Troubleshooting

### Common Issues

#### "ExifTool not found"
**Cause:** ExifTool not bundled correctly  
**Fix:** Run `./setup-exiftool.sh` and rebuild

#### "Can't locate Image/ExifTool.pm"
**Cause:** Missing Perl libraries (lib/ folder)  
**Fix:** Ensure `lib/` folder exists in `vendor/exiftool-mac/`

#### Tab switching doesn't work
**Cause:** Content Security Policy blocking Bootstrap JS  
**Fix:** Already fixed - CSP includes `https://cdn.jsdelivr.net`

#### CSV has all prompts in one cell
**Cause:** Old parsing logic  
**Fix:** Already fixed - uses `parseGraphicsPromptsRaw()`

#### Placeholders not replaced ({{END_FILE_NUMBER}})
**Cause:** Missing global flag in regex  
**Fix:** Already fixed - uses `/\{\{PLACEHOLDER\}\}/g`

#### Folder names don't match Flask app
**Cause:** Old folder naming  
**Fix:** Already fixed - uses `Processed_Files` + `CSV_Processed_Output`

---

## 12. Development History

### October 17, 2025 - Major Sync & Bug Fixes

**Synchronization with Flask App:**
- ✅ Changed default mode to "AI Generate & Process"
- ✅ Updated API key label to "(Optional)"
- ✅ Moved all AI tools inside AI Generation Options card
- ✅ Implemented comprehensive marketplace CSV mappings
- ✅ Added proper ExifTool field injections (6 fields)
- ✅ Fixed output folder names to match Flask

**Critical Bug Fixes:**
- ✅ Fixed Content Security Policy for tab switching
- ✅ Fixed placeholder replacement (global regex)
- ✅ Fixed TXT to CSV parsing (parseGraphicsPromptsRaw)
- ✅ Added progress bar
- ✅ Fixed ExifTool path resolution for production builds

**Production Readiness:**
- ✅ Created setup-exiftool.sh script
- ✅ Updated package.json with electron-builder config
- ✅ Added comprehensive documentation
- ✅ Verified feature parity with Flask app

---

## 🎯 Quick Reference

### Development
```bash
npm install
brew install exiftool  # macOS
npm start
```

### Production
```bash
./setup-exiftool.sh  # Choose option 3
npm install --save-dev electron-builder
npm run build:all
```

### Testing
```bash
# Test bundled ExifTool
vendor/exiftool-mac/exiftool -ver

# Test in dev mode
npm start

# Test built app
open "dist/Metadata Generator.app"
```

---

**Last Updated:** October 17, 2025  
**Maintained By:** [Your Name]  
**License:** ISC  
**Repository:** https://github.com/mrsam-dev/Desktop-Metadata-Generator

