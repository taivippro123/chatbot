import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, Alert, ActivityIndicator, FlatList, Text, Modal, TouchableHighlight } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from './Header';
import MessageList from './MessageList';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { API_URL } from '../config/api';

// Helper: convert arrayBuffer to base64 (React Native không có Buffer)
function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return global.btoa ? global.btoa(binary) : btoa(binary);
}

// Helper: loại bỏ thẻ HTML khỏi nội dung bài báo
function stripHtml(html) {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

const NewsReaderScreen = ({ theme, t, onLogout, onSettingsPress, token }) => {
  const [messages, setMessages] = useState([]); // Hiển thị tin tức dạng chat
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState(null);
  const recording = useRef(null);
  const sound = useRef(null);
  const isDark = theme === 'dark';
  const [articleList, setArticleList] = useState([]);
  const [showArticleModal, setShowArticleModal] = useState(false);
  const [selectedArticle, setSelectedArticle] = useState(null);

  // Ghi âm và gửi lên API speech để lấy text
  const handleStartRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant microphone permission');
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await newRecording.startAsync();
      recording.current = newRecording;
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const handleStopRecording = async () => {
    try {
      if (!recording.current) return;
      setIsLoading(true);
      await recording.current.stopAndUnloadAsync();
      const uri = recording.current.getURI();
      recording.current = null;
      setIsRecording(false);

      // Đọc file audio thành base64 string
      const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

      // Gửi audio lên API speech để lấy text (dạng JSON)
      const response = await fetch(`${API_URL}/speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ audio: base64Audio, language: 'vi-VN' }),
      });
      if (!response.ok) throw new Error('Speech to text failed');
      const { text } = await response.json();
      if (!text) throw new Error('No text returned from speech recognition');

      // Thêm message user
      const userMessage = {
        id: Date.now().toString(),
        text,
        sender: 'user',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMessage]);

      // Luôn gọi API /news không truyền query
      const newsRes = await fetch(`${API_URL}/news`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });

      if (!newsRes.ok) throw new Error('Failed to get news');
      const newsData = await newsRes.json();
      console.log('newsData:', newsData);
      let newsText = '';
      let audioUrl = null;
      if (Array.isArray(newsData.articles) && newsData.articles.length > 0) {
        setArticleList(newsData.articles);
        setShowArticleModal(true);
        // Đọc lần lượt tất cả title bằng Google TTS
        newsText = newsData.articles.map((a, i) => `${i + 1}. ${a.title}`).join('. ');
        await playNewsWithGoogleTTS(newsText);
        audioUrl = null;
      } else if (Array.isArray(newsData.articles) && newsData.articles.length === 0) {
        newsText = 'Không có bài báo nào trong chuyên mục này.';
      } else {
        newsText = newsData.message || 'Không tìm thấy bài báo phù hợp.';
      }
      newsText = stripHtml(newsText);
      // Thêm message bot
      const botMessage = {
        id: Date.now().toString() + '-bot',
        text: newsText,
        sender: 'bot',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, botMessage]);
      // Không phát audioUrl ở đây, chỉ phát khi user chọn bài
    } catch (error) {
      console.error('Error in news reader:', error);
      Alert.alert('Error', error.message || 'Có lỗi xảy ra');
    } finally {
      setIsLoading(false);
    }
  };

  // Phát audio mp3 từ backend Google TTS
  const playNewsWithGoogleTTS = async (text) => {
    try {
      if (sound.current) {
        await sound.current.unloadAsync();
        sound.current = null;
      }
      setIsPlaying(true);
      setCurrentPlayingId('news-bot');
      // Gọi API backend /tts
      const ttsRes = await fetch(`${API_URL}/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ text, language: 'vi-VN' }),
      });
      if (!ttsRes.ok) throw new Error('TTS failed');
      const arrayBuffer = await ttsRes.arrayBuffer();
      const base64Audio = arrayBufferToBase64(arrayBuffer);
      const audioUri = `data:audio/mp3;base64,${base64Audio}`;
      // Set audio mode để phát qua loa ngoài và volume to
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        // interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DO_NOT_MIX,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        // interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DO_NOT_MIX,
        playThroughEarpieceAndroid: false, // Bắt buộc phát qua loa ngoài
      });
      const { sound: playbackObj } = await Audio.Sound.createAsync(
        { uri: audioUri },
        { shouldPlay: true, volume: 1.0 }
      );
      sound.current = playbackObj;
      playbackObj.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsPlaying(false);
          setCurrentPlayingId(null);
        }
      });
      await playbackObj.playAsync();
    } catch (error) {
      setIsPlaying(false);
      setCurrentPlayingId(null);
      console.error('Error playing TTS:', error);
      Alert.alert('Error', 'Không thể phát audio TTS');
    }
  };

  // Thêm hàm phát audioUrl trực tiếp
  const playAudioUrl = async (audioUrl) => {
    try {
      if (sound.current) {
        await sound.current.unloadAsync();
        sound.current = null;
      }
      setIsPlaying(true);
      setCurrentPlayingId('news-bot');
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      const { sound: playbackObj } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true, volume: 1.0 }
      );
      sound.current = playbackObj;
      playbackObj.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsPlaying(false);
          setCurrentPlayingId(null);
        }
      });
      await playbackObj.playAsync();
    } catch (error) {
      setIsPlaying(false);
      setCurrentPlayingId(null);
      console.error('Error playing audioUrl:', error);
      Alert.alert('Error', 'Không thể phát audio bài báo');
    }
  };

  const handleRecordPress = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#343541' : '#fff' }]}>
      <Header
        theme={theme}
        title={t?.newsReader || 'News Reader'}
        onMenuPress={() => { }}
        onLogout={onLogout}
        onSettingsPress={onSettingsPress}
      />
      <View style={styles.content}>
        <MessageList
          messages={messages}
          theme={theme}
          language={t?.lang || 'vi'}
          hideAudioButton={true}
        />
      </View>
      <View style={styles.micBar}>
        <TouchableOpacity
          style={[styles.micButton, isRecording && styles.micButtonActive]}
          onPress={handleRecordPress}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={isDark ? '#fff' : '#007AFF'} size={32} />
          ) : (
            <Ionicons
              name={isRecording ? 'stop-circle' : 'mic-outline'}
              size={48}
              color={isRecording ? '#ff4444' : (isDark ? '#fff' : '#007AFF')}
            />
          )}
        </TouchableOpacity>
      </View>
      <Modal
        visible={showArticleModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowArticleModal(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center' }}>
          <View style={{ margin: 24, backgroundColor: '#fff', borderRadius: 8, padding: 16, maxHeight: '80%' }}>
            <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}>Chọn bài báo để nghe</Text>
            <FlatList
              data={articleList}
              keyExtractor={item => item.url}
              renderItem={({ item, index }) => (
                <TouchableHighlight
                  underlayColor="#eee"
                  onPress={async () => {
                    setShowArticleModal(false);
                    setSelectedArticle(item);
                    if (item.audioUrl) {
                      await playAudioUrl(item.audioUrl);
                    } else {
                      Alert.alert('Không có audio cho bài báo này');
                    }
                  }}
                  style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' }}
                >
                  <Text style={{ fontSize: 16 }}>{index + 1}. {item.title}</Text>
                </TouchableHighlight>
              )}
            />
            <TouchableOpacity onPress={() => setShowArticleModal(false)} style={{ marginTop: 16, alignSelf: 'flex-end' }}>
              <Text style={{ color: '#007AFF', fontWeight: 'bold' }}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  micBar: {
    padding: 16,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.07)',
    backgroundColor: 'transparent',
  },
  micButton: {
    padding: 16,
    borderRadius: 40,
    backgroundColor: '#e5e5ea',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  micButtonActive: {
    backgroundColor: '#ffeaea',
  },
});

export default NewsReaderScreen;
