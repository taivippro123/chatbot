import React from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const InputBar = ({
  theme,
  inputText,
  setInputText,
  selectedImage,
  setSelectedImage,
  isRecording,
  isLoading,
  onPickImage,
  onRecordPress,
  onSendPress,
  language,
  t
}) => {
  const isDark = theme === 'dark';

  return (
    <View style={[
      styles.container,
      { backgroundColor: isDark ? '#40414f' : '#fff' }
    ]}>
      {selectedImage && (
        <View style={styles.imagePreview}>
          <Image
            source={{ uri: selectedImage }}
            style={styles.previewImage}
          />
          <TouchableOpacity
            style={styles.removeImage}
            onPress={() => setSelectedImage(null)}
          >
            <Ionicons name="close-circle" size={24} color="#ff4444" />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={onPickImage}
          disabled={isLoading}
        >
          <Ionicons
            name="image-outline"
            size={24}
            color={isDark ? '#fff' : '#666'}
          />
        </TouchableOpacity>

        <TextInput
          style={[
            styles.input,
            { color: isDark ? '#fff' : '#000' }
          ]}
          placeholder={t.askAnything}
          placeholderTextColor={isDark ? '#8e8ea0' : '#999'}
          value={inputText}
          onChangeText={setInputText}
          multiline
          editable={!isLoading}
        />

        <TouchableOpacity
          style={[
            styles.button,
            isRecording && styles.recordingButton
          ]}
          onPress={() => onRecordPress(language)}
          disabled={isLoading}
        >
          <Ionicons
            name={isRecording ? "stop-circle" : "mic-outline"}
            size={24}
            color={isRecording ? '#ff4444' : (isDark ? '#fff' : '#666')}
          />
        </TouchableOpacity>

        {isLoading ? (
          <ActivityIndicator color={isDark ? '#fff' : '#666'} />
        ) : (
          inputText.trim() || selectedImage ? (
            <TouchableOpacity
              style={styles.button}
              onPress={onSendPress}
            >
              <Ionicons
                name="send"
                size={24}
                color="#007AFF"
              />
            </TouchableOpacity>
          ) : null
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    marginHorizontal: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  button: {
    padding: 8,
  },
  recordingButton: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
    borderRadius: 20,
  },
  imagePreview: {
    marginBottom: 10,
    position: 'relative',
    alignSelf: 'flex-start',
  },
  previewImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  removeImage: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
});

export default InputBar; 