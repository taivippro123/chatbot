import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  PanResponder 
} from 'react-native';
import { API_URL } from '@env';

import Header from './Header';
import MessageList from './MessageList';
import InputBar from './InputBar';
import Sidebar from './Sidebar';
console.log('API_URL from env:', API_URL);
export const chatAPI = {
  loadConversations: async (token) => {
    try {
      const response = await fetch(`${API_URL}/conversations`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        return data;
      }
      return [];
    } catch (error) {
      console.error('Error loading conversations:', error);
      return [];
    }
  },

  loadConversationMessages: async (token, conversationId) => {
    try {
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
        return data.messages || [];
      }
      throw new Error(data.message || 'Failed to load messages');
    } catch (error) {
      console.error('Error loading messages:', error);
      throw error;
    }
  },

  createNewChat: async (token, title) => {
    try {
      const response = await fetch(`${API_URL}/conversations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ title })
      });

      if (!response.ok) {
        throw new Error('Failed to create conversation');
      }

      const data = await response.json();
      if (data.success) {
        return data.conversation;
      }
      throw new Error(data.message || 'Failed to create conversation');
    } catch (error) {
      console.error('Error creating new chat:', error);
      throw error;
    }
  }
};

const ChatScreen = ({ theme, token, t, onLogout, onSettingsPress }) => {
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState(null);
  const [conversationInputs, setConversationInputs] = useState({});

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const conversationsData = await chatAPI.loadConversations(token);
        setConversations(conversationsData);
      } catch (error) {
        console.error('Error loading initial data:', error);
      }
    };

    if (token) {
      loadInitialData();
    }
  }, [token]);

  const handleConversationPress = async (id) => {
    try {
      if (currentConversationId && inputText) {
        setConversationInputs(prev => ({
          ...prev,
          [currentConversationId]: inputText
        }));
      }

      setIsLoading(true);
      const messages = await chatAPI.loadConversationMessages(token, id);
      setMessages(messages);
      setCurrentConversationId(id);
      setInputText(conversationInputs[id] || '');
      setSelectedImage(null);
      setIsSidebarOpen(false);
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = async () => {
    try {
      if (currentConversationId && inputText) {
        setConversationInputs(prev => ({
          ...prev,
          [currentConversationId]: inputText
        }));
      }

      setIsLoading(true);
      const newConversation = await chatAPI.createNewChat(token, t.newChat);
      setConversations(prev => [newConversation, ...prev]);
      setCurrentConversationId(newConversation.id);
      setMessages([]);
      setInputText('');
      setSelectedImage(null);
      setIsSidebarOpen(false);
    } catch (error) {
      console.error('Error creating new chat:', error);
    } finally {
      setIsLoading(false);
    }
  };


  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      // Nếu người dùng vuốt từ trái sang phải một đoạn đáng kể
      return gestureState.dx > 25 && Math.abs(gestureState.dy) < 20;
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx > 50) {
        setIsSidebarOpen(true); // Mở sidebar khi vuốt đủ xa
      }
    },
  });

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 44 : 0}
    >
      <Header
        theme={theme}
        title={currentConversationId ? t.chat : t.newChat}
        onMenuPress={() => setIsSidebarOpen(true)}
        onLogout={onLogout}
        onSettingsPress={onSettingsPress}
      />

      <View style={styles.content} {...panResponder.panHandlers}>
        <MessageList
          messages={messages}
          theme={theme}
          isPlaying={isPlaying}
          currentPlayingId={currentPlayingId}
          setIsPlaying={setIsPlaying}
          setCurrentPlayingId={setCurrentPlayingId}
        />
      </View>

      <InputBar
        theme={theme}
        token={token}
        currentConversationId={currentConversationId}
        inputText={inputText}
        setInputText={setInputText}
        selectedImage={selectedImage}
        setSelectedImage={setSelectedImage}
        isRecording={isRecording}
        setIsRecording={setIsRecording}
        isLoading={isLoading}
        setMessages={setMessages}
        t={t}
      />

      {isSidebarOpen && (
        <Sidebar
          theme={theme}
          conversations={conversations}
          currentConversationId={currentConversationId}
          onConversationPress={handleConversationPress}
          onClose={() => setIsSidebarOpen(false)}
          onNewChat={handleNewChat}
          t={t}
        />
      )}
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  content: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});

export default ChatScreen; 