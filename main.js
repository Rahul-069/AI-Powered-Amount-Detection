const express = require('express');
const multer = require('multer');
const vision = require('@google-cloud/vision'); 
const fs = require('fs');
const path = require('path');
require('dotenv').config(); 

const GOOGLE_VISION_KEY_FILE = process.env.GOOGLE_VISION_KEY_FILE; 
const GEMINI_KEY = process.env.GEMINI_API_KEY;

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const upload = multer({ 
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const MODEL_NAME = "gemini-2.5-flash-preview-05-20";
const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const apiKey = GEMINI_KEY;

async function exponentialBackoffFetch(url, options, maxRetries = 3, delay = 1000) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const response = await fetch(url, options);
            if (response.ok) {
                return response.json();
            }

            const errorBody = await response.text();
            
            if (attempt === maxRetries - 1) {
                throw new Error(`API call failed after ${maxRetries} attempts. Status: ${response.status}`);
            }

        } catch (error) {
            if (attempt === maxRetries - 1) {
                throw error;
            }
        }
        const waitTime = delay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, waitTime));
    }
}

function calculateTextConfidence(raw_text, raw_tokens) {
    if (!raw_text || raw_text.trim().length === 0) return 0.1;
    if (!raw_tokens || raw_tokens.length === 0) return 0.15;
    
    let confidence = 0.4; 
    
    const lines = raw_text.split('\n').filter(line => line.trim().length > 0);
    const words = raw_text.split(/\s+/).filter(word => word.trim().length > 0);
    
    const totalWords = words.length;
    const avgWordsPerLine = totalWords / Math.max(lines.length, 1);
    
    if (avgWordsPerLine >= 2 && avgWordsPerLine <= 15) {
        confidence += 0.15;
    } else if (avgWordsPerLine < 1) {
        confidence -= 0.1;
    }
    
    confidence += 0.2; 
    
    const validNumericPatterns = raw_tokens.filter(token => {
        const cleaned = token.replace(/[^\d.,]/g, '');
        return /^\d{1,3}(,\d{3})*(\.\d{2})?$|^\d+(\.\d{1,2})?$/.test(cleaned);
    });
    
    const validRatio = validNumericPatterns.length / raw_tokens.length;
    confidence += validRatio * 0.2;
    
    const reasonableNumbers = raw_tokens.filter(token => {
        const num = parseFloat(token.replace(/[^\d.]/g, ''));
        return !isNaN(num) && num >= 0.01 && num <= 100000;
    });
    
    if (reasonableNumbers.length > 0) {
        confidence += 0.1;
    }
    
    const documentKeywords = [
        'total', 'amount', 'bill', 'receipt', 'invoice', 'paid', 'due', 
        'tax', 'subtotal', 'discount', 'fee', 'charge', 'balance', 'prescription', 'consultation', 'treatment'
    ];
    
    const foundKeywords = documentKeywords.filter(keyword => 
        raw_text.toLowerCase().includes(keyword)
    ).length;
    
    if (foundKeywords >= 2) {
        confidence += 0.15;
    } else if (foundKeywords === 1) {
        confidence += 0.05;
    }
    
    const totalChars = raw_text.length;
    
    if (totalChars < 20) {
        confidence -= 0.2;
    } else if (totalChars >= 50 && totalChars <= 2000) {
        confidence += 0.1;
    }
    
    const linesWithNumbers = lines.filter(line => /\d/.test(line)).length;
    const numberLineRatio = linesWithNumbers / Math.max(lines.length, 1);
    
    if (numberLineRatio >= 0.3) {
        confidence += 0.1;
    }
    
    const specialChars = (raw_text.match(/[^a-zA-Z0-9\s.,\-:()]/g) || []).length;
    const specialRatio = specialChars / Math.max(totalChars, 1);
    
    if (specialRatio > 0.3) {
        confidence -= 0.1; 
    }
    
    return Math.max(0.2, Math.min(0.95, confidence));
}

function calculateOCRConfidence(detections, raw_tokens) {
    if (!detections || detections.length <= 1) return 0.1;
    
    const fullText = detections[0]?.description || '';
    const words = detections.slice(1);
    
    let confidence = 0.3;
    
    const lines = fullText.split('\n').filter(line => line.trim().length > 0);
    const totalWords = words.length;
    const avgWordsPerLine = totalWords / Math.max(lines.length, 1);
    
    if (avgWordsPerLine >= 2 && avgWordsPerLine <= 15) {
        confidence += 0.15;
    } else if (avgWordsPerLine < 1) {
        confidence -= 0.2;
    }
    
    if (raw_tokens && raw_tokens.length > 0) {
        confidence += 0.2;
        
        const validNumericPatterns = raw_tokens.filter(token => {
            const cleaned = token.replace(/[^\d.,]/g, '');
            return /^\d{1,3}(,\d{3})*(\.\d{2})?$|^\d+(\.\d{1,2})?$/.test(cleaned);
        });
        
        const validRatio = validNumericPatterns.length / raw_tokens.length;
        confidence += validRatio * 0.2;
        
        const reasonableNumbers = raw_tokens.filter(token => {
            const num = parseFloat(token.replace(/[^\d.]/g, ''));
            return !isNaN(num) && num >= 0.01 && num <= 100000;
        });
        
        if (reasonableNumbers.length > 0) {
            confidence += 0.1;
        }
    } else {
        confidence -= 0.3;
    }
    
    return Math.max(0.05, Math.min(0.98, confidence));
}

function calculateNormalizationConfidence(raw_tokens, normalized_amounts, llm_success) {
    if (!raw_tokens || !normalized_amounts) return 0.1;
    
    let confidence = 0.3;
    
    if (llm_success) {
        confidence += 0.4;
    }
    
    const tokenRatio = normalized_amounts.length / raw_tokens.length;
    if (tokenRatio >= 0.5 && tokenRatio <= 1.0) {
        confidence += 0.2;
    } else if (tokenRatio < 0.2) {
        confidence -= 0.2;
    }
    
    const validNumbers = normalized_amounts.filter(num => 
        !isNaN(num) && num > 0 && num < 1000000 && Number.isFinite(num)
    );
    const validRatio = validNumbers.length / normalized_amounts.length;
    confidence += validRatio * 0.2;
    
    const uniqueValues = new Set(normalized_amounts);
    if (uniqueValues.size < normalized_amounts.length * 0.8) {
        confidence -= 0.1;
    }
    
    return Math.max(0.1, Math.min(0.95, confidence));
}

function calculateClassificationConfidence(amounts, raw_text, llm_success) {
    if (!amounts || amounts.length === 0) return 0.1;
    
    let confidence = 0.2;
    
    if (llm_success) {
        confidence += 0.3;
    }
    
    const medicalKeywords = [
        'bill', 'total', 'amount', 'paid', 'due', 'tax', 'fee', 'charge', 'prescription', 'consultation', 'treatment',
        'hospital', 'clinic', 'medical', 'doctor', 'patient', 'invoice'
    ];
    
    const text = raw_text.toLowerCase();
    const keywordMatches = medicalKeywords.filter(keyword => text.includes(keyword));
    confidence += Math.min(0.3, keywordMatches.length * 0.05);
    
    const classificationTypes = amounts.map(a => a.type);
    const uniqueTypes = new Set(classificationTypes);
    
    if (uniqueTypes.size > 1 && uniqueTypes.size <= amounts.length * 0.8) {
        confidence += 0.15;
    }
    
    const unclassifiedCount = classificationTypes.filter(type => 
        type === 'unclassified' || type === 'unknown'
    ).length;
    const unclassifiedRatio = unclassifiedCount / amounts.length;
    confidence -= unclassifiedRatio * 0.2;
    
    const commonTypes = ['total', 'paid', 'due', 'tax', 'fee', 'copay'];
    const hasCommonTypes = classificationTypes.some(type => 
        commonTypes.some(common => type.toLowerCase().includes(common))
    );
    if (hasCommonTypes) {
        confidence += 0.1;
    }
    
    return Math.max(0.1, Math.min(0.95, confidence));
}

async function step1_process_input(input_data, input_type = 'text') {
    console.log(`**Step 1 - ${input_type.toUpperCase()} Processing**`);
    
    let raw_text = '';
    let confidence = 0;
    let detections = null;
    
    if (input_type === 'image') {
        try {
            const client = new vision.ImageAnnotatorClient({credentials: JSON.parse(process.env.GOOGLE_VISION_KEY_FILE_JSON)});
            const [result] = await client.textDetection(input_data);
            detections = result.textAnnotations;

            if (!detections || detections.length <= 1) {
                return {
                    status: "no_amounts_found",
                    reason: "No structured text detected by Google Cloud Vision"
                };
            }

            const words = detections.slice(1);
            const lines = groupWordsIntoLines(words);
            raw_text = lines.map(line => line.text).join('\n') || '';

        } catch (error) {
            return {
                status: "error",
                reason: `Google Cloud Vision failed: ${error.message}`
            };
        }
    } else {
        raw_text = input_data.trim();
        if (!raw_text) {
            return {
                status: "no_amounts_found",
                reason: "Empty text provided"
            };
        }
    }

    console.log("Input text:");
    console.log(raw_text);

    const currency_hint = raw_text.match(/(\bINR\b|\bRs\.?\b|\$|\€|\₹)/i)?.[0] || null;
    const raw_tokens = (raw_text.match(/(?:[$\€₹]|INR|Rs\.?)?\s*(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?|\d+(?:[.,]\d+)?)/g) || [])
        .map(token => token.trim());

    if (raw_tokens.length === 0) {
        return {
            status: "no_amounts_found",
            reason: "document contains text but no numbers"
        };
    }

    if (input_type === 'image') {
        confidence = calculateOCRConfidence(detections, raw_tokens);
    } else {
        confidence = calculateTextConfidence(raw_text, raw_tokens);
    }

    return {
        raw_text,
        raw_tokens,
        currency_hint,
        confidence: Math.round(confidence * 100) / 100,
        status: "ok",
        detections
    };
}

function groupWordsIntoLines(words) {
    if (!words || words.length === 0) return [];

    words.sort((a, b) => {
        const a_y = a.boundingPoly.vertices[0].y;
        const b_y = b.boundingPoly.vertices[0].y;
        const a_x = a.boundingPoly.vertices[0].x;
        const b_x = b.boundingPoly.vertices[0].x;

        if (Math.abs(a_y - b_y) < 10) {
            return a_x - b_x;
        }
        return a_y - b_y;
    });

    const lines = [];
    let currentLine = [];
    let currentY = words[0].boundingPoly.vertices[0].y;

    for (const word of words) {
        if (!word.description) continue;
        const wordY = word.boundingPoly.vertices[0].y;
        if (Math.abs(wordY - currentY) > 10) {
            lines.push({ text: currentLine.map(w => w.description).join(' ') });
            currentLine = [word];
            currentY = wordY;
        } else {
            currentLine.push(word);
        }
    }
    lines.push({ text: currentLine.map(w => w.description).join(' ') });

    return lines;
}

function cleanAndNormalize(token) {
    let cleanToken = token.trim();
    cleanToken = cleanToken.replace(/,/g, '');
    cleanToken = cleanToken.replace(/[^0-9.]/g, '');
    return parseFloat(cleanToken);
}

async function step2_normalization_llm(input_result) {
    console.log("**Step 2 - Normalization**");
    
    const userQuery = `Original Text: "${input_result.raw_text}". Raw Tokens: ${JSON.stringify(input_result.raw_tokens)}. Please normalize the tokens, correcting errors and treating commas as grouping separators. Remove all commas to form the intended numerical values (e.g., '175,00' -> 17500). Filter out percentages, quantities, and non-financial values.`;

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: {
            parts: [{ text: "You are an expert financial data normalizer. Extract valid financial amounts from raw tokens. Correct OCR errors, treat commas as grouping separators, and output precise numerical values." }]
        },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "ARRAY",
                items: { type: "NUMBER" },
                description: "A list of normalized financial amounts as numbers."
            }
        }
    };

    let llm_success = false;
    let normalizedAmounts = [];

    try {
        const url = `${API_BASE_URL}/${MODEL_NAME}:generateContent?key=${apiKey}`;
        const result = await exponentialBackoffFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const jsonString = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!jsonString) throw new Error("LLM returned no structured data for normalization.");

        normalizedAmounts = JSON.parse(jsonString);
        llm_success = true;

    } catch (error) {
        console.log(`LLM normalization failed: ${error.message}, using fallback`);
        normalizedAmounts = input_result.raw_tokens.map(cleanAndNormalize).filter(n => !isNaN(n));
    }

    const normalization_confidence = calculateNormalizationConfidence(
        input_result.raw_tokens, 
        normalizedAmounts, 
        llm_success
    );

    return {
        normalized_amounts: normalizedAmounts,
        normalization_confidence: Math.round(normalization_confidence * 100) / 100
    };
}

async function step3_classification_llm(input_result, normalization_result) {
    console.log("**Step 3 - Classification**");
    
    const normalizedList = JSON.stringify(normalization_result.normalized_amounts);
    const userQuery = `Original Text: "${input_result.raw_text}". Normalized Amounts: ${normalizedList}. Classify each amount based on surrounding context (e.g., 'total_bill', 'paid', 'due', 'tax', 'insurance_copay').`;

    const payload = {
        contents: [{ parts: [{ text: userQuery }] }],
        systemInstruction: {
            parts: [{ text: "You are an expert financial document classifier. Determine the context for each amount based on surrounding text (e.g., 'total_bill', 'paid', 'due', 'tax', 'insurance_copay'). Output JSON array with 'type' and 'value' keys." }]
        },
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "ARRAY",
                items: {
                    type: "OBJECT",
                    properties: {
                        "type": { type: "STRING", description: "The context/label of the amount." },
                        "value": { type: "NUMBER", description: "The numerical value." }
                    },
                    propertyOrdering: ["type", "value"]
                }
            }
        }
    };

    let llm_success = false;
    let classifiedAmounts = [];

    try {
        const url = `${API_BASE_URL}/${MODEL_NAME}:generateContent?key=${apiKey}`;
        const result = await exponentialBackoffFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const jsonString = result.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!jsonString) throw new Error("LLM returned no structured data for classification.");

        classifiedAmounts = JSON.parse(jsonString);
        llm_success = true;

    } catch (error) {
        console.log(`LLM classification failed: ${error.message}, using fallback`);
        classifiedAmounts = normalization_result.normalized_amounts.map(v => ({ type: 'unclassified', value: v }));
    }

    const confidence = calculateClassificationConfidence(
        classifiedAmounts, 
        input_result.raw_text, 
        llm_success
    );

    return {
        amounts: classifiedAmounts,
        confidence: Math.round(confidence * 100) / 100
    };
}

function findSourceTextForStructuredInput(rawValue, rawText) {
    const separators = [/\s*\|\s*/, /\s*,\s*(?=[A-Za-z])/, /\s*;\s*/, /\n/];
    
    for (const separator of separators) {
        const segments = rawText.split(separator).map(s => s.trim()).filter(s => s.length > 0);
        
        if (segments.length > 1) {
            for (const segment of segments) {
                const numbers = segment.match(/\d+(?:[.,]\d+)?/g);
                if (numbers) {
                    for (const numStr of numbers) {
                        const cleanedNum = parseFloat(numStr.replace(/,/g, ''));
                        if (Math.abs(cleanedNum - rawValue) < 0.01) {
                            return segment;
                        }
                    }
                }
            }
        }
    }
    
    return null;
}

function findSourceText(rawValue, rawText, usedSources = new Set()) {
    const numericValue = parseFloat(rawValue);
    
    const lines = rawText.split('\n')
        .map((line, index) => ({ text: line.trim(), originalIndex: index }))
        .filter(item => item.text.length > 0)
        .sort((a, b) => b.text.length - a.text.length);

    for (const { text, originalIndex } of lines) {
        const potentialNumbers = text.matchAll(/[\d,.]+/g);
        
        for (const match of potentialNumbers) {
            const numString = match[0];
            const startIndex = match.index;
            const lineKey = `${originalIndex}-${startIndex}`;
            
            if (usedSources.has(lineKey)) {
                continue;
            }
            
            const cleanedNum = parseFloat(numString.replace(/,/g, ''));
            
            if (Math.abs(cleanedNum - numericValue) < 0.01) {
                usedSources.add(lineKey);
                return text.replace(/\s+/g, ' ');
            }
        }
    }
    return null;
}

function step4_final_output(input_result, normalization_result, classified_result) {
    console.log("**Step 4 - Final Output**");
    
    const usedSources = new Set();
    
    const finalAmounts = classified_result.amounts.map(item => {
        let source_text = null;
        
        if (!input_result.detections) { 
            source_text = findSourceTextForStructuredInput(item.value, input_result.raw_text);
        }
        
        if (!source_text) {
            source_text = findSourceText(item.value, input_result.raw_text, usedSources);
        }
        
        return {
            type: item.type,
            value: item.value,
            source: source_text ? `text: '${source_text}'` : "source text not found"
        };
    });
    
    return {
        currency: input_result.currency_hint || "UNKNOWN",
        amounts: finalAmounts,
        status: "ok"
    };
}

async function processText(text) {
    const input_result = await step1_process_input(text, 'text');
    if (input_result.status !== 'ok') {
        return input_result;
    }

    const normalization_result = await step2_normalization_llm(input_result);
    const classified_result = await step3_classification_llm(input_result, normalization_result);
    const final_result = step4_final_output(input_result, normalization_result, classified_result);

    return {
        step1: {
            raw_tokens: input_result.raw_tokens,
            currency_hint: input_result.currency_hint,
            confidence: input_result.confidence
        },
        step2: {
            normalized_amounts: normalization_result.normalized_amounts,
            normalization_confidence: normalization_result.normalization_confidence
        },
        step3: {
            amounts: classified_result.amounts,
            confidence: classified_result.confidence
        },
        step4: final_result
    };
}

async function processImage(imagePath) {
    const input_result = await step1_process_input(imagePath, 'image');
    if (input_result.status !== 'ok') {
        return input_result;
    }

    const normalization_result = await step2_normalization_llm(input_result);
    const classified_result = await step3_classification_llm(input_result, normalization_result);
    const final_result = step4_final_output(input_result, normalization_result, classified_result);

    return {
        step1: {
            raw_tokens: input_result.raw_tokens,
            currency_hint: input_result.currency_hint,
            confidence: input_result.confidence
        },
        step2: {
            normalized_amounts: normalization_result.normalized_amounts,
            normalization_confidence: normalization_result.normalization_confidence
        },
        step3: {
            amounts: classified_result.amounts,
            confidence: classified_result.confidence
        },
        step4: final_result
    };
}

app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        message: 'AI Amount Detection API is running',
        timestamp: new Date().toISOString()
    });
});

app.post('/process-text', async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text || typeof text !== 'string') {
            return res.status(400).json({
                status: 'error',
                reason: 'Text field is required and must be a string'
            });
        }
        
        const result = await processText(text);
        res.json(result);
        
    } catch (error) {
        console.error('Text processing error:', error);
        res.status(500).json({
            status: 'error',
            reason: `Processing failed: ${error.message}`
        });
    }
});

app.post('/process-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                status: 'error',
                reason: 'Image file is required'
            });
        }
        
        const result = await processImage(req.file.path);
        
        try {
            fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
            console.warn('Failed to cleanup uploaded file:', cleanupError.message);
        }
        
        res.json(result);
        
    } catch (error) {
        console.error('Image processing error:', error);
        res.status(500).json({
            status: 'error',
            reason: `Processing failed: ${error.message}`
        });
    }
});

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

app.listen(PORT, () => {
    console.log(`AI Amount Detection API server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`Text processing: POST http://localhost:${PORT}/process-text`);
    console.log(`Image processing: POST http://localhost:${PORT}/process-image`);
});

module.exports = app;




