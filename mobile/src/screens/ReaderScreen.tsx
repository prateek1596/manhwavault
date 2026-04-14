import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, FlatList, Image, TouchableOpacity, TouchableWithoutFeedback,
  Dimensions, StyleSheet, StatusBar, useWindowDimensions,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useKeepAwake } from 'expo-keep-awake';
import { useAppTheme } from '../theme';
import { useLibraryStore, useSettingsStore } from '../store';
import { LoadingSpinner } from '../components';
import * as api from '../api/client';
import { Chapter, Manhwa, ReadingMode } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ReaderScreenProps {
  route: {
    params: {
      manhwa: Manhwa;
      chapter: Chapter;
      chapterList: Chapter[];
    };
  };
  navigation: any;
}

type ReaderImageQuality = 'low' | 'medium' | 'high';

function KeepAwakeLock() {
  useKeepAwake();
  return null;
}

export function ReaderScreen({ route, navigation }: ReaderScreenProps) {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const theme = useAppTheme();
  const { manhwa, chapter, chapterList } = route.params;
  const { defaultReadingMode, keepScreenOn, imageQuality } = useSettingsStore();
  const { setLastRead } = useLibraryStore();

  const [mode, setMode] = useState<ReadingMode>(defaultReadingMode);
  const [showControls, setShowControls] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const { data: images = [], isLoading } = useQuery<string[]>({
    queryKey: ['images', chapter.url],
    queryFn: () => api.getChapterImages(chapter.url, manhwa.source),
  });

  useEffect(() => {
    if (images.length > 0) {
      setLastRead(manhwa.id, chapter);
    }
  }, [images, manhwa.id, chapter, setLastRead]);

  const currentChapterIndex = chapterList.findIndex((c) => c.id === chapter.id);
  const prevChapter = chapterList[currentChapterIndex + 1];
  const nextChapter = chapterList[currentChapterIndex - 1];

  const goToChapter = (ch: Chapter) => {
    navigation.replace('Reader', { manhwa, chapter: ch, chapterList });
  };

  const toggleMode = () => setMode((m) => (m === 'vertical' ? 'horizontal' : 'vertical'));

  if (isLoading) {
    return (
      <View style={[styles.screen, { backgroundColor: '#000' }]}>
        <LoadingSpinner />
      </View>
    );
  }

  if (!images || images.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: '#000' }]}>
        <Text style={{ color: '#fff', textAlign: 'center', marginTop: 100 }}>
          Failed to load images
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: '#000' }]}>
      {keepScreenOn && <KeepAwakeLock />}
      <StatusBar hidden={!showControls} />

      {showControls && (
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.barBtn}>
            <Text style={styles.barBtnText}>← Back</Text>
          </TouchableOpacity>
          <View style={styles.topCenter}>
            <Text style={styles.topTitle} numberOfLines={1}>{manhwa.title}</Text>
            <Text style={styles.topSub} numberOfLines={1}>{chapter.title}</Text>
          </View>
          <TouchableOpacity onPress={() => setShowControls((v) => !v)} style={styles.barBtn}>
            <Text style={styles.barBtnText}>☰</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Reader */}
      {mode === 'vertical' ? (
        <VerticalReader
          images={images}
          screenWidth={screenWidth}
          imageQuality={imageQuality}
          onTapPage={() => setShowControls(true)}
          onBeginScroll={() => setShowControls(false)}
        />
      ) : (
        <HorizontalReader
          images={images}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          flatListRef={flatListRef}
          screenWidth={screenWidth}
          screenHeight={screenHeight}
          imageQuality={imageQuality}
          onTapPage={() => setShowControls(true)}
          onBeginScroll={() => setShowControls(false)}
        />
      )}

      {showControls && (
        <View style={styles.menuPanel}>
          <View style={styles.menuRow}>
            <Text style={styles.menuLabel}>Mode</Text>
            <TouchableOpacity style={styles.menuBtn} onPress={toggleMode}>
              <Text style={styles.menuBtnText}>{mode === 'vertical' ? 'Vertical' : 'Horizontal'}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.menuRow}>
            <Text style={styles.menuLabel}>Quality</Text>
            <Text style={styles.menuLabel}>{imageQuality.toUpperCase()}</Text>
          </View>
          <View style={styles.menuRow}>
            <Text style={styles.menuLabel}>{mode === 'horizontal' ? `${currentPage + 1} / ${images.length}` : 'Scroll mode'}</Text>
          </View>
          <View style={styles.menuRow}>
            <TouchableOpacity
              style={[styles.menuBtn, { opacity: prevChapter ? 1 : 0.35 }]}
              onPress={() => prevChapter && goToChapter(prevChapter)}
              disabled={!prevChapter}
            >
              <Text style={styles.menuBtnText}>← Prev</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.menuBtn, { opacity: nextChapter ? 1 : 0.35 }]}
              onPress={() => nextChapter && goToChapter(nextChapter)}
              disabled={!nextChapter}
            >
              <Text style={styles.menuBtnText}>Next →</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

// ── Vertical reader (webtoon-style) ───────────────────────────────────────────

function ReaderPageImage({
  uri,
  width,
  mode,
  imageQuality,
  height,
}: {
  uri: string;
  width: number;
  mode: 'vertical' | 'horizontal';
  imageQuality: ReaderImageQuality;
  height?: number;
}) {
  const [aspectRatio, setAspectRatio] = useState(0.67);
  const [naturalWidth, setNaturalWidth] = useState<number | null>(null);
  const [naturalHeight, setNaturalHeight] = useState<number | null>(null);
  const qualityScale = imageQuality === 'low' ? 0.82 : imageQuality === 'medium' ? 0.92 : 1;

  let renderWidth = width;
  let renderHeight = mode === 'horizontal' ? (height ?? SCREEN_HEIGHT) : width / aspectRatio;

  if (naturalWidth && naturalHeight) {
    if (mode === 'vertical') {
      // Keep native sharpness: never upscale above source width.
      renderWidth = Math.min(width * qualityScale, naturalWidth);
      renderHeight = renderWidth / aspectRatio;
    } else {
      // Fit inside viewport without upscaling for crisper horizontal pages.
      const maxH = height ?? SCREEN_HEIGHT;
      const scale = Math.min(width / naturalWidth, maxH / naturalHeight, 1);
      renderWidth = Math.max(1, Math.round(naturalWidth * scale * qualityScale));
      renderHeight = Math.max(1, Math.round(naturalHeight * scale * qualityScale));
    }
  }

  return (
    <View
      style={{
        width,
        height: mode === 'horizontal' ? (height ?? SCREEN_HEIGHT) : renderHeight,
        backgroundColor: '#000',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Image
        source={{ uri }}
        style={{
          width: renderWidth,
          height: renderHeight,
          backgroundColor: '#000',
        }}
        resizeMode="contain"
        resizeMethod={imageQuality === 'high' ? 'scale' : 'resize'}
        progressiveRenderingEnabled
        fadeDuration={0}
        onLoad={(event) => {
          const source = event.nativeEvent.source;
          if (source?.width && source?.height) {
            setNaturalWidth(source.width);
            setNaturalHeight(source.height);
            setAspectRatio(source.width / source.height);
          }
        }}
      />
    </View>
  );
}

function VerticalReader({
  images,
  screenWidth,
  imageQuality,
  onTapPage,
  onBeginScroll,
}: {
  images: string[];
  screenWidth: number;
  imageQuality: ReaderImageQuality;
  onTapPage: () => void;
  onBeginScroll: () => void;
}) {
  return (
    <FlatList
      data={images}
      keyExtractor={(_, i) => String(i)}
      contentContainerStyle={styles.readerContent}
      renderItem={({ item }) => (
        <TouchableWithoutFeedback onPress={onTapPage}>
          <View>
            <ReaderPageImage uri={item} width={screenWidth} mode="vertical" imageQuality={imageQuality} />
          </View>
        </TouchableWithoutFeedback>
      )}
      onScrollBeginDrag={onBeginScroll}
      showsVerticalScrollIndicator={false}
      removeClippedSubviews
      initialNumToRender={2}
      maxToRenderPerBatch={2}
      updateCellsBatchingPeriod={16}
      windowSize={7}
    />
  );
}

// ── Horizontal reader (page-flip) ─────────────────────────────────────────────

interface HorizontalReaderProps {
  images: string[];
  currentPage: number;
  onPageChange: (page: number) => void;
  flatListRef: React.RefObject<FlatList | null>;
  screenWidth: number;
  screenHeight: number;
  imageQuality: ReaderImageQuality;
  onTapPage: () => void;
  onBeginScroll: () => void;
}

function HorizontalReader({
  images,
  currentPage,
  onPageChange,
  flatListRef,
  screenWidth,
  screenHeight,
  imageQuality,
  onTapPage,
  onBeginScroll,
}: HorizontalReaderProps) {
  const onViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      onPageChange(viewableItems[0].index ?? 0);
    }
  }, []);

  return (
    <FlatList
      ref={flatListRef}
      data={images}
      keyExtractor={(_, i) => String(i)}
      horizontal
      pagingEnabled
      contentContainerStyle={styles.readerContent}
      showsHorizontalScrollIndicator={false}
      onScrollBeginDrag={onBeginScroll}
      onMomentumScrollBegin={onBeginScroll}
      onViewableItemsChanged={onViewableItemsChanged}
      viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
      renderItem={({ item }) => (
        <TouchableWithoutFeedback onPress={onTapPage}>
          <View>
            <ReaderPageImage
              uri={item}
              width={screenWidth}
              height={screenHeight}
              mode="horizontal"
              imageQuality={imageQuality}
            />
          </View>
        </TouchableWithoutFeedback>
      )}
      removeClippedSubviews
      initialNumToRender={2}
      maxToRenderPerBatch={2}
      updateCellsBatchingPeriod={16}
      windowSize={3}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  readerContent: { backgroundColor: '#000' },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.85)',
    gap: 10,
  },
  topCenter: { flex: 1, alignItems: 'center' },
  topTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  topSub: { color: '#aaa', fontSize: 12 },
  barBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.1)' },
  barBtnText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  menuPanel: {
    position: 'absolute',
    right: 12,
    top: 108,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 12,
    padding: 12,
    width: 190,
    gap: 8,
  },
  menuRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  menuLabel: { color: '#ddd', fontSize: 12 },
  menuBtn: { paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.12)' },
  menuBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  verticalImage: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.5 },
  horizontalImage: { width: SCREEN_WIDTH, height: SCREEN_HEIGHT },
});
