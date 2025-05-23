import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

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
  const timestamp = message.timestamp ? new Date(message.timestamp) : null;
  const isValidDate = timestamp && !isNaN(timestamp.getTime());

  // Detect language of text
  const detectLanguage = (text) => {
    // Simple language detection based on character set
    const vietnamesePattern = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i;
    return vietnamesePattern.test(text) ? 'vi-VN' : 'en-US';
  };

  const handlePlayAudio = () => {
    // Use detected language or fallback to current UI language
    const detectedLang = detectLanguage(message.text);
    const speechLang = detectedLang || (language === 'vi' ? 'vi-VN' : 'en-US');
    onPlayAudio(message.id, message.text, speechLang);
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
          <Text style={[
            styles.text,
            isUser ? styles.userText : [
              styles.aiText,
              { color: isDark ? '#fff' : '#000' }
            ]
          ]}>
            {message.text}
          </Text>
        )}
        {!isUser && (
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
        {isValidDate && (
          <Text style={[
            styles.timestamp,
            isUser ? styles.userTimestamp : styles.aiTimestamp
          ]}>
            {timestamp.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
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
  text: {
    fontSize: 16,
    marginBottom: 4,
    lineHeight: 24,
  },
  userText: {
    color: '#FFFFFF',
  },
  aiText: {
    color: '#000000',
  },
  timestamp: {
    fontSize: 12,
    alignSelf: 'flex-end',
    marginTop: 4,
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