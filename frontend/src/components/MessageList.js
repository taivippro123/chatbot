import React, { useRef, useEffect } from 'react';
import { FlatList, StyleSheet, ScrollView, View } from 'react-native';
import MessageItem from './MessageItem';
// import styles from '../styles/styles';

const MessageList = ({ 
  messages, 
  theme, 
  isPlaying, 
  currentPlayingId, 
  onPlayAudio,
  language
}) => {
  const isDark = theme === 'dark';
  const flatListRef = useRef(null);

  useEffect(() => {
    if (messages.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [messages]);

  const renderItem = ({ item }) => (
    <MessageItem
      message={item}
      theme={theme}
      isPlaying={isPlaying}
      currentPlayingId={currentPlayingId}
      onPlayAudio={onPlayAudio}
      isUser={item.sender === 'user'}
      language={language}
    />
  );

  return (
    <FlatList
      ref={flatListRef}
      data={messages}
      renderItem={renderItem}
      keyExtractor={(item) => item.id}
      style={[
        styles.container,
        { backgroundColor: isDark ? '#343541' : '#ffffff' }
      ]}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  }
});

export default MessageList; 