#!/bin/bash

# Setup script to download and install complete ExifTool for bundling
# Run this before building your Electron app for distribution

set -e  # Exit on error

echo "================================"
echo "ExifTool Setup for Bundling"
echo "================================"
echo ""

EXIFTOOL_VERSION="12.70"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Function to download and setup macOS ExifTool
setup_mac() {
    echo "📦 Setting up ExifTool for macOS..."
    
    # Create temp directory
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"
    
    # Download ExifTool
    echo "⬇️  Downloading ExifTool ${EXIFTOOL_VERSION}..."
    curl -sS -O "https://exiftool.org/Image-ExifTool-${EXIFTOOL_VERSION}.tar.gz"
    
    # Extract
    echo "📂 Extracting..."
    tar -xzf "Image-ExifTool-${EXIFTOOL_VERSION}.tar.gz"
    
    # Remove old vendor folder
    echo "🗑️  Removing old ExifTool (if exists)..."
    rm -rf "$SCRIPT_DIR/vendor/exiftool-mac"
    
    # Create new vendor folder
    echo "📁 Creating vendor folder..."
    mkdir -p "$SCRIPT_DIR/vendor/exiftool-mac"
    
    # Copy ExifTool files
    echo "📋 Copying ExifTool files..."
    cp "Image-ExifTool-${EXIFTOOL_VERSION}/exiftool" "$SCRIPT_DIR/vendor/exiftool-mac/"
    cp -r "Image-ExifTool-${EXIFTOOL_VERSION}/lib" "$SCRIPT_DIR/vendor/exiftool-mac/"
    
    # Make executable
    chmod +x "$SCRIPT_DIR/vendor/exiftool-mac/exiftool"
    
    # Cleanup
    cd "$SCRIPT_DIR"
    rm -rf "$TEMP_DIR"
    
    # Verify
    echo "✅ Verifying installation..."
    if [ -f "$SCRIPT_DIR/vendor/exiftool-mac/exiftool" ] && [ -d "$SCRIPT_DIR/vendor/exiftool-mac/lib" ]; then
        VERSION=$("$SCRIPT_DIR/vendor/exiftool-mac/exiftool" -ver)
        echo "✅ macOS ExifTool ${VERSION} installed successfully!"
    else
        echo "❌ Installation failed. Please check the vendor folder."
        exit 1
    fi
}

# Function to download and setup Windows ExifTool
setup_windows() {
    echo ""
    echo "📦 Setting up ExifTool for Windows..."
    
    # Create temp directory
    TEMP_DIR=$(mktemp -d)
    cd "$TEMP_DIR"
    
    # Download ExifTool
    echo "⬇️  Downloading ExifTool ${EXIFTOOL_VERSION} for Windows..."
    curl -sS -O "https://exiftool.org/exiftool-${EXIFTOOL_VERSION}.zip"
    
    # Extract
    echo "📂 Extracting..."
    unzip -q "exiftool-${EXIFTOOL_VERSION}.zip"
    
    # Remove old vendor folder
    echo "🗑️  Removing old ExifTool (if exists)..."
    rm -rf "$SCRIPT_DIR/vendor/exiftool-win"
    
    # Create new vendor folder
    echo "📁 Creating vendor folder..."
    mkdir -p "$SCRIPT_DIR/vendor/exiftool-win"
    
    # Copy and rename ExifTool
    echo "📋 Copying ExifTool executable..."
    cp "exiftool(-k).exe" "$SCRIPT_DIR/vendor/exiftool-win/exiftool.exe"
    
    # Cleanup
    cd "$SCRIPT_DIR"
    rm -rf "$TEMP_DIR"
    
    # Verify
    echo "✅ Verifying installation..."
    if [ -f "$SCRIPT_DIR/vendor/exiftool-win/exiftool.exe" ]; then
        echo "✅ Windows ExifTool installed successfully!"
    else
        echo "❌ Installation failed. Please check the vendor folder."
        exit 1
    fi
}

# Main menu
echo "What would you like to do?"
echo ""
echo "1) Setup ExifTool for macOS only"
echo "2) Setup ExifTool for Windows only"
echo "3) Setup ExifTool for both (recommended)"
echo ""
read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        setup_mac
        ;;
    2)
        setup_windows
        ;;
    3)
        setup_mac
        setup_windows
        ;;
    *)
        echo "❌ Invalid choice. Exiting."
        exit 1
        ;;
esac

echo ""
echo "================================"
echo "✅ Setup Complete!"
echo "================================"
echo ""
echo "Next steps:"
echo "1. Install electron-builder: npm install --save-dev electron-builder"
echo "2. Build your app: npm run build:mac (or build:win or build:all)"
echo "3. Test the built app in the 'dist' folder"
echo ""
echo "Your vendor folder structure:"
ls -la "$SCRIPT_DIR/vendor/"

