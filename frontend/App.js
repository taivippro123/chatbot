import React, { useState, useEffect } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar as RNStatusBar,
  TouchableWithoutFeedback,
  Keyboard,
  Alert,
  View,
} from 'react-native';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import Header from './src/components/Header';
import MessageList from './src/components/MessageList';
import InputBar from './src/components/InputBar';
import Sidebar from './src/components/Sidebar';

import AuthScreen from './src/components/AuthScreen';
import styles from './src/styles/styles';
import { translations } from './src/translations';
import SettingsScreen from './src/components/SettingsScreen';

const API_URL = 'https://chatbot-erif.onrender.com/api';
// const API_URL = 'http://localhost:5000';
// const API_URL = 'http://192.168.1.2:5000';
// const API_URL = 'http://192.168.1.2:5000/api';

export default function App() {
  const insets = useSafeAreaInsets ? useSafeAreaInsets() : { top: 44, bottom: 20 };
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState(null);
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({ language: 'vi', theme: 'light' });
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const recording = React.useRef(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [language, setLanguage] = useState('vi');

  useEffect(() => {
    loadTokenAndUser();
    loadSettings();
  }, []);

  useEffect(() => {
    if (token) {
      loadConversations();
    }
  }, [token]);

  const loadTokenAndUser = async () => {
    try {
      const savedToken = await AsyncStorage.getItem('token');
      const savedUser = await AsyncStorage.getItem('user');
      if (savedToken && savedUser) {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      }
    } catch (error) {
      console.error('Error loading token and user:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
        setLanguage(parsed.language || 'vi');
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const loadConversations = async () => {
    try {
      const response = await fetch(`${API_URL}/conversations`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setConversations(data);
      }
    } catch (error) {
      console.error('Error loading conversations:', error);
    }
  };

  const loadConversationMessages = async (conversationId) => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load messages');
      }

      const data = await response.json();
      if (data.success) {
        setMessages(data.messages || []);
        setCurrentConversationId(conversationId);
      } else {
        throw new Error(data.message || 'Failed to load messages');
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      Alert.alert(t.error, t.failedToLoadMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant microphone permission');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

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

  const stopRecording = async () => {
    try {
      await recording.current.stopAndUnloadAsync();
      const uri = recording.current.getURI();
      recording.current = null;
      setIsRecording(false);

      const formData = new FormData();
      formData.append('audio', {
        uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      });
      formData.append('language', settings.language === 'vi' ? 'vi-VN' : 'en-US');

      const response = await fetch(`${API_URL}/speech`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        throw new Error('Speech to text failed');
      }

      const { text } = await response.json();
      if (text) {
        setInputText(text);
      } else {
        throw new Error('No text returned from speech recognition');
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert(t.error, t.speechToTextFailed);
    }
  };

  const playAudio = async (messageId, text, speechLang) => {
    try {
      if (isPlaying && currentPlayingId === messageId) {
        await Speech.stop();
        setIsPlaying(false);
        setCurrentPlayingId(null);
      } else {
        if (isPlaying) {
          await Speech.stop();
        }
        setCurrentPlayingId(messageId);
        setIsPlaying(true);

        await Speech.speak(text, {
          language: speechLang,
          onDone: () => {
            setIsPlaying(false);
            setCurrentPlayingId(null);
          },
          onError: () => {
            setIsPlaying(false);
            setCurrentPlayingId(null);
          }
        });
      }
    } catch (error) {
      console.error('Error playing audio:', error);
      Alert.alert('Error', 'Failed to play audio');
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Could not pick image');
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() && !selectedImage) return;
    if (!token) {
      Alert.alert('Error', 'Please login first');
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('message', inputText);

      let imageUrl = null;
      if (selectedImage) {
        const imageUri = Platform.OS === 'ios' ? selectedImage.replace('file://', '') : selectedImage;
        const filename = imageUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('image', {
          uri: imageUri,
          type,
          name: filename,
        });
        imageUrl = selectedImage;
      }

      if (currentConversationId) {
        formData.append('conversation_id', currentConversationId);
      }

      const userMessage = {
        id: Date.now().toString(),
        text: inputText,
        image: imageUrl,
        sender: 'user',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);

      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      if (!currentConversationId) {
        setCurrentConversationId(data.conversation_id);
        loadConversations();
      }

      setMessages(prev => {
        const messagesWithoutTemp = prev.slice(0, -1);
        return [
          ...messagesWithoutTemp,
          {
            ...data.userMessage,
            image: data.userMessage.image || imageUrl
          },
          data.aiMessage
        ];
      });

      setInputText('');
      setSelectedImage(null);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', error.message);
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthSuccess = (newToken, userData) => {
    setToken(newToken);
    setUser(userData);
  };

  const handleLogout = async () => {
    try {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      setToken(null);
      setUser(null);
      setMessages([]);
      setCurrentConversationId(null);
      setConversations([]);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const createNewChat = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`${API_URL}/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: t.newChat
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create conversation');
      }

      const data = await response.json();
      if (data.success) {
        // Add new conversation to list
        setConversations(prev => [data.conversation, ...prev]);
        // Select the new conversation
        setCurrentConversationId(data.conversation.id);
        // Clear messages
        setMessages([]);
        // Close sidebar
        setIsSidebarOpen(false);
      } else {
        throw new Error(data.message || 'Failed to create conversation');
      }
    } catch (error) {
      console.error('Error creating new chat:', error);
      Alert.alert(t.error, t.failedToCreateChat);
    } finally {
      setIsLoading(false);
    }
  };

  const handleThemeChange = async (newTheme) => {
    try {
      const newSettings = { ...settings, theme: newTheme };
      await AsyncStorage.setItem('settings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const handleLanguageChange = async (newLanguage) => {
    try {
      const newSettings = { ...settings, language: newLanguage };
      await AsyncStorage.setItem('settings', JSON.stringify(newSettings));
      setSettings(newSettings);
      setLanguage(newLanguage);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const handleConversationPress = (id) => {
    loadConversationMessages(id);
    setIsSidebarOpen(false);
  };

  if (!token || !user) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} language={language} />;
  }

  const t = translations[language];

  return (
    <SafeAreaView style={[
      styles.container,
      { backgroundColor: settings.theme === 'dark' ? '#343541' : '#f5f5f5' }
    ]}>
      <RNStatusBar barStyle={settings.theme === 'dark' ? 'light-content' : 'dark-content'} />

      <Header
        onMenuPress={() => setIsSidebarOpen(true)}
        theme={settings.theme}
        title={currentConversationId ? t.chat : t.newChat}
        onLogout={handleLogout}
        onSettingsPress={() => setIsSettingsOpen(true)}
      />

      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <MessageList
            messages={messages}
            theme={settings.theme}
            isPlaying={isPlaying}
            currentPlayingId={currentPlayingId}
            onPlayAudio={playAudio}
            language={language}
            onOpenSidebar={() => setIsSidebarOpen(true)}
          />

          <InputBar
            theme={settings.theme}
            inputText={inputText}
            setInputText={setInputText}
            selectedImage={selectedImage}
            setSelectedImage={setSelectedImage}
            isRecording={isRecording}
            isLoading={isLoading}
            onPickImage={pickImage}
            onRecordPress={isRecording ? stopRecording : startRecording}
            onSendPress={sendMessage}
            language={language}
            t={t}
          />
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      {isSidebarOpen && (
        <Sidebar
          theme={settings.theme}
          conversations={conversations}
          currentConversationId={currentConversationId}
          onConversationPress={handleConversationPress}
          onClose={() => setIsSidebarOpen(false)}
          onNewChat={createNewChat}
          t={t}
        />
      )}

      <SettingsScreen
        visible={isSettingsOpen}
        theme={settings.theme}
        language={language}
        onThemeChange={handleThemeChange}
        onLanguageChange={handleLanguageChange}
        onClose={() => setIsSettingsOpen(false)}
      />
    </SafeAreaView>
  );
} 
