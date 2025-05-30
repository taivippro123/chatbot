import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Dimensions, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { detectSpeechLanguage } from '../utils/languageUtils';

const { width } = Dimensions.get('window');
const MAX_IMAGE_WIDTH = width * 0.65;
const MAX_IMAGE_HEIGHT = width * 0.5;
const MULTI_IMAGE_WIDTH = width * 0.45;

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
    
    // If text is an object, try to extract the text content
    if (typeof text === 'object') {
      console.warn('Text is an object:', text);
      return null;
    }
    
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

  // Get images array from message
  const getImages = () => {
    try {
      // First check message.images from API response
      if (message.images) {
        return Array.isArray(message.images) ? message.images : [];
      }
      
      // Then check image_urls
      if (message.image_urls) {
        // If image_urls is already an array, use it directly
        if (Array.isArray(message.image_urls)) {
          return message.image_urls;
        }
        // If image_urls is a JSON string, parse it
        if (typeof message.image_urls === 'string') {
          const parsed = JSON.parse(message.image_urls);
          return Array.isArray(parsed) ? parsed : [];
        }
      }
      return [];
    } catch (error) {
      console.error('Error parsing image_urls:', error);
      return [];
    }
  };

  const images = getImages();

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
        {images.length > 0 && (
          <View style={styles.imagesContainer}>
            {images.length === 1 ? (
              // Single image view
              <View style={styles.singleImageContainer}>
                <Image
                  source={{ uri: images[0] }}
                  style={styles.singleImage}
                  resizeMode="cover"
                />
              </View>
            ) : (
              // Multiple images view with grid layout
              <View style={styles.multiImageContainer}>
                {images.map((imageUrl, index) => (
                  <View key={index} style={[
                    styles.imageContainer,
                    index % 2 === 1 && styles.imageContainerRight,
                    index >= 2 && styles.imageContainerBottom
                  ]}>
                    <Image
                      source={{ uri: imageUrl }}
                      style={styles.image}
                      resizeMode="cover"
                    />
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
        {message.text && (
          <View style={[
            styles.textContainer,
            images.length > 0 && styles.textWithImages
          ]}>
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
    maxWidth: '90%',
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  userBubble: {
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 5,
  },
  aiBubble: {
    borderBottomLeftRadius: 5,
  },
  imagesContainer: {
    marginBottom: 8,
    borderRadius: 15,
    overflow: 'hidden',
  },
  singleImageContainer: {
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  singleImage: {
    width: MAX_IMAGE_WIDTH,
    height: MAX_IMAGE_HEIGHT,
    borderRadius: 15,
  },
  multiImageContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    width: MAX_IMAGE_WIDTH,
  },
  imageContainer: {
    width: MULTI_IMAGE_WIDTH,
    height: MULTI_IMAGE_WIDTH,
    marginBottom: 2,
    marginRight: 2,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f0f0f0',
  },
  imageContainerRight: {
    marginRight: 0,
  },
  imageContainerBottom: {
    marginBottom: 0,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  textContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  textWithImages: {
    marginTop: 8,
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