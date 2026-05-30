import { detectTextFromImage } from "../ocr/ocr.js";

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === "offscreen" && message.action === "RUN_OCR") {
    detectTextFromImage(message.imageSrc)
      .then((text) => {
        chrome.runtime.sendMessage({
          action: "OCR_RESULT",
          imageSrc: message.imageSrc,
          text: text
        });
      })
      .catch((error) => {
        console.error("Offscreen OCR error:", error);
        chrome.runtime.sendMessage({
          action: "OCR_RESULT",
          imageSrc: message.imageSrc,
          text: ""
        });
      });
  }
});
