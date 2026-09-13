export type BlockType =
  | "heading"
  | "paragraph"
  | "keyValue"
  | "listItem"
  | "table"
  | "figure";

export interface BBox {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export interface Block {
  id: string;
  type: BlockType;
  text: string;
  bbox: BBox;
  cells?: string[][];
  confidence?: number;
}

export type FieldValueType =
  | "date"
  | "money"
  | "email"
  | "phone"
  | "url"
  | "id"
  | "person"
  | "org"
  | "location"
  | "table"
  | "text";

export type ConfidenceTier = "high" | "medium" | "low";

export type FieldProvenance = "local" | "cloud-verbatim" | "cloud-inferred";

export type LabelProvenance = "schema" | "explicit" | "inferred";

export interface FieldRecord {
  id: string;
  documentId: string;
  key: string;
  value: string;
  valueType: FieldValueType;
  confidence: number;
  tier: ConfidenceTier;
  bbox: BBox;
  sourceBlockId: string;
  edited: boolean;
  editHistory: { oldValue: string; newValue: string; at: string }[];
  schemaKey?: string;
  required?: boolean;
  note?: string;
  missing?: boolean;
  semanticFit?: number;
  flagged?: boolean;
  provenance?: FieldProvenance;
  labelProvenance?: LabelProvenance;
  groundingScore?: number;
  sectionTitle?: string;
  entryIndex?: number;
}

export type DocumentStatus =
  | "queued"
  | "extracting-text"
  | "running-ocr"
  | "detecting-layout"
  | "scoring-confidence"
  | "needs-review"
  | "done"
  | "needs-manual-entry"
  | "failed";

export type CloudAssistStatus =
  | "not-requested"
  | "pending"
  | "succeeded"
  | "failed-fell-back";

export interface DocumentRecord {
  id: string;
  filename: string;
  uploadedAt: string;
  fileHash: string;
  status: DocumentStatus;
  failureReason?: string;
  statusDetail?: string;
  pageCount?: number;
  mimeType?: string;
  rawText: string;
  blockTree: Block[];
  layoutFingerprint: string;
  documentType?: string;
  schemaId?: string;
  notes?: string[];
  textSource?: "digital" | "ocr" | "mixed";
  quality?: QualityReport;
  rescans?: number;
  fileRevision?: number;
  cloudAssistStatus?: CloudAssistStatus;
}

export interface QualityReport {
  extractionConfidence: number;
  pageLegibility: number;
  textSource: "digital" | "ocr" | "mixed";
  handwritingPct: number;
  checks: Record<string, string>;
  checksPassed: number;
  checksTotal: number;
  advice: string[];
  userInput: { edited: number; flagged: number; rescans: number };
}

export type AuditKind =
  | "uploaded"
  | "status"
  | "edit"
  | "commit"
  | "manual-field"
  | "cloud-assist";

export interface AuditEvent {
  id: string;
  documentId: string;
  at: string;
  kind: AuditKind;
  label: string;
  oldValue?: string;
  newValue?: string;
}

export interface PositionedItem {
  text: string;
  bbox: BBox;
  fontSize?: number;
  confidence?: number;
}

export interface StoredFile {
  documentId: string;
  blob: Blob;
  mimeType: string;
  filename: string;
}

export const IN_PROGRESS_STATUSES: DocumentStatus[] = [
  "queued",
  "extracting-text",
  "running-ocr",
  "detecting-layout",
  "scoring-confidence",
];

export const STATUS_LABELS: Record<DocumentStatus, string> = {
  queued: "Queued…",
  "extracting-text": "Extracting text…",
  "running-ocr": "Running OCR…",
  "detecting-layout": "Detecting layout…",
  "scoring-confidence": "Scoring confidence…",
  "needs-review": "Needs review",
  done: "Done",
  "needs-manual-entry": "Needs manual entry",
  failed: "Failed",
};

export const FIELD_KIND_GROUPS: {
  label: string;
  types: FieldValueType[];
}[] = [
  { label: "Contacts & Identifiers", types: ["email", "phone", "url", "id"] },
  { label: "Dates", types: ["date"] },
  { label: "Amounts", types: ["money"] },
  { label: "People & orgs", types: ["person", "org", "location"] },
  { label: "Tables", types: ["table"] },
  { label: "Free text", types: ["text"] },
];
