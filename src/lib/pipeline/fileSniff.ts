export type SniffKind = "pdf" | "text" | "docx" | "doc" | "unsupported";

const PDF = [0x25, 0x50, 0x44, 0x46];
const ZIP = [0x50, 0x4b];
const OLE = [0xd0, 0xcf, 0x11, 0xe0];

function bytesStartWith(bytes: Uint8Array, sig: number[]): boolean {
  if (bytes.length < sig.length) return false;
  return sig.every((b, i) => bytes[i] === b);
}

export async function sniffFile(file: File): Promise<SniffKind> {
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const mime = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (bytesStartWith(header, PDF) || mime === "application/pdf" || name.endsWith(".pdf")) {
    return "pdf";
  }

  if (
    name.endsWith(".docx") ||
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    (bytesStartWith(header, ZIP) && name.endsWith(".docx"))
  ) {
    return "docx";
  }

  if (
    name.endsWith(".doc") ||
    mime === "application/msword" ||
    bytesStartWith(header, OLE)
  ) {
    return "doc";
  }

  if (mime.startsWith("image/")) return "unsupported";

  if (mime.startsWith("text/") || name.endsWith(".txt") || looksLikeUtf8Text(header)) {
    return "text";
  }

  return "unsupported";
}

function looksLikeUtf8Text(header: Uint8Array): boolean {
  if (header.length === 0) return false;
  let printable = 0;
  for (const b of header) {
    if (b === 9 || b === 10 || b === 13 || (b >= 32 && b < 127)) printable += 1;
  }
  return printable / header.length > 0.85;
}

export const ALLOWED_FORMATS = "PDF, TXT, DOCX, DOC";
export const ALLOWED_EXTENSIONS = ".pdf · .docx · .doc · .txt";
export const ALLOWED_ACCEPT =
  ".pdf,.txt,.docx,.doc,application/pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function rejectReason(file: File, kind: SniffKind): string | null {
  if (file.size === 0) {
    return `${file.name} is empty — try another file.`;
  }
  if (kind === "unsupported") {
    return `${file.name} isn't supported yet — try ${ALLOWED_FORMATS}.`;
  }
  return null;
}
