const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Initialize Google Cloud Text-to-Speech client
let client;
try {
  // Get base64 encoded credentials from environment variable
  const base64Credentials = process.env.GOOGLE_TTS_API;
  if (!base64Credentials) {
    throw new Error('GOOGLE_TTS_API environment variable is required');
  }

  // Decode base64 credentials
  const credentials = JSON.parse(Buffer.from(base64Credentials, 'base64').toString());
  
  // Create client with decoded credentials
  client = new textToSpeech.TextToSpeechClient({
    credentials: credentials,
    projectId: credentials.project_id
  });

  console.log('Successfully initialized Google Cloud Text-to-Speech client');
} catch (error) {
  console.error('Error initializing Google Cloud Text-to-Speech client:', error);
  throw error;
}

// Text-to-Speech endpoint
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { text, language = 'vi-VN', voice = null, speed = 1.0 } = req.body;

    if (!text) {
      return res.status(400).json({ message: 'Text is required' });
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

    // Construct the request
    const request = {
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

    console.log('Sending request to Google Text-to-Speech...');
    
    // Perform the text-to-speech request
    const [response] = await client.synthesizeSpeech(request);
    
    if (!response.audioContent) {
      throw new Error('No audio content returned from Google TTS');
    }

    console.log('Successfully generated audio, size:', response.audioContent.length, 'bytes');

    // Set headers for audio response
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': response.audioContent.length,
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
    });

    // Send the audio content directly
    res.send(response.audioContent);

  } catch (error) {
    console.error('Text-to-speech error:', error);
    res.status(500).json({ 
      message: 'Error processing text to speech',
      error: error.message,
      details: error.details || null
    });
  }
});

// Get available voices endpoint
router.get('/voices', authenticateToken, async (req, res) => {
  try {
    const { languageCode = 'vi-VN' } = req.query;

    const [result] = await client.listVoices({
      languageCode: languageCode,
    });

    const voices = result.voices.map(voice => ({
      name: voice.name,
      gender: voice.ssmlGender,
      languageCodes: voice.languageCodes,
      naturalSampleRateHertz: voice.naturalSampleRateHertz,
    }));

    res.json({
      success: true,
      voices: voices,
      total: voices.length
    });

  } catch (error) {
    console.error('Error getting voices:', error);
    res.status(500).json({ 
      message: 'Error getting available voices',
      error: error.message
    });
  }
});

module.exports = router; 