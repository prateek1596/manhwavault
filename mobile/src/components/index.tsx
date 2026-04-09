import React from 'react';
import {
  View, Text, Image, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useAppTheme } from '../theme';
import { Manhwa } from '../types';

// ── ManhwaCard ────────────────────────────────────────────────────────────────

interface ManhwaCardProps {
  manhwa: Manhwa;
  onPress: () => void;
  width?: number;
}

export function ManhwaCard({ manhwa, onPress, width = 150 }: ManhwaCardProps) {
  const theme = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.card, { width, backgroundColor: theme.colors.surface }]}
      activeOpacity={0.75}
    >
      <Image
        source={{ uri: manhwa.cover }}
        style={[styles.cover, { width, height: width * 1.45 }]}
        resizeMode="cover"
      />
      <View style={styles.cardInfo}>
        <Text
          style={[styles.cardTitle, { color: theme.colors.text }]}
          numberOfLines={2}
        >
          {manhwa.title}
        </Text>
        <Text style={[styles.cardSub, { color: theme.colors.textSecondary }]} numberOfLines={1}>
          {manhwa.latestChapter}
        </Text>
        <View style={[styles.sourcePill, { backgroundColor: theme.colors.primaryLight }]}>
          <Text style={[styles.sourceText, { color: theme.colors.primary }]}>
            {manhwa.source}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── LoadingSpinner ────────────────────────────────────────────────────────────

export function LoadingSpinner() {
  const theme = useAppTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
    </View>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

interface EmptyStateProps {
  icon: string;
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void };
}

export function EmptyState({ icon, title, subtitle, action }: EmptyStateProps) {
  const theme = useAppTheme();
  return (
    <View style={styles.center}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>{title}</Text>
      {subtitle && (
        <Text style={[styles.emptySub, { color: theme.colors.textSecondary }]}>{subtitle}</Text>
      )}
      {action && (
        <TouchableOpacity
          style={[styles.emptyBtn, { backgroundColor: theme.colors.primary }]}
          onPress={action.onPress}
        >
          <Text style={styles.emptyBtnText}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── SectionHeader ─────────────────────────────────────────────────────────────

interface SectionHeaderProps {
  title: string;
  action?: { label: string; onPress: () => void };
}

export function SectionHeader({ title, action }: SectionHeaderProps) {
  const theme = useAppTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{title}</Text>
      {action && (
        <TouchableOpacity onPress={action.onPress}>
          <Text style={[styles.sectionAction, { color: theme.colors.primary }]}>
            {action.label}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Chip ──────────────────────────────────────────────────────────────────────

interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
}

export function Chip({ label, active, onPress }: ChipProps) {
  const theme = useAppTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? theme.colors.primary : theme.colors.surfaceVariant,
          borderColor: active ? theme.colors.primary : theme.colors.border,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? '#fff' : theme.colors.textSecondary }]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

interface SourceIconProps {
  name: string;
  iconUrl?: string;
  size?: number;
}

export function SourceIcon({ name, iconUrl, size = 28 }: SourceIconProps) {
  const theme = useAppTheme();
  const initials = (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <View
      style={[
        styles.sourceIconWrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.surfaceVariant,
        },
      ]}
    >
      {iconUrl ? (
        <Image
          source={{ uri: iconUrl }}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          resizeMode="cover"
        />
      ) : (
        <Text style={[styles.sourceIconText, { color: theme.colors.textSecondary }]}>{initials || '?'}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 10, overflow: 'hidden', marginBottom: 8 },
  cover: { borderRadius: 0 },
  cardInfo: { padding: 8, gap: 3 },
  cardTitle: { fontSize: 13, fontWeight: '600', lineHeight: 18 },
  cardSub: { fontSize: 11 },
  sourcePill: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginTop: 2 },
  sourceText: { fontSize: 10, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12 },
  emptyIcon: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyBtn: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
  sectionAction: { fontSize: 13, fontWeight: '500' },
  chip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 99, borderWidth: 0.5, marginRight: 8 },
  chipText: { fontSize: 13, fontWeight: '500' },
  sourceIconWrap: { alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, overflow: 'hidden' },
  sourceIconText: { fontSize: 10, fontWeight: '700' },
});
