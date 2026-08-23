import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import ScreenShell from '../../ui/ScreenShell';
import { colors } from '../../theme/colors';
import { typography } from '../../theme/typography';

const cards = [
  {
    title: 'Open Leads',
    description: 'View all pending and processing leads',
    route: 'ReportsLeadsOpen',
    icon: 'document-text-outline' as const,
    iconBg: '#3b82f6',
  },
  {
    title: 'Follow-up Leads',
    description: 'Open leads in the follow-up pipeline',
    route: 'ReportsLeadsFollowup',
    icon: 'time-outline' as const,
    iconBg: '#f97316',
  },
  {
    title: 'Closed Leads',
    description: 'View all successfully closed leads',
    route: 'ReportsLeadsClosed',
    icon: 'checkmark-circle-outline' as const,
    iconBg: '#22c55e',
  },
];

export default function ReportsLeadsScreen({ navigation }: any) {
  return (
    <ScreenShell title="Leads Reports" subtitle="Select a report type to view detailed lead information">
      <ScrollView contentContainerStyle={styles.content}>
        {cards.map((card) => (
          <View key={card.title} style={styles.card}>
            <View style={[styles.iconBox, { backgroundColor: card.iconBg }]}>
              <Ionicons name={card.icon} size={24} color="#FFFFFF" />
            </View>
            <Text style={styles.cardTitle}>{card.title}</Text>
            <Text style={styles.cardDescription}>{card.description}</Text>
            <TouchableOpacity
              style={styles.button}
              onPress={() => navigation.navigate(card.route)}
              activeOpacity={0.85}
            >
              <Text style={styles.buttonText}>View Report</Text>
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 20,
    gap: 16,
  },
  card: {
    backgroundColor: colors.backgroundLight,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadowDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    ...typography.heading.h3,
    color: colors.textPrimary,
    marginBottom: 8,
  },
  cardDescription: {
    ...typography.body.medium,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: {
    ...typography.body.medium,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
