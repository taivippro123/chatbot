import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Dimensions, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { detectSpeechLanguage } from '../utils/languageUtils';

const { width } = Dimensions.get('window');
const MAX_IMAGES = 5;
const BUBBLE_PADDING = 12;
const IMAGE_GAP = 4;

// Calculate image dimensions based on number of images
const getImageDimensions = (imageCount) => {
  const maxWidth = width * 0.65; // Maximum bubble width (65% of screen)
  const bubbleWidth = maxWidth - (BUBBLE_PADDING * 2); // Account for bubble padding

  switch (imageCount) {
    case 1:
      return {
        width: bubbleWidth,
        height: bubbleWidth * 0.75, // 4:3 aspect ratio
        layout: '1'
      };
    case 2:
      return {
        width: (bubbleWidth - IMAGE_GAP) / 2,
        height: ((bubbleWidth - IMAGE_GAP) / 2) * 1.2, // Slightly taller for 2 images
        layout: '2'
      };
    case 3:
      return {
        width: (bubbleWidth - IMAGE_GAP) / 2,
        height: ((bubbleWidth - IMAGE_GAP) / 2),
        bigWidth: bubbleWidth,
        bigHeight: bubbleWidth * 0.75,
        layout: '1+2'
      };
    case 4:
      return {
        width: (bubbleWidth - IMAGE_GAP) / 2,
        height: ((bubbleWidth - IMAGE_GAP) / 2),
        layout: '2+2'
      };
    default: // 5 or more
      return {
        width: (bubbleWidth - IMAGE_GAP * 2) / 3,
        height: (bubbleWidth - IMAGE_GAP * 2) / 3,
        bigWidth: (bubbleWidth - IMAGE_GAP) / 2,
        bigHeight: (bubbleWidth - IMAGE_GAP) / 2,
        layout: '2+3'
      };
  }
};

const MessageItem = ({ 
  message, 
  theme, 
  isPlaying, 
  currentPlayingId, 
  onPlayAudio,
  isUser,
  language,
  hideAudioButton
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

  // Get images array from message
  const getImages = () => {
    try {
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

  const images = getImages().slice(0, MAX_IMAGES); // Limit to 5 images
  const imageDimensions = getImageDimensions(images.length);

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
              // Single image
              <Image
                source={{ uri: images[0] }}
                style={[styles.image, {
                  width: imageDimensions.width,
                  height: imageDimensions.height
                }]}
                resizeMode="cover"
              />
            ) : images.length === 2 ? (
              // Two images side by side
              <View style={styles.imageRow}>
                {images.map((uri, index) => (
                  <Image
                    key={index}
                    source={{ uri }}
                    style={[styles.image, {
                      width: imageDimensions.width,
                      height: imageDimensions.height,
                      marginRight: index === 0 ? IMAGE_GAP : 0
                    }]}
                    resizeMode="cover"
                  />
                ))}
              </View>
            ) : images.length === 3 ? (
              // One big image on top, two smaller below
              <View>
                <Image
                  source={{ uri: images[0] }}
                  style={[styles.image, {
                    width: imageDimensions.bigWidth,
                    height: imageDimensions.bigHeight,
                    marginBottom: IMAGE_GAP
                  }]}
                  resizeMode="cover"
                />
                <View style={styles.imageRow}>
                  {images.slice(1).map((uri, index) => (
                    <Image
                      key={index + 1}
                      source={{ uri }}
                      style={[styles.image, {
                        width: imageDimensions.width,
                        height: imageDimensions.height,
                        marginRight: index === 0 ? IMAGE_GAP : 0
                      }]}
                      resizeMode="cover"
                    />
                  ))}
                </View>
              </View>
            ) : images.length === 4 ? (
              // Two rows of two images
              <View>
                <View style={styles.imageRow}>
                  {images.slice(0, 2).map((uri, index) => (
                    <Image
                      key={index}
                      source={{ uri }}
                      style={[styles.image, {
                        width: imageDimensions.width,
                        height: imageDimensions.height,
                        marginRight: index === 0 ? IMAGE_GAP : 0,
                        marginBottom: IMAGE_GAP
                      }]}
                      resizeMode="cover"
                    />
                  ))}
                </View>
                <View style={styles.imageRow}>
                  {images.slice(2).map((uri, index) => (
                    <Image
                      key={index + 2}
                      source={{ uri }}
                      style={[styles.image, {
                        width: imageDimensions.width,
                        height: imageDimensions.height,
                        marginRight: index === 0 ? IMAGE_GAP : 0
                      }]}
                      resizeMode="cover"
                    />
                  ))}
                </View>
              </View>
            ) : (
              // Five images: 2 on top, 3 below
              <View>
                <View style={styles.imageRow}>
                  {images.slice(0, 2).map((uri, index) => (
                    <Image
                      key={index}
                      source={{ uri }}
                      style={[styles.image, {
                        width: imageDimensions.bigWidth,
                        height: imageDimensions.bigHeight,
                        marginRight: index === 0 ? IMAGE_GAP : 0,
                        marginBottom: IMAGE_GAP
                      }]}
                      resizeMode="cover"
                    />
                  ))}
                </View>
                <View style={styles.imageRow}>
                  {images.slice(2).map((uri, index) => (
                    <Image
                      key={index + 2}
                      source={{ uri }}
                      style={[styles.image, {
                        width: imageDimensions.width,
                        height: imageDimensions.height,
                        marginRight: index < 2 ? IMAGE_GAP : 0
                      }]}
                      resizeMode="cover"
                    />
                  ))}
                </View>
              </View>
            )}
          </View>
        )}
        {message.text && (
          <View style={styles.textContainer}>
            {renderFormattedText(message.text)}
          </View>
        )}
        {!isUser && message.text && !hideAudioButton && (
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
    maxWidth: '85%',
  },
  userContainer: {
    alignSelf: 'flex-end',
  },
  aiContainer: {
    alignSelf: 'flex-start',
  },
  bubble: {
    borderRadius: 20,
    padding: BUBBLE_PADDING,
    minWidth: 100,
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
  imageRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  image: {
    borderRadius: 12,
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