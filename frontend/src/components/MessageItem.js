import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { detectSpeechLanguage } from '../utils/languageUtils';

const { width } = Dimensions.get('window');
const MAX_IMAGE_WIDTH = width * 0.6;

const MessageItem = ({ 
  message, 
  theme, 
  isPlaying, 
  currentPlayingId, 
  onPlayAudio,
  isUser,
  language
}) => {
  const isDark = theme === 'dark';
  const messageTime = message.created_at ? new Date(message.created_at) : null;
  
  // Format timestamp
  const formatTime = (date) => {
    if (!date) return '';
    try {
      const hours = date.getHours().toString().padStart(2, '0');
      const minutes = date.getMinutes().toString().padStart(2, '0');
      return `${hours}:${minutes}`;
    } catch (error) {
      console.error('Error formatting date:', error);
      return '';
    }
  };

  const handlePlayAudio = () => {
    const speechLang = detectSpeechLanguage(message.text, language);
    onPlayAudio(message.id, message.text, speechLang);
  };

  // Process text for markdown-style bold
  const renderFormattedText = (text) => {
    if (!text) return null;
    
    // Split text by bold markers (**text**)
    const parts = text.split(/(\*\*.*?\*\*)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        // Remove ** markers and render bold text
        const boldText = part.slice(2, -2);
        return (
          <Text
            key={index}
            style={[
              styles.boldText,
              isUser ? styles.userText : { color: isDark ? '#fff' : '#000' }
            ]}
          >
            {boldText}
          </Text>
        );
      }
      // Render regular text
      return (
        <Text
          key={index}
          style={[
            styles.text,
            isUser ? styles.userText : { color: isDark ? '#fff' : '#000' }
          ]}
        >
          {part}
        </Text>
      );
    });
  };

  return (
    <View style={[
      styles.container,
      isUser ? styles.userContainer : styles.aiContainer
    ]}>
      <View style={[
        styles.bubble,
        isUser ? styles.userBubble : styles.aiBubble,
        { backgroundColor: isUser ? '#007AFF' : (isDark ? '#2C2C2E' : '#E5E5EA') }
      ]}>
        {(message.image || message.image_url) && (
          <View style={styles.imageContainer}>
            <Image
              source={{ uri: message.image || message.image_url }}
              style={styles.image}
              resizeMode="contain"
            />
          </View>
        )}
        {message.text && (
          <View style={styles.textContainer}>
            {renderFormattedText(message.text)}
          </View>
        )}
        {!isUser && message.text && (
          <TouchableOpacity
            style={[
              styles.audioButton,
              { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }
            ]}
            onPress={handlePlayAudio}
          >
            <Ionicons
              name={isPlaying && currentPlayingId === message.id ? "stop-circle-outline" : "play-circle-outline"}
              size={24}
              color={isDark ? '#fff' : '#000'}
            />
          </TouchableOpacity>
        )}
        {messageTime && (
          <Text style={[
            styles.timestamp,
            isUser ? styles.userTimestamp : styles.aiTimestamp,
            isDark && !isUser ? { color: 'rgba(255, 255, 255, 0.5)' } : null
          ]}>
            {formatTime(messageTime)}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 8,
    marginVertical: 2,
    maxWidth: '80%',
  },
  userContainer: {
    alignSelf: 'flex-end',
  },
  aiContainer: {
    alignSelf: 'flex-start',
  },
  bubble: {
    borderRadius: 20,
    padding: 12,
    minWidth: 100,
  },
  userBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 5,
  },
  aiBubble: {
    borderBottomLeftRadius: 5,
  },
  imageContainer: {
    marginBottom: 8,
    borderRadius: 15,
    overflow: 'hidden',
  },
  image: {
    width: MAX_IMAGE_WIDTH,
    height: MAX_IMAGE_WIDTH,
    borderRadius: 15,
  },
  textContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
  },
  boldText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: 'bold',
  },
  userText: {
    color: '#FFFFFF',
  },
  aiText: {
    color: '#000000',
  },
  timestamp: {
    fontSize: 11,
    marginTop: 5,
    alignSelf: 'flex-end',
    opacity: 0.8,
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  aiTimestamp: {
    color: 'rgba(0, 0, 0, 0.5)',
  },
  audioButton: {
    padding: 8,
    marginTop: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  }
});

export default MessageItem;