import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  ActivityIndicator, 
  TouchableOpacity, 
  StyleSheet, 
  Dimensions,
  ScrollView,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import { API_URL } from '../config/api';
import Header from './Header';

const { width, height } = Dimensions.get('window');

// TTS Queue System for sequential speech
class TTSQueue {
  constructor() {
    this.queue = [];
    this.isPlaying = false;
    this.currentAudio = null;
    this.isPaused = false;
    this.onComplete = null;
    this.onPause = null;
    this.onResume = null;
  }

  async speak(text, options = {}) {
    return new Promise((resolve, reject) => {
      this.queue.push({ text, options, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.isPlaying || this.queue.length === 0) return;
    
    this.isPlaying = true;
    const { text, options, resolve, reject } = this.queue.shift();
    
    try {
      await this.playSpeech(text, options);
      resolve();
      this.isPlaying = false;
      
      // Process next item in queue after a short delay
      setTimeout(() => this.processQueue(), 500);
    } catch (error) {
      console.warn('TTS failed for text:', text.substring(0, 50));
      // Try fallback with expo-speech if available
      try {
        if (Speech && Speech.speak) {
          console.log('Falling back to expo-speech');
          await Speech.speak(text, {
            language: options.language || 'vi',
            rate: options.speed || 1.0,
          });
          resolve();
        } else {
          throw new Error('No fallback TTS available');
        }
      } catch (fallbackError) {
        console.error('Fallback TTS also failed:', fallbackError);
        resolve(); // Continue with queue even if TTS fails
      }
      
      this.isPlaying = false;
      setTimeout(() => this.processQueue(), 500);
    }
  }

  async playSpeech(text, options = {}) {
    try {
      if (!text || text.trim() === '') return;

      const { language = 'vi-VN', speed = 1.0, token } = options;
      
      console.log('TTS Request:', { text: text.substring(0, 50) + '...', language, speed });

      const response = await fetch(`${API_URL}/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          text,
          language,
          speed,
        }),
      });

      if (!response.ok) {
        throw new Error(`TTS API failed: ${response.status}`);
      }

      // Get response as array buffer and convert to base64 for React Native
      const arrayBuffer = await response.arrayBuffer();
      const base64Audio = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      
      const audioUri = `data:audio/mpeg;base64,${base64Audio}`;
      
      // Create and play audio using Expo Audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true, volume: 1.0 }
      );

      this.currentAudio = sound;
      console.log('TTS Audio playing successfully');
      
      return new Promise((resolve, reject) => {
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            sound.unloadAsync().catch(() => {}); // Ignore unload errors
            this.currentAudio = null;
            resolve();
          }
          if (status.error) {
            sound.unloadAsync().catch(() => {}); // Ignore unload errors
            this.currentAudio = null;
            reject(new Error('Audio playback error'));
          }
        });
      });

    } catch (error) {
      console.error('Custom TTS Error:', error);
      // Don't show alert for every TTS error, just log it
      console.warn('TTS Error details:', error.message);
      throw error;
    }
  }

  async pause() {
    if (this.currentAudio && !this.isPaused) {
      await this.currentAudio.pauseAsync();
      this.isPaused = true;
      if (this.onPause) this.onPause();
    }
  }

  async resume() {
    if (this.currentAudio && this.isPaused) {
      await this.currentAudio.playAsync();
      this.isPaused = false;
      if (this.onResume) this.onResume();
    }
  }

  stop() {
    this.queue = [];
    this.isPlaying = false;
    if (this.currentAudio) {
      this.currentAudio.stopAsync().catch(() => {});
      this.currentAudio.unloadAsync().catch(() => {});
      this.currentAudio = null;
    }
    this.isPaused = false;
    
    // Also stop expo-speech if available
    if (Speech && Speech.stop) {
      Speech.stop();
    }
  }

  clear() {
    this.queue = [];
  }
}

const NewsReaderScreen = ({ theme, token, t, onLogout, onSettingsPress }) => {
  const [articles, setArticles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [selectedArticleIndex, setSelectedArticleIndex] = useState(null);
  const [isContinuousListening, setIsContinuousListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const [isTTSPaused, setIsTTSPaused] = useState(false);
  const [audioInitialized, setAudioInitialized] = useState(false);
  const sound = useRef(new Audio.Sound());
  const recording = useRef(null);
  const continuousRecording = useRef(null);
  const ttsQueue = useRef(new TTSQueue());
  const isDark = theme === 'dark';

  // Initialize audio system
  const initializeAudio = async () => {
    try {
      console.log('Initializing audio system...');
      
      // Set audio mode for optimal performance
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_MIX_WITH_OTHERS,
        shouldDuckAndroid: true,
        interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DUCK_OTHERS,
        playThroughEarpieceAndroid: false,
      });
      
      setAudioInitialized(true);
      console.log('Audio system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize audio:', error);
      // Continue without audio initialization
      setAudioInitialized(true);
    }
  };

  // Setup TTS callbacks
  useEffect(() => {
    initializeAudio();
    
    ttsQueue.current.onPause = () => setIsTTSPaused(true);
    ttsQueue.current.onResume = () => setIsTTSPaused(false);
    
    return () => {
      // Cleanup on unmount
      ttsQueue.current.stop();
      if (continuousRecording.current) {
        continuousRecording.current.stopAndUnloadAsync().catch(() => {});
      }
      if (recording.current) {
        recording.current.stopAndUnloadAsync().catch(() => {});
      }
      if (sound.current) {
        sound.current.unloadAsync().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (audioInitialized) {
      fetchNews();
    }
  }, [audioInitialized]);

  // Lấy ngày tháng hiện tại
  const getCurrentDate = () => {
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    
    return t.language === 'vi' 
      ? `ngày ${day} tháng ${month} năm ${year}`
      : `${month}/${day}/${year}`;
  };

  // Lấy danh sách bài viết từ backend
  const fetchNews = async () => {
    try {
      setIsLoadingNews(true);
      const res = await axios.get(`${API_URL}/news`); 
      setArticles(res.data);

      console.log('News data received:', res.data);

      if (res.data.length > 0) {
        // Dừng tất cả TTS trước đó
        ttsQueue.current.stop();
        
        // Hiển thị articles ngay lập tức
        setIsLoadingNews(false);
        
        // Sequence: Welcome -> List articles -> Ask for selection -> Start listening
        await speakWelcomeSequence(res.data);
      }
    } catch (err) {
      console.error('Fetch news failed', err);
      await ttsQueue.current.speak('Không thể tải tin tức. Vui lòng thử lại.', { 
        language: 'vi-VN', 
        token 
      });
      setIsLoadingNews(false);
    }
  };

  const speakWelcomeSequence = async (newsData) => {
    try {
      setIsTTSPlaying(true);
      
      // 1. Welcome message
      const currentDate = getCurrentDate();
      const welcomeText = `Tôi là trợ lý đọc tin tức, hôm nay ${currentDate} có các tin tức nóng sau:`;
      await ttsQueue.current.speak(welcomeText, { language: 'vi-VN', token });
      
      // 2. Đọc danh sách 5 tin mới nhất
      const maxArticles = Math.min(5, newsData.length);
      for (let i = 0; i < maxArticles; i++) {
        const articleText = `Tin số ${i + 1}: ${newsData[i].title}`;
        await ttsQueue.current.speak(articleText, { language: 'vi-VN', token });
      }
      
      // 3. Hỏi user chọn
      const askText = 'Bạn muốn nghe tin nào? Có thể nói tin số 1, tin số 2, hoặc các lệnh điều khiển như dừng, tiếp tục.';
      await ttsQueue.current.speak(askText, { language: 'vi-VN', token });
      
      setIsTTSPlaying(false);
      
      // 4. Start continuous listening
      setTimeout(() => {
        startContinuousListening();
      }, 1000);
      
    } catch (error) {
      console.error('Error in welcome sequence:', error);
      setIsTTSPlaying(false);
    }
  };

  // Chọn bài báo bằng index
  const selectArticle = async (index) => {
    if (index >= 0 && index < articles.length) {
      // Stop all current speech and listening
      ttsQueue.current.stop();
      stopContinuousListening();
      
      setSelectedArticleIndex(index);
      setSelected(articles[index]);
      setIsTTSPlaying(true);
      
      try {
        const selectedText = `Đã chọn tin số ${index + 1}: ${articles[index].title}`;
        await ttsQueue.current.speak(selectedText, { language: 'vi-VN', token });
        
        // Auto-play audio sau khi thông báo
        await playNewsAudio(index);
        
      } catch (error) {
        console.error('Error selecting article:', error);
        setIsTTSPlaying(false);
      }
    }
  };

  // Lấy audio URL và phát
  const playNewsAudio = async (articleIndex) => {
    try {
      const article = articles[articleIndex];
      setSelected(article);
      setSelectedArticleIndex(articleIndex);
      
      console.log('Playing article:', article);
      
      const loadingText = `Đang tải audio tin số ${articleIndex + 1}`;
      await ttsQueue.current.speak(loadingText, { language: 'vi-VN', token });
      
      const res = await axios.get(`${API_URL}/news/audio`, {
        params: { url: article.url },
      });

      console.log('Audio response:', res.data);

      const audioUrl = res.data.audioUrl;
      if (!audioUrl) {
        const noAudioText = "Tin này không có file âm thanh, sẽ đọc nội dung bằng giọng nói";
        await ttsQueue.current.speak(noAudioText, { language: 'vi-VN', token });
        
        // Fallback: đọc title bằng TTS
        await ttsQueue.current.speak(article.title, { language: 'vi-VN', token });
        
        setIsTTSPlaying(false);
        setTimeout(() => {
          startContinuousListening();
        }, 1000);
        return;
      }

      await sound.current.unloadAsync();
      await sound.current.loadAsync({ uri: audioUrl });
      await sound.current.playAsync();
      setIsPlaying(true);
      setIsTTSPlaying(false);
      
      // Start continuous listening khi bắt đầu phát audio
      setTimeout(() => {
        startContinuousListening();
      }, 2000);
      
      // Listen for audio completion
      sound.current.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsPlaying(false);
          stopContinuousListening();
          
          const finishedText = 'Đã phát xong tin này. Bạn có thể chọn tin khác.';
          ttsQueue.current.speak(finishedText, { language: 'vi-VN', token }).then(() => {
            setTimeout(() => {
              startContinuousListening();
            }, 1000);
          });
        }
      });
      
    } catch (err) {
      console.error('Error playing audio', err);
      const errorText = `Không thể phát audio tin này. Sẽ đọc bằng giọng nói.`;
      await ttsQueue.current.speak(errorText, { language: 'vi-VN', token });
      
      // Fallback: đọc title bằng TTS khi có lỗi
      await ttsQueue.current.speak(articles[articleIndex].title, { language: 'vi-VN', token });
      
      setIsTTSPlaying(false);
      setTimeout(() => {
        startContinuousListening();
      }, 1000);
    }
  };

  // Dừng và tiếp tục TTS
  const pauseTTS = async () => {
    if (isTTSPlaying && !isTTSPaused) {
      await ttsQueue.current.pause();
    }
  };
  
  const resumeTTS = async () => {
    if (isTTSPlaying && isTTSPaused) {
      await ttsQueue.current.resume();
    }
  };

  // Dừng và tiếp tục Audio
  const pauseAudio = async () => {
    await sound.current.pauseAsync();
    setIsPlaying(false);
  };
  
  const resumeAudio = async () => {
    await sound.current.playAsync();
    setIsPlaying(true);
    if (!isContinuousListening) {
      setTimeout(() => {
        startContinuousListening();
      }, 1000);
    }
  };

  // Simple similarity calculation
  const calculateSimilarity = (str1, str2) => {
    const words1 = str1.split(' ');
    const words2 = str2.split(' ');
    const commonWords = words1.filter(word => words2.some(w => w.includes(word) || word.includes(w)));
    return commonWords.length / Math.max(words1.length, words2.length);
  };

  // Continuous listening functions
  const startContinuousListening = async () => {
    if (isContinuousListening) return;
    
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') return;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync({
        ...Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY,
        android: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_ANDROID_OUTPUT_FORMAT_MPEG_4,
          audioEncoder: Audio.RECORDING_OPTION_ANDROID_AUDIO_ENCODER_AAC,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.RECORDING_OPTION_IOS_OUTPUT_FORMAT_MPEG4AAC,
          audioQuality: Audio.RECORDING_OPTION_IOS_AUDIO_QUALITY_MEDIUM,
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
      });

      continuousRecording.current = recording;
      setIsContinuousListening(true);

      // Monitor audio levels
      recording.setOnRecordingStatusUpdate((status) => {
        if (status.metering) {
          setAudioLevel(status.metering);
        }
      });

      // Auto-process after 3 seconds of recording
      setTimeout(() => {
        if (isContinuousListening) {
          processContinuousRecording();
        }
      }, 3000);

    } catch (err) {
      console.error('Failed to start continuous listening:', err);
    }
  };

  const processContinuousRecording = async () => {
    if (!continuousRecording.current) return;

    try {
      await continuousRecording.current.stopAndUnloadAsync();
      const uri = continuousRecording.current.getURI();
      continuousRecording.current = null;
      setIsContinuousListening(false);

      // Check if there was significant audio input
      if (audioLevel > -40) { // Threshold for detecting speech
        await sendAudioForProcessing(uri, true); // true = continuous mode
      } else {
        console.log('No significant audio detected, not sending to API');
        // Restart continuous listening after a short delay
        setTimeout(() => {
          if (!isRecording) { // Only restart if not manually recording
            startContinuousListening();
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error processing continuous recording:', error);
      setIsContinuousListening(false);
    }
  };

  const stopContinuousListening = () => {
    if (continuousRecording.current) {
      continuousRecording.current.stopAndUnloadAsync();
      continuousRecording.current = null;
    }
    setIsContinuousListening(false);
  };

  // Enhanced voice command processing
  const processVoiceCommand = (text, isContinuous = false) => {
    const lowerText = text.toLowerCase().trim();
    console.log('Processing voice command:', lowerText, 'Continuous:', isContinuous);
    
    // Control commands - chỉ sử dụng tiếng Việt
    const controlCommands = {
      stop: ['dừng', 'tạm dừng', 'pause'],
      continue: ['tiếp tục', 'phát', 'play'],
      next: ['tin tiếp theo', 'bài tiếp theo', 'next'],
      previous: ['tin trước', 'bài trước', 'previous'],
      repeat: ['lặp lại', 'đọc lại', 'repeat']
    };

    // Check for control commands first
    for (const [action, keywords] of Object.entries(controlCommands)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        executeControlCommand(action);
        
        // Restart continuous listening after control command
        if (isContinuous) {
          setTimeout(() => startContinuousListening(), 1000);
        }
        return;
      }
    }

    // Check for number patterns (tin số X, bài số X)
    const numberPatterns = [
      /tin\s*số\s*(\d+)/,
      /bài\s*số\s*(\d+)/,
      /số\s*(\d+)/,
      /^(\d+)$/
    ];

    for (const pattern of numberPatterns) {
      const match = lowerText.match(pattern);
      if (match) {
        const articleNumber = parseInt(match[1]);
        if (articleNumber >= 1 && articleNumber <= articles.length) {
          console.log('Found article by number:', articleNumber);
          selectArticle(articleNumber - 1);
          
          // Don't restart continuous listening when selecting article
          return;
        }
      }
    }

    // If continuous mode and no command found, restart listening
    if (isContinuous) {
      setTimeout(() => startContinuousListening(), 1000);
    } else {
      // Handle article selection by keywords (for manual commands)
      handleArticleSelection(lowerText);
    }
  };

  const executeControlCommand = async (action) => {
    switch (action) {
      case 'stop':
        if (isPlaying) {
          await pauseAudio();
          await ttsQueue.current.speak('Đã tạm dừng', { language: 'vi-VN', token });
        } else if (isTTSPlaying) {
          await pauseTTS();
          await ttsQueue.current.speak('Đã tạm dừng', { language: 'vi-VN', token });
        }
        break;
      case 'continue':
        if (!isPlaying && selected) {
          await resumeAudio();
          await ttsQueue.current.speak('Tiếp tục phát', { language: 'vi-VN', token });
        } else if (isTTSPaused) {
          await resumeTTS();
        }
        break;
      case 'next':
        if (selectedArticleIndex !== null && selectedArticleIndex < articles.length - 1) {
          await selectArticle(selectedArticleIndex + 1);
        } else {
          await ttsQueue.current.speak('Đây là tin cuối cùng', { language: 'vi-VN', token });
        }
        break;
      case 'previous':
        if (selectedArticleIndex !== null && selectedArticleIndex > 0) {
          await selectArticle(selectedArticleIndex - 1);
        } else {
          await ttsQueue.current.speak('Đây là tin đầu tiên', { language: 'vi-VN', token });
        }
        break;
      case 'repeat':
        if (selectedArticleIndex !== null) {
          await selectArticle(selectedArticleIndex);
        } else {
          await ttsQueue.current.speak('Chưa chọn tin nào để lặp lại', { language: 'vi-VN', token });
        }
        break;
    }
  };

  const handleArticleSelection = async (lowerText) => {
    // Enhanced keyword matching cho tiếng Việt
    const vietnameseKeywords = {
      'mỹ': ['mỹ', 'america', 'usa'],
      'việt nam': ['việt nam', 'vietnam'],
      'trump': ['trump', 'ông trump'],
      'iran': ['iran'],
      'thái lan': ['thái lan', 'thailand'],
      'tàu': ['tàu', 'tau'],
      'cảnh sát': ['cảnh sát', 'canh sat'],
      'bắt': ['bắt', 'bat'],
      'đường sắt': ['đường sắt', 'duong sat', 'đường ray'],
      'xe ôm': ['xe ôm', 'xe om', 'grab'],
      'hun sen': ['hun sen']
    };

    let bestMatch = null;
    let highestScore = 0;

    articles.forEach((article, index) => {
      const articleTitle = article.title.toLowerCase();
      let score = 0;

      // Calculate similarity
      score += calculateSimilarity(lowerText, articleTitle) * 10;

      // Check keywords
      Object.keys(vietnameseKeywords).forEach(keyword => {
        if (articleTitle.includes(keyword)) {
          vietnameseKeywords[keyword].forEach(variant => {
            if (lowerText.includes(variant)) {
              score += 5;
            }
          });
        }
      });

      // Check word matches
      const voiceWords = lowerText.split(' ');
      const titleWords = articleTitle.split(' ');
      
      voiceWords.forEach(voiceWord => {
        if (voiceWord.length > 2) {
          titleWords.forEach(titleWord => {
            if (titleWord.includes(voiceWord) || voiceWord.includes(titleWord)) {
              score += 2;
            }
          });
        }
      });

      if (score > highestScore) {
        highestScore = score;
        bestMatch = { article, index };
      }
    });

    if (bestMatch && highestScore > 3) {
      await selectArticle(bestMatch.index);
    } else {
      await ttsQueue.current.speak('Không tìm thấy bài báo phù hợp. Thử nói tin số mấy.', { 
        language: 'vi-VN', 
        token 
      });
    }
  };

  // Voice recording handlers (manual)
  const handleRecordPress = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording();
    }
  };

  const startRecording = async () => {
    try {
      // Stop continuous listening khi recording thủ công
      stopContinuousListening();
      
      const permission = await Audio.requestPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission Required', 'Cần quyền truy cập microphone để ghi âm');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY
      );
      recording.current = recording;
      setIsRecording(true);

      await ttsQueue.current.speak('Đang ghi âm... Nói tin số mấy hoặc lệnh điều khiển', { 
        language: 'vi-VN', 
        token 
      });
    } catch (err) {
      console.error('Failed to start recording:', err);
      Alert.alert('Error', 'Không thể bắt đầu ghi âm');
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      if (recording.current) {
        await recording.current.stopAndUnloadAsync();
        const uri = recording.current.getURI();
        recording.current = null;
        
        // Send audio to speech-to-text API (manual mode)
        await sendAudioForProcessing(uri, false);
      }
    } catch (error) {
      console.error('Failed to stop recording:', error);
      Alert.alert('Error', 'Không thể dừng ghi âm');
    }
  };

  // Send audio to speech-to-text API
  const sendAudioForProcessing = async (audioUri, isContinuous = false) => {
    try {
      // Read the audio file and convert to base64
      const response = await fetch(audioUri);
      const blob = await response.blob();
      const base64Audio = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = reader.result.split(',')[1]; // Remove data:audio/m4a;base64, prefix
          resolve(base64Data);
        };
        reader.readAsDataURL(blob);
      });

      const requestBody = {
        audio: base64Audio,
        language: 'vi-VN' // Luôn sử dụng tiếng Việt
      };

      const response2 = await fetch(`${API_URL}/speech`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response2.ok) {
        throw new Error('Speech-to-text request failed');
      }

      const data = await response2.json();
      console.log('Speech recognition result:', data);

      if (data.text) {
        // Process the voice command
        processVoiceCommand(data.text, isContinuous);
      } else {
        await ttsQueue.current.speak('Không nhận diện được giọng nói. Vui lòng thử lại.', { 
          language: 'vi-VN', 
          token 
        });
        
        // Restart continuous listening if continuous mode
        if (isContinuous) {
          setTimeout(() => startContinuousListening(), 1000);
        }
      }
    } catch (error) {
      console.error('Error processing speech:', error);
      await ttsQueue.current.speak('Lỗi xử lý giọng nói. Vui lòng thử lại.', { 
        language: 'vi-VN', 
        token 
      });
      
      // Restart continuous listening if continuous mode
      if (isContinuous) {
        setTimeout(() => startContinuousListening(), 1000);
      }
    }
  };

  return (
    <View style={[
      styles.container,
      { backgroundColor: isDark ? '#343541' : '#ffffff' }
    ]}>
      <Header
        theme={theme}
        title={t.newsReader || 'News Reader'}
        onMenuPress={() => {}} // No sidebar in news reader
        onLogout={onLogout}
        onSettingsPress={onSettingsPress}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[
          styles.newsContainer,
          { backgroundColor: isDark ? '#202123' : '#f5f5f5' }
        ]}>
          <Text style={[
            styles.title,
            { color: isDark ? '#fff' : '#000' }
          ]}>
            {t.newsReader || 'Tin tức mới nhất'}
          </Text>
          
          {isLoadingNews ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={isDark ? '#fff' : '#007AFF'} />
              <Text style={[
                styles.loadingText,
                { color: isDark ? '#ccc' : '#666' }
              ]}>
                Đang tải tin tức...
              </Text>
            </View>
          ) : !audioInitialized ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={isDark ? '#fff' : '#007AFF'} />
              <Text style={[
                styles.loadingText,
                { color: isDark ? '#ccc' : '#666' }
              ]}>
                Đang khởi tạo hệ thống âm thanh...
              </Text>
            </View>
          ) : (
            <>
              {selected && (
                <View style={[
                  styles.selectedContainer,
                  { backgroundColor: isDark ? '#2C2C2E' : '#E3F2FD' }
                ]}>
                  <Text style={[
                    styles.selectedLabel,
                    { color: isDark ? '#4CAF50' : '#1976D2' }
                  ]}>
                    Đang phát:
                  </Text>
                  <Text style={[
                    styles.selectedTitle,
                    { color: isDark ? '#fff' : '#000' }
                  ]}>
                    {selected.title}
                  </Text>
                  <View style={styles.audioControls}>
                    <TouchableOpacity
                      style={[styles.controlButton, { backgroundColor: isDark ? '#4CAF50' : '#2196F3' }]}
                      onPress={isPlaying ? pauseAudio : resumeAudio}
                    >
                      <Ionicons
                        name={isPlaying ? "pause" : "play"}
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.controlButtonText}>
                        {isPlaying ? 'Dừng' : 'Phát'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* Article List */}
              <View style={styles.articleList}>
                <Text style={[
                  styles.sectionTitle,
                  { color: isDark ? '#fff' : '#000' }
                ]}>
                  Danh sách bài báo ({articles.length} bài):
                </Text>
                <Text style={[
                  styles.instructionText,
                  { color: isDark ? '#888' : '#666' }
                ]}>
                  Nhấn vào bài báo hoặc nói "Tin số X" để chọn
                </Text>
                {articles.map((article, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.articleItem,
                      selectedArticleIndex === index && styles.selectedArticleItem,
                      { 
                        backgroundColor: selectedArticleIndex === index 
                          ? (isDark ? '#2C2C2E' : '#E3F2FD')
                          : (isDark ? '#1E1E1E' : '#fff'),
                        borderColor: isDark ? '#333' : '#E0E0E0'
                      }
                    ]}
                    onPress={() => selectArticle(index)}
                    disabled={isTTSPlaying && !isTTSPaused}
                  >
                    <View style={styles.articleRow}>
                      <View style={[
                        styles.articleNumber,
                        { backgroundColor: selectedArticleIndex === index ? '#4CAF50' : (isDark ? '#4CAF50' : '#2196F3') }
                      ]}>
                        <Text style={[
                          styles.articleNumberText,
                          { color: '#fff' }
                        ]}>
                          {index + 1}
                        </Text>
                      </View>
                      <View style={styles.articleContent}>
                        <Text style={[
                          styles.articleTitle,
                          { color: isDark ? '#fff' : '#000' }
                        ]} numberOfLines={3}>
                          {article.title}
                        </Text>
                      </View>
                      {selectedArticleIndex === index && (
                        <Ionicons
                          name="volume-high"
                          size={24}
                          color={isDark ? '#4CAF50' : '#2196F3'}
                        />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>

              {/* TTS Status Indicator */}
              {isTTSPlaying && (
                <View style={[
                  styles.ttsStatusContainer,
                  { backgroundColor: isDark ? '#2C2C2E' : '#E8F5E8' }
                ]}>
                  <View style={styles.ttsStatusRow}>
                    <Ionicons
                      name="volume-high"
                      size={24}
                      color={isDark ? '#4CAF50' : '#2196F3'}
                    />
                    <Text style={[
                      styles.ttsStatusText,
                      { color: isDark ? '#4CAF50' : '#2196F3' }
                    ]}>
                      {isTTSPaused ? 'Đã tạm dừng đọc' : 'Đang đọc...'}
                    </Text>
                  </View>
                  <View style={styles.ttsControls}>
                    <TouchableOpacity
                      style={[styles.ttsControlButton, { backgroundColor: isDark ? '#4CAF50' : '#2196F3' }]}
                      onPress={isTTSPaused ? resumeTTS : pauseTTS}
                    >
                      <Ionicons
                        name={isTTSPaused ? "play" : "pause"}
                        size={20}
                        color="#fff"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.ttsControlButton, { backgroundColor: '#ff4444' }]}
                      onPress={() => {
                        ttsQueue.current.stop();
                        setIsTTSPlaying(false);
                        setIsTTSPaused(false);
                        setTimeout(() => startContinuousListening(), 500);
                      }}
                    >
                      <Ionicons
                        name="stop"
                        size={20}
                        color="#fff"
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Voice Control Area - Redesigned */}
      <View style={[
        styles.voiceControlContainer,
        { backgroundColor: isDark ? '#343541' : '#ffffff' }
      ]}>
        {isContinuousListening && (
          <View style={styles.listeningIndicatorContainer}>
            <View style={[
              styles.listeningPulse,
              { backgroundColor: isDark ? '#4CAF50' : '#2196F3' }
            ]}>
              <Text style={styles.listeningText}>
                🎤 Đang lắng nghe...
              </Text>
            </View>
          </View>
        )}
        
        {/* Main Mic Button - Integrated Design */}
        <View style={styles.micButtonContainer}>
          <TouchableOpacity
            style={[
              styles.micButton,
              { 
                backgroundColor: 'transparent',
                borderWidth: 3,
                borderColor: isRecording ? '#ff4444' : (isDark ? '#4CAF50' : '#2196F3')
              }
            ]}
            onPress={handleRecordPress}
            disabled={isLoadingNews}
          >
            <View style={[
              styles.micIconContainer,
              { 
                backgroundColor: isRecording ? '#ff4444' : (isDark ? '#4CAF50' : '#2196F3')
              }
            ]}>
              <Ionicons
                name={isRecording ? "stop" : "mic"}
                size={50}
                color="#fff"
              />
            </View>
          </TouchableOpacity>
          
          {/* Recording Animation */}
          {isRecording && (
            <View style={styles.recordingAnimation}>
              <View style={[styles.recordingPulse, { backgroundColor: '#ff4444' }]} />
              <View style={[styles.recordingPulse, styles.recordingPulseDelay, { backgroundColor: '#ff4444' }]} />
            </View>
          )}
        </View>
        
        <Text style={[
          styles.micButtonLabel,
          { color: isDark ? '#fff' : '#000' }
        ]}>
          {isRecording 
            ? 'Đang ghi âm...' 
            : 'Nhấn để ghi âm thủ công'
          }
        </Text>
        
        <Text style={[
          styles.micButtonHint,
          { color: isDark ? '#888' : '#666' }
        ]}>
          Nói: "Tin số X", "Dừng", "Tiếp tục", "Tin tiếp theo"
        </Text>
        
        {audioLevel > -40 && isContinuousListening && (
          <View style={styles.audioLevelIndicator}>
            <View style={[
              styles.audioLevelBar,
              { 
                width: `${Math.min(100, Math.max(0, audioLevel + 60))}%`,
                backgroundColor: isDark ? '#4CAF50' : '#2196F3'
              }
            ]} />
            <Text style={[
              styles.audioLevelText,
              { color: isDark ? '#4CAF50' : '#2196F3' }
            ]}>
              🔊 Âm thanh: {Math.round(audioLevel + 60)}%
            </Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  newsContainer: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
  },
  selectedContainer: {
    padding: 16,
    borderWidth: 2,
    borderColor: '#4CAF50',
    borderRadius: 8,
    marginBottom: 16,
  },
  selectedLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  selectedTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  audioControls: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    alignItems: 'center',
    marginTop: 12,
  },
  controlButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  controlButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  articleList: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  articleItem: {
    padding: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    marginBottom: 8,
  },
  articleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  articleNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  articleNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
  },
  articleContent: {
    flex: 1,
  },
  articleTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  selectedArticleItem: {
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  ttsStatusContainer: {
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#4CAF50',
  },
  ttsStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  ttsStatusText: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  ttsControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  ttsControlButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceControlContainer: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingHorizontal: 20,
  },
  micButtonContainer: {
    alignItems: 'center',
    position: 'relative',
  },
  micButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  micIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  recordingAnimation: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 50,
  },
  recordingPulse: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.3,
  },
  recordingPulseDelay: {
    width: 140,
    height: 140,
    borderRadius: 70,
    opacity: 0.2,
  },
  micButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 20,
    textAlign: 'center',
  },
  micButtonHint: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 200,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  instructionText: {
    fontSize: 14,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  audioLevelIndicator: {
    width: '80%',
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  audioLevelBar: {
    height: 6,
    borderRadius: 3,
    marginBottom: 8,
    minWidth: 20,
  },
  audioLevelText: {
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  listeningIndicatorContainer: {
    marginBottom: 20,
  },
  listeningPulse: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 25,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  listeningText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
});

export default NewsReaderScreen;
