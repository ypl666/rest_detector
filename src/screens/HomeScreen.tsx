// src/screens/HomeScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';

const TASKS = [
  { id: 'drink_water', label: '喝水检测' },
  { id: 'leave_seat',  label: '离开座位检测' },
  { id: 'stretch',     label: '伸懒腰检测' },
] as const;

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>休息动作检测</Text>
      {TASKS.map(t => (
        <TouchableOpacity
          key={t.id}
          style={styles.btn}
          onPress={() => navigation.navigate('Detect', { task: t.id as any })}
        >
          <Text style={styles.btnText}>{t.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 24 },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 32 },
  btn: { backgroundColor: '#3478f6', paddingVertical: 12, paddingHorizontal: 36, borderRadius: 12 },
  btnText: { color: '#fff', fontSize: 18 },
});