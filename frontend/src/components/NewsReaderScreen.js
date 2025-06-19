import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Platform, Alert, ActivityIndicator, FlatList, Text, Modal, TouchableHighlight } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Header from './Header';
import MessageList from './MessageList';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { API_URL } from '../config/api';
import NewsArticleListMessage from './NewsArticleListMessage';
import NewsArticlePlayer from './NewsArticlePlayer';
import * as Speech from 'expo-speech';

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

const NewsReaderScreen = ({ theme, t, onLogout, onSettingsPress, token, handsFreeMode }) => {
  const [messages, setMessages] = useState([]); // Hiển thị tin tức dạng chat
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState(null);
  const recording = useRef(null);
  const sound = useRef(null);
  const isDark = theme === 'dark';
  const [articleList, setArticleList] = useState([]);
  const [selectedArticle, setSelectedArticle] = useState({ messageId: null, articleIndex: null, articles: [] });
  const [newsPage, setNewsPage] = useState(0); // Số lần gọi, bắt đầu từ 0
  const NEWS_LIMIT = 10;
  const introRef = useRef(false);

  // Tắt audio khi unmount hoặc khi tắt handsfree mode
  useEffect(() => {
    return () => {
      if (sound.current) {
        sound.current.unloadAsync();
        sound.current = null;
      }
    };
  }, []);
  useEffect(() => {
    if (!handsFreeMode && sound.current) {
      sound.current.unloadAsync();
      sound.current = null;
    }
  }, [handsFreeMode]);

  // Phát audio giới thiệu khi vào handsfree mode và thêm message bot giới thiệu
  useEffect(() => {
    if (handsFreeMode && !introRef.current) {
      const intro = 'Tôi là trợ lý đọc báo, hãy nói "Tin tức" và thưởng thức những tin nóng hổi ngay, bạn có thể nói "Xem thêm" để lựa chọn bài báo muốn nghe';
      // Set lại audio mode trước khi phát TTS
      Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      }).then(() => {
        Speech.speak(intro, { language: 'vi-VN', pitch: 1.0, rate: 0.95 });
      });
      setMessages(prev => [
        ...prev,
        {
          id: Date.now().toString() + '-intro',
          text: intro,
          sender: 'bot',
          created_at: new Date().toISOString(),
          type: 'intro',
        }
      ]);
      introRef.current = true;
    }
    // Cleanup: luôn stop audio khi rời khỏi handsFreeMode hoặc unmount, và reset flag
    return () => {
      Speech.stop();
      introRef.current = false;
    };
  }, [handsFreeMode]);

  // Ghi âm và gửi lên API speech để lấy text
  const handleStartRecording = async () => {
    try {
      Speech.stop(); // Dừng audio intro nếu đang phát
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
      const base64Audio = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
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
      const userMessage = {
        id: Date.now().toString(),
        text,
        sender: 'user',
        created_at: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMessage]);
      // Nếu là lần đầu, page = 0, nếu user nói "xem thêm", page++
      let nextPage = 0;
      if (/xem thêm/i.test(text.trim())) {
        nextPage = newsPage + 1;
        setNewsPage(nextPage);
      } else {
        setNewsPage(0);
      }
      await fetchAndShowNews(nextPage);
    } catch (error) {
      console.error('Error in news reader:', error);
      Alert.alert('Error', error.message || 'Có lỗi xảy ra');
    } finally {
      setIsLoading(false);
    }
  };

  // Hàm fetch news với page (không cộng dồn)
  const fetchAndShowNews = async (page) => {
    setIsLoading(true);
    try {
      const offset = page * NEWS_LIMIT;
      const newsRes = await fetch(`${API_URL}/news?offset=${offset}&limit=${NEWS_LIMIT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({}),
      });
      if (!newsRes.ok) throw new Error('Failed to get news');
      const newsData = await newsRes.json();
      let newsText = '';
      let articleList = [];
      if (Array.isArray(newsData.articles) && newsData.articles.length > 0) {
        articleList = newsData.articles;
        newsText = articleList.map((a, i) => `${offset + i + 1}. ${a.title}`).join('. ');
      } else if (Array.isArray(newsData.articles) && newsData.articles.length === 0) {
        newsText = 'Không có bài báo nào trong chuyên mục này.';
      } else {
        newsText = newsData.message || 'Không tìm thấy bài báo phù hợp.';
      }
      newsText = stripHtml(newsText);
      const botMessage = {
        id: Date.now().toString() + '-bot',
        text: newsText,
        sender: 'bot',
        created_at: new Date().toISOString(),
        articles: articleList,
        type: 'news-list',
      };
      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      Alert.alert('Error', error.message || 'Có lỗi xảy ra');
    } finally {
      setIsLoading(false);
    }
  };

  // Điều khiển nghe bài báo
  const [isArticlePlaying, setIsArticlePlaying] = useState(false);
  const [isArticlePaused, setIsArticlePaused] = useState(false);

  // Hàm phát audio cho bài báo trong 1 message bot cụ thể
  const playSelectedArticle = async (articles, idx) => {
    const article = articles[idx];
    if (!article) return;
    setIsArticlePlaying(true);
    setIsArticlePaused(false);
    setCurrentPlayingId('news-bot');
    if (sound.current) {
      await sound.current.unloadAsync();
      sound.current = null;
    }
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
      });
      const { sound: playbackObj } = await Audio.Sound.createAsync(
        { uri: article.audioUrl },
        { shouldPlay: true, volume: 1.0 }
      );
      sound.current = playbackObj;
      playbackObj.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsArticlePlaying(false);
          setIsArticlePaused(false);
          setCurrentPlayingId(null);
        }
      });
      await playbackObj.playAsync();
    } catch (error) {
      setIsArticlePlaying(false);
      setIsArticlePaused(false);
      setCurrentPlayingId(null);
      Alert.alert('Error', 'Không thể phát audio bài báo');
    }
  };

  // Khi chọn bài báo ở 1 message bot cụ thể
  const handleSelectArticle = (messageId, articles, idx) => {
    setSelectedArticle({ messageId, articleIndex: idx, articles });
    playSelectedArticle(articles, idx);
  };

  const handleStop = async () => {
    if (sound.current) {
      await sound.current.pauseAsync();
      setIsArticlePaused(true);
      setIsArticlePlaying(false);
    }
  };
  const handlePlay = async () => {
    if (sound.current) {
      await sound.current.playAsync();
      setIsArticlePaused(false);
      setIsArticlePlaying(true);
    }
  };
  const handleForward = () => {
    if (
      selectedArticle.messageId &&
      selectedArticle.articleIndex !== null &&
      selectedArticle.articleIndex < selectedArticle.articles.length - 1
    ) {
      const nextIdx = selectedArticle.articleIndex + 1;
      setSelectedArticle({ ...selectedArticle, articleIndex: nextIdx });
      playSelectedArticle(selectedArticle.articles, nextIdx);
    }
  };
  const handleBack = () => {
    if (
      selectedArticle.messageId &&
      selectedArticle.articleIndex !== null &&
      selectedArticle.articleIndex > 0
    ) {
      const prevIdx = selectedArticle.articleIndex - 1;
      setSelectedArticle({ ...selectedArticle, articleIndex: prevIdx });
      playSelectedArticle(selectedArticle.articles, prevIdx);
    }
  };

  const handleRecordPress = () => {
    Speech.stop(); // Dừng audio intro nếu đang phát
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
        onMenuPress={handsFreeMode ? undefined : () => { }}
        onLogout={onLogout}
        onSettingsPress={onSettingsPress}
        handsFreeMode={handsFreeMode}
      />
      <View style={styles.content}>
        <MessageList
          messages={messages}
          theme={theme}
          language={t?.lang || 'vi'}
          hideAudioButton={true}
          renderCustomMessage={(msg) => {
            if (msg.type === 'news-list' && msg.articles && msg.articles.length > 0) {
              return (
                <View style={{ backgroundColor: isDark ? '#23232b' : '#f5f5f7', borderRadius: 8, padding: 12, marginVertical: 8 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8, color: isDark ? '#fff' : '#000' }}>Danh sách bài báo:</Text>
                  {msg.articles.map((article, idx) => (
                    <View key={article.url} style={{ marginBottom: 8, borderBottomWidth: 1, borderBottomColor: isDark ? '#333' : '#eee', paddingBottom: 8 }}>
                      <TouchableOpacity onPress={() => handleSelectArticle(msg.id, msg.articles, idx)}>
                        <Text style={{ fontSize: 15, color: selectedArticle.messageId === msg.id && selectedArticle.articleIndex === idx
                          ? (isDark ? '#4cd964' : '#007AFF')
                          : (isDark ? '#fff' : '#222'), fontWeight: selectedArticle.messageId === msg.id && selectedArticle.articleIndex === idx ? 'bold' : 'normal' }}>
                          {idx + 1}. {article.title}
                        </Text>
                      </TouchableOpacity>
                      {selectedArticle.messageId === msg.id && selectedArticle.articleIndex === idx && (
                        <NewsArticlePlayer
                          article={article}
                          onBack={handleBack}
                          onStop={handleStop}
                          onPlay={handlePlay}
                          onForward={handleForward}
                          isPlaying={isArticlePlaying}
                          isPaused={isArticlePaused}
                          theme={theme}
                        />
                      )}
                    </View>
                  ))}
                </View>
              );
            }
            return null;
          }}
        />
      </View>
      <View style={styles.micBar}>
        <TouchableOpacity
          style={[
            styles.micButton,
            { backgroundColor: isDark ? '#23232b' : '#e5e5ea' },
            isRecording && { backgroundColor: isDark ? '#3a3a4a' : '#ffeaea' }
          ]}
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
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
      android: { elevation: 4 },
    }),
  },
  micButtonActive: {
  },
});

export default NewsReaderScreen;
