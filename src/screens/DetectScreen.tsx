// src/screens/DetectScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation';
import CameraView from '../components/CameraView';
import { initDetector } from '../modules/movenet';
import type { PoseDetector } from '@tensorflow-models/pose-detection';
import { createMoveNetDetector } from '../modules/movenet';


export default function DetectScreen() {
  const [detector, setDetector] = useState<PoseDetector | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const d = await createMoveNetDetector();
      if (mounted) setDetector(d);
    })();
    return () => { mounted = false; };
  }, []);

  return <View style={{ flex: 1 }} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  tip: { flex: 1, justifyContent: 'center', textAlign: 'center', fontSize: 18 },
});