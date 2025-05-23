import React from 'react';
import { View, Text, TouchableOpacity, FlatList, Dimensions, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const SIDEBAR_WIDTH = width * 0.7;

const Sidebar = ({
  theme,
  conversations,
  currentConversationId,
  onConversationPress,
  onClose,
  onNewChat,
  t // translations object
}) => {
  const isDark = theme === 'dark';

  // Get last message preview - limit to first 50 characters
  const getPreviewText = (messages) => {
    if (!messages || messages.length === 0) return '';
    const lastMessage = messages[messages.length - 1];
    const text = lastMessage.text || '';
    return text.length > 50 ? text.substring(0, 50) + '...' : text;
  };

  const renderEmptyComponent = () => (
    <View style={styles.emptyContainer}>
      <Text style={[
        styles.emptyText,
        { color: isDark ? '#fff' : '#666' }
      ]}>
        {t.noConversations}
      </Text>
      <TouchableOpacity
        style={[styles.newChatButton, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }]}
        onPress={onNewChat}
      >
        <Ionicons name="add-circle-outline" size={24} color={isDark ? '#fff' : '#000'} />
        <Text style={[styles.newChatText, { color: isDark ? '#fff' : '#000' }]}>
          {t.newChat || 'New Chat'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <TouchableOpacity 
      style={styles.overlay}
      activeOpacity={1} 
      onPress={onClose}
    >
      <View style={[
        styles.sidebar,
        { backgroundColor: isDark ? '#1C1C1E' : '#fff' }
      ]}>
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={(e) => e.stopPropagation()}
          style={styles.content}
        >
          <View style={[
            styles.header,
            { borderBottomColor: isDark ? '#333' : '#ccc' }
          ]}>
            <View style={styles.headerContent}>
              <Text style={[
                styles.title,
                { color: isDark ? '#fff' : '#000' }
              ]}>
                {t.conversations}
              </Text>
              <TouchableOpacity
                style={styles.newChatIcon}
                onPress={onNewChat}
              >
                <Ionicons 
                  name="add-circle-outline" 
                  size={28} 
                  color={isDark ? '#fff' : '#000'} 
                />
              </TouchableOpacity>
            </View>
          </View>

          <FlatList
            data={conversations}
            keyExtractor={item => item.id.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.conversationItem,
                  currentConversationId === item.id && styles.activeConversation,
                  { 
                    backgroundColor: currentConversationId === item.id 
                      ? (isDark ? '#2C2C2E' : '#E5E5EA')
                      : 'transparent',
                    borderBottomColor: isDark ? '#333' : '#eee'
                  }
                ]}
                onPress={() => onConversationPress(item.id)}
              >
                <View style={styles.conversationContent}>
                  <Text 
                    style={[
                      styles.conversationTitle,
                      { color: isDark ? '#fff' : '#000' }
                    ]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.title || t.newChat}
                  </Text>
                  <Text 
                    style={[
                      styles.conversationPreview,
                      { color: isDark ? '#999' : '#666' }
                    ]}
                    numberOfLines={1}
                  >
                    {getPreviewText(item.messages)}
                  </Text>
                  <Text 
                    style={[
                      styles.conversationDate,
                      { color: isDark ? '#999' : '#666' }
                    ]}
                  >
                    {new Date(item.updated_at).toLocaleDateString()}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={renderEmptyComponent}
            contentContainerStyle={styles.listContent}
          />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    zIndex: 1000,
  },
  sidebar: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  content: {
    flex: 1,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    marginTop: 44, // For status bar
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  newChatIcon: {
    padding: 4,
  },
  listContent: {
    flexGrow: 1,
  },
  conversationItem: {
    padding: 16,
    borderBottomWidth: 1,
  },
  activeConversation: {
    borderRadius: 8,
    margin: 4,
  },
  conversationContent: {
    flex: 1,
  },
  conversationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  conversationPreview: {
    fontSize: 14,
    marginBottom: 4,
  },
  conversationDate: {
    fontSize: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  newChatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  newChatText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default Sidebar; 