import { Request, Response } from "express"

export async function uploadFile(req: Request, res: Response) {
  try {
    const { prompt, codeInterpreter }  = req.body
    
    res.status(501).json({ error: "Not implemented" })
  } catch (err) {
    console.error('Error in file upload:', err)
    res.status(500).json({ error: "Server error" })
  }
}