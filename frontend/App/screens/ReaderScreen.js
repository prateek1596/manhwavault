import React, { useState, useEffect, useRef } from 'react';
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
  Alert,
} from 'react-native';
import { useTheme } from '@theme/ThemeContext';
import { api, getReadingProgress, setReadingProgress } from '@services/api';
import { downloadChapter } from '@services/api';
import useReaderSettings from '../hooks/useReaderSettings';

export default function ReaderScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { title, sourceId, chapterUrl } = route.params;
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [imageSizes, setImageSizes] = useState({});
  const scrollRef = useRef(null);
  const lastSavedPageRef = useRef(null);
  const saveTimerRef = useRef(null);
  const {
    settings,
    loading: readerSettingsLoading,
  } = useReaderSettings();

  const { width, height } = useWindowDimensions();
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

    // Restore reading progress when images are available
    (async () => {
      try {
        const saved = await getReadingProgress({ mangaId: sourceId, chapterUrl });
        const pageNum = saved?.page_num || saved?.pageNum || 0;
        if (pageNum && scrollRef.current) {
          const y = Math.max(0, pageNum * (height));
          // approximate jump to page position
          scrollRef.current.scrollTo({ y, animated: false });
          lastSavedPageRef.current = pageNum;
        }
      } catch (e) {
        // ignore
      }
    })();

    const urls = images.map((item) => item.url).filter(Boolean);
    const prefetchBatch = urls.map((url) => Image.prefetch(url));
    Promise.allSettled(prefetchBatch).catch(() => {});
  }, [images]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

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
    downloadButton: {
      position: 'absolute',
      right: 12,
      top: 12,
      backgroundColor: '#111',
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      zIndex: 1000,
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

      <TouchableOpacity
        style={styles.downloadButton}
        onPress={async () => {
          try {
            Alert.alert('Download', 'Starting download...');
            const res = await downloadChapter({ chapterUrl, source: sourceId, title });
            Alert.alert('Download complete', `Saved ${res.files?.length || 0} files to ${res.path}`);
          } catch (e) {
            console.error('Download failed', e);
            Alert.alert('Download failed', e?.message || 'Unknown error');
          }
        }}
      >
        <Text style={{ color: '#fff', fontWeight: '600' }}>Download</Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.readerStage}
        showsVerticalScrollIndicator={false}
        onScroll={({ nativeEvent }) => {
          const offsetY = nativeEvent.contentOffset?.y || 0;
          const pageIndex = Math.max(0, Math.round(offsetY / (Math.max(1, height))));
          if (lastSavedPageRef.current === pageIndex) return;
          lastSavedPageRef.current = pageIndex;
          if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
          saveTimerRef.current = setTimeout(() => {
            try {
              setReadingProgress({
                userId: undefined,
                mangaId: sourceId,
                chapterUrl: chapterUrl,
                pageNum: pageIndex,
                position: 0,
              });
            } catch (e) {
              // ignore
            }
          }, 800);
        }}
        scrollEventThrottle={200}
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
