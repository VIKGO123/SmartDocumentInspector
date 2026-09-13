# 📄 Smart Document Builder (Smart Document Inspector)

> **Transforming messy, semi-structured documents into clean, structured, and queryable data.**  
> A local-first, privacy-preserving Intelligent Document Processing (IDP) platform with visual proof-of-extraction, human-in-the-loop inspection, in-browser full-text search, and multi-format exports.

[![Live Deployed App](https://img.shields.io/badge/Live%20Demo-smartdocumentinspector.vercel.app-blue?style=for-the-badge&logo=vercel)](https://smartdocumentinspector.vercel.app/)
[![GitHub Repo](https://img.shields.io/badge/GitHub-SmartDocumentInspector-181717?style=for-the-badge&logo=github)](https://github.com/VIKGO123/SmartDocumentInspector)
[![Next.js](https://img.shields.io/badge/Next.js-16.3.5-black?style=flat&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.8-61DAFB?style=flat&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat&logo=typescript)](https://www.typescriptlang.org/)
[![Tests](https://img.shields.io/badge/Vitest-18%20suites%20passing-brightgreen?style=flat&logo=vitest)](https://vitest.dev/)
[![Privacy](https://img.shields.io/badge/Privacy-100%25%20Local%20First-green?style=flat)](#-security--privacy-guarantees)

---

## 🌐 Live Application & Repository Links

- **🚀 Public Deployed Application:** [https://smartdocumentinspector.vercel.app/](https://smartdocumentinspector.vercel.app/)
- **📦 GitHub Repository:** [https://github.com/VIKGO123/SmartDocumentInspector](https://github.com/VIKGO123/SmartDocumentInspector)
- **📋 Architectural Decisions Log:** [`decisions.md`](./decisions.md)

> [!NOTE]
> **Live AI Demonstration:**  
> The GitHub repository strictly excludes `.env.local` to prevent secret leakage. However, the **live deployed application on Vercel has `GEMINI_API_KEY` configured via secure Vercel environment variable secrets**. You can test full AI operations ("Enhance with AI" / Cloud Assist) immediately on the live demo URL without any personal setup!

---

## 🎯 Problem Statement & Framing

### **Problem Statement: Turn messy documents into structured, queryable data**
> *"Build a system that takes unstructured or semi-structured documents and converts them into clean, structured data that can be searched and queried."*

### How We Interpreted & Scoped the Problem
Real-world documents arrive in chaotic formats: multi-column resumes with overlapping sidebars, skewed invoice scans with faint text, receipts with distorted line items, and medical forms with inconsistent key-value layouts.

Most solutions take the superficial route: send the whole PDF to a cloud LLM and display whatever JSON it returns. We recognized that this approach fails on three fundamental real-world enterprise requirements:
1. **Privacy & Compliance:** Financial statements, identity proofs, and medical records cannot be indiscriminately sent to third-party AI endpoints.
2. **Loss of Visual Grounding:** When an LLM extracts `"Total Due: $1,450.00"`, the user has no visual evidence of where that number originated on the original page. Extraction without verification cannot be trusted.
3. **Multi-Column & OCR Chaos:** Linear plaintext extraction shatters multi-column reading orders, merging unrelated lines across vertical gutters into nonsensical tokens.

**Our Solution:** A **local-first Intelligent Document Processing (IDP) workbench** featuring:
- **Spatial Layout & Block Reconstruction:** Preserves $(x, y, w, h)$ coordinates and column boundaries.
- **Hybrid Extraction Pipeline:** Fast deterministic regex patterns + local Named Entity Recognition (Compromise NLP) + document schema classification + optional Gemini 3.6 Flash cloud assist.
- **Interactive Document Inspector:** Split-pane interface providing visual proof-of-extraction with interactive bounding box overlays.
- **Client-Side Query Engine:** Embedded full-text search (MiniSearch) with dynamic faceting and sub-millisecond query execution.
- **Universal Multi-Format Exporters:** Standardized JSON, RFC 4180 CSV, and native formatted Excel (`.xlsx`).

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
│   • PDF text stream extraction (pdf.js) with font matrices & coordinate preservation          │
│   • Automatic OCR Web Worker fallback (Tesseract.js) for image/scanned pages                  │
│   • Word OpenXML decompression & document.xml text extraction (JSZip)                         │
└───────────────────────────────────────────────┬───────────────────────────────────────────────┘
                                                │
                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. SPATIAL LAYOUT & BLOCK TREE RECONSTRUCTION                                                 │
│   • Reading-order sorting (top-to-bottom, multi-column left-to-right)                         │
│   • Vertical gutter detection (columnDetection.ts) preventing multi-column reading bleed       │
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

## 🌟 Going Above and Beyond: Solving the Hard Problems

Rather than building a basic proof-of-concept, we tackled the hard, edge-case engineering challenges that are routinely skipped in document extraction:

### 1. Spatial Reading Order & Multi-Column Gutter Detection
- **The Problem:** Standard text extractors flatten documents linearly, reading straight across two-column layouts. A left-column candidate title gets stitched into a right-column job date, destroying downstream NER.
- **Our Solution:** Built vertical gutter detection (`src/lib/pipeline/blockReconstruction/columnDetection.ts`) and horizontal baseline clustering (`lineGrouping.ts`). Words are ordered within columns before crossing gutters, preserving true human reading hierarchy.

### 2. OCR Worker Thread Isolation & Low-Text Fallback Routing
- **The Problem:** Running OCR on scanned documents or images usually freezes the browser tab, triggering "Page Unresponsive" errors.
- **Our Solution:** Isolated Tesseract.js inside a dedicated Web Worker (`src/workers/ocr.worker.ts`) communicating via structured message passing. Added heuristic fallback routing (`ocrFallbackRouting.ts`): if a digital PDF yields fewer than 15 characters per page or consists purely of raster images, it dynamically routes pages through grayscale contrast filtering into the OCR worker with real-time progress events.

### 3. Proximity Anti-Stampede Guard & Field Quality Linting
- **The Problem:** When an extraction keyword appears in a messy document (e.g. `"Frontend"` in a resume header), naive proximity algorithms label every succeeding item with sequential duplicates: `Frontend (2)`, `Frontend (3)`, ..., `Frontend (6)`.
- **Our Solution:** Engineered `consumedBlockProximityCues` in `inferLabel.ts`. Once a cue is matched within a spatial block, it is consumed and subsequent tokens fall back cleanly to semantic types. Paired with `fieldQualityLint.ts`, which detects and flags generic nouns, label masquerades, and OCR noise.

### 4. Zero Data-Clone Crashes in Safari/WebKit
- **The Problem:** Modern Safari revokes temporary OS file handles when storing raw `File` objects in IndexedDB, causing unpredictable `DataCloneError: The object could not be cloned` during background operations.
- **Our Solution:** Created an immutable binary blob normalization layer (`file.blob.slice(...)`), detaching the browser file handle before persisting to IndexedDB.

### 5. In-Memory Search Engine with Dynamic Facets
- **The Problem:** Querying extracted documents typically requires a server database or external search cluster.
- **Our Solution:** Embedded **MiniSearch** in the client, building an in-memory inverted index of all committed documents, fields, and notes with fuzzy search tolerance for OCR misspellings and real-time facet filtering (`src/lib/search/facets.ts`).

---

## 📊 Alignment with Evaluation Criteria

| Evaluation Dimension | How Smart Document Builder Delivers |
| :--- | :--- |
| **Problem Framing** | Reframed from a naive "API wrapper" to a **local-first, privacy-preserving, verifiable document workbench**. Prioritized user data sovereignty, auditability, and spatial layout preservation over generic black-box extraction. |
| **Product Thinking** | Built for operations analysts, compliance auditors, and recruiters who need to process sensitive documents with **zero data leakage**, verify every extracted value visually, and search/export clean datasets. |
| **UX Decisions** | Split-pane Document Inspector with **interactive coordinate highlight overlays** on hover/click; radial confidence progress indicators; commit gate preventing low-confidence data pollution; seamless multi-file drag-and-drop. |
| **Code Quality** | Strict TypeScript throughout; Zod schema validation; clean architectural separation (`pipeline/`, `storage/`, `search/`, `components/`); zero circular dependencies; comprehensive defensive error handling. |
| **Tests** | **18 automated unit test suites** (77+ assertions) covering block reconstruction, schema binding, confidence scoring, storage quota, and label linting, plus **Playwright E2E suites** testing the complete upload-review-commit-query cycle on messy documents. |
| **Documentation** | Detailed README with architecture diagrams, setup commands, schema references, and a standalone [`decisions.md`](./decisions.md) capturing real architectural tradeoffs. |
| **Setup Experience** | Clone, `npm install`, and `npm run dev`. Works 100% offline out-of-the-box without requiring an API key, database, or external service. |
| **Velocity & Depth** | Built an entire production-grade IDP platform featuring custom block layout trees, OCR Web Workers, IndexedDB repositories, MiniSearch, and multi-format exporters. |

---

## 📋 Document Schemas Supported

The system includes pre-configured schema detectors with automatic document classification:

| Schema Type | Description | Key Extracted Fields |
| :--- | :--- | :--- |
| **Invoice** | Billing invoices & accounts payable | Invoice Number, Vendor Name, Total Due, Due Date, Tax, Line Items |
| **Resume / CV** | Professional resumes & CVs | Candidate Name, Job Title, Email, Phone, LinkedIn, Skills, Experience |
| **Receipt** | Point-of-sale retail receipts | Merchant Name, Total Amount, Date, Tax, Payment Method |
| **Identity Document** | Passports, National IDs, Driver's Licenses | Full Name, Document/ID Number, DOB, Issue Date, Expiry Date |
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
git clone https://github.com/VIKGO123/SmartDocumentInspector.git
cd SmartDocumentInspector
```

---

### Step 2: Install Dependencies
```bash
npm install
```

---

### Step 3: Configure Environment Variables (Optional)
The application works **100% offline out-of-the-box** using local deterministic extraction, NLP, and in-browser OCR without any API key.

If you wish to test the optional Gemini AI Cloud Assist locally:
1. Create your local environment file:
   ```bash
   cp .env.example .env.local
   ```
2. Add your Google Gemini API key (free from [Google AI Studio](https://aistudio.google.com/app/apikey)):
   ```env
   GEMINI_API_KEY="your_api_key_here"
   ```

*(Remember: The live public app at [https://smartdocumentinspector.vercel.app/](https://smartdocumentinspector.vercel.app/) already has this configured via Vercel secrets, so you can test AI extraction there immediately without creating an API key!)*

---

### Step 4: Run the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

### Step 5: Run Automated Tests

Run the complete Vitest unit test suite:
```bash
npm test
```

Run tests in watch mode:
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
- **Frontend Core**: [React 19.2.8](https://react.dev/), [TypeScript 5](https://www.typescriptlang.org/)
- **Styling**: Tailored Modern CSS Design System (Glassmorphism, custom design tokens, zero runtime CSS bloat)
- **PDF Extraction & Rendering**: [pdfjs-dist](https://mozilla.github.io/pdf.js/) & [pdf-lib](https://pdf-lib.js.org/)
- **In-Browser OCR**: [Tesseract.js](https://tesseract.projectnaptha.com/) (Isolated Web Workers with real-time progress)
- **Client Storage**: [idb](https://github.com/jakearchibald/idb) (Typed multi-store IndexedDB wrapper)
- **NLP & Named Entity Recognition**: [Compromise](https://compromise.cool/) (Fast local entity extraction)
- **Client-Side Query Engine**: [MiniSearch](https://lucaong.github.io/minisearch/) (Full-text in-memory indexing)
- **Archive & Office Parsing**: [JSZip](https://stuk.github.io/jszip/) (OpenXML `.docx` parsing & `.xlsx` workbook generation)
- **Schema Validation**: [Zod 4](https://zod.dev/)
- **AI Cloud Assist**: [@google/genai](https://github.com/google/generative-ai-js) (Gemini 3.6 Flash / Vision)
- **Test Frameworks**: [Vitest](https://vitest.dev/) & [Playwright](https://playwright.dev/)

---

## 📁 Repository Structure

```
SmartDocumentInspector/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── extract/          # Serverless structured extraction bridge
│   │   │   ├── extract-image/    # Multimodal Gemini vision extraction
│   │   │   └── cloud-extract/    # AI cloud enhancement route
│   │   ├── document/[docId]/     # Interactive Document Inspector & Canvas
│   │   ├── history/              # Document History & Storage Quota Manager
│   │   ├── how-it-works/         # Architecture & Workflow Explainer
│   │   ├── upload/               # Multi-file upload route
│   │   ├── page.tsx              # Dashboard & Hero Dropzone
│   │   └── layout.tsx            # Root layout, navigation & ToastProvider
│   ├── components/
│   │   ├── review/               # PageViewer, FieldGroupList, JsonPanel, QualityDashboard
│   │   ├── ui/                   # ToastProvider, Spinner, Skeleton, Modal
│   │   └── upload/               # Dropzone & DocumentStatusRow
│   ├── lib/
│   │   ├── pipeline/
│   │   │   ├── blockReconstruction/ # Spatial reading order, column, & table detection
│   │   │   ├── extraction/       # inferLabel, bindToSchema, ner, fieldQualityLint, export
│   │   │   ├── classifyDocument  # Schema classification engine
│   │   │   ├── schemas.ts        # Pre-configured document schema definitions
│   │   │   ├── runPipeline.ts    # Main pipeline orchestrator with rollback guard
│   │   │   ├── fileSniff.ts      # Magic-byte format detector
│   │   │   └── ocrFallbackRouting# Intelligent scanned vs digital PDF router
│   │   ├── storage/
│   │   │   ├── db.ts             # Self-healing IndexedDB connection
│   │   │   ├── documentsRepo.ts  # Document & safe file blob repository
│   │   │   ├── fieldsRepo.ts     # Extracted fields repository & edits
│   │   │   ├── auditRepo.ts      # Immutable audit trail repository
│   │   │   └── storageQuota.ts   # Storage quota estimator & orphan garbage collector
│   │   └── search/               # MiniSearch client-side full-text index & facets
│   └── workers/
│       └── ocr.worker.ts         # Tesseract.js OCR background Web Worker
├── tests/
│   ├── unit/                     # 18 Vitest test suites (77 passing unit tests)
│   └── e2e/                      # Playwright E2E upload-review-commit-query test
├── decisions.md                  # Architectural decisions record (ADR)
├── README.md                     # Project overview & documentation
├── .env.example                  # Template for environment variables
├── package.json                  # NPM dependencies & scripts
└── tsconfig.json                 # TypeScript compiler configuration
```

---

## 🔒 Security & Privacy Guarantees

1. **Air-Gapped Operation:** The entire ingestion, layout reconstruction, OCR, extraction, and search pipeline runs 100% offline inside the client's browser. You can turn off your Wi-Fi and process confidential documents with zero data egress.
2. **Zero Third-Party Telemetry:** No analytics scripts, tracking cookies, or external logging.
3. **Atomic Purging:** Deleting a document from Document History triggers an atomic multi-store purge in IndexedDB, completely removing the binary file blob, layout blocks, and extracted fields from the user's device.

---

## 📄 Architectural Decisions Record

For detailed documentation on the technical decisions, alternatives considered, tradeoffs accepted, and deliberate cuts, please refer to:
👉 **[`decisions.md`](./decisions.md)**

---

## 📄 License

MIT License — open and free for academic, enterprise, and personal use.
