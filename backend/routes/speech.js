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

// Decode base64 credentials and create a temporary credentials file
const tempCredentialsPath = path.join(os.tmpdir(), 'google-credentials.json');
const base64Credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
if (!base64Credentials) {
  throw new Error('GOOGLE_APPLICATION_CREDENTIALS environment variable is required');
}
try {
  const credentialsJson = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  fs.writeFileSync(tempCredentialsPath, credentialsJson);
  console.log('Decoded Google credentials and saved to temporary file');
} catch (error) {
  console.error('Error decoding Google credentials:', error);
  throw error;
}

// Create a client for Google Cloud Speech-to-Text
const client = new speech.SpeechClient({
  keyFilename: tempCredentialsPath
});

// Clean up credentials file when the process exits
process.on('exit', () => {
  try {
    if (fs.existsSync(tempCredentialsPath)) {
      fs.unlinkSync(tempCredentialsPath);
      console.log('Cleaned up temporary credentials file');
    }
  } catch (error) {
    console.error('Error cleaning up credentials file:', error);
  }
});

// Also clean up on unhandled errors
process.on('uncaughtException', () => {
  if (fs.existsSync(tempCredentialsPath)) {
    fs.unlinkSync(tempCredentialsPath);
  }
});

process.on('SIGINT', () => {
  if (fs.existsSync(tempCredentialsPath)) {
    fs.unlinkSync(tempCredentialsPath);
  }
  process.exit();
});

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
        alternativeLanguageCodes: ['en-US'],
        model: 'default',
        enableAutomaticPunctuation: true,
        useEnhanced: true, // Use enhanced model
        audioChannelCount: 1,
        enableWordTimeOffsets: false,
        profanityFilter: false,
        speechContexts: [{
          phrases: ['hello', 'hi', 'xin chào', 'tạm biệt']
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