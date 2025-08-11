// src/utils/frameToTensor.ts
import * as tf from '@tensorflow/tfjs';
import { Frame } from 'react-native-vision-camera';

/** 将 VisionCamera Frame 转成 tf.Tensor3D，遵循 tfjs-react-native 官方示例 */
export function frameToTensor(frame: Frame) {
  const { width, height } = frame;
  const data = new Uint8Array(frame.buffer);
  // RGBA → Tensor [h,w,4]
  return tf.tensor(data, [height, width, 4], 'int32');
}