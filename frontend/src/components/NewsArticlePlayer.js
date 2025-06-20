import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const NewsArticlePlayer = ({ article, onBack, onStop, onPlay, onForward, isPlaying, isPaused, theme, isAutoPlay, onToggleAutoPlay, t }) => {
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
      <TouchableOpacity onPress={onToggleAutoPlay} style={[styles.autoPlayBtn, isAutoPlay && (isDark ? styles.autoPlayBtnActiveDark : styles.autoPlayBtnActive)]}>
        <Ionicons name={isAutoPlay ? 'infinite' : 'infinite-outline'} size={22} color={isAutoPlay ? (isDark ? '#4cd964' : '#007AFF') : (isDark ? '#fff' : '#888')} />
        <Text style={[styles.autoPlayText, { color: isDark ? '#fff' : '#222', marginLeft: 6 }]}> 
          {t?.autoPlay || 'Auto Play'}: {t?.[isAutoPlay ? 'on' : 'off'] || (isAutoPlay ? 'On' : 'Off')}
        </Text>
      </TouchableOpacity>
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
  autoPlayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    alignSelf: 'center',
  },
  autoPlayBtnActive: {
    borderColor: '#007AFF',
    backgroundColor: '#e0eaff',
  },
  autoPlayBtnActiveDark: {
    borderColor: '#4cd964',
    backgroundColor: '#2a3a5a',
  },
  autoPlayText: {
    fontSize: 15,
    fontWeight: '500',
  },
});

export default NewsArticlePlayer; 