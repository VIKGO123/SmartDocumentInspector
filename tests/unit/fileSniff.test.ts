import { describe, expect, it } from "vitest";
import { rejectReason, sniffFile } from "@/lib/pipeline/fileSniff";
import { replaceOnce, replaceWordXmlText } from "@/lib/pipeline/rewrite/textReplace";

function fileFrom(name: string, bytes: number[], type = ""): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

describe("sniffFile", () => {
  it("detects PDF magic", async () => {
    expect(await sniffFile(fileFrom("x.bin", [0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe("pdf");
  });

  it("detects docx by name", async () => {
    expect(await sniffFile(fileFrom("cv.docx", [0x50, 0x4b, 0x03, 0x04]))).toBe("docx");
  });

  it("detects OLE .doc", async () => {
    expect(await sniffFile(fileFrom("old.doc", [0xd0, 0xcf, 0x11, 0xe0, 0xa1]))).toBe("doc");
  });

  it("rejects PNG", async () => {
    const png = fileFrom(
      "scan.png",
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      "image/png",
    );
    expect(await sniffFile(png)).toBe("unsupported");
    expect(rejectReason(png, "unsupported")).toMatch(/PDF, TXT, DOCX, DOC/);
  });
});

describe("text replace", () => {
  it("replaces the first occurrence only", () => {
    expect(replaceOnce("aa aa", "aa", "bb")).toBe("bb aa");
  });

  it("replaces a contiguous Word XML text run once", () => {
    const xml = `<w:t>Hello Gurugram, India</w:t><w:t>Hello Gurugram, India</w:t>`;
    const next = replaceWordXmlText(xml, "Gurugram, India", "Delhi, India");
    expect(next).toContain("Hello Delhi, India");
    expect(next.match(/Delhi, India/g)?.length).toBe(1);
    expect(next.match(/Gurugram, India/g)?.length).toBe(1);
  });
});
