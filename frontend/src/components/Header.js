import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
// import styles from '../styles/styles';

const Header = ({ onMenuPress, theme, title, onLogout, onSettingsPress }) => {
    const isDark = theme === 'dark';

    return (
        <View style={[
            styles.header,
            {
                backgroundColor: isDark ? '#000' : '#fff',
                borderBottomColor: isDark ? '#333' : '#ccc'
            }
        ]}>
            <TouchableOpacity onPress={onMenuPress} style={styles.button}>
                <Ionicons
                    name="menu"
                    size={24}
                    color={isDark ? '#fff' : '#000'}
                />
            </TouchableOpacity>
            <Text style={[
                styles.title,
                { color: isDark ? '#fff' : '#000' }
            ]}>
                {title}
            </Text>

            <View style={styles.rightButtons}>
                <TouchableOpacity onPress={onSettingsPress} style={styles.button}>
                    <Ionicons
                        name="settings-outline"
                        size={24}
                        color={isDark ? '#fff' : '#000'}
                    />
                </TouchableOpacity>
                <TouchableOpacity onPress={onLogout} style={styles.button}>
                    <Ionicons
                        name="log-out-outline"
                        size={24}
                        color={isDark ? '#fff' : '#000'}
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
    },
    button: {
        padding: 8,
    },
    title: {
        flex: 1,
        fontSize: 20,
        fontWeight: 'bold',
        marginLeft: 8,
    },
    rightButtons: {
        flexDirection: 'row',
    },
});

export default Header; 