import { extractText, getDocumentProxy } from "unpdf";
import { normalizeExtractedText } from "@/server/ingestion/extractors/readability";

/** Returns null when the bytes are not a readable PDF or carry no extractable text layer. */
export async function extractPdfText(bytes: Uint8Array): Promise<string | null> {
  try {
    const document = await getDocumentProxy(bytes);
    const { text } = await extractText(document, { mergePages: true });
    const normalized = normalizeExtractedText(Array.isArray(text) ? text.join("\n") : text);
    return normalized || null;
  } catch {
    return null;
  }
}

export function isPdfSource(url: URL, contentType: string | null) {
  if (contentType?.toLowerCase().includes("application/pdf")) return true;
  return /\.pdf$/i.test(url.pathname);
}
