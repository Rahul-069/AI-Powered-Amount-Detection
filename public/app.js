let selectedFile = null;

// Your Render API endpoint
const API_ENDPOINT = 'https://ai-powered-amount-detection.onrender.com/process-image';

// DOM Elements
const uploadBtn = document.getElementById('uploadBtn');
const imageInput = document.getElementById('imageInput');
const previewSection = document.getElementById('previewSection');
const fileInfo = document.getElementById('fileInfo');
const removeBtn = document.getElementById('removeBtn');
const detectBtn = document.getElementById('detectBtn');
const btnText = document.getElementById('btnText');
const loader = document.getElementById('loader');
const resultsSection = document.getElementById('resultsSection');
const resultsContent = document.getElementById('resultsContent');

// Upload button click handler
uploadBtn.addEventListener('click', () => {
    imageInput.click();
});

// File input change handler
imageInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        handleFileSelect(e.target.files[0]);
    }
});

// Handle file selection
function handleFileSelect(file) {
    // Validate file type
    if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
    }
    
    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
        alert('File size must be less than 10MB');
        return;
    }
    
    selectedFile = file;
    
    // Show file name
    fileInfo.textContent = ` ${file.name}`;
    uploadBtn.style.display = 'none';
    previewSection.style.display = 'block';
    detectBtn.disabled = false;
    resultsSection.style.display = 'none';
}

// Remove image handler
removeBtn.addEventListener('click', () => {
    selectedFile = null;
    imageInput.value = '';
    uploadBtn.style.display = 'block';
    previewSection.style.display = 'none';
    detectBtn.disabled = true;
    resultsSection.style.display = 'none';
});

// Detect amounts handler
detectBtn.addEventListener('click', async () => {
    if (!selectedFile) return;
    
    // Show loading state
    detectBtn.disabled = true;
    btnText.textContent = 'Processing...';
    loader.style.display = 'inline-block';
    resultsSection.style.display = 'none';
    
    try {
        // Create form data
        const formData = new FormData();
        formData.append('image', selectedFile);
        
        // Send request to Render API endpoint
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        // Display results
        displayResults(result);
        
    } catch (error) {
        console.error('Error:', error);
        displayError('Failed to process image. Please check your internet connection and try again.');
    } finally {
        // Reset button state
        detectBtn.disabled = false;
        btnText.textContent = 'Detect Amounts';
        loader.style.display = 'none';
    }
});

// Display results
function displayResults(result) {
    resultsSection.style.display = 'block';
    
    if (result.status === 'error' || result.status === 'no_amounts_found') {
        resultsContent.innerHTML = `
            <div class="error-message">
                <strong>No amounts detected</strong>
                ${result.reason || 'Could not extract financial amounts from the image.'}
            </div>
        `;
        return;
    }
    
    // Build results HTML
    let html = '';
    
    // Currency badge
    if (result.step4?.currency) {
        html += `<div class="currency-badge">Currency: ${result.step4.currency}</div>`;
    }
    
    // Confidence information
    if (result.step1?.confidence || result.step2?.normalization_confidence || result.step3?.confidence) {
        html += `
            <div class="confidence-info">
                <strong>📊 Confidence Scores:</strong>
                ${result.step1?.confidence ? `OCR/Text Detection: ${(result.step1.confidence * 100).toFixed(0)}%<br>` : ''}
                ${result.step2?.normalization_confidence ? `Normalization: ${(result.step2.normalization_confidence * 100).toFixed(0)}%<br>` : ''}
                ${result.step3?.confidence ? `Classification: ${(result.step3.confidence * 100).toFixed(0)}%` : ''}
            </div>
        `;
    }
    
    // Amounts
    if (result.step4?.amounts && result.step4.amounts.length > 0) {
        html += '<div class="amounts-grid">';
        result.step4.amounts.forEach(amount => {
            html += `
                <div class="result-card">
                    <div class="amount-type">${formatType(amount.type)}</div>
                    <div class="amount-value">${result.step4.currency} ${amount.value.toFixed(2)}</div>
                    <div class="amount-source">
                        <strong>Source:</strong>
                        ${formatSource(amount.source)}
                    </div>
                </div>
            `;
        });
        html += '</div>';
    } else {
        html += `
            <div class="error-message">
                No amounts were extracted from the image.
            </div>
        `;
    }
    
    resultsContent.innerHTML = html;
    
    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

// Display error
function displayError(message) {
    resultsSection.style.display = 'block';
    resultsContent.innerHTML = `
        <div class="error-message">
            <strong>⚠️ Error</strong>
            ${message}
        </div>
    `;
}

// Format type for display
function formatType(type) {
    return type
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

// Format source text for display
function formatSource(source) {
    if (!source || source === 'source text not found') {
        return 'Source context not available';
    }
    return source;
}