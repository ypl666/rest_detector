import cv2
import mediapipe as mp
import time
import numpy as np

class RestActionDetector:
    def __init__(self):
        # 初始化MediaPipe模型
        self.mp_pose = mp.solutions.pose
        self.mp_drawing = mp.solutions.drawing_utils
        
        # 摄像头资源（延迟初始化）
        self.cap = None
    
    def init_camera(self):
        """初始化摄像头资源"""
        if self.cap is None or not self.cap.isOpened():
            self.cap = cv2.VideoCapture(0)
            if not self.cap.isOpened():
                print("⚠️ 无法打开摄像头，请检查权限和连接")
                return False
            
            self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        
        # 创建姿势检测模型
        self.pose = self.mp_pose.Pose(
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
            model_complexity=1  # 1为轻量级模型
        )
        return True
    
    def release_resources(self):
        """释放摄像头和模型资源"""
        if self.cap and self.cap.isOpened():
            self.cap.release()
        self.cap = None
        
        # 释放姿势检测模型
        if hasattr(self, 'pose'):
            self.pose.close()
            del self.pose
    
    def _get_landmark_coords(self, landmarks, img_shape):
        """获取关键点坐标（像素值）"""
        if not landmarks:
            return {}
        
        h, w, _ = img_shape
        coords = {}
        for idx, landmark in enumerate(landmarks.landmark):
            cx, cy = int(landmark.x * w), int(landmark.y * h)
            coords[idx] = (cx, cy)
        return coords
    
    def _drink_water_detection(self, coords):
        """喝水动作检测逻辑"""
        status = ""
        success = False
        
        # 检查所需关键点是否存在
        required_points = [self.mp_pose.PoseLandmark.LEFT_INDEX, 
                          self.mp_pose.PoseLandmark.RIGHT_INDEX,
                          self.mp_pose.PoseLandmark.LEFT_EYE_OUTER,
                        self.mp_pose.PoseLandmark.RIGHT_EYE_OUTER]
        
        if all(p.value in coords for p in required_points):
            li = coords[self.mp_pose.PoseLandmark.LEFT_INDEX.value]
            ri = coords[self.mp_pose.PoseLandmark.RIGHT_INDEX.value]
            leo = coords[self.mp_pose.PoseLandmark.LEFT_EYE_OUTER.value]
            reo = coords[self.mp_pose.PoseLandmark.RIGHT_EYE_OUTER.value]
            
            # 计算食指根部到眼外侧的距离
            dist_l = np.sqrt((li[0]-leo[0])**2 + (li[1]-leo[1])**2)
            dist_r = np.sqrt((ri[0]-reo[0])**2 + (ri[1]-reo[1])**2)
            min_dist = min(dist_l, dist_r)
            
            # 状态机逻辑
            if self.task_state == "initial":
                if min_dist < 50:  # 手靠近眼
                    self.task_state = "hand_near_mouth"
                    self.state_start_time = time.time()
                    status = "hand near mouth..."
            elif self.task_state == "hand_near_mouth":
                if min_dist < 50:
                    if time.time() - self.state_start_time > 2.0:  # 保持2秒
                        self.task_state = "hand_away"
                        status = "remove your hand..."
                else:
                    self.task_state = "initial"  # 重置
            elif self.task_state == "hand_away":
                if min_dist > 80:  # 手离开
                    success = True
                    status = "finished!"
            else:
                self.task_state = "initial"
        else:
            status = "upper body in the screen"
        
        return success, status
    
    def _leave_seat_detection(self, coords):
        """离开座位检测逻辑"""
        if coords:  # 检测到人体
            self.absence_start_time = 0
            return False, "user detected"
        else:
            if self.absence_start_time == 0:
                self.absence_start_time = time.time()
                return False, "detecting..."
            
            absence_duration = time.time() - self.absence_start_time
            if absence_duration > 5:  # 连续5秒无人体
                return True, "finished"
            
            return False, f"left for {int(absence_duration)}/5s"
    
    def _stretching_detection(self, coords):
        """伸懒腰检测逻辑"""
        status = ""
        success = False
        
        required_points = [self.mp_pose.PoseLandmark.LEFT_SHOULDER,
                          self.mp_pose.PoseLandmark.RIGHT_SHOULDER,
                          self.mp_pose.PoseLandmark.LEFT_WRIST,
                          self.mp_pose.PoseLandmark.RIGHT_WRIST]
        
        if all(p.value in coords for p in required_points):
            ls = coords[self.mp_pose.PoseLandmark.LEFT_SHOULDER.value]
            rs = coords[self.mp_pose.PoseLandmark.RIGHT_SHOULDER.value]
            lw = coords[self.mp_pose.PoseLandmark.LEFT_WRIST.value]
            rw = coords[self.mp_pose.PoseLandmark.RIGHT_WRIST.value]
            
            # 判断手腕是否高于肩膀
            left_raised = lw[1] < ls[1] - 50  # y值更小表示更高
            right_raised = rw[1] < rs[1] - 50
            
            # 状态机逻辑
            if self.task_state == "initial":
                if left_raised and right_raised:
                    self.task_state = "arms_up"
                    self.stretch_hold_start = time.time()
                    status = "hold your arm"
            elif self.task_state == "arms_up":
                if left_raised and right_raised:
                    if time.time() - self.stretch_hold_start > 1.5:  # 保持1.5秒
                        success = True
                        status = "finished"
                else:
                    self.task_state = "initial"  # 重置
        else:
            status = "upper body in the screen"
        
        return success, status
    
    def run_detection(self, task_type, timeout=60):
        """运行指定任务的检测"""
        # 初始化任务状态
        self.task_type = task_type
        self.timeout = timeout
        self.task_state = "initial"
        self.last_detection_time = time.time()
        self.state_start_time = 0
        self.absence_start_time = 0
        self.stretch_hold_start = 0
        self.manual_confirm = False
        self.status_text = f"开始检测: {task_type}..."
        
        # 初始化摄像头
        if not self.init_camera():
            print("⚠️ 摄像头初始化失败")
            return False
        
        start_time = time.time()
        detected = False
        
        while self.cap.isOpened():
            success, frame = self.cap.read()
            if not success:
                continue
            
            # 镜像显示
            frame = cv2.flip(frame, 1)
            rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # 姿势检测
            results = self.pose.process(rgb_frame)
            landmarks = results.pose_landmarks
            coords = self._get_landmark_coords(landmarks, frame.shape)
            
            # 绘制姿势关键点
            if landmarks:
                self.mp_drawing.draw_landmarks(
                    frame, landmarks, self.mp_pose.POSE_CONNECTIONS,
                    self.mp_drawing.DrawingSpec(color=(0,255,0), thickness=2, circle_radius=2),
                    self.mp_drawing.DrawingSpec(color=(0,0,255), thickness=2))
            
            # 执行任务检测
            detected = False
            if task_type == "drink_water":
                detected, self.status_text = self._drink_water_detection(coords)
            elif task_type == "leave_seat":
                detected, self.status_text = self._leave_seat_detection(coords)
            elif task_type == "stretch":
                detected, self.status_text = self._stretching_detection(coords)
            
            # 超时检查
            elapsed = time.time() - start_time
            if elapsed > timeout:
                self.status_text = f"time leak for ({int(elapsed)}秒)"
                break
            
            # 手动确认
            key = cv2.waitKey(1) & 0xFF
            if key == ord(' '):  # 空格键手动确认
                detected = True
                self.manual_confirm = True
                self.status_text = "confirmed!"
            
            if key == 27:  # ESC键退出当前检测
                self.status_text = "cancelled"
                break
            
            if detected:  # 检测成功
                break
            
            # 显示状态信息
            cv2.putText(frame, f"task: {task_type}", (10, 30), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
            cv2.putText(frame, self.status_text, (10, 70), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 0), 2)
            cv2.putText(frame, f"time: {int(elapsed)}/{timeout}s", (10, 110), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 2)
            cv2.putText(frame, "press space to finish| esc to exit", (10, 460), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (100, 100, 255), 2)
            
            # 显示摄像头画面
            cv2.imshow('Rest Action Detector', frame)
        
        # 显示最终结果
        cv2.destroyAllWindows()
        return detected

def display_menu():
    """显示主菜单"""
    print("\n" + "="*40)
    print("休息动作检测系统")
    print("="*40)
    print("1. 喝水检测")
    print("2. 离开座位检测")
    print("3. 伸懒腰检测")
    print("4. 退出程序")
    print("="*40)
    choice = input("请选择操作 (1-4): ")
    return choice

def main():
    """主程序循环"""
    detector = RestActionDetector()
    TASKS = ["drink_water", "leave_seat", "stretch"]
    TASK_NAMES = {
        "drink_water": "喝水检测",
        "leave_seat": "离开座位检测",
        "stretch": "伸懒腰检测"
    }
    
    while True:
        choice = display_menu()
        
        if choice == '4':
            print("thank you, bye！")
            detector.release_resources()
            break
        
        if choice in ('1', '2', '3'):
            task_index = int(choice) - 1
            task_id = TASKS[task_index]
            task_name = TASK_NAMES[task_id]
            
            print(f"\n开始{task_name}...")
            print("请确保上半身在摄像头画面中清晰可见")
            print("按空格键可手动确认完成，按ESC键退出当前检测")
            
            result = detector.run_detection(task_id, timeout=60)
            
            if result:
                print(f"\n✅ {task_name}成功完成!")
                if hasattr(detector, 'manual_confirm') and detector.manual_confirm:
                    print("(通过手动确认完成)")
            else:
                print(f"\n❌ {task_name}未完成或已取消")
                
            input("\n按回车键返回主菜单...")
        else:
            print("无效选择，请重新输入")

if __name__ == "__main__":
    main()