import fs from "fs";
import path from "path";
import { baseHeaders } from "../utils";
import { Readable } from "stream";
import { v4 as uuid } from "uuid";
// import { Blob } from 'buffer'; // Uncomment if needed for older Node versions

export async function saveFileToOpenai(file: {
  buffer: Buffer;
  originalname: string;
}) {
  const uploadsDir = path.join(process.cwd(), "uploads");

  if (!fs.existsSync(uploadsDir)) {
    try {
      fs.mkdirSync(uploadsDir);
      console.log(
        `[saveFileToOpenai] Created uploads directory: ${uploadsDir}`
      );
    } catch (mkdirErr) {
      console.error(
        `[saveFileToOpenai] Failed to create uploads directory:`,
        mkdirErr
      );
      throw new Error(
        `Server setup error: could not create directory at ${uploadsDir}`
      );
    }
  }

  const uniqueFilename = `${uuid()}-${file.originalname}`;
  const filePath = path.join(uploadsDir, uniqueFilename);
  let fileWritten = false;

  try {
    console.log(`[saveFileToOpenai] Writing temporary file: ${filePath}`);
    await new Promise<void>((resolve, reject) => {
      const readableStream = new Readable({
        read() {
          this.push(file.buffer);
          this.push(null);
        },
      });
      const writeStream = fs.createWriteStream(filePath);

      readableStream.pipe(writeStream);

      writeStream.on("finish", () => {
        console.log(
          `[saveFileToOpenai] Finished writing temporary file: ${filePath}`
        );
        fileWritten = true;
        resolve();
      });

      writeStream.on("error", (err) => {
        console.error(
          `[saveFileToOpenai] Error writing temporary file ${filePath}:`,
          err
        );
        reject(err);
      });

      readableStream.on("error", (err) => {
        console.error(
          `[saveFileToOpenai] Error reading buffer stream for ${filePath}:`,
          err
        );
        reject(err);
      });
    });

    const fileBlob = new Blob([fs.readFileSync(filePath)]);
    const formData = new FormData();
    formData.append("purpose", "assistants");
    formData.append("file", fileBlob, file.originalname);

    console.log(
      `[saveFileToOpenai] Uploading ${file.originalname} (as ${uniqueFilename}) to OpenAI...`
    );
    const response = await fetch("https://api.openai.com/v1/files", {
      method: "POST",
      headers: {
        ...baseHeaders,
      },
      body: formData,
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error(
        `[saveFileToOpenai] OpenAI API error: ${response.status} ${response.statusText}`,
        responseData
      );
      throw new Error(
        `OpenAI API Error (${response.status}): ${
          responseData?.error?.message || JSON.stringify(responseData)
        }`
      );
    }

    console.log(
      `[saveFileToOpenai] OpenAI file upload successful:`,
      responseData
    );
    return responseData;
  } catch (err) {
    console.error(
      "[saveFileToOpenai] Overall error during file processing/upload:",
      err
    );
    throw err;
  } finally {
    if (fileWritten && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        console.log(
          `[saveFileToOpenai] Cleaned up temporary file: ${filePath}`
        );
      } catch (cleanupErr) {
        console.error(
          `[saveFileToOpenai] Error cleaning up temporary file ${filePath}:`,
          cleanupErr
        );
      }
    }
  }
}
