// src/screens/DetectScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import CameraView from '../components/CameraView';
import { initDetector } from '../modules/movenet';
import type { PoseDetector } from '@tensorflow-models/pose-detection';
import { createMoveNetDetector } from '../modules/movenet';

type Props = NativeStackScreenProps<RootStackParamList, 'Detect'>;

export default function DetectScreen({ route }: Props) {
  const { task } = route.params;
  const [detector, setDetector] = useState<PoseDetector | null>(null);
  const [result, setResult] = useState<string>('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      const d = await createMoveNetDetector();
      if (mounted) setDetector(d);
    })();
    return () => { mounted = false; };
  }, []);

  const handleResult = useCallback((status: string, done: boolean) => {
    setResult(status);
    if (done) {
      // 可以在这里添加完成后的逻辑
      console.log('任务完成:', task);
    }
  }, [task]);

  return (
    <View style={styles.container}>
      <CameraView task={task} onResult={handleResult} />
      {result && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultText}>{result}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  tip: { flex: 1, justifyContent: 'center', textAlign: 'center', fontSize: 18 },
  resultContainer: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 16,
    borderRadius: 8,
  },
  resultText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
});