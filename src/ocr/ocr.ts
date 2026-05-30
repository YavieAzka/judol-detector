import { createWorker } from "tesseract.js";

export async function detectTextFromImage(imageSrc: string): Promise<string> {
  let worker;
  try {
    worker = await createWorker("eng", 1, {
      workerPath: chrome.runtime.getURL("tesseract/worker.min.js"),
      corePath: chrome.runtime.getURL("tesseract/tesseract-core.wasm.js"),
      langPath: chrome.runtime.getURL("tesseract/"),
      workerBlobURL: false,
    });

    // Fetch the image as a Blob first to bypass CORS and avoid Tesseract's buggy base64 decoder
    let imageInput: Blob | string = imageSrc;
    try {
      const response = await fetch(imageSrc);
      if (response.ok) {
        imageInput = await response.blob();
      }
    } catch (fetchErr) {
      console.warn("Failed to fetch image as blob in offscreen, falling back to raw src:", fetchErr);
    }

    const { data: { text } } = await worker.recognize(imageInput);
    return text;
  } catch (error) {
    console.error("OCR failed for image:", imageSrc, error);
    return "";
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (err) {
        console.error("Failed to terminate worker:", err);
      }
    }
  }
}
export function detectSentences(text: string): string[] {
  if (!text) return [];
  return text
    .split(/[.!?\n\r]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}
