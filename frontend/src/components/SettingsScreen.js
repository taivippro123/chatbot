import React from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { translations } from '../translations';

const { height } = Dimensions.get('window');
const MODAL_HEIGHT = height * 0.6;

const SettingsScreen = ({
  visible,
  theme,
  language,
  onThemeChange,
  onLanguageChange,
  onClose,
}) => {
  const t = translations[language];
  const isDark = theme === 'dark';

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.modalOverlay}>
          <TouchableWithoutFeedback>
            <View style={[
              styles.modalContent,
              { 
                backgroundColor: isDark ? '#202123' : '#fff',
                shadowColor: isDark ? '#000' : '#000',
              }
            ]}>
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
                      onValueChange={(value) => onThemeChange(value ? 'dark' : 'light')}
                      trackColor={{ false: '#767577', true: '#81b0ff' }}
                      thumbColor={isDark ? '#fff' : '#f4f3f4'}
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
                    onPress={() => onLanguageChange('en')}
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
                    onPress={() => onLanguageChange('vi')}
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
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
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