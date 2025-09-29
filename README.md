# AI-Powered Amount Detection API

An intelligent API that extracts and classifies financial amounts from text and images using Google Cloud Vision OCR and Google's Gemini AI.

## 🌐 Live Demo

**Base URL**: `https://ai-powered-amount-detection.onrender.com`

## ✨ Features

- **Text Processing**: Extract amounts from plain text bills, receipts, and invoices
- **Image Processing**: OCR-powered extraction from bill/receipt images
- **Intelligent Classification**: Automatically categorizes amounts (total, paid, due, tax, etc.)
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

6. **Start the server**
```bash
npm start
```

The API will be available at `http://localhost:3000`

## 📡 API Endpoints

### 1. Health Check

**GET** `/health`

Check if the API is running.

**Response**:
```json
{
    "status": "ok",
    "message": "AI Amount Detection API is running",
    "timestamp": "2025-09-29T02:04:35.534Z"
}
```

### 2. Process Text

**POST** `/process-text`

Extract and classify amounts from text input.

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
        "raw_tokens": [
            "INR 120",
            "0",
            "100",
            "0",
            "200",
            "10"
        ],
        "currency_hint": "INR",
        "confidence": 0.95
    },
    "step2": {
        "normalized_amounts": [
            120,
            0,
            100,
            0,
            200,
            10
        ],
        "normalization_confidence": 0.63
    },
    "step3": {
        "amounts": [
            {
                "type": "total_bill",
                "value": 1200
            },
            {
                "type": "paid",
                "value": 1000
            },
            {
                "type": "due",
                "value": 200
            },
            {
                "type": "discount_percentage",
                "value": 10
            }
        ],
        "confidence": 0.75
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
            },
            {
                "type": "discount_percentage",
                "value": 10,
                "source": "text: 'Discount: 10%'"
            }
        ],
        "status": "ok"
    }
}
```

### 3. Process Image

**POST** `/process-image`

Extract and classify amounts from image input.

**Request**: `multipart/form-data`
- Field name: `image`
- Field type: File

**Response**: Same structure as `/process-text`

## 💡 Usage Examples

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
   - **Start Command**: `node main.js` (or `npm start`)
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
3. Your API will be live at: `https://your-app-name.onrender.com`

---

**Note**: Replace `your-app-name.onrender.com` with your actual Render deployment URL throughout your documentation and code.
