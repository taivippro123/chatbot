const express = require('express');
const app = express.Router();
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const speech = require('@google-cloud/speech');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  }
});

// Initialize Google Cloud Speech client with credentials
let client;
try {
  // Get base64 encoded credentials from environment variable
  const base64Credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!base64Credentials) {
    throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable is required');
  }

  // Decode base64 credentials
  const credentials = JSON.parse(Buffer.from(base64Credentials, 'base64').toString());
  
  // Create client with decoded credentials
  client = new speech.SpeechClient({
    credentials: credentials,
    projectId: credentials.project_id
  });

  console.log('Successfully initialized Google Cloud Speech client');
} catch (error) {
  console.error('Error initializing Google Cloud Speech client:', error);
  throw error;
}

// Set ffmpeg path from ffmpeg-installer
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
console.log('FFmpeg path:', ffmpegInstaller.path);

// Convert audio buffer to linear16 format using ffmpeg
async function convertAudioToLinear16(inputBuffer) {
  return new Promise((resolve, reject) => {
    const tempInputPath = path.join(os.tmpdir(), `input-${Date.now()}.m4a`);
    const tempOutputPath = path.join(os.tmpdir(), `output-${Date.now()}.raw`);

    try {
      // Write input buffer to temporary file
      fs.writeFileSync(tempInputPath, inputBuffer);
      console.log('Audio file size:', inputBuffer.length, 'bytes');

      ffmpeg(tempInputPath)
        .toFormat('s16le')
        .audioChannels(1)
        .audioFrequency(16000)
        .on('start', (command) => {
          console.log('FFmpeg command:', command);
        })
        .on('progress', (progress) => {
          console.log('FFmpeg progress:', progress);
        })
        .on('end', () => {
          try {
            // Read the converted file
            const outputBuffer = fs.readFileSync(tempOutputPath);
            console.log('Converted audio size:', outputBuffer.length, 'bytes');
            
            // Clean up temporary files
            fs.unlinkSync(tempInputPath);
            fs.unlinkSync(tempOutputPath);
            
            resolve(outputBuffer);
          } catch (error) {
            console.error('Error reading converted file:', error);
            reject(error);
          }
        })
        .on('error', (err) => {
          console.error('FFmpeg conversion error:', err);
          // Clean up on error
          try {
            if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
            if (fs.existsSync(tempOutputPath)) fs.unlinkSync(tempOutputPath);
          } catch (cleanupError) {
            console.error('Error cleaning up temp files:', cleanupError);
          }
          reject(err);
        })
        .save(tempOutputPath);
    } catch (error) {
      console.error('Error in audio conversion:', error);
      reject(error);
    }
  });
}

// Speech to text endpoint
app.post('/', authenticateToken, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No audio file provided' });
    }

    console.log('Received audio file:', {
      mimetype: req.file.mimetype,
      size: req.file.size,
      language: req.body.language
    });

    // Convert audio to correct format
    const audioBuffer = await convertAudioToLinear16(req.file.buffer);

    // Configure request for Google Cloud Speech-to-Text
    const request = {
      audio: {
        content: audioBuffer.toString('base64'),
      },
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: req.body.language || 'vi-VN',
        alternativeLanguageCodes: ['en-US', 'vi-VN'],
        model: 'latest_long', // Use latest and most accurate model
        enableAutomaticPunctuation: true,
        useEnhanced: true,
        audioChannelCount: 1,
        enableWordTimeOffsets: false,
        profanityFilter: false,
        speechContexts: [{
          phrases: [
            // Common Vietnamese phrases
            'xin chào', 'cảm ơn', 'tạm biệt', 'làm ơn',
            // Common English phrases
            'hello', 'thank you', 'goodbye', 'please',
            // Add more common phrases in both languages as needed
          ],
          boost: 20 // Boost the recognition of these phrases
        }]
      },
    };

    console.log('Sending request to Google Speech-to-Text...');
    // Detect speech in audio file
    const [response] = await client.recognize(request);
    console.log('Google Speech-to-Text response:', JSON.stringify(response, null, 2));

    if (!response.results || response.results.length === 0) {
      throw new Error('No speech detected in the audio');
    }

    const transcription = response.results
      .map(result => {
        const transcript = result.alternatives[0].transcript;
        const confidence = result.alternatives[0].confidence;
        console.log(`Transcript: "${transcript}" (confidence: ${confidence})`);
        return transcript;
      })
      .join('\n');

    if (!transcription.trim()) {
      throw new Error('Empty transcription returned');
    }

    res.json({ 
      text: transcription,
      confidence: response.results[0].alternatives[0].confidence
    });
  } catch (error) {
    console.error('Speech-to-text error:', error);
    res.status(500).json({ 
      message: 'Error processing speech to text',
      error: error.message,
      details: error.details || null
    });
  }
});

module.exports = app; 