import express from 'express'
import multer from 'multer'
import { gemini } from './gemini'

const upload = multer()

const router = express.Router()

router.post('/gemini', gemini)

export default router