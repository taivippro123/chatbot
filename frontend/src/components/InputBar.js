import React, { useRef } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';

const API_URL = 'https://chatbot-erif.onrender.com/api';

const InputBar = ({
  theme,
  inputText,
  setInputText,
  selectedImage,
  setSelectedImage,
  isRecording,
  setIsRecording,
  isLoading,
  language,
  t,
  token,
  setMessages,
  currentConversationId,
  setCurrentConversationId,
  loadConversations
}) => {
  const recording = useRef(null);
  const isDark = theme === 'dark';

  const handleStartRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant microphone permission');
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await newRecording.startAsync();
      recording.current = newRecording;
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      Alert.alert('Error', 'Failed to start recording');
    }
  };

  const handleStopRecording = async () => {
    try {
      if (!recording.current) return;
      
      await recording.current.stopAndUnloadAsync();
      const uri = recording.current.getURI();
      recording.current = null;
      setIsRecording(false);

      const formData = new FormData();
      formData.append('audio', {
        uri,
        type: 'audio/m4a',
        name: 'recording.m4a',
      });
      formData.append('language', language === 'vi' ? 'vi-VN' : 'en-US');

      const response = await fetch(`${API_URL}/speech`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        throw new Error('Speech to text failed');
      }

      const { text } = await response.json();
      if (text) {
        setInputText(text);
      } else {
        throw new Error('No text returned from speech recognition');
      }
    } catch (error) {
      console.error('Error stopping recording:', error);
      Alert.alert(t.error, t.speechToTextFailed);
    }
  };

  const handleRecordPress = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled) {
        setSelectedImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Could not pick image');
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() && !selectedImage) return;
    if (!token) {
      Alert.alert('Error', 'Please login first');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('message', inputText);

      let imageUrl = null;
      if (selectedImage) {
        const imageUri = Platform.OS === 'ios' ? selectedImage.replace('file://', '') : selectedImage;
        const filename = imageUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('image', {
          uri: imageUri,
          type,
          name: filename,
        });
        imageUrl = selectedImage;
      }

      if (currentConversationId) {
        formData.append('conversation_id', currentConversationId);
      }

      const userMessage = {
        id: Date.now().toString(),
        text: inputText,
        image: imageUrl,
        sender: 'user',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);

      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      const data = await response.json();

      if (!currentConversationId) {
        setCurrentConversationId(data.conversation_id);
        loadConversations();
      }

      setMessages(prev => {
        const messagesWithoutTemp = prev.slice(0, -1);
        return [
          ...messagesWithoutTemp,
          {
            ...data.userMessage,
            image: data.userMessage.image || imageUrl
          },
          data.aiMessage
        ];
      });

      setInputText('');
      setSelectedImage(null);
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', error.message);
      setMessages(prev => prev.slice(0, -1));
    }
  };

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
          onPress={pickImage}
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
          onPress={handleRecordPress}
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
              onPress={sendMessage}
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