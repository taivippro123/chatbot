const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const axios = require('axios');

// Text-to-Speech endpoint using Google TTS REST API
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { text, language = 'vi-VN', voice = null, speed = 1.0 } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'Text is required' });
    }

    const googleTTSAPI = process.env.GOOGLE_TTS_API;
    if (!googleTTSAPI) {
      return res.status(500).json({ message: 'Google TTS API key not configured' });
    }

    console.log('TTS Request:', { text: text.substring(0, 100), language, voice, speed });

    // Configure voice settings based on language
    let voiceName, voiceGender;
    
    if (language.startsWith('vi')) {
      voiceName = voice || 'vi-VN-Standard-A'; // Vietnamese female voice
      voiceGender = 'FEMALE';
    } else if (language.startsWith('en')) {
      voiceName = voice || 'en-US-Standard-C'; // English female voice  
      voiceGender = 'FEMALE';
    } else {
      voiceName = voice || 'en-US-Standard-C';
      voiceGender = 'FEMALE';
    }

    // Construct the request for Google TTS REST API
    const requestData = {
      input: { text: text },
      voice: {
        languageCode: language,
        name: voiceName,
        ssmlGender: voiceGender,
      },
      audioConfig: {
        audioEncoding: 'MP3',
        speakingRate: speed,
        pitch: 0.0,
        volumeGainDb: 0.0,
        sampleRateHertz: 24000,
      },
    };

    console.log('Sending request to Google Text-to-Speech REST API...');
    
    // Make request to Google TTS REST API
    const response = await axios.post(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleTTSAPI}`,
      requestData,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000, // 30 seconds timeout
      }
    );

    if (!response.data || !response.data.audioContent) {
      throw new Error('No audio content returned from Google TTS');
    }

    // Decode base64 audio content
    const audioBuffer = Buffer.from(response.data.audioContent, 'base64');
    
    console.log('Successfully generated audio, size:', audioBuffer.length, 'bytes');

    // Set headers for audio response
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': audioBuffer.length,
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    });

    // Send the audio content
    res.send(audioBuffer);

  } catch (error) {
    console.error('Text-to-speech error:', error);
    
    let errorMessage = 'Error processing text to speech';
    let statusCode = 500;
    
    if (error.response) {
      // Google API error
      statusCode = error.response.status;
      errorMessage = error.response.data?.error?.message || error.message;
      
      if (statusCode === 400) {
        errorMessage = 'Invalid request parameters';
      } else if (statusCode === 403) {
        errorMessage = 'API key invalid or quota exceeded';
      } else if (statusCode === 429) {
        errorMessage = 'Too many requests, please try again later';
      }
    }
    
    res.status(statusCode).json({ 
      message: errorMessage,
      error: error.message,
    });
  }
});

// Get available voices endpoint
router.get('/voices', authenticateToken, async (req, res) => {
  try {
    const { languageCode = 'vi-VN' } = req.query;
    
    const googleTTSAPI = process.env.GOOGLE_TTS_API;
    if (!googleTTSAPI) {
      return res.status(500).json({ message: 'Google TTS API key not configured' });
    }

    console.log('Getting available voices for language:', languageCode);

    // Make request to Google TTS REST API for voices
    const response = await axios.get(
      `https://texttospeech.googleapis.com/v1/voices?key=${googleTTSAPI}&languageCode=${languageCode}`,
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000, // 10 seconds timeout
      }
    );

    if (!response.data || !response.data.voices) {
      throw new Error('No voices data returned from Google TTS');
    }

    const voices = response.data.voices.map(voice => ({
      name: voice.name,
      gender: voice.ssmlGender,
      languageCodes: voice.languageCodes,
      naturalSampleRateHertz: voice.naturalSampleRateHertz,
    }));

    console.log(`Found ${voices.length} voices for ${languageCode}`);

    res.json({
      success: true,
      voices: voices,
      total: voices.length
    });

  } catch (error) {
    console.error('Error getting voices:', error);
    
    let errorMessage = 'Error getting available voices';
    let statusCode = 500;
    
    if (error.response) {
      statusCode = error.response.status;
      errorMessage = error.response.data?.error?.message || error.message;
    }
    
    res.status(statusCode).json({ 
      message: errorMessage,
      error: error.message
    });
  }
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Text-to-Speech',
    timestamp: new Date().toISOString(),
    apiConfigured: !!process.env.GOOGLE_TTS_API
  });
});

module.exports = router; 