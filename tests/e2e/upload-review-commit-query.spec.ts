import { expect, test } from "@playwright/test";
import path from "node:path";

const fixture = path.join(__dirname, "fixtures", "invoice.txt");

test.setTimeout(120000);

test("upload extract json", async ({ page }) => {
  await page.goto("/upload");
  await expect(page.getByRole("heading", { name: "Drop a document to inspect it" })).toBeVisible();
  await page.getByTestId("file-input").setInputFiles(fixture);
  await expect(page.getByText("invoice.txt").or(page.locator(".reject-msg"))).toBeVisible({
    timeout: 30000,
  });
  await expect(page.getByText(/Done|Needs review|Needs manual entry|fields extracted/i)).toBeVisible({
    timeout: 60000,
  });
  await page.getByRole("button", { name: /invoice\.txt/ }).click();
  await expect(page.getByRole("button", { name: /Raw JSON/i })).toBeVisible({ timeout: 15000 });
  await page.getByRole("button", { name: /Raw JSON/i }).click();
  await expect(page.getByText(/"docType"|"email"/)).toBeVisible();
});
