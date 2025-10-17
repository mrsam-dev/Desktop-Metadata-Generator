require('dotenv').config();
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { execFileSync } = require('child_process');
const AdmZip = require('adm-zip');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { parse } = require('csv-parse/sync');
const { createObjectCsvWriter } = require('csv-writer');
const naturalSort = require('natural-sort');

let mainWindow;

// --- Marketplace Specific CSV Output Configuration (matching Flask app) ---
const MARKETPLACE_CSV_MAPPING = {
    "shutterstock": {
        "columns": [
            {"source": "Filename", "target": "Filename"},
            {"source": "Shutterstock_Platform_Title", "target": "Description"}, 
            {"source": "Keywords", "target": "Keywords"},
            {"source": "Categories", "target": "Categories"},
            {"source": "Editorial", "target": "Editorial"},
            {"source": "Mature Content", "target": "Mature Content"},
            {"source": "Illustration", "target": "Illustration"},
        ],
        "include_internal_tracking_in_download_csv": false 
    },
    "freepik": { 
        "columns": [
            {"source": "filename", "target": "File name"}, 
            {"source": "Freepik_Platform_Title", "target": "Title"}, 
            {"source": "tags", "target": "Keywords"}, 
            {"source": "category", "target": "Category"}, 
        ],
        "include_internal_tracking_in_download_csv": false 
    },
    "adobe_stock": { 
        "columns": [
            {"source": "Filename", "target": "Filename"}, 
            {"source": "AdobeStock_Platform_Title", "target": "Title"}, 
            {"source": "Keywords", "target": "Keywords"},
            {"source": "Category", "target": "Category"},
        ],
        "include_internal_tracking_in_download_csv": false 
    },
    "vecteezy": { 
        "columns": [
            {"source": "Filename", "target": "Filename"},
            {"source": "Title", "target": "Title"},
            {"source": "Description", "target": "Description"},
            {"source": "Keywords", "target": "Keywords"},
        ],
        "include_internal_tracking_in_download_csv": false
    }
};

// CSV header constants (matching Flask app)
const CSV_FILENAME_AI_OUTPUT_HEADER = "Filename";
const CSV_INTERNAL_TRACKING_FILENAME_HEADER = "Internal Tracking Filename";
const CSV_KEYWORDS_AI_OUTPUT_HEADER = "Keywords";

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 900,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
        }
    });
    mainWindow.loadFile('index.html');
    
    // Open DevTools in development mode only
    // mainWindow.webContents.openDevTools();
}

function sendStatus(message) {
    if (mainWindow) {
        mainWindow.webContents.send('update-status', message);
    }
}

function getExifToolPath() {
    let exiftoolPath;
    
    // In production (packaged app), resources are in a different location
    const isDev = !app.isPackaged;
    const vendorDir = isDev 
        ? path.join(__dirname, 'vendor')
        : path.join(process.resourcesPath, 'vendor');

    if (process.platform === 'win32') {
        exiftoolPath = path.join(vendorDir, 'exiftool-win', 'exiftool.exe');
    } else if (process.platform === 'darwin') {
        exiftoolPath = path.join(vendorDir, 'exiftool-mac', 'exiftool');
    } else {
        throw new Error(`Unsupported platform: ${process.platform}. ExifTool cannot be located.`);
    }

    // Check if bundled ExifTool exists
    if (!fs.existsSync(exiftoolPath)) {
        console.warn(`Bundled ExifTool not found at: ${exiftoolPath}`);
        console.warn('Attempting to use system ExifTool...');
        
        // Try to use system ExifTool as fallback
        if (process.platform === 'darwin') {
            // Try common Homebrew paths
            const systemPaths = [
                '/opt/homebrew/bin/exiftool',
                '/usr/local/bin/exiftool',
                'exiftool'  // Try PATH
            ];
            
            for (const systemPath of systemPaths) {
                try {
                    // Test if it exists and works
                    const { execFileSync } = require('child_process');
                    execFileSync(systemPath, ['-ver'], { encoding: 'utf8' });
                    console.log(`Found system ExifTool at: ${systemPath}`);
                    return systemPath;
                } catch (e) {
                    // Continue to next path
                }
            }
        }
        
        throw new Error(`ExifTool not found. Please install ExifTool or see EXIFTOOL_SETUP.md for instructions.`);
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

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

function parsePrompts(rawText) {
    // Use the same parsing logic as Flask app
    return parseGraphicsPromptsRaw(rawText);
}

function getPrompts(data) {
    let prompts = [];
    if (data.graphicsPrompts) {
        prompts = parsePrompts(data.graphicsPrompts);
    } else if (data.graphicsPromptsFilePath) {
        const fileContent = fs.readFileSync(data.graphicsPromptsFilePath, 'utf8');
        prompts = parsePrompts(fileContent);
    } else if (data.graphicsPromptsCsvFilePath) {
        const csvContent = fs.readFileSync(data.graphicsPromptsCsvFilePath, 'utf8');
        const records = parse(csvContent, { columns: true, skip_empty_lines: true });
        const promptColumnName = Object.keys(records[0]).find(key => key.toLowerCase() === 'prompt text');
        if (!promptColumnName) throw new Error('CSV file must contain a "Prompt Text" column.');
        prompts = records.map(record => record[promptColumnName]);
    }

    if (prompts.length === 0) {
        throw new Error('No valid prompts found.');
    }
    return { prompts, count: prompts.length };
}

function getMasterPrompt(data) {
    if (data.useCustomMasterPrompt && data.customMasterPrompt) return data.customMasterPrompt;
    
    // Desktop app has its own prompts folder
    const isDev = !app.isPackaged;
    const promptsDir = isDev 
        ? path.join(__dirname, 'prompts')  // Local prompts folder in dev
        : path.join(process.resourcesPath, 'prompts');  // Bundled in production
    
    const promptPath = path.join(promptsDir, data.mediaType, `${data.marketplace}.txt`);
    
    if (!fs.existsSync(promptPath)) {
        // Try alternative path for asar unpacked
        const altPath = path.join(__dirname, 'prompts', data.mediaType, `${data.marketplace}.txt`);
        if (fs.existsSync(altPath)) {
            return fs.readFileSync(altPath, 'utf8');
        }
        throw new Error(`Master prompt file not found at: ${promptPath}`);
    }
    
    return fs.readFileSync(promptPath, 'utf8');
}

async function processAiResponse(responseText, tempDir, marketplace) {
    // Parse CSV response from AI (expecting full CSV format, not pipe-delimited)
    let records;
    try {
        records = parse(responseText.trim(), { 
            columns: true, 
            skip_empty_lines: true,
            trim: true 
        });
    } catch (error) {
        throw new Error(`AI-generated CSV is malformed. Error: ${error.message}. Please try with fewer prompts or a more powerful model (e.g., gemini-2.5-pro).`);
    }

    if (records.length === 0) throw new Error('AI response could not be parsed or was empty.');
    
    // Save RAW AI output CSV
    const rawCsvPath = path.join(tempDir, 'CSV_Raw_AI_Output', 'raw_ai_output.csv');
    fs.mkdirSync(path.dirname(rawCsvPath), { recursive: true });
    
    // Determine columns from the first record
    const rawHeaders = Object.keys(records[0]).map(key => ({ id: key, title: key }));
    await createObjectCsvWriter({ path: rawCsvPath, header: rawHeaders }).writeRecords(records);

    // Create marketplace-conformed CSV
    let conformedRecords = [];
    let conformedHeaders = [];

    if (marketplace in MARKETPLACE_CSV_MAPPING) {
        const mapping = MARKETPLACE_CSV_MAPPING[marketplace];
        
        // Build conformed records by mapping source columns to target columns
        conformedRecords = records.map(record => {
            const conformedRecord = {};
            for (const colMap of mapping.columns) {
                const sourceCol = colMap.source;
                const targetCol = colMap.target;
                
                if (sourceCol in record) {
                    conformedRecord[targetCol] = record[sourceCol];
                } else {
                    // Column missing, add empty value
                    conformedRecord[targetCol] = '';
                }
            }
            return conformedRecord;
        });

        // Build headers for conformed CSV
        conformedHeaders = mapping.columns.map(colMap => ({ 
            id: colMap.target, 
            title: colMap.target 
        }));
    } else {
        // No specific mapping, use raw records
        conformedRecords = records;
        conformedHeaders = rawHeaders;
    }

    const conformedCsvPath = path.join(tempDir, 'CSV_Processed_Output', `${marketplace}_metadata_for_upload.csv`);
    fs.mkdirSync(path.dirname(conformedCsvPath), { recursive: true });
    await createObjectCsvWriter({ path: conformedCsvPath, header: conformedHeaders }).writeRecords(conformedRecords);
    
    // Return the raw records for file processing (using original AI column names)
    return records;
}

function sanitizeArg(arg) {
    if (typeof arg !== 'string') return '';
    // Allow letters, numbers, spaces, and common punctuation.
    // This is a restrictive set to be safe.
    return arg.replace(/[^a-zA-Z0-9\s.,!?-]/g, '');
}

async function processFiles(tempDir, processedData, targetExtension, marketplace) {
    const exiftoolPath = getExifToolPath();
    const supportedExtensions = ['.eps', '.jpg', '.jpeg', '.png', '.svg'];
    const files = fs.readdirSync(tempDir).filter(f => supportedExtensions.includes(path.extname(f).toLowerCase()));
    files.sort(naturalSort());

    if (files.length !== processedData.length) {
        throw new Error(`File count (${files.length}) and metadata count (${processedData.length}) mismatch.`);
    }

    // Create output folder for processed files
    const injectedFilesDir = path.join(tempDir, 'Processed_Files');
    fs.mkdirSync(injectedFilesDir, { recursive: true });

    for (let i = 0; i < files.length; i++) {
        const originalFileName = files[i];
        const record = processedData[i];
        sendStatus(`Processing file ${i + 1} of ${files.length}: ${originalFileName}`);

        // Extract marketplace-specific column values (matching Flask app logic)
        let titleForExif = '';
        let descriptionForExif = '';
        let keywordsForExif = '';
        let filenameBase = '';

        if (marketplace === "shutterstock") {
            titleForExif = record.Shutterstock_Platform_Title || '';
            descriptionForExif = record.Long_Description_For_Exif || '';
            keywordsForExif = record.Keywords || '';
            filenameBase = record.Filename || '';
        } else if (marketplace === "freepik") {
            titleForExif = record.Freepik_Platform_Title || '';
            descriptionForExif = record.Long_Description_For_Exif || '';
            keywordsForExif = record.tags || '';
            filenameBase = record.filename || '';
        } else if (marketplace === "adobe_stock") {
            titleForExif = record.AdobeStock_Platform_Title || '';
            descriptionForExif = record.Long_Description_For_Exif || '';
            keywordsForExif = record.Keywords || '';
            filenameBase = record.Filename || '';
        } else if (marketplace === "vecteezy") {
            titleForExif = record.Title || '';
            descriptionForExif = record.Description || '';
            keywordsForExif = record.Keywords || '';
            filenameBase = record.Filename || '';
        }

        // Remove extension from filename base if present
        filenameBase = filenameBase.replace(/\.[^/.]+$/, '');
        
        // Sanitize filename for filesystem (matching Flask app logic)
        const safeFilename = filenameBase.replace(/[\/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
        
        // Add dot before extension (matching Flask app: f"{name}.{ext}")
        const newFileName = `${safeFilename}.${targetExtension}`;
        const originalFilePath = path.join(tempDir, originalFileName);
        const newFilePath = path.join(injectedFilesDir, newFileName);

        try {
            // First inject metadata into original file
            const sanitizedTitle = sanitizeArg(titleForExif);
            const sanitizedDescription = sanitizeArg(descriptionForExif);
            const sanitizedKeywords = sanitizeArg(keywordsForExif);
            
            const args = [
                '-overwrite_original',
                `-XMP-dc:Title=${sanitizedTitle}`,
                `-IPTC:ObjectName=${sanitizedTitle}`,
                `-XMP-dc:Description=${sanitizedDescription}`,
                `-IPTC:Caption-Abstract=${sanitizedDescription}`,
                '-sep', ',',
                `-IPTC:Keywords=${sanitizedKeywords}`,
                `-XMP-dc:Subject=${sanitizedKeywords}`,
                originalFilePath
            ];
            
            execFileSync(exiftoolPath, args);
            sendStatus(`Metadata injected into ${originalFileName}`);

            // Then rename and move to Injected_Files folder
            fs.renameSync(originalFilePath, newFilePath);
            sendStatus(`Renamed to ${newFileName}`);
        } catch (error) {
            console.error(`Failed to process ${originalFileName}: ${error.message}`);
            sendStatus(`Warning: Could not fully process ${originalFileName}.`);
            // Try to at least copy the file
            try {
                fs.copyFileSync(originalFilePath, newFilePath);
            } catch (copyError) {
                console.error(`Failed to copy ${originalFileName}: ${copyError.message}`);
            }
        }
    }
}

// Helper function for parsing graphics prompts (matching Flask app's _parse_graphics_prompts_raw)
function parseGraphicsPromptsRaw(rawText) {
    const cleanedRawText = rawText.trim();
    if (!cleanedRawText) return [];

    // Regex to find any numbered line, which indicates the start of a new prompt block
    const numberedPromptStartPattern = /^\s*\d+\.\s*/m;

    // If no numbered prompts are found, treat as unnumbered paragraphs
    if (!numberedPromptStartPattern.test(cleanedRawText)) {
        const paragraphs = cleanedRawText.split(/\n+/).map(p => p.trim()).filter(p => p);
        return paragraphs;
    }

    // If numbered prompts ARE found, process them as distinct blocks
    const lines = cleanedRawText.split('\n');
    let currentPromptLines = [];
    const parsedPrompts = [];

    for (const line of lines) {
        if (/^\s*\d+\.\s*/.test(line)) {
            if (currentPromptLines.length > 0) {
                const normalizedBlock = currentPromptLines.join('\n').replace(/\n{2,}/g, '\n').trim();
                if (normalizedBlock) {
                    parsedPrompts.push(normalizedBlock);
                }
            }
            currentPromptLines = [line];
        } else if (line.trim() !== "") {
            currentPromptLines.push(line);
        } else {
            if (currentPromptLines.length > 0) {
                currentPromptLines.push(line);
            }
        }
    }

    if (currentPromptLines.length > 0) {
        const normalizedBlock = currentPromptLines.join('\n').replace(/\n{2,}/g, '\n').trim();
        if (normalizedBlock) {
            parsedPrompts.push(normalizedBlock);
        }
    }

    return parsedPrompts;
}

// Listener for the TXT to CSV conversion utility
ipcMain.on('convert-txt-to-csv', async (event, filePath) => {
    console.log("[CONVERT-DEBUG] Received 'convert-txt-to-csv' event.");
    try {
        console.log(`[CONVERT-DEBUG] File path received: ${filePath}`);
        const txtContent = fs.readFileSync(filePath, 'utf8');
        console.log(`[CONVERT-DEBUG] Raw TXT content read successfully.`);

        // Use the same parsing logic as Flask app
        const prompts = parseGraphicsPromptsRaw(txtContent);
        console.log(`[CONVERT-DEBUG] Parsed into ${prompts.length} prompts.`);

        const records = prompts.map(prompt => ({ 'Prompt Text': prompt }));
        console.log(`[CONVERT-DEBUG] Mapped to ${records.length} records for CSV.`);

        console.log('[CONVERT-DEBUG] Showing save dialog...');
        const { filePath: savePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Save Converted CSV',
            defaultPath: `converted_prompts_${Date.now()}.csv`,
            filters: [{ name: 'CSV Files', extensions: ['csv'] }]
        });

        if (savePath) {
            console.log(`[CONVERT-DEBUG] User selected save path: ${savePath}`);
            const csvWriter = createObjectCsvWriter({
                path: savePath,
                header: [
                    { id: 'Prompt Text', title: 'Prompt Text' }
                ]
            });
            await csvWriter.writeRecords(records);
            console.log('[CONVERT-DEBUG] Successfully wrote CSV file.');
            event.reply('convert-txt-to-csv-reply', { success: true, filePath: savePath });
        } else {
            console.log('[CONVERT-DEBUG] Save operation cancelled by user.');
            event.reply('convert-txt-to-csv-reply', { success: false, error: 'Save operation cancelled.' });
        }

    } catch (error) {
        console.error('[CONVERT-DEBUG] An error occurred in convert-txt-to-csv:', error);
        event.reply('convert-txt-to-csv-reply', { success: false, error: error.message });
    }
});

ipcMain.on('export-master-prompt', (event, data) => {
    try {
        const { prompts, count } = getPrompts(data);
        const masterPrompt = getMasterPrompt(data);
        const finalPrompt = masterPrompt
            .replace(/\{\{GRAPHICS_PROMPTS_LIST\}\}/g, prompts.join('\n'))
            .replace(/\{\{START_FILE_NUMBER\}\}/g, '1')
            .replace(/\{\{END_FILE_NUMBER\}\}/g, count.toString());
        event.reply('export-master-prompt-reply', { success: true, prompt: finalPrompt });
    } catch (error) {
        console.error('Failed to export master prompt:', error);
        event.reply('export-master-prompt-reply', { success: false, error: error.message });
    }
});

ipcMain.on('log-to-terminal', (event, message) => {
    console.log(`[UI Click]: ${message}`);
});

ipcMain.on('form:submit', async (event, data) => {
    let tempDir;
    try {
        sendStatus('Processing started...');
        if (!data.sourceFilesPath) throw new Error('No source file path provided.');

        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'metadata-generator-'));
        sendStatus('Created temporary directory...');

        const zip = new AdmZip(data.sourceFilesPath);
        zip.extractAllTo(tempDir, true);
        sendStatus('Successfully extracted source files.');

        let processedData;
        if (data.processingMode === 'ai') {
            const apiKey = data.geminiApiKey || process.env.GEMINI_API_KEY;
            if (!apiKey) {
                throw new Error('Gemini API Key not provided in UI and not found in a .env file.');
            }
            sendStatus('Constructing prompts...');
            const { prompts, count } = getPrompts(data);
            const masterPrompt = getMasterPrompt(data);
            const finalPrompt = masterPrompt
                .replace(/\{\{GRAPHICS_PROMPTS_LIST\}\}/g, prompts.join('\n'))
                .replace(/\{\{START_FILE_NUMBER\}\}/g, '1')
                .replace(/\{\{END_FILE_NUMBER\}\}/g, count.toString());
            sendStatus('Calling Gemini AI... This may take a moment.');
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: data.geminiModel });
            const result = await model.generateContent(finalPrompt);
            const text = result.response.text();
            sendStatus('Parsing AI response and creating CSVs...');
            processedData = await processAiResponse(text, tempDir, data.marketplace);
        } else {
            sendStatus('Processing in Manual Mode...');
            let csvContent;
            if (data.existingMetadataCsvPath) {
                sendStatus('Reading from provided CSV file...');
                csvContent = fs.readFileSync(data.existingMetadataCsvPath, 'utf8');
            } else if (data.pasteExistingMetadata) {
                sendStatus('Reading from pasted CSV data...');
                csvContent = data.pasteExistingMetadata;
            } else {
                throw new Error('No existing metadata provided for Manual Mode.');
            }
            const records = parse(csvContent, { columns: true, skip_empty_lines: true });
            if (records.length === 0) throw new Error('CSV data is empty or invalid.');
            
            // Transform manual CSV to match the structure expected by processFiles()
            // Match marketplace-specific column names like AI mode
            processedData = records.map(r => {
                const baseFilename = r.Filename || r.filename;
                const title = r.Document_Title_For_Exif || r.Title || r.title;
                const description = r.Long_Description_For_Exif || r.description;
                const keywords = r.Keywords || r.keywords || r.tags;
                const category = r.Category || r.category || '';
                
                if (!baseFilename || !title) {
                    throw new Error('CSV for manual mode must contain at least "Filename" and "Title" columns.');
                }
                
                // Create a record with ALL marketplace-specific columns
                // so processFiles() can extract the right ones based on marketplace
                const record = {
                    'Filename': baseFilename,
                    'filename': baseFilename.toLowerCase(),  // For freepik
                    'Document_Title_For_Exif': title,
                    'Long_Description_For_Exif': description || '',
                    'Keywords': keywords || '',
                    'tags': keywords || '',  // For freepik
                    
                    // Platform-specific title columns
                    'Shutterstock_Platform_Title': title,
                    'Freepik_Platform_Title': title,
                    'AdobeStock_Platform_Title': title,
                    'Title': title,  // For vecteezy
                    'Description': description || '',  // For vecteezy
                    
                    // Category columns (different naming for different marketplaces)
                    'Category': category,
                    'category': category.toLowerCase(),  // For freepik
                    'Categories': category,  // For shutterstock (plural)
                    
                    // Additional marketplace-specific columns with default values
                    'Editorial': '',  // For shutterstock
                    'Mature Content': '',  // For shutterstock
                    'Illustration': '',  // For shutterstock
                };
                
                return record;
            });
            sendStatus(`Successfully parsed ${processedData.length} records from CSV.`);
            
            // Also create a marketplace CSV output for manual mode
            sendStatus('Creating marketplace CSV...');
            const csvOutputDir = path.join(tempDir, 'CSV_Processed_Output');
            fs.mkdirSync(csvOutputDir, { recursive: true });
            
            // Create marketplace-conformed CSV
            const marketplaceMapping = MARKETPLACE_CSV_MAPPING[data.marketplace];
            if (marketplaceMapping) {
                const conformedRecords = processedData.map(record => {
                    const transformed = {};
                    for (const colMap of marketplaceMapping.columns) {
                        transformed[colMap.target] = record[colMap.source] || '';
                    }
                    return transformed;
                });
                
                const csvFilename = `${data.marketplace}_metadata_for_upload.csv`;
                const csvPath = path.join(csvOutputDir, csvFilename);
                const csvWriter = createObjectCsvWriter({
                    path: csvPath,
                    header: marketplaceMapping.columns.map(c => ({ id: c.target, title: c.target }))
                });
                await csvWriter.writeRecords(conformedRecords);
                sendStatus(`Created ${csvFilename} in CSV_Processed_Output folder.`);
            }
        }

        if (processedData) {
            await processFiles(tempDir, processedData, data.targetFileFormat, data.marketplace);
            sendStatus('Creating final zip archive...');
            const outputZip = new AdmZip();
            outputZip.addLocalFolder(tempDir);
            const outputZipBuffer = outputZip.toBuffer();
            const { filePath } = await dialog.showSaveDialog(mainWindow, {
                title: 'Save Processed Files',
                defaultPath: `processed_metadata_${Date.now()}.zip`,
                filters: [{ name: 'Zip Files', extensions: ['zip'] }]
            });
            if (filePath) {
                fs.writeFileSync(filePath, outputZipBuffer);
                sendStatus(`Success! Final zip file saved to: ${filePath}`);
            } else {
                sendStatus('Save operation cancelled.');
            }
        }
    } catch (error) {
        console.error('An error occurred during processing:', error.stack || error);
        sendStatus(`Error: ${error.message}`);
    } finally {
        if (tempDir) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});