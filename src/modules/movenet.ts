// src/modules/movenet.ts  ← 仍可保留这个文件名
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-cpu';
// 关键：在 React Native 环境使用 rn-webgl 后端
import '@tensorflow/tfjs-react-native';
import * as posedetection from '@tensorflow-models/pose-detection';

let detector: posedetection.PoseDetector | null = null;

export async function initDetector() {
  // 保险：确保 fetch 可用（大多数 RN 都有）
  // @ts-ignore
  if (typeof global.fetch !== 'function' && typeof fetch === 'function') {
    // @ts-ignore
    global.fetch = fetch;
  }

  // ① 先 ready 再切后端（tfjs-react-native 会注册 rn-webgl）
  await tf.ready();

  // ② 优先 rn-webgl，失败回退 cpu
  try {
    await tf.setBackend('rn-webgl');
  } catch {
    await tf.setBackend('cpu');
  }
  await tf.ready(); // 切后端后再等一次，确保 kernel 初始化

  // ③ 创建 BlazePose 检测器（改这里：用 BlazePose + full）
  detector = await posedetection.createDetector(
    posedetection.SupportedModels.BlazePose,
    {
      runtime: 'tfjs',
      modelType: 'full',          // 'lite'|'full'|'heavy'，full 更稳
      enableSmoothing: true,      // 平滑关键点
    } as posedetection.BlazePoseTfjsModelConfig
  );

  return detector;
}

export async function estimatePose(tensor: tf.Tensor3D) {
  if (!detector) throw new Error('Pose detector not init');
  // 如用前置相机且镜像，需要 flipHorizontal: true
  return detector.estimatePoses(tensor, { flipHorizontal: true });
}

// 保留你原来的工厂函数，但内部也换成 BlazePose（可选）
export async function createMoveNetDetector() {
  await tf.ready();
  try { await tf.setBackend('rn-webgl'); } catch { await tf.setBackend('cpu'); }
  await tf.ready();

  return posedetection.createDetector(
    posedetection.SupportedModels.BlazePose,
    {
      runtime: 'tfjs',
      modelType: 'full',
      enableSmoothing: true,
    } as posedetection.BlazePoseTfjsModelConfig
  );
}