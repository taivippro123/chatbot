import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';

import Header from './Header';
import MessageList from './MessageList';
import InputBar from './InputBar';
import Sidebar from './Sidebar';

const API_URL = 'https://chatbot-erif.onrender.com/api';

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
      setIsLoading(true);
      const messages = await chatAPI.loadConversationMessages(token, id);
      setMessages(messages);
      setCurrentConversationId(id);
      setIsSidebarOpen(false);
    } catch (error) {
      console.error('Error loading conversation:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = async () => {
    try {
      setIsLoading(true);
      const newConversation = await chatAPI.createNewChat(token, t.newChat);
      setConversations(prev => [newConversation, ...prev]);
      setCurrentConversationId(newConversation.id);
      setMessages([]);
      setIsSidebarOpen(false);
    } catch (error) {
      console.error('Error creating new chat:', error);
    } finally {
      setIsLoading(false);
    }
  };

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

      <View style={styles.content}>
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