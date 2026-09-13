# Architectural Decisions Record (decisions.md)

> **Project:** Smart Document Builder (Smart Document Inspector)  
> **Repository:** [https://github.com/VIKGO123/SmartDocumentInspector](https://github.com/VIKGO123/SmartDocumentInspector)  
> **Live Deployed App:** [https://smartdocumentinspector.vercel.app/](https://smartdocumentinspector.vercel.app/)  
> **Problem Statement:** Turn messy documents into structured, queryable data.  
> **Role:** Senior Software Architect  

---

## Overview & Scoping Philosophy

When building a system to *"take unstructured or semi-structured documents and convert them into clean, structured data that can be searched and queried"*, the easiest, most superficial approach is building a thin UI wrapper around an LLM API (e.g., streaming files to OpenAI/Anthropic/Gemini).

We deliberately **rejected that shortcut**. In real-world enterprise environments (fintech, legal, healthcare, compliance), documents contain sensitive PII, financial ledgers, and trade secrets that cannot be blindly blasted across external networks. Furthermore, cloud-only LLMs fail unpredictably on complex multi-column layouts, table grids, OCR artifacts, and high-frequency document pipelines due to rate limits, cost, and latency.

Instead, we framed the problem as an **intelligent, local-first document processing pipeline with human-in-the-loop verification and an optional cloud-intelligence fallback**.

Below is the log of key architectural decisions made throughout the project, detailing what was chosen, what was rejected, why, the tradeoffs accepted, and what was deliberately cut.

---

## 1. Local-First In-Browser Pipeline vs. Cloud-Centric Processing

### The Decision
We chose a **100% local-first, client-side processing architecture**. File parsing (`pdfjs-dist`, `JSZip`), layout reconstruction, OCR (`tesseract.js`), rule/NER extraction (`compromise`), search indexing (`minisearch`), and persistent storage (`idb`) execute entirely inside the user's browser runtime.

### The Alternatives Considered
1. **Server-Side Microservices (Python/FastAPI + Celery/RabbitMQ + PyMuPDF/Tesseract):**  
   *Pros:* Unlimited server memory, access to heavy C++ OCR binaries (PaddleOCR, EasyOCR).  
   *Cons:* Required running and maintaining multi-container backend infrastructure; uploaded customer files sit on remote disks (massive compliance & privacy overhead); network latency for multi-megabyte PDF uploads.
2. **Cloud-Only LLM Pipeline (e.g., sending raw PDFs to Gemini/GPT-4 Vision):**  
   *Pros:* Rapid initial scaffolding.  
   *Cons:* Non-deterministic extractions, high token costs per page ($0.02–$0.05/doc), rate-limiting bottlenecks, zero offline capability, and complete loss of spatial coordinate awareness ($x, y, w, h$).

### Reasoning & Tradeoffs
- **Zero Data Leakage:** Air-gapped confidentiality by default. Medical records, salary slips, and ID cards never leave the user's browser.
- **Instant Response & Zero Egress:** Eliminates upload round-trips.
- **Tradeoff Accepted:** Browser CPU and memory constraints. Processing large 50-page scanned documents in client WebAssembly takes longer than on a 32-core cloud server. We solved this with background Web Workers and a sequential ingestion queue.

### What We Deliberately Cut
- Multi-node distributed queue processing. For an interactive document inspector, processing documents in-tab with live progress cues provides a far superior user experience than a detached asynchronous job queue.

---

## 2. Spatial Layout & Block Tree Reconstruction vs. Raw Plaintext Extraction

### The Decision
We built a custom **Spatial Layout & Block Reconstruction Engine** (`src/lib/pipeline/blockReconstruction/`) that processes raw geometric text items $(x, y, \text{width}, \text{height}, \text{page})$ into a structural hierarchy:
- `columnDetection.ts`: Segregates text items by vertical gutters to prevent reading across multi-column boundaries (e.g., dual-column resumes or side-by-side invoice headers).
- `lineGrouping.ts`: Groups words on the same baseline with adaptive character-spacing thresholds.
- `blockClassifier.ts`: Classifies visual elements into semantic roles (`H1`, `H2`, `paragraph`, `keyValue`, `table`, `code`).
- `tableDetection.ts`: Identifies aligned tabular columns and grid lines.

### The Alternatives Considered
1. **Linear Plaintext Stream (`pdf.getTextContent().items.map(i => i.str).join(' ')`):**  
   *Pros:* 10 lines of code.  
   *Cons:* Destroys column order completely. Multi-column resumes merge left-column company names with right-column job dates, producing nonsensical garbage for downstream NER.
2. **Heavy LayoutLM / LayoutXLM Machine Learning Models:**  
   *Pros:* High accuracy on complex document geometries.  
   *Cons:* Models are 500MB–1.5GB; cannot run fluidly inside browser WebAssembly or edge runtimes.

### Reasoning & Tradeoffs
- **Precision Grounding:** Preserving physical coordinates allows the interactive PageViewer to draw precise highlight overlays over every extracted field.
- **Tradeoff Accepted:** Algorithmic complexity. Edge cases in hand-drawn tables or skewed scans require continuous heuristic refinement.

### What We Deliberately Cut
- Arbitrary non-orthogonal / rotated text angle compensation (e.g. 45° watermark text). We prioritized vertical and horizontal document structures that represent 99% of business forms.

---

## 3. Hybrid Dual-Engine Extraction (Deterministic Rules + NER + Schema Binding + AI Cloud Assist)

### The Decision
We implemented a **hybrid, layered extraction strategy**:
1. **Layer 1 (Deterministic Patterns):** Fast regex recognizers for unambiguous tokens (RFC 5322 emails, E.164 phone numbers, ISO/US dates, ISO 4217 currencies, URLs, tax/ID numbers).
2. **Layer 2 (Local NLP/NER):** `compromise` NLP engine for entity tagging (persons, organizations, places).
3. **Layer 3 (Schema Classification & Binding):** Auto-classifies document type (Invoice, Resume, Receipt, ID, Tax, Medical, Contract, Generic) and binds detected fields to strict schema keys.
4. **Layer 4 (Optional AI Cloud Assist):** Serverless Google Gemini 3.6 Flash endpoint (`/api/cloud-extract`) that accepts compressed spatial layout outlines and provides structured JSON extractions when high-level semantic reasoning is desired.

### The Alternatives Considered
1. **Pure Regex / Heuristics Only:**  
   *Pros:* Extremely fast, zero dependencies.  
   *Cons:* Fragile against unstructured prose, ambiguous keys, and multi-line descriptive text.
2. **Pure LLM Prompts for Everything:**  
   *Pros:* Flexible.  
   *Cons:* Prone to hallucinations, expensive, slow, and fails basic regex guarantees (e.g., truncating phone digits or inventing tax numbers).

### Reasoning & Tradeoffs
- **Best of Both Worlds:** Deterministic patterns guarantee exact string fidelity for critical identifiers; AI handles high-level summarization and ambiguous key-value pairings.
- **Anti-Stampede & Quality Linter:** Built `inferLabel.ts` with provenance flags (`"schema" | "explicit" | "inferred"`) and `fieldQualityLint.ts` to prevent nearby words from stampeding into duplicate field keys (e.g., `Frontend (2)`, `Frontend (3)`).
- **Tradeoff Accepted:** Maintaining schema definitions and regex rules alongside AI prompt templates requires disciplined typing.

### What We Deliberately Cut
- Custom model fine-tuning. Fine-tuning a domain model requires training pipelines that are unnecessary given the accuracy of few-shot structured prompting combined with deterministic regex pre-extraction.

---

## 4. Background Web Worker Thread Isolation for OCR and PDF Rendering

### The Decision
All OCR processing is offloaded to a dedicated Web Worker (`src/workers/ocr.worker.ts`) running `tesseract.js`, communicating via typed messages (`POST_DOCUMENT`, `OCR_PROGRESS`, `OCR_SUCCESS`, `OCR_ERROR`). PDF rendering similarly isolates canvas operations to offscreen contexts.

### The Alternatives Considered
1. **Running Tesseract on the Main UI Thread:**  
   *Pros:* Simpler, synchronous code flow.  
   *Cons:* Completely freezes the browser tab. The user cannot scroll, type, switch tabs, or cancel while a 3-page scan is being processed. The browser displays the "Page Unresponsive" crash dialog.
2. **Server-Side OCR Rendering:**  
   *Pros:* Faster execution on GPU instances.  
   *Cons:* Requires uploading gigabytes of uncompressed image bitmaps over the network, violating the local-first privacy guarantee.

### Reasoning & Tradeoffs
- **60fps UI Responsiveness:** Main thread remains completely fluid. The user can review other documents or explore the UI while OCR completes in the background.
- **Granular Progress:** Worker emits real-time page-by-page progress events displayed on the UI progress bar.
- **Tradeoff Accepted:** Cross-thread message serialization overhead (ArrayBuffers and ImageData transferred via transferable objects).

### What We Deliberately Cut
- Multi-language OCR packs downloaded simultaneously. We bundled English (`eng`) by default with dynamic download capability to avoid forcing users to download 100MB of Tesseract language traineddata files up front.

---

## 5. Resilient Client-Side Storage Architecture (IndexedDB with Safe Slicing)

### The Decision
We chose **IndexedDB** managed via the lightweight `idb` library, organized into 4 distinct object stores:
1. `documents`: Metadata, status, page count, document type, quality metrics.
2. `files`: Raw binary file Blobs for re-rendering in the PageViewer.
3. `fields`: Normalized extracted field records with bounding boxes and edit histories.
4. `auditEvents`: Immutable chronological audit trail of all status transitions, human edits, and re-classifications.

### The Alternatives Considered
1. **`localStorage` / `sessionStorage`:**  
   *Pros:* Simple synchronous key-value API.  
   *Cons:* 5MB hard limit, string-only (cannot store PDF Blobs), blocks the main thread on every read/write.
2. **Origin Private File System (OPFS):**  
   *Pros:* Fast raw file I/O.  
   *Cons:* Poor tooling for relational queries, complex cross-browser sync, lack of secondary indexes.
3. **External Cloud Database (Supabase / Firebase / Postgres):**  
   *Pros:* Easy multi-device sharing.  
   *Cons:* Destroys privacy; requires user accounts, auth walls, and server costs.

### Reasoning & Tradeoffs
- **Safe Blob Slicing (`file.blob.slice(...)`):** Solved a notoriously insidious WebKit/Safari bug where holding references to raw `File` objects causes random `DataCloneError: The object could not be cloned` when temporary OS file handles are revoked.
- **Sequential Ingestion Queue:** Eliminates concurrent IndexedDB write transaction collisions and memory exhaustion during bulk uploads.
- **Self-Healing Connection:** Automatically catches `VersionError` or blocked connections across tabs and cleanly re-opens the database.
- **Storage Quota Management:** Proactively requests persistent storage (`navigator.storage.persist()`) and provides live disk usage metering with one-click orphan cleanup.

### What We Deliberately Cut
- Real-time peer-to-peer WebRTC cross-device sync. Overkill for an individual document inspector and introduces connection discovery fragility.

---

## 6. Embedded In-Browser Search Engine (MiniSearch)

### The Decision
We integrated **MiniSearch** directly in the client runtime. It constructs an in-memory inverted full-text index across all committed documents, indexing:
- Document filenames and metadata
- Extracted field keys and values
- Document notes and summaries
- Full raw text content

We augmented this with a custom faceting engine (`src/lib/search/facets.ts`) for dynamic filtering by document type, confidence tier, date ranges, and field presence.

### The Alternatives Considered
1. **Simple JavaScript Array `.filter()` & `.includes()`:**  
   *Pros:* Zero extra libraries.  
   *Cons:* Fails on fuzzy matching, prefix search, token stemming, term weighting, and multi-field queries. Degrades rapidly as document count grows.
2. **Cloud Vector Database (Pinecone / Qdrant / pgvector):**  
   *Pros:* Semantic similarity search ("find documents like this").  
   *Cons:* Overkill for a local document workbench; requires embedding model API calls for every document, adding cost, latency, and privacy leakage.

### Reasoning & Tradeoffs
- **Sub-Millisecond Search:** Instant search results on keystroke (<5ms) without a single network hop.
- **Fuzzy Matching:** Gracefully tolerates OCR typos (e.g. searching "invoice" matches OCR scan containing "lnvoice").
- **Tradeoff Accepted:** Index is stored in memory and rebuilt from IndexedDB on page load. For thousands of documents, re-indexing takes ~200ms on startup, which is imperceptible to the user.

### What We Deliberately Cut
- Vector semantic embedding search. Kept the query engine deterministic, lightweight, and completely local.

---

## 7. Human-in-the-Loop Visual Verification (Visual Proof-of-Extraction)

### The Decision
Extraction without verification is dangerous. We designed an **interactive split-pane inspection interface**:
- **Left Pane (PageViewer):** Renders the actual document canvas (PDF/image) with physical bounding boxes $(x, y, w, h)$ layered over the extracted coordinates.
- **Right Pane (Field Inspector):** Lists all extracted fields grouped by confidence tier (High, Medium, Low). Hovering over any field instantly scrolls to and highlights its physical position on the document. Clicking any field allows immediate inline editing, key reassignment, or deletion.
- **Commit Guard:** Documents cannot be marked "Committed" if they contain unresolved Low-Confidence fields, preventing bad data from polluting downstream search.

### The Alternatives Considered
1. **Blind Automated JSON Export:**  
   *Pros:* Fully automatic, no UI needed.  
   *Cons:* Unusable in production. Users cannot trust AI or OCR without visual evidence of where a number or date came from.
2. **Text-Only Review Table:**  
   *Pros:* Easier to implement than an interactive canvas with coordinate scaling.  
   *Cons:* Disconnects the extracted value from its visual context. The user has to manually open the original PDF in another window to verify whether an invoice total is correct.

### Reasoning & Tradeoffs
- **Trust & Observability:** Giving users visual proof of extraction bridges the gap between raw OCR and dependable data.
- **Tradeoff Accepted:** Managing coordinate space transformations (converting PDF points to viewport-scaled canvas pixels with DPR adjustments) required rigorous math in `PageViewer.tsx`.

### What We Deliberately Cut
- Manual polygon drawing tools for lassoing text. Standard rectangular bounding boxes cover 99.9% of business document fields and keep the UI streamlined.

---

## 8. Deliberately Cut Features & Future Scope

In any 5-day architectural sprint under ambiguity, **what you choose NOT to build is just as critical as what you build**:

1. **User Authentication & Multi-Tenancy:**  
   *Why Cut:* For a privacy-first, local-first document inspector, an auth wall is pure friction. Keeping the app serverless and local-first allows anyone to evaluate it immediately with zero sign-up friction.
2. **Support for Non-Latin Scripts (CJK, Arabic, Cyrillic OCR):**  
   *Why Cut:* Tesseract traineddata for non-Latin languages adds 150MB+ of downloads. We optimized deeply for standard Latin/English business documents.
3. **Direct Database Connector Write-Back (Postgres / Snowflake sync):**  
   *Why Cut:* Exporting to RFC 4180 CSV, formatted Excel (`.xlsx`), and clean JSON provides universal compatibility with any database without coupling to a specific cloud vendor.

---

## 9. Summary of Key Architectural Tradeoffs

| Component | We Chose | We Rejected | Principal Tradeoff Accepted |
| :--- | :--- | :--- | :--- |
| **Pipeline Core** | Local-First Browser Execution | Remote Cloud Microservices | Browser WASM compute vs. 100% data privacy & zero server costs |
| **Document Layout** | Spatial Block Reconstruction | Linear Plaintext Stream | Algorithmic layout math vs. complete multi-column integrity |
| **Entity Extraction**| Hybrid (Regex + NLP + Schemas + AI)| Pure LLM Prompts | Code discipline vs. zero hallucinations on IDs/phone/currency |
| **OCR Runtime** | Web Worker Multithreading | Main Thread Execution | Cross-thread serialization vs. silky 60fps UI responsiveness |
| **Client Storage** | IndexedDB with Sliced Blobs | LocalStorage / Cloud DB | Asynchronous indexed queries vs. zero memory leaks/data clone crashes |
| **Search Engine** | In-Memory MiniSearch | Cloud Vector DB | Inverted text index vs. zero API latency and zero cloud costs |
| **UX Verification** | Split-Pane Coordinate Overlays | Blind JSON Export | Viewport coordinate math vs. complete human-in-the-loop auditability |
