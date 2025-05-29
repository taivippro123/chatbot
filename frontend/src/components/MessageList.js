import React, { useRef, useEffect, useCallback, memo, useState } from 'react';
import { FlatList, StyleSheet, View, Platform } from 'react-native';
import MessageItem from './MessageItem';
import * as Speech from 'expo-speech';
// import styles from '../styles/styles';

// Memoize MessageItem để tránh re-render không cần thiết
const MemoizedMessageItem = memo(MessageItem);

// Chunk size for message groups
const CHUNK_SIZE = 10;
const SWIPE_THRESHOLD = 50; // Minimum swipe distance to trigger sidebar

const MessageList = ({ 
  messages, 
  theme, 
  language,
  style
}) => {
  const isDark = theme === 'dark';
  const listRef = useRef(null);
  const isScrolling = useRef(false);
  const lastContentOffset = useRef(0);
  const lastMessageLength = useRef(messages.length);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentPlayingId, setCurrentPlayingId] = useState(null);

  // Scroll to bottom only on new messages
  useEffect(() => {
    if (messages.length > lastMessageLength.current) {
      const timer = setTimeout(() => {
        if (listRef.current) {
          listRef.current.scrollToEnd({ 
            animated: true,
            duration: 300 // Smooth animation duration
          });
        }
      }, 100);
      lastMessageLength.current = messages.length;
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  const handlePlayAudio = (messageId, text, speechLang) => {
    if (isPlaying && currentPlayingId === messageId) {
      Speech.stop();
      setIsPlaying(false);
      setCurrentPlayingId(null);
      return;
    }

    if (isPlaying) {
      Speech.stop();
    }

    setIsPlaying(true);
    setCurrentPlayingId(messageId);

    Speech.speak(text, {
      language: speechLang,
      pitch: 1.0,
      rate: 0.75,
    });

    // Estimate duration based on text length
    const estimatedDuration = text.length * 50; // 50ms per character
    setTimeout(() => {
      setIsPlaying(false);
      setCurrentPlayingId(null);
    }, estimatedDuration);
  };

  const renderItem = useCallback(({ item: message }) => (
    <MemoizedMessageItem
      key={message.id}
      message={message}
      theme={theme}
      isPlaying={isPlaying}
      currentPlayingId={currentPlayingId}
      onPlayAudio={handlePlayAudio}
      isUser={message.sender === 'user'}
      language={language}
    />
  ), [theme, isPlaying, currentPlayingId, language]);

  const handleScroll = useCallback(({ nativeEvent }) => {
    isScrolling.current = true;
    lastContentOffset.current = nativeEvent.contentOffset.y;
  }, []);

  const handleScrollEnd = useCallback(() => {
    isScrolling.current = false;
  }, []);

  return (
    <View style={[styles.container, style]}>
      <FlatList
        ref={listRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        style={[
          styles.list,
          { backgroundColor: isDark ? '#343541' : '#ffffff' }
        ]}
        contentContainerStyle={styles.contentContainer}
        
        // Performance optimizations
        removeClippedSubviews={Platform.OS === 'android'}
        maxToRenderPerBatch={5}
        updateCellsBatchingPeriod={50}
        windowSize={7}
        initialNumToRender={8}
        
        // Scrolling optimizations
        scrollEventThrottle={16}
        onScroll={handleScroll}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleScrollEnd}
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
        }}
        
        // Enhanced touch handling
        scrollsToTop={false}
        alwaysBounceVertical={true}
        bounces={true}
        bouncesZoom={false}
        decelerationRate="fast"
        
        // Additional optimizations
        showsVerticalScrollIndicator={true}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        
        // Disable unnecessary features
        automaticallyAdjustContentInsets={false}
        directionalLockEnabled={false}
        overScrollMode="never"
        
        // Platform specific
        scrollToOverflowEnabled={true}
        fadingEdgeLength={Platform.OS === 'android' ? 50 : undefined}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
    ...Platform.select({
      ios: {
        paddingTop: 8,
      },
      android: {
        paddingTop: 4,
      },
    }),
  }
});

// Memoize toàn bộ component
export default memo(MessageList); 