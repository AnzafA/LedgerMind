import fs from "fs";
import { extractText, getDocumentProxy } from "unpdf";

async function main() {
  const pdfPath = "C:\\path\\to\\your\\AccountStatement (9).pdf"; // <-- UPDATE THIS PATH
  
  if (!fs.existsSync(pdfPath)) {
    console.error("File not found:", pdfPath);
    process.exit(1);
  }

  const buffer = fs.readFileSync(pdfPath);
  const pdf = await getDocumentProxy(new Uint8Array(buffer));
  const { text } = await extractText(pdf, { mergePages: true });

  console.log("=== RAW PDF TEXT ===");
  console.log(text.substring(0, 3000)); // Print first 3000 chars
  console.log("=== END OF TEXT ===");
}

main().catch(console.error);