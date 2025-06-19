import React, { useState, useEffect } from 'react';
import {
  Platform,
  SafeAreaView,
  StatusBar,
  View,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import AuthScreen, { authAPI } from './src/components/AuthScreen';
import SettingsScreen, { settingsAPI } from './src/components/SettingsScreen';
import ChatScreen, { chatAPI } from './src/components/ChatScreen';
import NewsReaderScreen from './src/components/NewsReaderScreen';
import { translations } from './src/translations';

export default function App() {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({ theme: 'light', language: 'vi', handsFreeMode: false });
  const [language, setLanguage] = useState('vi');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const authData = await authAPI.loadTokenAndUser();
        if (authData) {
          setToken(authData.token);
          setUser(authData.user);
        }
        
        settingsAPI.loadSettings(
          (theme) => setSettings(prev => ({ ...prev, theme })),
          setLanguage,
          (handsFreeMode) => setSettings(prev => ({ ...prev, handsFreeMode }))
        );
      } catch (error) {
        console.error('Error initializing app:', error);
      }
    };
    
    initializeApp();
  }, []);

  const handleAuthSuccess = (newToken, userData) => {
    setToken(newToken);
    setUser(userData);
  };

  const handleLogout = async () => {
    if (await authAPI.handleLogout()) {
      setToken(null);
      setUser(null);
    }
  };

  const handleThemeChange = (newTheme) => {
    setSettings(prev => ({ ...prev, theme: newTheme }));
  };

  const handleLanguageChange = (newLanguage) => {
    setLanguage(newLanguage);
  };

  const handleHandsFreeModeChange = (newHandsFreeMode) => {
    setSettings(prev => ({ ...prev, handsFreeMode: newHandsFreeMode }));
  };

  if (!token || !user) {
    return (
      <SafeAreaProvider>
        <AuthScreen 
          onAuthSuccess={handleAuthSuccess} 
          language={language} 
        />
      </SafeAreaProvider>
    );
  }

  const t = translations[language];
  const isDark = settings.theme === 'dark';
  const backgroundColor = isDark ? '#343541' : '#ffffff';

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor }}>
        <StatusBar 
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={backgroundColor}
        />
        
        <SafeAreaView style={{ flex: 1 }}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={{ flex: 1 }}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            {settings.handsFreeMode ? (
              <NewsReaderScreen
                theme={settings.theme}
                token={token}
                t={t}
                onLogout={handleLogout}
                onSettingsPress={() => setIsSettingsOpen(true)}
                handsFreeMode={settings.handsFreeMode}
              />
            ) : (
              <ChatScreen
                theme={settings.theme}
                token={token}
                t={t}
                onLogout={handleLogout}
                onSettingsPress={() => setIsSettingsOpen(true)}
                handsFreeMode={settings.handsFreeMode}
              />
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>

        <SettingsScreen
          visible={isSettingsOpen}
          theme={settings.theme}
          language={language}
          handsFreeMode={settings.handsFreeMode}
          onThemeChange={handleThemeChange}
          onLanguageChange={handleLanguageChange}
          onHandsFreeModeChange={handleHandsFreeModeChange}
          onClose={() => setIsSettingsOpen(false)}
        />
      </View>
    </SafeAreaProvider>
  );
} 
