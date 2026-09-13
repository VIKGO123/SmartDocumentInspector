import { describe, expect, it, vi, afterEach } from "vitest";
import {
  isQuotaError,
  StorageQuotaError,
  getStorageEstimate,
  requestPersistentStorage,
} from "@/lib/storage/storageQuota";

describe("storageQuota utilities", () => {
  describe("isQuotaError", () => {
    it("detects QuotaExceededError by name", () => {
      const err = new DOMException("The quota has been exceeded.", "QuotaExceededError");
      expect(isQuotaError(err)).toBe(true);
    });

    it("detects Firefox NS_ERROR_DOM_QUOTA_REACHED by name", () => {
      const err = { name: "NS_ERROR_DOM_QUOTA_REACHED", message: "Persistent storage maximum size reached" };
      expect(isQuotaError(err)).toBe(true);
    });

    it("detects legacy WebKit code 22", () => {
      const err = { code: 22, message: "QUOTA_EXCEEDED_ERR" };
      expect(isQuotaError(err)).toBe(true);
    });

    it("detects quota error from descriptive message", () => {
      const err = new Error("Device out of disk space during write operation");
      expect(isQuotaError(err)).toBe(true);
    });

    it("detects StorageQuotaError instance", () => {
      const err = new StorageQuotaError("Custom storage full message");
      expect(isQuotaError(err)).toBe(true);
    });

    it("returns false for unrelated errors", () => {
      expect(isQuotaError(null)).toBe(false);
      expect(isQuotaError(undefined)).toBe(false);
      expect(isQuotaError(new Error("File not found"))).toBe(false);
      expect(isQuotaError(new DOMException("Aborted", "AbortError"))).toBe(false);
    });
  });

  describe("StorageQuotaError", () => {
    it("provides clear default actionable user guidance", () => {
      const err = new StorageQuotaError();
      expect(err.name).toBe("StorageQuotaError");
      expect(err.message).toContain("storage quota exceeded");
      expect(err.message).toContain("Document History");
    });

    it("accepts custom error messages", () => {
      const err = new StorageQuotaError("Cannot store resume.pdf: storage full");
      expect(err.message).toBe("Cannot store resume.pdf: storage full");
    });
  });

  describe("getStorageEstimate & requestPersistentStorage", () => {
    const originalNavigator = globalThis.navigator;

    afterEach(() => {
      Object.defineProperty(globalThis, "navigator", {
        value: originalNavigator,
        configurable: true,
        writable: true,
      });
    });

    it("gracefully calculates storage percentages when estimate is available", async () => {
      const mockEstimate = vi.fn().mockResolvedValue({
        usage: 50 * 1024 * 1024, // 50 MB
        quota: 1000 * 1024 * 1024, // 1000 MB
      });
      const mockPersisted = vi.fn().mockResolvedValue(true);

      Object.defineProperty(globalThis, "navigator", {
        value: {
          storage: {
            estimate: mockEstimate,
            persisted: mockPersisted,
          },
        },
        configurable: true,
        writable: true,
      });

      const est = await getStorageEstimate();
      expect(est).not.toBeNull();
      expect(est?.usageMB).toBe("50.0");
      expect(est?.quotaMB).toBe("1000");
      expect(est?.percentUsed).toBe(5);
      expect(est?.isPersistent).toBe(true);
    });

    it("requests persistent storage successfully", async () => {
      const mockPersist = vi.fn().mockResolvedValue(true);
      const mockPersisted = vi.fn().mockResolvedValue(false);

      Object.defineProperty(globalThis, "navigator", {
        value: {
          storage: {
            persist: mockPersist,
            persisted: mockPersisted,
          },
        },
        configurable: true,
        writable: true,
      });

      const granted = await requestPersistentStorage();
      expect(granted).toBe(true);
      expect(mockPersist).toHaveBeenCalled();
    });
  });
});
