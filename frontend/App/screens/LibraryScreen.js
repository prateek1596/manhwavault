import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@theme/ThemeContext';

export default function LibraryScreen({ navigation }) {
  const { colors } = useTheme();
  const [library, setLibrary] = useState([]);

  useEffect(() => {
    // Load user's library from storage
    // AsyncStorage.getItem('library').then((data) => {
    //   if (data) {
    //     setLibrary(JSON.parse(data));
    //   }
    // });
  }, []);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: 16,
    },
    emptyText: {
      textAlign: 'center',
      color: colors.textSecondary,
      marginTop: 32,
    },
  });

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {library.length === 0 ? (
          <Text style={styles.emptyText}>Your library is empty. Start searching!</Text>
        ) : (
          <Text style={{ color: colors.text }}>Library items: {library.length}</Text>
        )}
      </View>
    </ScrollView>
  );
}
