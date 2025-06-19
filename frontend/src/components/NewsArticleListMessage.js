import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const NewsArticleListMessage = ({ articles, onSelect, selectedIndex, theme }) => {
  const isDark = theme === 'dark';
  return (
    <View style={[styles.container, { backgroundColor: isDark ? '#23232b' : '#f5f5f7' }]}>
      <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>Danh sách bài báo:</Text>
      {articles.map((article, idx) => (
        <TouchableOpacity
          key={article.url}
          style={[
            styles.item,
            { borderBottomColor: isDark ? '#333' : '#eee' },
            selectedIndex === idx && (isDark ? styles.selectedItemDark : styles.selectedItem)
          ]}
          onPress={() => onSelect(idx)}
        >
          <Text style={[styles.itemText, { color: isDark ? '#fff' : '#222', fontWeight: selectedIndex === idx ? 'bold' : 'normal' }]}>
            {idx + 1}. {article.title}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    padding: 12,
    marginVertical: 8,
  },
  title: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 8,
  },
  item: {
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  selectedItem: {
    backgroundColor: '#e0eaff',
  },
  selectedItemDark: {
    backgroundColor: '#2a3a5a',
  },
  itemText: {
    fontSize: 15,
  },
});

export default NewsArticleListMessage; 