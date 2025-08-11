// src/modules/actionDetector.ts
import { Pose } from '@tensorflow-models/pose-detection';

interface State {
  taskState: 'initial' | 'hand_near_mouth' | 'hand_away' | 'arms_up';
  stateStart: number;
  absenceStart: number;
  stretchHoldStart: number;
  // 内部平滑缓存（不改变外部类型）
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _smooth?: { d?: number | null };
}

const state: Record<string, State> = {};

// === 小工具 ===
type KP = { name?: string; x: number; y: number; score?: number };

function dist(a: KP, b: KP) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function detectAction(task: string, poses: Pose[]) {
  const now = Date.now();
  if (!state[task])
    state[task] = {
      taskState: 'initial',
      stateStart: 0,
      absenceStart: 0,
      stretchHoldStart: 0,
    };

  const s = state[task];
  const keypoints = (poses[0]?.keypoints || []) as KP[];

  // 置信度过滤的安全取点；如果没有该点或 score 低，则返回 undefined
  const pick = (name: string, minScore = 0.5): KP | undefined => {
    const k = keypoints.find((k) => k.name === name);
    return k && (k.score ?? 1) >= minScore ? k : undefined;
  };

  // 肩宽用于尺度归一化（兜底200防止 NaN）
  const ls = pick('left_shoulder');
  const rs = pick('right_shoulder');
  const scale = ls && rs ? dist(ls, rs) : 200;

  // IIR 平滑（α 越小越平滑）
  const smooth = (val: number, key: 'd', alpha = 0.5) => {
    s._smooth ??= {};
    const prev = s._smooth[key] ?? null;
    s._smooth[key] = prev == null ? val : alpha * val + (1 - alpha) * prev;
    return s._smooth[key]!;
  };

  let text = '检测中…';
  let done = false;

  switch (task) {
    case 'drink_water': {
      // —— 取用于“食指↔眼角(outer)”的关键点；没有就回退 —— //
      // BlazePose 专有：left_index/right_index/left_eye_outer/right_eye_outer
      const li = pick('left_index') || pick('left_wrist'); // 回退 wrist
      const ri = pick('right_index') || pick('right_wrist');
      const leo = pick('left_eye_outer') || pick('left_eye'); // 回退 eye 中心
      const reo = pick('right_eye_outer') || pick('right_eye');

      // 至少要能得到一侧距离
      const dL = li && leo ? dist(li, leo) : Infinity;
      const dR = ri && reo ? dist(ri, reo) : Infinity;
      const rawD = Math.min(dL, dR);

      if (Number.isFinite(rawD)) {
        const d = smooth(rawD, 'd', 0.4); // 稍强一点平滑

        // ——— 阈值：随肩宽缩放 + 滞回，按需微调 ——— //
        const nearTh = 0.20 * scale; // 贴近
        const farTh = 0.35 * scale;  // 拉开（大于 near，形成滞回，防抖）

        if (s.taskState === 'initial' && d < nearTh) {
          s.taskState = 'hand_near_mouth';
          s.stateStart = now;
          text = '手已靠近';
        } else if (s.taskState === 'hand_near_mouth') {
          if (d < nearTh && now - s.stateStart > 2000) {
            s.taskState = 'hand_away';
            text = '放下杯子';
          } else if (d > farTh) {
            s.taskState = 'initial';
            text = '检测中…';
          }
        } else if (s.taskState === 'hand_away' && d > farTh) {
          done = true;
          text = '喝水动作完成';
        } else {
          // 保持既有状态 & 提示
          if (s.taskState === 'initial') text = '等待手靠近…';
          if (s.taskState === 'hand_near_mouth') text = '保持靠近…';
          if (s.taskState === 'hand_away') text = '确认放下…';
        }
      } else {
        // 关键点不足：大概率是 MoveNet 或置信度太低
        text = '关键点不足（尝试靠近镜头或使用 BlazePose）';
      }
      break;
    }

    case 'leave_seat': {
      if (poses.length === 0) {
        if (!s.absenceStart) s.absenceStart = now;
        const dur = now - s.absenceStart;
        text = `离开 ${Math.floor(dur / 1000)} / 5 秒`;
        if (dur > 5000) {
          done = true;
          text = '离席完成';
        }
      } else {
        s.absenceStart = 0;
        text = '检测到坐姿';
      }
      break;
    }

    case 'stretch': {
      const lw = pick('left_wrist');
      const rw = pick('right_wrist');
      const lss = ls; // 已取
      const rss = rs;

      if (lw && rw && lss && rss) {
        // 同样做相对阈值：手腕高于肩部一定距离（用肩宽的 0.25 作为高差）
        const yTh = 0.25 * scale;
        const upL = lw.y < lss.y - yTh;
        const upR = rw.y < rss.y - yTh;

        if (s.taskState === 'initial' && upL && upR) {
          s.taskState = 'arms_up';
          s.stretchHoldStart = now;
          text = '保持举手…';
        } else if (s.taskState === 'arms_up') {
          if (upL && upR && now - s.stretchHoldStart > 1500) {
            done = true;
            text = '伸懒腰完成';
          } else if (!upL || !upR) {
            s.taskState = 'initial';
            text = '检测中…';
          }
        } else {
          text = '等待双手举过肩…';
        }
      } else {
        text = '关键点不足（伸懒腰）';
      }
      break;
    }
  }

  return { text, done };
}