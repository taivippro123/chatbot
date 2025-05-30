import React, { useRef, useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  ScrollView,
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Audio } from 'expo-av';
import { API_URL } from '@env';
import { getAPILanguage } from '../utils/languageUtils';

const { width } = Dimensions.get('window');
const PREVIEW_IMAGE_SIZE = width * 0.2;

console.log('API_URL from env:', API_URL);

const InputBar = ({
  theme,
  inputText,
  setInputText,
  isRecording,
  setIsRecording,
  isLoading,
  setIsLoading,
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
  const [localInputText, setLocalInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedImages, setSelectedImages] = useState([]);

  // Update local input when parent input changes
  React.useEffect(() => {
    setLocalInputText(inputText);
  }, [inputText]);

  const requestPermissions = async () => {
    const { status: imageStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    
    if (imageStatus !== 'granted' || cameraStatus !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera and photo library permissions');
      return false;
    }
    return true;
  };

  const handleImageAction = () => {
    Alert.alert(
      t.selectImage || 'Select Image',
      t.chooseOption || 'Choose an option',
      [
        {
          text: t.takePhoto || 'Take Photo',
          onPress: () => launchCamera(),
        },
        {
          text: t.chooseFromLibrary || 'Choose from Library',
          onPress: () => pickImage(),
        },
        {
          text: t.cancel || 'Cancel',
          style: 'cancel',
        },
      ],
    );
  };

  const launchCamera = async () => {
    if (!await requestPermissions()) return;

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImage = result.assets[0];
        setSelectedImages(prev => [...prev, newImage.uri]);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert(t.error || 'Error', t.couldNotTakePhoto || 'Could not take photo');
    }
  };

  const pickImage = async () => {
    if (!await requestPermissions()) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        aspect: [4, 3],
        quality: 0.8,
        selectionLimit: 10,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImages = result.assets.map(asset => asset.uri);
        setSelectedImages(prev => {
          const combined = [...prev, ...newImages];
          if (combined.length > 10) {
            Alert.alert(t.error || 'Error', t.maxImagesLimit || 'Maximum 10 images allowed');
            return combined.slice(0, 10);
          }
          return combined;
        });
      }
    } catch (error) {
      console.error('Error picking images:', error);
      Alert.alert(t.error || 'Error', t.couldNotPickImages || 'Could not pick images');
    }
  };

  const removeImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

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

  const sendMessage = async () => {
    if (!localInputText.trim() && selectedImages.length === 0) return;
    if (!token) {
      Alert.alert(t.error || 'Error', t.pleaseLoginFirst || 'Please login first');
      return;
    }

    try {
      setIsSending(true);
      const currentText = localInputText;
      const currentImages = [...selectedImages];
      
      // Clear input immediately
      setLocalInputText('');
      setInputText('');
      setSelectedImages([]);

      const formData = new FormData();
      formData.append('text', currentText);
      formData.append('language', getAPILanguage(currentText, language));

      // Append all images
      currentImages.forEach((imageUri, index) => {
        const filename = imageUri.split('/').pop();
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image/jpeg';

        formData.append('images', {
          uri: Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri,
          type,
          name: filename,
        });
      });

      if (currentConversationId) {
        formData.append('conversation_id', currentConversationId);
      }

      // Add temporary message
      const userMessage = {
        id: Date.now().toString(),
        text: currentText,
        images: currentImages,
        sender: 'user',
        created_at: new Date().toISOString()
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
        throw new Error(t.failedToSendMessage || 'Failed to send message');
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
            images: data.userMessage.images || currentImages
          },
          data.aiMessage
        ];
      });
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert(t.error || 'Error', error.message);
      setMessages(prev => prev.slice(0, -1));
      // Restore input text and images if sending failed
      setLocalInputText(currentText);
      setInputText(currentText);
      setSelectedImages(currentImages);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={[
      styles.container,
      { backgroundColor: isDark ? '#40414f' : '#fff' }
    ]}>
      {selectedImages.length > 0 && (
        <ScrollView 
          horizontal 
          style={styles.imagePreviewScroll}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.imagePreviewContent}
        >
          {selectedImages.map((uri, index) => (
            <View key={index} style={styles.imagePreview}>
              <Image
                source={{ uri }}
                style={styles.previewImage}
                resizeMode="cover"
              />
              <TouchableOpacity
                style={styles.removeImage}
                onPress={() => removeImage(index)}
              >
                <Ionicons name="close-circle" size={24} color="#ff4444" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.inputContainer}>
        <TouchableOpacity
          style={[
            styles.button,
            selectedImages.length >= 10 && styles.disabledButton
          ]}
          onPress={handleImageAction}
          disabled={isLoading || isSending || selectedImages.length >= 10}
        >
          <Ionicons
            name="image-outline"
            size={24}
            color={isDark ? '#fff' : '#666'}
            style={[
              (isLoading || isSending || selectedImages.length >= 10) && 
              { opacity: 0.5 }
            ]}
          />
        </TouchableOpacity>

        <TextInput
          style={[
            styles.input,
            { color: isDark ? '#fff' : '#000' }
          ]}
          placeholder={t.askAnything || 'Ask anything...'}
          placeholderTextColor={isDark ? '#8e8ea0' : '#999'}
          value={localInputText}
          onChangeText={(text) => {
            setLocalInputText(text);
            setInputText(text);
          }}
          multiline
          editable={!isLoading && !isSending}
        />

        <TouchableOpacity
          style={[
            styles.button,
            isRecording && styles.recordingButton
          ]}
          onPress={handleRecordPress}
          disabled={isLoading || isSending}
        >
          <Ionicons
            name={isRecording ? "stop-circle" : "mic-outline"}
            size={24}
            color={isRecording ? '#ff4444' : (isDark ? '#fff' : '#666')}
            style={[isLoading || isSending ? { opacity: 0.5 } : null]}
          />
        </TouchableOpacity>

        {isSending ? (
          <ActivityIndicator color={isDark ? '#fff' : '#007AFF'} style={styles.sendButton} />
        ) : (
          (localInputText.trim() || selectedImages.length > 0) ? (
            <TouchableOpacity
              style={[styles.button, styles.sendButton]}
              onPress={sendMessage}
              disabled={isSending}
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
    paddingVertical: 8,
  },
  button: {
    padding: 8,
    borderRadius: 20,
  },
  disabledButton: {
    opacity: 0.5,
  },
  recordingButton: {
    backgroundColor: 'rgba(255, 68, 68, 0.1)',
  },
  imagePreviewScroll: {
    maxHeight: PREVIEW_IMAGE_SIZE + 20,
    marginBottom: 10,
  },
  imagePreviewContent: {
    paddingHorizontal: 5,
  },
  imagePreview: {
    marginHorizontal: 5,
    position: 'relative',
    borderRadius: 10,
    overflow: 'hidden',
  },
  previewImage: {
    width: PREVIEW_IMAGE_SIZE,
    height: PREVIEW_IMAGE_SIZE,
    borderRadius: 10,
  },
  removeImage: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#fff',
    borderRadius: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  sendButton: {
    padding: 8,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center'
  }
});

export default InputBar; 