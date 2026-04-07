import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const READER_MODE_KEY = 'reader_mode';
const READER_IMAGE_FIT_KEY = 'reader_image_fit';

const DEFAULT_SETTINGS = {
  readingMode: 'paged',
  imageFit: 'cover',
};

export default function useReaderSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadSettings = async () => {
      try {
        const [savedMode, savedImageFit] = await Promise.all([
          AsyncStorage.getItem(READER_MODE_KEY),
          AsyncStorage.getItem(READER_IMAGE_FIT_KEY),
        ]);

        if (!isMounted) {
          return;
        }

        setSettings({
          readingMode:
            savedMode === 'vertical' || savedMode === 'paged'
              ? savedMode
              : DEFAULT_SETTINGS.readingMode,
          imageFit:
            savedImageFit === 'contain' || savedImageFit === 'cover'
              ? savedImageFit
              : DEFAULT_SETTINGS.imageFit,
        });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const setReadingMode = useCallback(async (mode) => {
    if (mode !== 'vertical' && mode !== 'paged') {
      return;
    }

    setSettings((prev) => ({ ...prev, readingMode: mode }));
    await AsyncStorage.setItem(READER_MODE_KEY, mode);
  }, []);

  const setImageFit = useCallback(async (fit) => {
    if (fit !== 'contain' && fit !== 'cover') {
      return;
    }

    setSettings((prev) => ({ ...prev, imageFit: fit }));
    await AsyncStorage.setItem(READER_IMAGE_FIT_KEY, fit);
  }, []);

  return {
    settings,
    loading,
    setReadingMode,
    setImageFit,
  };
}
