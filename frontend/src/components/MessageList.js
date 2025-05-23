import React, { useRef, useEffect, useCallback, memo, useMemo } from 'react';
import { VirtualizedList, StyleSheet, View, PanResponder } from 'react-native';
import MessageItem from './MessageItem';
// import styles from '../styles/styles';

// Memoize MessageItem để tránh re-render không cần thiết
const MemoizedMessageItem = memo(MessageItem);

// Chunk size for message groups
const CHUNK_SIZE = 10;
const SWIPE_THRESHOLD = 50; // Minimum swipe distance to trigger sidebar

const MessageList = ({ 
  messages, 
  theme, 
  isPlaying, 
  currentPlayingId, 
  onPlayAudio,
  language,
  onOpenSidebar // New prop for opening sidebar
}) => {
  const isDark = theme === 'dark';
  const listRef = useRef(null);

  // Group messages into chunks for better performance
  const messageChunks = useMemo(() => {
    const chunks = [];
    for (let i = 0; i < messages.length; i += CHUNK_SIZE) {
      chunks.push(messages.slice(i, i + CHUNK_SIZE));
    }
    return chunks;
  }, [messages]);

  // Pan responder for swipe gesture
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      // Only respond to horizontal movements
      return Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
    },
    onPanResponderRelease: (_, gestureState) => {
      // If swiped right enough, open sidebar
      if (gestureState.dx > SWIPE_THRESHOLD) {
        onOpenSidebar();
      }
    },
  }), [onOpenSidebar]);

  // Scroll to bottom on new messages
  useEffect(() => {
    const timer = setTimeout(() => {
      if (messageChunks.length > 0) {
        listRef.current?.scrollToEnd({ animated: false });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [messageChunks.length]);

  const getItem = useCallback((data, index) => data[index], []);
  const getItemCount = useCallback((data) => data.length, []);

  const renderChunk = useCallback(({ item: chunk }) => {
    return (
      <View style={styles.chunkContainer}>
        {chunk.map((message) => (
          <MemoizedMessageItem
            key={message.id}
            message={message}
            theme={theme}
            isPlaying={isPlaying}
            currentPlayingId={currentPlayingId}
            onPlayAudio={onPlayAudio}
            isUser={message.sender === 'user'}
            language={language}
          />
        ))}
      </View>
    );
  }, [theme, isPlaying, currentPlayingId, onPlayAudio, language]);

  const getItemLayout = useCallback((data, index) => ({
    length: CHUNK_SIZE * 100, // Approximate height per chunk
    offset: (CHUNK_SIZE * 100) * index,
    index,
  }), []);

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <VirtualizedList
        ref={listRef}
        data={messageChunks}
        renderItem={renderChunk}
        getItem={getItem}
        getItemCount={getItemCount}
        getItemLayout={getItemLayout}
        style={[
          styles.list,
          { backgroundColor: isDark ? '#343541' : '#ffffff' }
        ]}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        
        // Performance optimizations
        removeClippedSubviews={true}
        maxToRenderPerBatch={2} // Render fewer chunks at a time
        updateCellsBatchingPeriod={50}
        windowSize={5} // Keep fewer items in memory
        initialNumToRender={2}
        
        // Maintain scroll position
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 10
        }}

        // Optimize memory usage
        onEndReachedThreshold={0.5}
        onEndReached={() => {}}
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
  },
  chunkContainer: {
    marginBottom: 8,
  }
});

// Memoize toàn bộ component
export default memo(MessageList); 