import express from 'express'
import chatRouter from './chat/chatRouter'
import imagesRouter from './images/imagesRouter'
import fileRouter from './files/fileRouter'
import bodyParser from 'body-parser'
import 'dotenv/config'
import cors from "cors";


const app = express()

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: "*",
  })
);
app.options("*", cors());

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())
app.use(express.json({limit: '50mb'}))


app.get('/', (req, res) => {
  res.send('Hello World!')
})

app.use('/chat', chatRouter)
app.use('/images', imagesRouter)
app.use('/files', fileRouter)

const PORT = process.env.PORT || 3050;

// Conditionally start the server only when NOT running on Vercel
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server started locally on port ${PORT}`);
  });
}

// Export the app instance for Vercel
export default app;
