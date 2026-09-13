# 📄 Smart Document Builder (Document Inspector)

> **Transforming messy, semi-structured documents into clean, structured, and queryable data.**

[![Next.js](https://img.shields.io/badge/Next.js-16.3.5-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.8-61DAFB?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Vitest-18%20suites%20passing-brightgreen?style=flat&logo=vitest)](https://vitest.dev/)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Client--Side-green?style=flat)](#100-local-privacy--zero-data-leakage)

---

## 🎯 Problem Statement

### **1. Turn messy documents into structured, queryable data**

> *Build a system that takes unstructured or semi-structured documents and converts them into clean, structured data that can be searched and queried.*

Real-world documents—invoices, bank statements, receipts, resumes, medical records, identity cards, and scanned forms—arrive in erratic formats with multi-column layouts, table grids, OCR noise, faux-bolding layer stutters, and inconsistent headers. 

**Smart Document Builder** is a **local-first, privacy-preserving intelligent document processing (IDP) platform** that ingests messy files, reconstructs visual layout hierarchies, applies hybrid semantic extraction (local deterministic NER + schema binding + optional Gemini 3.6 Flash AI assist), and provides an interactive document inspector with visual proof-of-extraction overlays, full-text search, and multi-format exports (**JSON**, **CSV**, **Excel .xlsx**).

---

## 🏗️ System Architecture

```
                                  ┌───────────────────────────┐
                                  │   Unstructured Document   │
                                  │  PDF, Word, Scans, Images │
                                  └─────────────┬─────────────┘
                                                │
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. INGESTION & NORMALIZATION LAYER                                                            │
│   • Magic-byte file sniffing (sniffFile.ts)                                                   │
│   • SHA-256 cryptographic deduplication (hashFile.ts)                                        │
│   • PDF text stream extraction (pdf.js) with font matrices & coordinates                      │
│   • Automatic OCR Web Worker fallback (Tesseract.js) for image/scanned pages                  │
│   • Word OpenXML decompression & document.xml text extraction (JSZip)                         │
└───────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                │
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. SPATIAL LAYOUT & BLOCK TREE RECONSTRUCTION                                                 │
│   • Reading-order sorting (top-to-bottom, multi-column left-to-right)                         │
│   • Spatial clustering into ReconstructedBlock[] (headings, paragraphs, key-value, tables)    │
│   • Coordinate preservation: exact bounding boxes (x, y, width, height, page)                 │
│   • Compressed tagged outline synthesis: [H1], [H2], [P], [KV], [Table]                       │
└───────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                │
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│ 3. HYBRID EXTRACTION & NORMALIZATION ENGINE                                                   │
│   • Fast Rule & Pattern Recognizers (email, phone, currency, dates, URLs, IDs, locations)     │
│   • Compromise NLP Named Entity Recognition (persons, organizations, places)                  │
│   • Schema Classification (Invoice, Resume, Receipt, ID, Tax/Financial, Medical, Generic)     │
│   • Provenance Tracking: schema-bound vs explicit-inline vs inferred proximity labels        │
│   • Proximity Anti-Stampede Guard: consumedBlockProximityCues prevents label duplication      │
│   • Field Quality Linter: catches generic masquerades, denylist nouns, & slug collisions      │
│   • Optional AI Cloud Assist: Gemini 3.6 Flash / Gemini Vision structured prompt extraction   │
└───────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                │
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│ 4. RESILIENT CLIENT-SIDE STORAGE & MEMORY MANAGEMENT                                          │
│   • IndexedDB (idb) with 4 atomic object stores: documents, files, fields, auditEvents        │
│   • Safe Blob normalization: file.blob.slice(...) eliminates WebKit/Safari handle detachment  │
│   • Atomic Multi-Store Transactions: zero orphaned records on delete or rollback              │
│   • Self-Healing Connection: auto-resets on rejection, handles multi-tab blocked events       │
│   • Sequential Ingestion Queue: prevents WebWorker OOM, canvas memory leaks, & DB collisions  │
│   • Storage Quota Manager: navigator.storage.persist() & live usage metering (storageQuota.ts)│
└───────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                │
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│ 5. QUERY, INSPECTOR & EXPORT LAYER                                                            │
│   • Visual Proof-of-Extraction: interactive canvas bounding box overlays mapped to fields     │
│   • Live Inline Field Editor: edit values, change keys, toggle flags with audit history trail │
│   • MiniSearch In-Browser Query Engine: sub-millisecond search across documents, fields, notes│
│   • Quality Dashboard: radial confidence progress ring, legibility metrics, rule audit trails │
│   • Multi-Format Exporters: Papersnap JSON (.json), Tabular CSV (.csv), Excel (.xlsx)         │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## ⚡ Key Architectural Highlights

### 1. 100% Local Privacy & Zero Data Leakage
- By default, documents **never leave the user's browser**.
- Parsing, spatial layout extraction, OCR (Tesseract.js Web Workers), and storage (IndexedDB) run purely on the client side.
- Optional **AI Cloud Assist** (powered by Google Gemini 3.6 Flash) can be explicitly triggered by the user via the "Enhance with AI" toggle, sending only anonymized structured layout outlines.

### 2. Multi-Format Ingestion with Automatic Fallback
- **Digital PDFs**: Extracts vector text with precise font metrics and $(x, y, w, h)$ bounding boxes using `pdfjs-dist`.
- **Scanned Documents & Images**: Detects image-only or low-text pages and routes them to a dedicated background Web Worker running `tesseract.js` OCR with contrast enhancement.
- **Word Documents (`.docx`, `.doc`)**: Decompresses OpenXML packages using `JSZip`, parsing `word/document.xml` into structured paragraph and table blocks.
- **Plain Text / CSV**: Native utf-8 parsing with column alignment detection.

### 3. Spatial Layout & Block Tree Reconstruction
Messy raw text streams are clustered into a structural hierarchy ([Block](file:///Users/vikashpathak/Documents/ZAMP%20Project/SmartDocumentBuilder/src/lib/types.ts)):
- **Headings (`H1`, `H2`)**: Identified by font weight, font size, and spatial isolation.
- **Key-Value Pairs (`keyValue`)**: Recognizes inline labels (`Total due: $1,400.00`) and tabular line pairs.
- **Paragraphs & List Items**: Reassembles wrapped lines and bullet markers into cohesive blocks.
- **Tables (`table`)**: Detects multi-column tabular lines and aligns cell grids.

### 4. Robust Field Extraction & Anti-Stampede Heuristics
- **Provenance Tracking** (`LabelProvenance: "schema" | "explicit" | "inferred"`): Distinguishes high-confidence schema keys from inline delimiters and loose proximity cues.
- **Proximity Anti-Stampede Guard**: When a keyword (e.g. `"Frontend"`) appears in a block, our `consumedBlockProximityCues` mechanism ensures subsequent fields fall back cleanly to their respective type label instead of generating sequential duplicates (`Frontend (2)`, `Frontend (3)`, ..., `Frontend (6)`).
- **Field Quality Linter** ([fieldQualityLint.ts](file:///Users/vikashpathak/Documents/ZAMP%20Project/SmartDocumentBuilder/src/lib/pipeline/extraction/fieldQualityLint.ts)): Detects and penalizes generic labels, denylisted nouns (`field`, `item`, `data`), and heading masquerades.

### 5. Resilient Browser Storage (IndexedDB)
- **Safe Blob Serialization**: Slices incoming files (`file.blob.slice(...)`) to prevent WebKit/Safari temporary file handle detachment crashes (`DataCloneError`).
- **Sequential Ingestion Queue**: Processes multi-file batches sequentially to keep tab memory flat (<150MB) and prevent IndexedDB write transaction collisions.
- **Atomic Multi-Store Rollback**: If an upload fails, partial records are rolled back immediately, eliminating dead `"queued"` zombie documents.
- **Quota Management**: Proactively calls `navigator.storage.persist()`, monitors disk usage with `navigator.storage.estimate()`, and provides one-click orphaned storage cleanup (`purgeOrphanedStorage()`).

### 6. Interactive Inspector & Multi-Format Exporters
- **Visual Proof-of-Extraction**: Hovering or clicking any extracted field instantly illuminates its exact physical bounding box on the document canvas.
- **Quality Dashboard**: Displays legibility scores, extraction confidence percentages via SVG radial progress indicators, and automated validation checks.
- **Multi-Format Exports**:
  - **JSON (`.json`)**: Papersnap-compliant standardized structured JSON.
  - **CSV (`.csv`)**: RFC 4180 compliant tabular export with UTF-8 BOM (`\uFEFF`) for Excel compatibility.
  - **Excel (`.xlsx`)**: Native OpenXML multi-sheet workbook generation generated completely client-side without heavy external dependencies.

---

## 📋 Document Schemas Supported

The system includes pre-configured schema detectors with automatic document classification:

| Schema Type | Description | Key Extracted Fields |
| :--- | :--- | :--- |
| **Invoice** | Billing invoices & accounts payable | Invoice Number, Vendor Name, Total Due, Due Date, Tax, Line Items |
| **Resume / CV** | Professional resumes & CVs | Candidate Name, Job Title, Email, Phone, LinkedIn, Skills, Experience |
| **Receipt** | Point-of-sale retail receipts | Merchant Name, Total Amount, Date, Tax, Payment Method |
| **Identity Document** | Passports, Aadhaar cards, Driver's Licenses | Full Name, Document/ID Number, DOB, Issue Date, Expiry Date |
| **Tax & Financial** | Salary slips, Bank statements, Form 16 | Employee ID, Gross Pay, Deductions, Net Pay, Statement Period |
| **Medical Record** | Prescriptions, Lab diagnostics, Clinical notes | Patient Name, Physician, Diagnosis, Rx Date, Medications |
| **Certificate** | Educational degrees, Professional licenses | Recipient Name, Issuing Institution, Degree/Course, Award Date |
| **Contract** | Legal agreements, NDAs, Service agreements | Parties Involved, Effective Date, Governing Law, Term |
| **Generic Document** | Any unclassified or unstructured document | Key-value pairs, dates, amounts, organizations, emails, phones |

---

## 🚀 Getting Started & Setup Guide

### Prerequisites
- **Node.js**: `v18.18.0` or higher (Recommended: `v20.x` or `v22.x LTS`)
- **Package Manager**: `npm` (v9 or higher)
- **Browser**: Modern Chromium (Chrome, Edge, Brave), Firefox, or Safari

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/your-username/SmartDocumentBuilder.git
cd SmartDocumentBuilder
```

---

### Step 2: Install Dependencies
```bash
npm install
```

---

### Step 3: Configure Environment Variables (Optional)
AI Cloud Assist uses Google Gemini 3.6 Flash for optional high-level section restructuring. To enable it:

1. Create your local environment file:
   ```bash
   cp .env.example .env.local
   ```
2. Obtain a free API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
3. Open `.env.local` and add your key:
   ```env
   GEMINI_API_KEY="your_api_key_here"
   ```
*(Note: If no API key is provided, the platform functions 100% offline using local deterministic extraction and browser OCR!)*

---

### Step 4: Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### Step 5: Run Automated Tests

Run the Vitest unit test suite (18 suites covering extraction, schemas, storage quota, and linter):
```bash
npm test
```

To run tests in watch mode during development:
```bash
npm run test:watch
```

Run end-to-end (E2E) browser verification with Playwright:
```bash
npm run test:e2e
```

---

### Step 6: Build for Production
```bash
npm run build
npm start
```
The optimized production bundle will start on [http://localhost:3000](http://localhost:3000).

---

## 🛠️ Tech Stack & Dependencies

- **Framework**: [Next.js 16.3.5](https://nextjs.org/) (App Router, Turbopack)
- **Frontend Core**: [React 19](https://react.dev/), [TypeScript 5](https://www.typescriptlang.org/)
- **Styling**: Tailored Modern CSS Design System (Glassmorphism, custom design tokens, zero external CSS bloat)
- **PDF Extraction**: [pdfjs-dist](https://mozilla.github.io/pdf.js/) & [pdf-lib](https://pdf-lib.js.org/)
- **In-Browser OCR**: [Tesseract.js](https://tesseract.projectnaptha.com/) (Web Workers with multithreading)
- **Client Storage**: [idb](https://github.com/jakearchibald/idb) (IndexedDB wrapper with typed schemas)
- **NLP & Entities**: [Compromise](https://compromise.cool/) (Fast in-browser named entity recognition)
- **In-Browser Search**: [MiniSearch](https://lucaong.github.io/minisearch/) (Full-text client-side indexing)
- **Archive & Office Parsing**: [JSZip](https://stuk.github.io/jszip/) (OpenXML `.docx` extraction & `.xlsx` workbook generation)
- **Validation**: [Zod 4](https://zod.dev/)
- **AI Assist**: [@google/genai](https://github.com/google/generative-ai-js) (Gemini 3.6 Flash)
- **Testing**: [Vitest](https://vitest.dev/) & [Playwright](https://playwright.dev/)

---

## 📁 Repository Structure

```
SmartDocumentBuilder/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── extract/          # Serverless extraction bridge
│   │   │   ├── extract-image/    # Multimodal Gemini vision extraction
│   │   │   └── cloud-extract/    # AI cloud enhancement route
│   │   ├── document/[docId]/     # Interactive Document Inspector & Canvas
│   │   ├── history/              # Document History & Storage Quota Manager
│   │   ├── how-it-works/         # Architecture & Workflow Explainer
│   │   ├── upload/               # Multi-file upload route
│   │   ├── page.tsx              # Dashboard & Hero Dropzone
│   │   └── layout.tsx            # Root layout, navigation & ToastProvider
│   ├── components/
│   │   ├── review/               # PageViewer, FieldCard, JsonPanel, QualityDashboard
│   │   ├── ui/                   # ToastProvider, Spinner, Skeleton, Modal
│   │   └── upload/               # HeroDropzone & FileStatus
│   ├── lib/
│   │   ├── pipeline/
│   │   │   ├── extraction/       # inferLabel, partitionContent, resumeProfile, export
│   │   │   ├── classifyDocument  # Schema classification engine
│   │   │   ├── schemas.ts        # Pre-configured document schema definitions
│   │   │   ├── runPipeline.ts    # Main pipeline orchestrator with rollback guard
│   │   │   └── fileSniff.ts      # Magic-byte format detector
│   │   ├── storage/
│   │   │   ├── db.ts             # Self-healing IndexedDB connection
│   │   │   ├── documentsRepo.ts  # Document & safe file blob repository
│   │   │   ├── fieldsRepo.ts     # Extracted fields repository & edits
│   │   │   ├── auditRepo.ts      # Immutable audit trail repository
│   │   │   └── storageQuota.ts   # Storage quota estimator & orphan garbage collector
│   │   └── search/               # MiniSearch client-side full-text index
│   └── workers/
│       └── ocr.worker.ts         # Tesseract.js OCR background Web Worker
├── tests/
│   └── unit/                     # 18 Vitest test suites (77 passing unit tests)
├── .env.example                  # Template for environment variables
├── package.json                  # NPM dependencies & scripts
└── tsconfig.json                 # TypeScript compiler configuration
```

---

## 🔒 Security & Privacy Guarantees

1. **Air-Gapped Operation Possible**: The system runs completely offline without any internet connection. You can disconnect your network and process confidential documents with 100% fidelity.
2. **Zero Third-Party Tracking**: No telemetry, analytics, cookies, or remote logging are included.
3. **Permanent Deletion**: Deleting a document from Document History triggers an atomic multi-store purge in IndexedDB, completely removing the binary blob, layout blocks, and extracted fields from your device.

---

## 📄 License

MIT License — free for academic, enterprise, and personal use.
