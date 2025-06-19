import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const NewsArticlePlayer = ({ article, onBack, onStop, onPlay, onForward, isPlaying, isPaused, theme }) => {
  const isDark = theme === 'dark';
  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#23232b' : '#f5f5f7' }]}>
      <View style={styles.controls}>
        <TouchableOpacity onPress={onBack} style={styles.controlBtn}>
          <Ionicons name="arrow-back" size={28} color={isDark ? '#fff' : '#007AFF'} />
        </TouchableOpacity>
        {isPlaying && !isPaused ? (
          <TouchableOpacity onPress={onStop} style={styles.controlBtn}>
            <Ionicons name="pause-circle" size={36} color="#ff4444" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={onPlay} style={styles.controlBtn}>
            <Ionicons name="play-circle" size={36} color={isDark ? '#fff' : '#4cd964'} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onForward} style={styles.controlBtn}>
          <Ionicons name="arrow-forward" size={28} color={isDark ? '#fff' : '#007AFF'} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
    alignItems: 'center',
  },
  title: {
    fontWeight: 'bold',
    fontSize: 17,
    marginBottom: 12,
    textAlign: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtn: {
    marginHorizontal: 18,
  },
});

export default NewsArticlePlayer; 