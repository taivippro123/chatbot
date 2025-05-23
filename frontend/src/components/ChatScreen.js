import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  PanResponder,
  Animated,
  Dimensions,
} from 'react-native';
import MessageList from './MessageList';
import InputBar from './InputBar';
import Header from './Header';

const SWIPE_THRESHOLD = 50;
const SIDEBAR_WIDTH = Dimensions.get('window').width * 0.7;

const ChatScreen = ({ 
  onOpenSidebar, 
  messages, 
  onSendMessage,
  theme
}) => {
  const [isPanning, setIsPanning] = useState(false);
  const pan = useRef(new Animated.ValueXY()).current;
  const isDark = theme === 'dark';

  const panResponder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gestureState) => {
      // Only respond to horizontal gestures
      return Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
    },
    onPanResponderGrant: () => {
      setIsPanning(true);
    },
    onPanResponderMove: (_, gestureState) => {
      // Only allow right swipe (positive dx)
      if (gestureState.dx > 0) {
        pan.x.setValue(gestureState.dx);
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      setIsPanning(false);
      if (gestureState.dx > SWIPE_THRESHOLD) {
        // Open sidebar
        onOpenSidebar();
      }
      // Reset position
      Animated.spring(pan.x, {
        toValue: 0,
        useNativeDriver: false,
      }).start();
    },
  });

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          transform: [{ translateX: pan.x }],
          backgroundColor: isDark ? '#343541' : '#fff',
        },
      ]}
      {...panResponder.panHandlers}
    >
      <Header theme={theme} />
      <MessageList 
        messages={messages}
        style={[styles.messageList, isPanning && styles.panning]}
        theme={theme}
      />
      <InputBar 
        onSendMessage={onSendMessage} 
        theme={theme}
      />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messageList: {
    flex: 1,
  },
  panning: {
    opacity: 0.7,
  },
});

export default ChatScreen; 