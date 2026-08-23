import React, { useLayoutEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  type ViewStyle,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, radii } from '../theme/colors';

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  showBack?: boolean;
  headerRight?: React.ReactNode;
  contentContainerStyle?: ViewStyle;
  noScroll?: boolean;
};

export default function ScreenShell({
  title,
  subtitle,
  children,
  loading,
  refreshing,
  onRefresh,
  showBack = true,
  headerRight,
  contentContainerStyle,
  noScroll,
}: Props) {
  const navigation = useNavigation();

  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  const body = loading ? (
    <View style={styles.loadingWrap}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>Loading…</Text>
    </View>
  ) : (
    children
  );

  return (
    <View style={styles.root}>
      <View style={styles.topBar}>
        {showBack ? (
          <TouchableOpacity
            onPress={() => {
              if (navigation.canGoBack()) {
                navigation.goBack();
                return;
              }
              navigation.navigate('MainTabs' as never);
            }}
            style={styles.backBtn}
            hitSlop={12}
          >
            <Ionicons name="chevron-back" size={26} color={colors.primary} />
          </TouchableOpacity>
        ) : (
          <View style={styles.backBtn} />
        )}
        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        <View style={styles.headerRight}>{headerRight}</View>
      </View>

      {noScroll ? (
        <View style={[styles.contentFill, contentContainerStyle]}>{body}</View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, contentContainerStyle]}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
            ) : undefined
          }
          keyboardShouldPersistTaps="handled"
        >
          {body}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.backgroundLight,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  titleWrap: { flex: 1, paddingHorizontal: 8 },
  title: { fontSize: 20, fontWeight: '600', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  headerRight: { minWidth: 40, alignItems: 'flex-end' },
  scroll: { flex: 1 },
  /** Fills remaining height under the top bar (required for nested ScrollView + sticky footers). */
  contentFill: { flex: 1, minHeight: 0 },
  content: { padding: spacing.md, paddingBottom: spacing.xl },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 48 },
  loadingText: { marginTop: 12, fontSize: 14, color: colors.textSecondary },
});

export function PageSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <View style={sectionStyles.card}>
      <Text style={sectionStyles.h2}>{title}</Text>
      {description ? <Text style={sectionStyles.desc}>{description}</Text> : null}
      {children}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  card: {
    backgroundColor: colors.backgroundMuted,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  h2: { fontSize: 17, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  desc: { fontSize: 13, color: colors.textSecondary, marginBottom: 12, lineHeight: 18 },
});
