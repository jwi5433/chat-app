import fs from "fs";
import path from "path";
import { Readable } from "stream";
import { v4 as uuid } from "uuid";

export async function saveFileToOpenai(file: {
  buffer: Buffer;
  originalname: string;
}) {
  const uploadsDir = path.join(process.cwd(), "uploads");

  if (!fs.existsSync(uploadsDir)) {
    try {
      fs.mkdirSync(uploadsDir);
    } catch (mkdirErr) {
      console.error("Failed to create uploads directory:", mkdirErr);
      throw new Error(
        `Server setup error: could not create directory at ${uploadsDir}`
      );
    }
  }

  const uniqueFilename = `${uuid()}-${file.originalname}`;
  const filePath = path.join(uploadsDir, uniqueFilename);
  let fileWritten = false;

  try {
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
        fileWritten = true;
        resolve();
      });

      writeStream.on("error", (err) => {
        reject(err);
      });

      readableStream.on("error", (err) => {
        reject(err);
      });
    });

    const fileBlob = new Blob([fs.readFileSync(filePath)]);
    const formData = new FormData();
    formData.append("purpose", "assistants");
    formData.append("file", fileBlob, file.originalname);

    const response = await fetch("https://api.openai.com/v1/files", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: formData,
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error(
        `OpenAI API error: ${response.status} ${response.statusText}`,
        responseData
      );
      throw new Error(
        `OpenAI API Error (${response.status}): ${
          responseData?.error?.message || JSON.stringify(responseData)
        }`
      );
    }

    return responseData;
  } catch (err) {
    console.error("Error during file processing/upload:", err);
    throw err;
  } finally {
    if (fileWritten && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (cleanupErr) {
        console.error(`Error cleaning up temporary file ${filePath}:`, cleanupErr);
      }
    }
  }
}
