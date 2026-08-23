import { Platform, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { documentDirectory, downloadAsync } from 'expo-file-system/legacy';
import { getApiUrl } from '../services/api';

type ExportParams = {
  zone?: string;
  employee?: string;
  schoolName?: string;
  schoolCode?: string;
  fromDate?: string;
  toDate?: string;
  contactMobile?: string;
};

export async function exportContactQueriesReport(params: ExportParams, filename: string) {
  const qs = new URLSearchParams();
  if (params.zone) qs.append('zone', params.zone);
  if (params.employee) qs.append('employee', params.employee);
  if (params.schoolName) qs.append('schoolName', params.schoolName);
  if (params.schoolCode) qs.append('schoolCode', params.schoolCode);
  if (params.fromDate) qs.append('fromDate', params.fromDate);
  if (params.toDate) qs.append('toDate', params.toDate);
  if (params.contactMobile) qs.append('contactMobile', params.contactMobile);

  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const url = `${getApiUrl()}/contact-queries/export${suffix}`;
  const token = await AsyncStorage.getItem('authToken');
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Export failed');
    }
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const err = await res.json();
      throw new Error(err.message || 'Export failed');
    }
    const blob = await res.blob();
    if (!blob.size) throw new Error('Export returned an empty file');

    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    window.URL.revokeObjectURL(objectUrl);
    document.body.removeChild(anchor);
    return;
  }

  const dir = documentDirectory;
  if (!dir) {
    throw new Error('File storage is not available on this device');
  }
  const fileUri = `${dir}${filename}`;
  const result = await downloadAsync(url, fileUri, { headers });
  if (result.status !== 200) {
    throw new Error(`Export failed (${result.status})`);
  }
  Alert.alert('Export complete', `Excel file saved to:\n${result.uri}`);
}
