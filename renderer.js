document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // --- THEME SWITCHER LOGIC ---
    (() => {
        const getStoredTheme = () => localStorage.getItem('theme');
        const setStoredTheme = theme => localStorage.setItem('theme', theme);
        const getPreferredTheme = () => {
            const storedTheme = getStoredTheme();
            if (storedTheme) return storedTheme;
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        };
        const setTheme = theme => {
            const effectiveTheme = theme === 'auto' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme;
            document.documentElement.setAttribute('data-bs-theme', effectiveTheme);
        };
        setTheme(getPreferredTheme());
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            if (getStoredTheme() !== 'light' && getStoredTheme() !== 'dark') {
                setTheme(getPreferredTheme());
            }
        });
        document.querySelectorAll('[data-bs-theme-value]').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const theme = toggle.getAttribute('data-bs-theme-value');
                setStoredTheme(theme);
                setTheme(theme);
            });
        });
    })();

    // --- DOM ELEMENT REFERENCES ---
    const statusMessage = document.getElementById('statusMessage');
    const mainSubmitButton = document.getElementById('mainSubmitButton');
    const metadataForm = document.getElementById('metadataForm');
    const mediaTypeSelect = document.getElementById('mediaType');
    const styleDescriptionElement = document.getElementById('styleDescription');
    const customPromptToggle = document.getElementById('customPromptToggle');
    const customMasterPrompt = document.getElementById('customMasterPrompt');
    const processingModeRadios = document.querySelectorAll('input[name="processingMode"]');
    const aiProcessingSection = document.getElementById('aiProcessingSection');
    const manualProcessingSection = document.getElementById('manualProcessingSection');
    const sourceFilesInput = document.getElementById('sourceFiles');
    const convertTxtInput = document.getElementById('convertTxtInput');
    const convertTxtToCsvButton = document.getElementById('convertTxtToCsvButton');
    const convertTxtStatusMessage = document.getElementById('convertTxtStatusMessage');
    const exportMasterPromptButton = document.getElementById('exportMasterPromptButton');
    const exportPacketContainer = document.getElementById('exportPacketContainer');
    const exportPacketContent = document.getElementById('exportPacketContent');
    const progressBarContainer = document.getElementById('progressBarContainer');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');

    // --- FORM VALIDATION ---
    function validateForm() {
        const sourceFile = sourceFilesInput.files.length > 0;
        mainSubmitButton.disabled = !sourceFile;
    }

    sourceFilesInput.addEventListener('change', validateForm);
    processingModeRadios.forEach(radio => radio.addEventListener('change', validateForm));

    // --- PROMPT INPUT LOGIC ---
    const graphicsPrompts = document.getElementById('graphicsPrompts');
    const graphicsPromptsFile = document.getElementById('graphicsPromptsFile');
    const graphicsPromptsCsvFile = document.getElementById('graphicsPromptsCsvFile');
    const manualTab = document.getElementById('nav-manual-tab');
    const fileUploadTab = document.getElementById('nav-file-upload-tab');

    function updatePromptInputs() {
        const manualText = graphicsPrompts.value.trim() !== '';
        const txtFile = graphicsPromptsFile.files.length > 0;
        const csvFile = graphicsPromptsCsvFile.files.length > 0;

        graphicsPrompts.disabled = txtFile || csvFile;
        graphicsPromptsFile.disabled = manualText || csvFile;
        graphicsPromptsCsvFile.disabled = manualText || txtFile;
    }

    graphicsPrompts.addEventListener('input', updatePromptInputs);
    graphicsPromptsFile.addEventListener('change', updatePromptInputs);
    graphicsPromptsCsvFile.addEventListener('change', updatePromptInputs);

    manualTab.addEventListener('click', () => {
        graphicsPromptsFile.value = '';
        graphicsPromptsCsvFile.value = '';
        updatePromptInputs();
    });

    fileUploadTab.addEventListener('click', () => {
        graphicsPrompts.value = '';
        updatePromptInputs();
    });

    // --- UI LOGIC ---
    const mediaTypeStyles = {
        "2D_Vectors": "solid bold uniform stroke, monochrome, Icon like, centered, isolated on white, flat 2D vector, simple shapes, minimalist design for a consistent Icon pack.",
        "3D_Renders": "high-resolution, isometric Octane 3D renders designed as premium icons..."
    };

    function updateStyleDescription() {
        styleDescriptionElement.innerText = mediaTypeStyles[mediaTypeSelect.value] || 'N/A';
    }

    function handleProcessingModeChange() {
        const selectedMode = document.querySelector('input[name="processingMode"]:checked').value;
        aiProcessingSection.style.display = selectedMode === 'ai' ? 'block' : 'none';
        manualProcessingSection.style.display = selectedMode === 'manual' ? 'block' : 'none';
        mainSubmitButton.innerText = selectedMode === 'ai' ? 'Generate Metadata & Process Files' : 'Process Existing Metadata & Files';
        validateForm(); // Re-validate when mode changes
    }

    // --- EVENT LISTENERS ---
    mediaTypeSelect.addEventListener('change', updateStyleDescription);
    
    customPromptToggle.addEventListener('change', function() {
        customMasterPrompt.style.display = this.checked ? 'block' : 'none';
    });

    processingModeRadios.forEach(radio => {
        radio.addEventListener('change', handleProcessingModeChange);
    });

    exportMasterPromptButton.addEventListener('click', () => {
        const data = {
            marketplace: document.getElementById('marketplace').value,
            mediaType: document.getElementById('mediaType').value,
            useCustomMasterPrompt: document.getElementById('customPromptToggle').checked,
            customMasterPrompt: document.getElementById('customMasterPrompt').value,
            graphicsPrompts: document.getElementById('graphicsPrompts').value,
            graphicsPromptsFilePath: document.getElementById('graphicsPromptsFile').files[0]?.path,
            graphicsPromptsCsvFilePath: document.getElementById('graphicsPromptsCsvFile').files[0]?.path,
        };
        window.electronAPI.exportMasterPrompt(data);
    });

    metadataForm.addEventListener('submit', (event) => {
        event.preventDefault();
        mainSubmitButton.disabled = true;
        statusMessage.className = 'alert alert-info';
        statusMessage.innerText = 'Processing request... This may take a moment.';
        statusMessage.style.display = 'block';
        
        // Show progress bar
        progressBarContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressBar.setAttribute('aria-valuenow', 0);
        progressText.innerText = '0%';

        const formData = {
            processingMode: document.querySelector('input[name="processingMode"]:checked').value,
            marketplace: document.getElementById('marketplace').value,
            mediaType: document.getElementById('mediaType').value,
            targetFileFormat: document.getElementById('targetFileFormat').value,
            geminiApiKey: document.getElementById('geminiApiKey').value,
            geminiModel: document.getElementById('geminiModel').value,
            graphicsPrompts: document.getElementById('graphicsPrompts').value,
            useCustomMasterPrompt: document.getElementById('customPromptToggle').checked,
            customMasterPrompt: document.getElementById('customMasterPrompt').value,
            sourceFilesPath: document.getElementById('sourceFiles').files[0]?.path,
            graphicsPromptsFilePath: document.getElementById('graphicsPromptsFile').files[0]?.path,
            graphicsPromptsCsvFilePath: document.getElementById('graphicsPromptsCsvFile').files[0]?.path,
            existingMetadataCsvPath: document.getElementById('existingMetadataCsv').files[0]?.path,
            pasteExistingMetadata: document.getElementById('pasteExistingMetadata').value
        };
        window.electronAPI.submitForm(formData);
    });

    convertTxtToCsvButton.addEventListener('click', () => {
        const file = convertTxtInput.files[0];
        if (!file) {
            convertTxtStatusMessage.innerText = 'Please select a .txt file first.';
            convertTxtStatusMessage.className = 'alert alert-warning';
            convertTxtStatusMessage.style.display = 'block';
            return;
        }
        convertTxtStatusMessage.innerText = 'Converting...';
        convertTxtStatusMessage.className = 'alert alert-info';
        convertTxtStatusMessage.style.display = 'block';
        window.electronAPI.convertTxtToCsv(file.path);
    });

    // --- IPC LISTENERS ---
    window.electronAPI.onUpdate((message) => {
        statusMessage.innerText = message;
        
        // Update progress bar based on status messages (estimated progress)
        let progress = 0;
        if (message.includes('Processing started')) {
            progress = 5;
        } else if (message.includes('Created temporary directory')) {
            progress = 10;
        } else if (message.includes('extracted source files')) {
            progress = 20;
        } else if (message.includes('Constructing prompts')) {
            progress = 25;
        } else if (message.includes('Calling Gemini AI')) {
            progress = 30;
        } else if (message.includes('Parsing AI response')) {
            progress = 60;
        } else if (message.includes('Processing in Manual Mode')) {
            progress = 30;
        } else if (message.includes('Processing file')) {
            // Extract file number if available (e.g., "Processing file 3 of 10")
            const match = message.match(/Processing file (\d+) of (\d+)/);
            if (match) {
                const current = parseInt(match[1]);
                const total = parseInt(match[2]);
                progress = 60 + Math.floor((current / total) * 30); // 60-90%
            } else {
                progress = 70;
            }
        } else if (message.includes('Creating final zip')) {
            progress = 95;
        } else if (message.includes('Success') || message.includes('saved')) {
            progress = 100;
        }

        if (progress > 0) {
            progressBar.style.width = `${progress}%`;
            progressBar.setAttribute('aria-valuenow', progress);
            progressText.innerText = `${progress}%`;
        }
        
        if (message.toLowerCase().includes('error') || message.toLowerCase().includes('failed')) {
            statusMessage.className = 'alert alert-danger';
            mainSubmitButton.disabled = false;
            progressBarContainer.style.display = 'none';
        } else if (message.toLowerCase().includes('success') || message.toLowerCase().includes('saved')) {
            statusMessage.className = 'alert alert-success';
            mainSubmitButton.disabled = false;
            // Keep progress bar visible at 100% for a moment
            setTimeout(() => {
                progressBarContainer.style.display = 'none';
            }, 2000);
        } else {
            statusMessage.className = 'alert alert-info';
        }
    });

    window.electronAPI.onConvertTxtToCsvReply((result) => {
        if (result.success) {
            convertTxtStatusMessage.innerText = `Success! CSV saved to: ${result.filePath}`;
            convertTxtStatusMessage.className = 'alert alert-success';
        } else {
            convertTxtStatusMessage.innerText = `Error: ${result.error}`;
            convertTxtStatusMessage.className = 'alert alert-danger';
        }
    });

    window.electronAPI.onExportMasterPromptReply((result) => {
        if (result.success) {
            exportPacketContent.textContent = result.prompt;
            exportPacketContainer.style.display = 'block';
            statusMessage.style.display = 'none';
        } else {
            statusMessage.innerText = `Error exporting prompt: ${result.error}`;
            statusMessage.className = 'alert alert-danger';
            statusMessage.style.display = 'block';
            exportPacketContainer.style.display = 'none';
        }
    });

    // --- COPY AND DOWNLOAD PACKET BUTTONS ---
    const copyExportPacketButton = document.getElementById('copyExportPacketButton');
    const downloadExportPacketButton = document.getElementById('downloadExportPacketButton');

    if (copyExportPacketButton) {
        copyExportPacketButton.addEventListener('click', () => {
            const text = exportPacketContent.textContent;
            navigator.clipboard.writeText(text).then(() => {
                const originalText = copyExportPacketButton.textContent;
                copyExportPacketButton.textContent = 'Copied!';
                setTimeout(() => {
                    copyExportPacketButton.textContent = originalText;
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
                alert('Failed to copy to clipboard.');
            });
        });
    }

    if (downloadExportPacketButton) {
        downloadExportPacketButton.addEventListener('click', () => {
            const text = exportPacketContent.textContent;
            const marketplaceName = document.getElementById('marketplace').value.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
            const filename = `master_prompt_packet_${marketplaceName}.txt`;
            
            const blob = new Blob([text], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }

    // --- INITIALIZATION ---
    updateStyleDescription();
    handleProcessingModeChange();
    updatePromptInputs(); // Initial call to set the correct state
    validateForm(); // Initial call to set button state
});
