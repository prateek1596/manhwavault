import React, { useState, useEffect } from 'react';
import { View, StyleSheet, FlatList, Image, TouchableOpacity, Text } from 'react-native';
import { useTheme } from '@theme/ThemeContext';

export default function ReaderScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { chapterId, title } = route.params;
  const [images, setImages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    // Fetch chapter images
    // const fetchImages = async () => {
    //   try {
    //     // const response = await axios.post(`http://localhost:8000/chapter/${sourceId}/images`, {
    //     //   chapter_url: chapterUrl,
    //     // });
    //     // setImages(response.data.images);
    //   } catch (error) {
    //     console.error('Error fetching images:', error);
    //   }
    // };
    // fetchImages();
  }, [chapterId]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    image: {
      width: '100%',
      height: '100%',
      resizeMode: 'contain',
    },
    controls: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.7)',
      padding: 16,
    },
    controlsText: {
      color: '#ffffff',
      fontSize: 14,
    },
  });

  return (
    <View style={styles.container}>
      <FlatList
        data={images}
        renderItem={({ item }) => <Image source={{ uri: item.url }} style={styles.image} />}
        keyExtractor={(item, index) => index.toString()}
        scrollEventThrottle={16}
        onScroll={() => setShowControls(false)}
        onScrollEndDrag={() => setShowControls(true)}
        pagingEnabled
        scrollsToTop={false}
        scrollEnabled
      />

      {showControls && (
        <View style={styles.controls}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.controlsText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.controlsText}>
            {currentPage} / {images.length}
          </Text>
          <Text style={styles.controlsText}>Next →</Text>
        </View>
      )}
    </View>
  );
}
