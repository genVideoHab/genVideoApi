import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { writeFile, readFile } from 'fs/promises'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import { getTTS, TTSAudioModel } from './getTTS.ts'
import { cors } from 'hono/cors'
import { serveStatic } from '@hono/node-server/serve-static'

const execAsync = promisify(exec)
const app = new Hono()

// Enable CORS for all routes
app.use('/*', cors())

// Serve static files from upload directory
app.use('/static/*', serveStatic({
    root: './upload',
    rewriteRequestPath: (path) =>
      path.replace(/^\/static/, ''), // Remove /static prefix to match actual directory
  }))

// Serve static files from upload directory directly
app.use('/upload/*', serveStatic({
    root: './upload',
    rewriteRequestPath: (path) =>
      path.replace(/^\/upload/, ''), // Remove /upload prefix to match actual directory
}))

app.post('/api/v1/users', async (c) => {
  const { name, email } = await c.req.json()
  console.log(name, email)
  return c.json({
    code: 200,
    data: {
      name,
      email
    },
    ts: new Date().getTime()
  })
})

app.post('/api/gen_audio_sub', async (c) => {
  try {
    const formData = await c.req.json()
    const audioUrl = formData.audioUrl
    console.log('Received audioUrl:', audioUrl)

    if (!audioUrl || typeof audioUrl !== 'string') {
      throw new HTTPException(400, { message: 'No audio URL provided' })
    }

    // Convert URL path to full file path
    const audioFilePath = `/Users/jiashuoshi/Desktop/code/make_video/gen_audio_api/upload/${audioUrl}`
    console.log('Audio file path:', audioFilePath)

    // Extract filename from URL
    const fileName = path.basename(audioUrl)
    const wavFileName = fileName.replace(/\.mp3$/i, '.wav')
    const finalFilePath = `/Users/jiashuoshi/Desktop/code/make_video/gen_audio_api/public/${wavFileName}`
    console.log('Final file path:', finalFilePath)

    // If it's an MP3 file, convert it to WAV
    if (fileName.toLowerCase().endsWith('.mp3')) {
      try {
        await execAsync(`ffmpeg -i "${audioFilePath}" -ar 16000 "${finalFilePath}" -y`)
        console.log("Converted MP3 to WAV successfully")
      } catch (error) {
        console.error('Error converting MP3 to WAV:', error)
        throw new HTTPException(500, { message: 'Error converting audio file' })
      }
    }

    // Execute sub.mjs
    try {
      const { stdout, stderr } = await execAsync('node sub.mjs')
      console.log('Script output:', stdout)
      if (stderr) console.error('Script error:', stderr)
    } catch (error) {
      console.error('Error executing sub.mjs:', error)
      throw new HTTPException(500, { message: 'Error processing audio file' })
    }

    // Get the JSON file path and read its content
    const jsonFilePath = finalFilePath.replace(/\.(wav|mp3)$/i, '.json')
    const jsonContent = await readFile(jsonFilePath, 'utf-8')
    const jsonData = JSON.parse(jsonContent)
    
    return c.json({
      code: 200,
      data: {
        filename: path.basename(finalFilePath),
        savedPath: finalFilePath,
        subJson: jsonData
      },
      ts: new Date().getTime()
    })
  } catch (error) {
    console.error('Error in gen_audio_sub:', error)
    if (error instanceof HTTPException) {
      throw error
    }
    throw new HTTPException(500, { message: 'Internal server error' })
  }
})

app.post('/api/text_to_audio', async (c) => {
  try {
    const formData = await c.req.json()
    const { text, audioModel = TTSAudioModel.P_8, speedRatio = 1.25 } = formData

    if (!text || typeof text !== 'string') {
      throw new HTTPException(400, { message: 'No text provided' })
    }

    // Get TTS audio
    const ttsResponse = await getTTS({
      text,
      audioModel, // Use the provided audioModel or default to P_8
      speedRatio // Use the provided speedRatio or default to 1.25
    })

    // Convert base64 to binary and save to local file
    const audioBuffer = Buffer.from(ttsResponse.data, 'base64')
    const timestamp = new Date().getTime()
    const audioFilePath = `./upload/tts_${timestamp}.mp3`
    
    await writeFile(audioFilePath, audioBuffer)

    // Generate URL for the saved file
    const audioUrl = `tts_${timestamp}.mp3`
    
    return c.json({
      code: 200,
      data: {
        duration: ttsResponse.addition.duration,
        audioUrl: audioUrl
      },
      ts: new Date().getTime()
    })
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error
    }
    console.error('Error in text_to_audio:', error)
    throw new HTTPException(500, { message: 'Error generating audio' })
  }
})

serve({
  fetch: app.fetch,
  port: 4000
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
