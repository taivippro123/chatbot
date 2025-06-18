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

// Custom TTS function using backend API instead of expo-speech
const CustomSpeech = {
  speak: async (text, options = {}) => {
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

      // Get response as array buffer
      const arrayBuffer = await response.arrayBuffer();
      
      // Convert to base64 for React Native
      const base64Audio = btoa(
        new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      
      const audioUri = `data:audio/mpeg;base64,${base64Audio}`;
      
      // Create and play audio using Expo Audio
      const { sound } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true, volume: 1.0 }
      );

      console.log('TTS Audio playing successfully');
      
      return new Promise((resolve, reject) => {
        // Set completion callback
        sound.setOnPlaybackStatusUpdate((status) => {
          if (status.didJustFinish) {
            sound.unloadAsync();
            resolve();
          }
          if (status.error) {
            sound.unloadAsync();
            reject(new Error('Audio playback error'));
          }
        });
      });

    } catch (error) {
      console.error('Custom TTS Error:', error);
      // Fallback: show alert if TTS fails
      Alert.alert('TTS Error', error.message);
      throw error;
    }
  },

  stop: () => {
    // Stop current TTS if needed
    console.log('TTS Stop requested');
  }
};

const NewsReaderScreen = ({ theme, token, t, onLogout, onSettingsPress }) => {
  const [articles, setArticles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoadingNews, setIsLoadingNews] = useState(false);
  const [selectedArticleIndex, setSelectedArticleIndex] = useState(null);
  const [isContinuousListening, setIsContinuousListening] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const sound = useRef(new Audio.Sound());
  const recording = useRef(null);
  const continuousRecording = useRef(null);
  const isDark = theme === 'dark';

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
      
      console.log('News data received:', res.data); // Debug log

      if (res.data.length > 0) {
        // Welcome message với ngày tháng
        const currentDate = getCurrentDate();
        const welcomeText = t.language === 'vi' 
          ? `Tôi là trợ lý đọc tin tức, hôm nay ${currentDate} có các tin tức nóng sau:`
          : `I am your news reading assistant, today ${currentDate} we have the following hot news:`;
        
        CustomSpeech.speak(welcomeText, { 
          language: t.language === 'vi' ? 'vi-VN' : 'en-US', 
          token 
        });
        
        // Đọc danh sách 5 tin mới nhất
        setTimeout(() => {
          const maxArticles = Math.min(5, res.data.length);
          let currentIndex = 0;
          
          const readNextArticle = () => {
            if (currentIndex < maxArticles) {
              const articleText = t.language === 'vi' 
                ? `Tin số ${currentIndex + 1}: ${res.data[currentIndex].title}`
                : `News ${currentIndex + 1}: ${res.data[currentIndex].title}`;
              
              CustomSpeech.speak(articleText, { 
                language: t.language === 'vi' ? 'vi-VN' : 'en-US', 
                token 
              });
              currentIndex++;
              
              // Đọc tin tiếp theo sau 4 giây
              setTimeout(readNextArticle, 4000);
            } else {
              // Sau khi đọc xong, bật continuous listening
              setTimeout(() => {
                const instructionText = t.language === 'vi' 
                  ? 'Bạn có thể nói tin số mấy để nghe, hoặc nói dừng, tiếp tục để điều khiển.'
                  : 'You can say news number to listen, or say stop, continue to control.';
                CustomSpeech.speak(instructionText, { 
                  language: t.language === 'vi' ? 'vi-VN' : 'en-US', 
                  token 
                });
                
                setTimeout(() => {
                  startContinuousListening();
                }, 2000);
              }, 2000);
            }
          };
          
          readNextArticle();
        }, 3000); // Delay 3s sau welcome message
      }
    } catch (err) {
      console.error('Fetch news failed', err);
      const errorText = t.language === 'vi' 
        ? 'Không thể tải tin tức. Vui lòng thử lại.'
        : 'Failed to load news. Please try again.';
      CustomSpeech.speak(errorText, { 
        language: t.language === 'vi' ? 'vi-VN' : 'en-US', 
        token 
      });
    } finally {
      setIsLoadingNews(false);
    }
  };

  // Chọn bài báo bằng index
  const selectArticle = (index) => {
    if (index >= 0 && index < articles.length) {
      // Stop continuous listening when selecting article
      stopContinuousListening();
      
      setSelectedArticleIndex(index);
      setSelected(articles[index]);
      
      const selectedText = t.language === 'vi' 
        ? `Đã chọn tin số ${index + 1}: ${articles[index].title}`
        : `Selected news ${index + 1}: ${articles[index].title}`;
      CustomSpeech.speak(selectedText, { 
        language: t.language === 'vi' ? 'vi-VN' : 'en-US', 
        token 
      });
      
      // Auto-play audio sau 2 giây
      setTimeout(() => {
        playNewsAudio(index);
      }, 2000);
    }
  };

  // Lấy audio URL và phát
  const playNewsAudio = async (articleIndex) => {
    try {
      const article = articles[articleIndex];
      setSelected(article);
      setSelectedArticleIndex(articleIndex);
      
      console.log('Playing article:', article);
      
      const loadingText = t.language === 'vi' 
        ? `Đang tải audio tin số ${articleIndex + 1}`
        : `Loading audio for news ${articleIndex + 1}`;
      CustomSpeech.speak(loadingText, { 
        language: t.language === 'vi' ? 'vi-VN' : 'en-US', 
        token 
      });
      
      const res = await axios.get(`${API_URL}/news/audio`, {
        params: { url: article.url },
      });

      console.log('Audio response:', res.data);

      const audioUrl = res.data.audioUrl;
      if (!audioUrl) {
        const noAudioText = t.language === 'vi' 
          ? "Tin này không có file âm thanh, sẽ đọc nội dung bằng giọng nói"
          : "This news has no audio file, will read content with text-to-speech";
        CustomSpeech.speak(noAudioText, { 
          language: t.language === 'vi' ? 'vi-VN' : 'en-US', 
          token 
        });
        
        // Fallback: đọc title bằng TTS
        setTimeout(() => {
          CustomSpeech.speak(article.title, { 
            language: t.language === 'vi' ? 'vi-VN' : 'en-US', 
            token 
          });
          // Start continuous listening after TTS
          setTimeout(() => {
            startContinuousListening();
          }, 5000);
        }, 2000);
        return;
      }

      await sound.current.unloadAsync();
      await sound.current.loadAsync({ uri: audioUrl });
      await sound.current.playAsync();
      setIsPlaying(true);
      
      // Start continuous listening khi bắt đầu phát audio
      setTimeout(() => {
        startContinuousListening();
      }, 3000);
      
      // Listen for audio completion
      sound.current.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsPlaying(false);
          stopContinuousListening();
          
          const finishedText = t.language === 'vi' 
            ? 'Đã phát xong tin này. Bạn có thể chọn tin khác.'
            : 'Finished playing this news. You can select another news.';
          CustomSpeech.speak(finishedText, { 
            language: t.language === 'vi' ? 'vi-VN' : 'en-US', 
            token 
          });
          
          // Restart continuous listening after completion
          setTimeout(() => {
            startContinuousListening();
          }, 2000);
        }
      });
      
    } catch (err) {
      console.error('Error playing audio', err);
      const errorText = t.language === 'vi' 
        ? `Không thể phát audio tin này. Sẽ đọc bằng giọng nói.`
        : `Cannot play audio for this news. Will read with text-to-speech.`;
      CustomSpeech.speak(errorText, { 
        language: t.language === 'vi' ? 'vi-VN' : 'en-US', 
        token 
      });
      
      // Fallback: đọc title bằng TTS khi có lỗi
      setTimeout(() => {
        CustomSpeech.speak(articles[articleIndex].title, { 
          language: t.language === 'vi' ? 'vi-VN' : 'en-US', 
          token 
        });
        setTimeout(() => {
          startContinuousListening();
        }, 5000);
      }, 1000);
    }
  };

  // Dừng và tiếp tục
  const pauseAudio = async () => {
    await sound.current.pauseAsync();
    setIsPlaying(false);
    // Keep continuous listening active when paused
  };
  
  const resumeAudio = async () => {
    await sound.current.playAsync();
    setIsPlaying(true);
    // Ensure continuous listening is active
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
    
    // Control commands
    const controlCommands = {
      stop: ['dừng', 'stop', 'tạm dừng', 'pause'],
      continue: ['tiếp tục', 'continue', 'phát', 'play'],
      next: ['tin tiếp theo', 'next', 'bài tiếp theo'],
      previous: ['tin trước', 'previous', 'bài trước'],
      repeat: ['lặp lại', 'repeat', 'đọc lại']
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
      /news\s*(\d+)/,
      /article\s*(\d+)/,
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
          pauseAudio();
          const stopText = t.language === 'vi' ? 'Đã tạm dừng' : 'Paused';
          CustomSpeech.speak(stopText, { 
            language: t.language === 'vi' ? 'vi-VN' : 'en-US', 
            token 
          });
        }
        break;
      case 'continue':
        if (!isPlaying && selected) {
          resumeAudio();
          const continueText = t.language === 'vi' ? 'Tiếp tục phát' : 'Continuing playback';
          CustomSpeech.speak(continueText, { 
            language: t.language === 'vi' ? 'vi-VN' : 'en-US', 
            token 
          });
        }
        break;
      case 'next':
        if (selectedArticleIndex !== null && selectedArticleIndex < articles.length - 1) {
          selectArticle(selectedArticleIndex + 1);
        }
        break;
      case 'previous':
        if (selectedArticleIndex !== null && selectedArticleIndex > 0) {
          selectArticle(selectedArticleIndex - 1);
        }
        break;
      case 'repeat':
        if (selectedArticleIndex !== null) {
          selectArticle(selectedArticleIndex);
        }
        break;
    }
  };

  const handleArticleSelection = (lowerText) => {
    // Enhanced keyword matching (existing code)
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

      score += calculateSimilarity(lowerText, articleTitle) * 10;

      Object.keys(vietnameseKeywords).forEach(keyword => {
        if (articleTitle.includes(keyword)) {
          vietnameseKeywords[keyword].forEach(variant => {
            if (lowerText.includes(variant)) {
              score += 5;
            }
          });
        }
      });

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
      selectArticle(bestMatch.index);
    } else {
      const noMatchText = t.language === 'vi' 
        ? 'Không tìm thấy bài báo phù hợp. Thử nói tin số mấy.'
        : 'No matching article found. Try saying news number.';
      CustomSpeech.speak(noMatchText, { 
        language: t.language === 'vi' ? 'vi-VN' : 'en-US', 
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
        const permissionText = t.language === 'vi' 
          ? 'Cần quyền truy cập microphone để ghi âm'
          : 'Microphone permission required for recording';
        Alert.alert('Permission Required', permissionText);
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

      const recordingText = t.language === 'vi' 
        ? 'Đang ghi âm... Nói tin số mấy hoặc lệnh điều khiển'
        : 'Recording... Say news number or control command';
      CustomSpeech.speak(recordingText, { 
        language: t.language === 'vi' ? 'vi-VN' : 'en-US', 
        token 
      });
    } catch (err) {
      console.error('Failed to start recording:', err);
      const errorText = t.language === 'vi' 
        ? 'Không thể bắt đầu ghi âm'
        : 'Failed to start recording';
      Alert.alert('Error', errorText);
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
      const errorText = t.language === 'vi' 
        ? 'Không thể dừng ghi âm'
        : 'Failed to stop recording';
      Alert.alert('Error', errorText);
    }
  };

  // Send audio to speech-to-text API
  const sendAudioForProcessing = async (audioUri, isContinuous = false) => {
    try {
      const formData = new FormData();
      formData.append('audio', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'voice_command.m4a',
      });
      formData.append('language', t.language === 'vi' ? 'vi-VN' : 'en-US');

      const response = await fetch(`${API_URL}/speech`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        throw new Error('Speech-to-text request failed');
      }

      const data = await response.json();
      console.log('Speech recognition result:', data);

      if (data.text) {
        // Process the voice command
        processVoiceCommand(data.text, isContinuous);
      } else {
        const noSpeechText = t.language === 'vi' 
          ? 'Không nhận diện được giọng nói. Vui lòng thử lại.'
          : 'No speech detected. Please try again.';
        CustomSpeech.speak(noSpeechText, { 
          language: t.language === 'vi' ? 'vi-VN' : 'en-US', 
          token 
        });
      }
    } catch (error) {
      console.error('Error processing speech:', error);
      const errorText = t.language === 'vi' 
        ? 'Lỗi xử lý giọng nói. Vui lòng thử lại.'
        : 'Speech processing error. Please try again.';
      CustomSpeech.speak(errorText, { 
        language: t.language === 'vi' ? 'vi-VN' : 'en-US', 
        token 
      });
    }
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopContinuousListening();
      if (recording.current) {
        recording.current.stopAndUnloadAsync();
      }
      if (sound.current) {
        sound.current.unloadAsync();
      }
    };
  }, []);

  useEffect(() => {
    fetchNews();
  }, []);

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
                {t.language === 'vi' ? 'Đang tải tin tức...' : 'Loading news...'}
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
                    {t.language === 'vi' ? 'Đang phát:' : 'Now playing:'}
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
                        {isPlaying ? (t.language === 'vi' ? 'Dừng' : 'Pause') : (t.language === 'vi' ? 'Phát' : 'Play')}
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
                  {t.language === 'vi' 
                    ? `Danh sách bài báo (${articles.length} bài):` 
                    : `Article List (${articles.length} articles):`
                  }
                </Text>
                <Text style={[
                  styles.instructionText,
                  { color: isDark ? '#888' : '#666' }
                ]}>
                  {t.language === 'vi' 
                    ? 'Nhấn vào bài báo hoặc nói "Bài số X" để chọn'
                    : 'Tap on article or say "Article X" to select'
                  }
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
            </>
          )}
        </View>
      </ScrollView>

      {/* Large Voice Control Button */}
      <View style={styles.voiceControlContainer}>
        {isContinuousListening && (
          <View style={[
            styles.listeningIndicator,
            { backgroundColor: isDark ? '#4CAF50' : '#2196F3' }
          ]}>
            <Text style={styles.listeningText}>
              {t.language === 'vi' ? '🎤 Đang lắng nghe...' : '🎤 Listening...'}
            </Text>
          </View>
        )}
        
        <TouchableOpacity
          style={[
            styles.recordButton,
            isRecording && styles.recordingButton,
            { backgroundColor: isRecording ? '#ff4444' : '#007AFF' }
          ]}
          onPress={handleRecordPress}
          disabled={isLoadingNews}
        >
          <Ionicons
            name={isRecording ? "stop" : "mic"}
            size={60}
            color="#fff"
          />
        </TouchableOpacity>
        
        <Text style={[
          styles.recordButtonLabel,
          { color: isDark ? '#fff' : '#000' }
        ]}>
          {isRecording 
            ? (t.recording || 'Đang ghi âm...') 
            : (t.tapToRecord || 'Nhấn để ghi âm thủ công')
          }
        </Text>
        
        <Text style={[
          styles.recordButtonHint,
          { color: isDark ? '#888' : '#666' }
        ]}>
          {t.language === 'vi' 
            ? 'Nói: "Tin số X", "Dừng", "Tiếp tục", "Tin tiếp theo"'
            : 'Say: "News X", "Stop", "Continue", "Next news"'
          }
        </Text>
        
        {audioLevel > -40 && isContinuousListening && (
          <View style={styles.audioLevelIndicator}>
            <Text style={[
              styles.audioLevelText,
              { color: isDark ? '#4CAF50' : '#2196F3' }
            ]}>
              🔊 Audio Level: {Math.round(audioLevel + 60)}%
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
  voiceControlContainer: {
    alignItems: 'center',
    paddingBottom: 40,
    paddingTop: 20,
  },
  recordButton: {
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
  recordingButton: {
    transform: [{ scale: 1.1 }],
  },
  recordButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  recordButtonHint: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
  },
  instructionText: {
    fontSize: 14,
    marginBottom: 16,
    fontStyle: 'italic',
  },
  listeningIndicator: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 16,
  },
  listeningText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  audioLevelIndicator: {
    padding: 8,
    borderRadius: 8,
    marginTop: 16,
  },
  audioLevelText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default NewsReaderScreen;
