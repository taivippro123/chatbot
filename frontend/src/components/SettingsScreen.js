import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ScrollView,
  Modal,
  Dimensions,
  TouchableWithoutFeedback,
  Animated,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { translations } from '../translations';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { height, width } = Dimensions.get('window');
const MODAL_HEIGHT = height * 0.6;
const SWIPE_THRESHOLD = 50;

// Settings API functions
export const settingsAPI = {
  loadSettings: async (onThemeChange, onLanguageChange, onHandsFreeModeChange) => {
    try {
      const savedSettings = await AsyncStorage.getItem('settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        onThemeChange(parsed.theme || 'light');
        onLanguageChange(parsed.language || 'vi');
        if (onHandsFreeModeChange) {
          onHandsFreeModeChange(parsed.handsFreeMode || false);
        }
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  },

  saveSettings: async (theme, language, handsFreeMode = false) => {
    try {
      const settings = { theme, language, handsFreeMode };
      await AsyncStorage.setItem('settings', JSON.stringify(settings));
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  }
};

const SettingsScreen = ({
  visible,
  theme,
  language,
  handsFreeMode,
  onThemeChange,
  onLanguageChange,
  onHandsFreeModeChange,
  onClose,
}) => {
  const t = translations[language];
  const isDark = theme === 'dark';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;

  const resetAnimationConfig = {
    toValue: 0,
    duration: 200,
    useNativeDriver: true,
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        const { dx, dy } = gestureState;
        return Math.abs(dx) > 20 || Math.abs(dy) > 20;
      },
      onPanResponderMove: (_, gestureState) => {
        const { dx, dy } = gestureState;
        if (Math.abs(dx) > Math.abs(dy)) {
          // Horizontal swipe - don't move
          return;
        }
        if (dy > 0) { // Only allow downward swipe
          panY.setValue(dy);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dy, dx } = gestureState;
        
        if (Math.abs(dx) > Math.abs(dy) && dx > SWIPE_THRESHOLD) {
          // Handle horizontal swipe
          onClose();
          return;
        }
        
        if (dy > SWIPE_THRESHOLD) {
          // User swiped down
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }).start(onClose);
        } else {
          // Reset position
          Animated.spring(panY, resetAnimationConfig).start();
        }
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      panY.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const handleThemeChange = async (newTheme) => {
    try {
      if (await settingsAPI.saveSettings(newTheme, language, handsFreeMode)) {
        onThemeChange(newTheme);
      }
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  const handleLanguageChange = async (newLanguage) => {
    try {
      if (await settingsAPI.saveSettings(theme, newLanguage, handsFreeMode)) {
        onLanguageChange(newLanguage);
      }
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const handleHandsFreeModeChange = async (newHandsFreeMode) => {
    try {
      if (await settingsAPI.saveSettings(theme, language, newHandsFreeMode)) {
        onHandsFreeModeChange(newHandsFreeMode);
      }
    } catch (error) {
      console.error('Error saving hands-free mode:', error);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View 
        style={[
          styles.modalOverlay,
          { opacity: fadeAnim }
        ]}
      >
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <Animated.View 
                {...panResponder.panHandlers}
                style={[
                  styles.modalContent,
                  { 
                    backgroundColor: isDark ? '#202123' : '#fff',
                    shadowColor: isDark ? '#000' : '#000',
                    transform: [
                      {
                        translateY: panY
                      }
                    ]
                  }
                ]}
              >
                <View style={[
                  styles.header,
                  { borderBottomColor: isDark ? '#333' : '#eee' }
                ]}>
                  <Text style={[
                    styles.title,
                    { color: isDark ? '#fff' : '#000' }
                  ]}>
                    {t.settings}
                  </Text>
                  <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Ionicons
                      name="close"
                      size={24}
                      color={isDark ? '#fff' : '#000'}
                    />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.content}>
                  {/* Appearance Section */}
                  <View style={styles.section}>
                    <Text style={[
                      styles.sectionTitle,
                      { color: isDark ? '#fff' : '#000' }
                    ]}>
                      {t.appearance}
                    </Text>
                    <View style={[
                      styles.option,
                      { backgroundColor: isDark ? '#2D2D2D' : '#f5f5f5' }
                    ]}>
                      <Text style={[
                        styles.optionText,
                        { color: isDark ? '#fff' : '#000' }
                      ]}>
                        {t.darkMode}
                      </Text>
                      <Switch
                        value={isDark}
                        onValueChange={(value) => handleThemeChange(value ? 'dark' : 'light')}
                        trackColor={{ false: '#767577', true: '#81b0ff' }}
                        thumbColor={isDark ? '#fff' : '#f4f3f4'}
                      />
                    </View>
                    <View style={[
                      styles.option,
                      { backgroundColor: isDark ? '#2D2D2D' : '#f5f5f5', marginTop: 8 }
                    ]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[
                          styles.optionText,
                          { color: isDark ? '#fff' : '#000' }
                        ]}>
                          {t.handsFreeMode}
                        </Text>
                        <Text style={[
                          styles.optionSubText,
                          { color: isDark ? '#888' : '#666' }
                        ]}>
                          {t.newsReaderDescription}
                        </Text>
                      </View>
                      <Switch
                        value={handsFreeMode}
                        onValueChange={handleHandsFreeModeChange}
                        trackColor={{ false: '#767577', true: '#81b0ff' }}
                        thumbColor={handsFreeMode ? '#fff' : '#f4f3f4'}
                      />
                    </View>
                  </View>

                  {/* Language Section */}
                  <View style={styles.section}>
                    <Text style={[
                      styles.sectionTitle,
                      { color: isDark ? '#fff' : '#000' }
                    ]}>
                      {t.language}
                    </Text>
                    <TouchableOpacity
                      style={[
                        styles.languageOption,
                        language === 'en' && styles.selectedLanguage,
                        { 
                          backgroundColor: isDark ? '#2D2D2D' : '#f5f5f5',
                          borderColor: isDark ? '#333' : '#ddd' 
                        }
                      ]}
                      onPress={() => handleLanguageChange('en')}
                    >
                      <Text style={[
                        styles.languageText,
                        { color: isDark ? '#fff' : '#000' }
                      ]}>
                        {t.english}
                      </Text>
                      {language === 'en' && (
                        <Ionicons
                          name="checkmark"
                          size={20}
                          color={isDark ? '#fff' : '#000'}
                        />
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.languageOption,
                        language === 'vi' && styles.selectedLanguage,
                        { 
                          backgroundColor: isDark ? '#2D2D2D' : '#f5f5f5',
                          borderColor: isDark ? '#333' : '#ddd' 
                        }
                      ]}
                      onPress={() => handleLanguageChange('vi')}
                    >
                      <Text style={[
                        styles.languageText,
                        { color: isDark ? '#fff' : '#000' }
                      ]}>
                        {t.vietnamese}
                      </Text>
                      {language === 'vi' && (
                        <Ionicons
                          name="checkmark"
                          size={20}
                          color={isDark ? '#fff' : '#000'}
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                </ScrollView>
              </Animated.View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: MODAL_HEIGHT,
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  closeButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  optionText: {
    fontSize: 16,
  },
  optionSubText: {
    fontSize: 12,
    marginTop: 2,
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
  },
  selectedLanguage: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  languageText: {
    fontSize: 16,
  },
});

export default SettingsScreen; 