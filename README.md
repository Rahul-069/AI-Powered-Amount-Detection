# AI-Powered Amount Detection API

An intelligent API that extracts and classifies financial amounts from text and images using Google Cloud Vision OCR and Google's Gemini AI.

## ✨ Features

- **Text Processing**: Extract amounts from plain text bills, receipts, and invoices
- **Image Processing**: OCR-powered extraction from bill/receipt images
- **Intelligent Classification**: Automatically categorizes amounts (total, paid, due, tax, etc.)
- **Multi-Currency Support**: Handles INR, USD, EUR, and other currencies
- **Confidence Scoring**: Returns confidence metrics for each processing step
- **Fallback Mechanisms**: Works even if LLM APIs fail
- **Source Tracking**: Links each extracted amount back to its source text

## 🏗️ Architecture

### Processing Pipeline

```
Input (Text/Image)
    ↓
┌─────────────────────────────────────────┐
│ Step 1: OCR / Text Extraction           │
│ - Google Cloud Vision API (for images)  │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ Step 2: Normalization                   │
│ - Gemini AI for intelligent parsing     │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ Step 3: Classification                  │
│ - Gemini AI context analysis            │
│ - Keyword-based categorization          │
└─────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────┐
│ Step 4: Output Generation               │
│ - Source text mapping                   │
│ - Confidence calculation                │
│ - Structured JSON response              │
└─────────────────────────────────────────┘
```

### Technology Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **OCR**: Google Cloud Vision API
- **AI**: Google Gemini 2.5 Flash
- **File Upload**: Multer
- **Environment**: dotenv

## 🚀 Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- Google Cloud Platform account
- Google AI Studio account (for Gemini API)

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/Rahul-069/AI-Powered-Amount-Detection
cd AI-Powered-Amount-Detection
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up Google Cloud Vision API**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Enable the Cloud Vision API
   - Create a service account
   - Download the JSON credentials file
   - Save the entire JSON content

4. **Get Gemini API Key**
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create or copy your API key

5. **Create `.env` file**
```env
PORT=3000
GEMINI_API_KEY=your_gemini_api_key_here
GOOGLE_VISION_KEY_FILE_JSON={"type":"service_account","project_id":"..."}
```

**Note**: For `GOOGLE_VISION_KEY_FILE_JSON`, paste the entire JSON content from your Google Cloud service account credentials file as a single-line string.

6. **Start the server**
```bash
npm start
```

The API will be available at `http://localhost:3000`

## 📡 API Endpoints

**Note**: All endpoints have been tested using **Postman** for reliability and accuracy.

### 1. Health Check

**GET** `/health`

Check if the API is running.

**Testing in Postman**:
- Method: `GET`
- URL: `https://ai-powered-amount-detection.onrender.com/health`

**Response**:
```json
{
  "status": "ok",
  "message": "AI Amount Detection API is running",
  "timestamp": "2025-09-29T02:04:35.534Z"
}
```

---

### 2. Process Text

**POST** `/process-text`

Extract and classify amounts from text input.

**Testing in Postman**:
- Method: `POST`
- URL: `https://ai-powered-amount-detection.onrender.com/process-text`
- Headers: `Content-Type: application/json`
- Body: Select "raw" → "JSON"

**Request Body**:
```json
{
  "text": "Total: INR 1200 | Paid: 1000 | Due: 200 | Discount: 10%"
}
```

**Response**:
```json
{
  "step1": {
    "raw_tokens": ["INR 1200", "1000", "200", "10"],
    "currency_hint": "INR",
    "confidence": 0.95
  },
  "step2": {
    "normalized_amounts": [1200, 1000, 200],
    "normalization_confidence": 0.85
  },
  "step3": {
    "amounts": [
      {"type": "total_bill", "value": 1200},
      {"type": "paid", "value": 1000},
      {"type": "due", "value": 200}
    ],
    "confidence": 0.88
  },
  "step4": {
    "currency": "INR",
    "amounts": [
      {
        "type": "total_bill",
        "value": 1200,
        "source": "text: 'Total: INR 1200'"
      },
      {
        "type": "paid",
        "value": 1000,
        "source": "text: 'Paid: 1000'"
      },
      {
        "type": "due",
        "value": 200,
        "source": "text: 'Due: 200'"
      }
    ],
    "status": "ok"
  }
}
```

---

### 3. Process Image

**POST** `/process-image`

Extract and classify amounts from image input using OCR.

**Testing in Postman**:
- Method: `POST`
- URL: `https://ai-powered-amount-detection.onrender.com/process-image`
- Body: Select "form-data"
  - Key: `image` (change type to "File")
  - Value: Select your image file

**Request**: `multipart/form-data`
- Field name: `image`
- Field type: File
- Supported formats: JPG, PNG, JPEG
- Max size: 10MB

#### Example 1: Complete Bill

**Input Image:**

<img width="816" height="1056" alt="bill1" src="https://github.com/user-attachments/assets/f75b40fb-0a6d-41ab-893b-10cdad6f574e" />

**Output:**
```json
{
  "step1": {
    "raw_tokens": [
      "555", "595", "599", "9", "555", "505", "500", "0",
      "11", "102", "335", "80", "455", "68", "122", "45",
      "07", "01", "23", "07", "30", "23",
      "$ 1,745.00", "$ 745.00", "$ 1,000.00", "$ 745.00",
      "9", "$ 157.05", "$ 1,902.05"
    ],
    "currency_hint": "$",
    "confidence": 0.95
  },
  "step2": {
    "normalized_amounts": [1745, 745, 1000, 745, 157.05, 1902.05],
    "normalization_confidence": 0.9
  },
  "step3": {
    "amounts": [
      {"type": "amount_due", "value": 1745},
      {"type": "item_amount", "value": 745},
      {"type": "item_amount", "value": 1000},
      {"type": "sub_total", "value": 745},
      {"type": "tax", "value": 157.05},
      {"type": "total", "value": 1902.05}
    ],
    "confidence": 0.9
  },
  "step4": {
    "currency": "$",
    "amounts": [
      {
        "type": "amount_due",
        "value": 1745,
        "source": "text: '12245 07/01/23 07/30/23 $ 1,745.00'"
      },
      {
        "type": "item_amount",
        "value": 745,
        "source": "text: 'Full Check Up Full body check up $ 745.00'"
      },
      {
        "type": "item_amount",
        "value": 1000,
        "source": "text: '$ 1,000.00'"
      },
      {
        "type": "sub_total",
        "value": 745,
        "source": "text: 'NOTES SUB TOTAL $ 745.00'"
      },
      {
        "type": "tax",
        "value": 157.05,
        "source": "text: 'TAX $ 157.05'"
      },
      {
        "type": "total",
        "value": 1902.05,
        "source": "text: 'TOTAL $ 1,902.05'"
      }
    ],
    "status": "ok"
  }
}
```

#### Example 2: Partially Visible Bill

**Input Image:**

<img width="603" height="350" alt="bill9" src="https://github.com/user-attachments/assets/cf83b685-c484-4aac-a4e4-d47a39a692e6" />

**Output:**
```json
{
  "step1": {
    "raw_tokens": [
      "718", "080", "421", "086", "88", "6", "560", "078", "095",
      "910", "279", "67", "100", "007", "19", "09", "201", "6",
      "09", "16", "100", "01", "1", "200", "200", "2", "220",
      "220", "420", "420", "19", "09", "201", "6", "08", "17", "420"
    ],
    "currency_hint": "Rs",
    "confidence": 0.95
  },
  "step2": {
    "normalized_amounts": [200, 200, 220, 220, 420, 420, 420],
    "normalization_confidence": 0.6
  },
  "step3": {
    "amounts": [
      {"type": "consultation_charge", "value": 200},
      {"type": "consultation_amount", "value": 200},
      {"type": "service_charge", "value": 220},
      {"type": "service_amount", "value": 220},
      {"type": "total_billed", "value": 420},
      {"type": "payable", "value": 420},
      {"type": "paid", "value": 420}
    ],
    "confidence": 0.9
  },
  "step4": {
    "currency": "Rs",
    "amounts": [
      {
        "type": "consultation_charge",
        "value": 200,
        "source": "text: '1 Consultation - Dr . Harish Kumar 200 200'"
      },
      {
        "type": "consultation_amount",
        "value": 200,
        "source": "text: '1 Consultation - Dr . Harish Kumar 200 200'"
      },
      {
        "type": "service_charge",
        "value": 220,
        "source": "text: '2 Complete Blood Count 220 220'"
      },
      {
        "type": "service_amount",
        "value": 220,
        "source": "text: '2 Complete Blood Count 220 220'"
      },
      {
        "type": "total_billed",
        "value": 420,
        "source": "text: '19/09/2016 08:17 AM-Received Rs . 420 ( by Cash ) as Payment'"
      },
      {
        "type": "payable",
        "value": 420,
        "source": "text: 'Four Hundred and Twenty Only Total Billed 420'"
      },
      {
        "type": "paid",
        "value": 420,
        "source": "text: 'Payable 420'"
      }
    ],
    "status": "ok"
  }
}
```

#### Example 3: No Amounts Found

**Input Image:**

![bill12](https://github.com/user-attachments/assets/43515c6f-f426-4203-84c9-1b8e08d98c09)

**Output:**
```json
{
  "status": "no_amounts_found",
  "reason": "document contains text but no numbers"
}
```

## 🔧 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port (default: 3000) | No |
| `GEMINI_API_KEY` | Google Gemini API key | Yes |
| `GOOGLE_VISION_KEY_FILE_JSON` | Google Cloud Vision credentials (JSON string) | Yes (for images) |

## 🌐 Deployment on Render

### Step 1: Prepare Your Repository

1. Ensure your code is pushed to GitHub/GitLab/Bitbucket
2. Create a `.gitignore` file:
```
node_modules/
.env
uploads/
*.log
```

### Step 2: Create a Render Account

1. Go to [render.com](https://render.com/)
2. Sign up or log in
3. Connect your GitHub/GitLab account

### Step 3: Create a New Web Service

1. Click "New +" → "Web Service"
2. Connect your repository
3. Configure the service:
   - **Name**: `ai-amount-detection` (or your preferred name)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node main.js`
   - **Instance Type**: Free (or as needed)

### Step 4: Set Environment Variables

In Render dashboard, go to "Environment" tab and add:

```
GEMINI_API_KEY=your_actual_gemini_api_key
GOOGLE_VISION_KEY_FILE_JSON={"type":"service_account","project_id":"...","private_key":"..."}
```

**Important**: Paste your entire Google Cloud JSON credentials as a single-line string for `GOOGLE_VISION_KEY_FILE_JSON`.

### Step 5: Deploy

1. Click "Create Web Service"
2. Render will automatically deploy your app
3. Your API will be live at: `https://ai-powered-amount-detection.onrender.com`

### Step 6: Test Deployment

```bash
curl https://ai-powered-amount-detection.onrender.com/health
```

## 🛠️ Troubleshooting

### Slow Response Times
- First request may be slower (cold start on Render free tier)
- Large images take longer to process

---
