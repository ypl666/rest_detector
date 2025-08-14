// src/components/CameraView.tsx
import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Linking, Alert } from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCameraPermission,
  useFrameProcessor,
} from 'react-native-vision-camera';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
// 我们将动态导入，所以这里可以先不导入
// import { frameToTensor } from '../utils/frameToTensor';
// import { estimatePose } from '../modules/movenet';
// import { detectAction } from '../modules/actionDetector';

interface Props {
  task: 'drink_water' | 'leave_seat' | 'stretch';
  onResult?: (status: string, done: boolean) => void;
}

export default function CameraView({ task, onResult }: Props) {
  const device = useCameraDevice('front');
  const { hasPermission, requestPermission } = useCameraPermission();
  const [status, setStatus] = useState('等待检测…');

  // 1. 使用 useSharedValue 替代 useState 来持有 detector
  const detector = useSharedValue<any>(null);

  // 2. 移除 useEffect 初始化逻辑 (我们将把它移到 Worklet 内部)
  //    useEffect 仍然可以用来请求权限或处理其他仅在JS线程的事务

  const frameCount = useSharedValue(0);

  const frameProcessor = useFrameProcessor(
    (frame) => {
      'use worklet';

      // 3. 在 Worklet 内部进行"懒加载"
      if (detector.value == null) {
        console.log('Initializing detector on worklet thread...');
        // 动态导入和创建模型
        // 注意：这里的 require 行为在 worklet 中可能有限制
        // 一个更稳妥的方式是在JS线程准备好creator，然后传递
        // 但我们先尝试最直接的方式
        const { createMoveNetDetector } = require('../modules/movenet');
        const d = createMoveNetDetector(); // 假设这个函数返回一个Promise
        // 注意：worklet 中不能直接使用 async/await，但 vision-camera v3+ 支持
        // 如果出错，我们会看到日志
        detector.value = d;
        runOnJS(setStatus)('检测器已就绪');
        return; // 在第一帧初始化后返回
      }
      
      try {
        frameCount.value++;
        
        if (frameCount.value % 30 === 0) {
          runOnJS(setStatus)(`摄像头正常运行中... 帧数: ${frameCount.value}`);
          
          // const poses = detector.value.estimatePoses(frame);
          // ...
        }
      } catch (e) {
        runOnJS((error: any) => {
          console.error('[!!! FrameProcessor CRASH !!!]', error);
        })(e);
      }
    },
    [] // 4. 移除依赖项数组中的 detector
  );

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
        // 只有当 detector 准备好后才激活 frameProcessor
        frameProcessor={detector.value != null ? frameProcessor : undefined}
        frameProcessorFps={10}
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