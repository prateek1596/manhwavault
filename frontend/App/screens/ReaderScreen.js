import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StatusBar,
  useWindowDimensions,
} from 'react-native';
import { useTheme } from '@theme/ThemeContext';
import { api } from '@services/api';
import useReaderSettings from '../hooks/useReaderSettings';

export default function ReaderScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { title, sourceId, chapterUrl } = route.params;
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageSizes, setImageSizes] = useState({});
  const {
    settings,
    loading: readerSettingsLoading,
  } = useReaderSettings();

  const { width } = useWindowDimensions();
  const isVerticalFlow = settings.readingMode === 'vertical';

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
        const response = await api.get('/chapter/images', {
          params: {
            url: chapterUrl,
            source: sourceId,
          },
        });

        const payload = response.data || [];
        const chapterImages = payload.map((img, index) => {
          if (typeof img === 'string') {
            return { url: img, page_num: index + 1 };
          }
          return img;
        });
        setImages(chapterImages);
      } catch (fetchError) {
        console.error('Error fetching images:', fetchError);
        setError('Failed to load chapter images.');
      } finally {
        setLoading(false);
      }
    };

    fetchImages();
  }, [sourceId, chapterUrl]);

  useEffect(() => {
    if (!images.length) {
      return;
    }

    const urls = images.map((item) => item.url).filter(Boolean);
    const prefetchBatch = urls.map((url) => Image.prefetch(url));
    Promise.allSettled(prefetchBatch).catch(() => {});
  }, [images]);

  useEffect(() => {
    let cancelled = false;

    const loadSizes = async () => {
      const entries = await Promise.all(
        images.map(
          (item) =>
            new Promise((resolve) => {
              Image.getSize(
                item.url,
                (imgWidth, imgHeight) => resolve([item.url, { width: imgWidth, height: imgHeight }]),
                () => resolve([item.url, { width: width, height: Math.round(width * 1.5) }])
              );
            })
        )
      );

      if (!cancelled) {
        setImageSizes(Object.fromEntries(entries));
      }
    };

    if (images.length > 0) {
      loadSizes();
    }

    return () => {
      cancelled = true;
    };
  }, [images, width]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.background,
    },
    errorText: {
      color: colors.error,
      marginBottom: 12,
      textAlign: 'center',
      paddingHorizontal: 24,
    },
    pageContainer: {
      width: '100%',
      backgroundColor: '#000',
    },
    image: {
      width: '100%',
      resizeMode: settings.imageFit,
      backgroundColor: '#000',
    },
    readerStage: {
      backgroundColor: '#000',
      paddingBottom: 0,
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
        <TouchableOpacity style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }} onPress={() => navigation.goBack()}>
          <Text style={{ color: '#ffffff', fontWeight: '600' }}>Back</Text>
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
      <StatusBar hidden />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.readerStage}
        showsVerticalScrollIndicator={false}
      >
        {images.map((item, index) => {
          const size = imageSizes[item.url] || { width: width, height: Math.round(width * 1.5) };
          const aspectRatio = size.width && size.height ? size.width / size.height : 0.7;
          const imageHeight = Math.round(width / aspectRatio);

          return (
            <View key={`${item.url}-${index}`} style={styles.pageContainer}>
              <Image
                source={{ uri: item.url }}
                style={[
                  styles.image,
                  {
                    aspectRatio,
                    height: imageHeight,
                  },
                ]}
              />
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
