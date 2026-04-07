import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useTheme } from '@theme/ThemeContext';
import { api } from '@services/api';
import useReaderSettings from '../hooks/useReaderSettings';

export default function ReaderScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { title, sourceId, chapterUrl } = route.params;
  const [images, setImages] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const {
    settings,
    loading: readerSettingsLoading,
  } = useReaderSettings();

  const { width, height } = Dimensions.get('window');
  const isPaged = settings.readingMode === 'paged';

  useEffect(() => {
    const fetchImages = async () => {
      if (!sourceId || !chapterUrl) {
        setError('Missing chapter info. Please reopen this chapter.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const response = await api.post(`/chapter/${sourceId}/images`, {
          chapter_url: chapterUrl,
        });

        const chapterImages = response.data?.images ?? [];
        setImages(chapterImages);
        setCurrentPage(chapterImages.length > 0 ? 1 : 0);
      } catch (fetchError) {
        console.error('Error fetching images:', fetchError);
        setError('Failed to load chapter images.');
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, [sourceId, chapterUrl]);

  const onViewableItemsChanged = React.useRef(({ viewableItems }) => {
    if (!viewableItems || viewableItems.length === 0) {
      return;
    }

    const firstVisible = viewableItems[0];
    if (typeof firstVisible.index === 'number') {
      setCurrentPage(firstVisible.index + 1);
    }
  }).current;

  const viewabilityConfig = React.useRef({
    itemVisiblePercentThreshold: 65,
  }).current;

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    errorText: {
      color: colors.error,
      marginBottom: 12,
      textAlign: 'center',
      paddingHorizontal: 24,
    },
    retryButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 8,
    },
    retryButtonText: {
      color: '#ffffff',
      fontWeight: '600',
    },
    pageContainer: {
      width,
      minHeight: isPaged ? height : 380,
      backgroundColor: colors.background,
    },
    image: {
      width: '100%',
      height: isPaged ? height : 420,
      resizeMode: settings.imageFit,
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
    chapterTitle: {
      position: 'absolute',
      top: 42,
      left: 12,
      right: 12,
      color: '#ffffff',
      fontSize: 12,
      textAlign: 'center',
      backgroundColor: 'rgba(0,0,0,0.5)',
      borderRadius: 6,
      paddingVertical: 6,
      paddingHorizontal: 8,
    },
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (readerSettingsLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => navigation.goBack()}>
          <Text style={styles.retryButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (images.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={{ color: colors.textSecondary }}>No images found for this chapter.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={images}
        renderItem={({ item }) => (
          <View style={styles.pageContainer}>
            <Image source={{ uri: item.url }} style={styles.image} />
          </View>
        )}
        keyExtractor={(item, index) => `${item.url}-${index}`}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => isPaged && setShowControls(false)}
        onMomentumScrollEnd={() => isPaged && setShowControls(true)}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        pagingEnabled={isPaged}
        showsVerticalScrollIndicator={false}
      />

      {showControls && (
        <>
          <Text style={styles.chapterTitle} numberOfLines={1}>
            {title || 'Reader'}
          </Text>

          <View style={styles.controls}>
            <TouchableOpacity onPress={() => navigation.goBack()}>
              <Text style={styles.controlsText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.controlsText}>
              {currentPage} / {images.length}
            </Text>
            <Text style={styles.controlsText}>{isPaged ? 'Swipe' : 'Scroll'}</Text>
          </View>
        </>
      )}
    </View>
  );
}
