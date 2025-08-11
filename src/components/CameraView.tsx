// src/components/CameraView.tsx
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Linking, Alert } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { runOnJS } from 'react-native-reanimated';
import { frameToTensor } from '../utils/frameToTensor';
import { estimatePose } from '../modules/movenet';
import { detectAction } from '../modules/actionDetector';

interface Props {
  task: 'drink_water' | 'leave_seat' | 'stretch';
  onResult?: (status: string, done: boolean) => void;
}

export default function CameraView({ task, onResult }: Props) {
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [status, setStatus] = useState('等待检测…');

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    // 每 2 帧处理一次，降低算力消耗
    if (frame.timestamp % 2 === 0) return;
    const tensor = frameToTensor(frame);
    runOnJS(async () => {
      const poses = await estimatePose(tensor);
      const { text, done } = detectAction(task, poses);
      setStatus(text);
      onResult?.(text, done);
    })();
  }, [task]);

  if (!device) return <Text style={styles.tip}>摄像头加载中…</Text>;
  if (!hasPermission)
    return (
      <View style={styles.centered}>
        <Text>需要摄像头权限</Text>
        <Text style={{ color: 'blue' }} onPress={async () => {
          if (!(await requestPermission())) Linking.openSettings();
        }}>
          点此授权
        </Text>
      </View>
    );

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={true}
        frameProcessor={frameProcessor}
        frameProcessorFps={24}
      />
      <View style={styles.overlay}>
        <Text style={styles.overlayText}>{status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tip: { flex: 1, textAlign: 'center', marginTop: 120 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  overlay: { position: 'absolute', bottom: 40, alignSelf: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 12, borderRadius: 8 },
  overlayText: { color: '#fff' },
});