import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { documentDirectory, downloadAsync } from 'expo-file-system/legacy';
import { getApiUrl } from '../services/api';

export async function downloadDcReport(queryString: string) {
  const url = `${getApiUrl()}/reports/dc/export${queryString ? `?${queryString}` : ''}`;
  const filename = `DC_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
  const token = await AsyncStorage.getItem('authToken');
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'Export failed');
    const blob = await response.blob(); if (!blob.size) throw new Error('Export returned an empty file');
    const objectUrl = window.URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = objectUrl; link.download = filename; document.body.appendChild(link); link.click(); window.URL.revokeObjectURL(objectUrl); document.body.removeChild(link); return;
  }
  if (!documentDirectory) throw new Error('File storage is not available on this device');
  const result = await downloadAsync(url, `${documentDirectory}${filename}`, { headers });
  if (result.status !== 200) throw new Error(`Export failed (${result.status})`);
  Alert.alert('Export complete', `Excel file saved to:\n${result.uri}`);
}
