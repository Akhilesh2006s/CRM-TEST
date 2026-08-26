import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

type Dataset = { label: string; data: number[]; color: string };

type Props = {
  labels: string[];
  datasets: Dataset[];
  title?: string;
  subtitle?: string;
};

/** Simple grouped vertical bars for mobile (Leads / DCs / Sales). */
export default function GroupedBarChart({ labels, datasets, title, subtitle }: Props) {
  const max = Math.max(1, ...datasets.flatMap((d) => d.data));
  const chartH = 160;

  return (
    <View style={styles.wrap}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      <View style={styles.legend}>
        {datasets.map((d) => (
          <View key={d.label} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: d.color }]} />
            <Text style={styles.legendText}>{d.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View style={[styles.chartRow, { height: chartH + 36 }]}>
          {labels.map((label, i) => (
            <View key={`${label}-${i}`} style={styles.group}>
              <View style={[styles.bars, { height: chartH }]}>
                {datasets.map((d) => {
                  const v = d.data[i] || 0;
                  const h = Math.max(v > 0 ? 4 : 0, (v / max) * chartH);
                  return (
                    <View key={d.label} style={styles.barCol}>
                      <Text style={styles.barVal}>{v > 0 ? v : ''}</Text>
                      <View style={[styles.bar, { height: h, backgroundColor: d.color }]} />
                    </View>
                  );
                })}
              </View>
              <Text style={styles.xLabel} numberOfLines={1}>
                {label}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  title: { ...typography.heading.h3, color: colors.textPrimary, marginBottom: 4 },
  subtitle: { ...typography.body.small, color: colors.textSecondary, marginBottom: 12 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 2 },
  legendText: { ...typography.label.small, color: colors.textSecondary },
  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 14, paddingRight: 8 },
  group: { width: 72, alignItems: 'center' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 4 },
  barCol: { alignItems: 'center', width: 18 },
  barVal: { fontSize: 9, color: colors.textMuted, marginBottom: 2, minHeight: 12 },
  bar: { width: 14, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  xLabel: { marginTop: 8, fontSize: 11, color: colors.textSecondary, textAlign: 'center', width: 72 },
});
