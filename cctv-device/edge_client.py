import os
import time
import json
import random
from io import BytesIO

import cv2
import numpy as np
import requests
from dotenv import load_dotenv

load_dotenv()

ADMIN_URL = os.environ.get('ADMIN_URL', 'http://localhost:3000').rstrip('/')
ZONE_ID = os.environ.get('ZONE_ID', 'ZONE_A')
ALERT_DEBOUNCE_SECONDS = float(os.environ.get('ALERT_DEBOUNCE_SECONDS', '15'))
MOCK_CAMERA = os.environ.get('MOCK_CAMERA', 'True').lower() == 'true'

# Available mock civic event types
INCIDENTS = [
    ('TRASH_ACCUMULATION', 0.94, 'ZONE_A'),
    ('ILLEGAL_PARKING', 0.88, 'ZONE_B'),
    ('POTHOLE_HAZARD', 0.91, 'ZONE_C'),
    ('RESTRICTED_ACCESS', 0.97, 'ZONE_B')
]

def generate_mock_incident(event_type: str, zone_id: str):
    """Draw a stylized mock surveillance frame of the civic issue."""
    # Create dark slate background (640x480 RGB)
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # Draw dark gray pavement floor
    cv2.rectangle(frame, (0, 0), (640, 480), (30, 32, 40), -1)
    
    # Draw perspective road markings (yellow dividing line)
    cv2.line(frame, (320, 0), (320, 480), (0, 200, 220), 4)
    # Draw sidewalks
    cv2.rectangle(frame, (0, 0), (80, 480), (80, 85, 90), -1)
    cv2.rectangle(frame, (560, 0), (640, 480), (80, 85, 90), -1)

    # Draw specific incident visuals
    if event_type == 'TRASH_ACCUMULATION':
        # Green garbage bag piles
        cv2.circle(frame, (320, 260), 55, (35, 75, 40), -1)
        cv2.circle(frame, (350, 280), 40, (45, 95, 50), -1)
        cv2.circle(frame, (285, 275), 45, (25, 65, 30), -1)
        # Red warning banner text
        cv2.putText(frame, "ALERT: SANITATION HAZARD DETECTED", (150, 160), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 100, 255), 2, cv2.LINE_AA)
        
    elif event_type == 'ILLEGAL_PARKING':
        # Boxy vehicle shape
        cv2.rectangle(frame, (220, 200), (420, 310), (50, 50, 190), -1) # chassis
        cv2.rectangle(frame, (250, 150), (390, 200), (80, 80, 230), -1) # cabin
        # Wheels
        cv2.circle(frame, (260, 310), 22, (15, 15, 15), -1)
        cv2.circle(frame, (380, 310), 22, (15, 15, 15), -1)
        cv2.putText(frame, "ALERT: VEHICLE OBSTRUCTING PATH", (150, 120), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 100, 255), 2, cv2.LINE_AA)
        
    elif event_type == 'POTHOLE_HAZARD':
        # Elliptical road damage
        cv2.ellipse(frame, (320, 340), (95, 35), 0, 0, 360, (15, 15, 22), -1)
        # Crack details
        cv2.line(frame, (225, 340), (195, 350), (60, 60, 60), 2)
        cv2.line(frame, (415, 340), (445, 330), (60, 60, 60), 2)
        cv2.putText(frame, "ALERT: INFRASTRUCTURE DAMAGE", (160, 160), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 100, 255), 2, cv2.LINE_AA)
        
    elif event_type == 'RESTRICTED_ACCESS':
        # Intruder alert bounding boxes
        cv2.rectangle(frame, (270, 130), (370, 370), (0, 0, 210), 3) # box
        cv2.circle(frame, (320, 175), 22, (0, 0, 210), -1) # head
        cv2.line(frame, (320, 197), (320, 290), (0, 0, 210), 7) # torso
        cv2.putText(frame, "ALERT: SECURITY BREACH IN PROGRESS", (140, 95), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2, cv2.LINE_AA)

    # Draw transparent black dashboard header HUD
    overlay = frame.copy()
    cv2.rectangle(overlay, (0, 0), (640, 65), (15, 15, 15), -1)
    cv2.addWeighted(overlay, 0.6, frame, 0.4, 0, frame)
    
    cv2.putText(frame, f"CIVICLENS EDGE CAM // SECURE FEED // {zone_id}", (15, 25), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (220, 220, 220), 1, cv2.LINE_AA)
    cv2.putText(frame, "AI ENGINE RUNNING - ALL SYSTEMS NOMINAL", (15, 48), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 200, 0), 1, cv2.LINE_AA)

    # Draw scanning corner HUD markings
    color_hud = (0, 220, 0) if event_type != 'RESTRICTED_ACCESS' else (0, 0, 220)
    cv2.line(frame, (10, 75), (35, 75), color_hud, 2)
    cv2.line(frame, (10, 75), (10, 100), color_hud, 2)
    cv2.line(frame, (10, 470), (35, 470), color_hud, 2)
    cv2.line(frame, (10, 470), (10, 445), color_hud, 2)
    cv2.line(frame, (630, 75), (605, 75), color_hud, 2)
    cv2.line(frame, (630, 75), (630, 100), color_hud, 2)
    cv2.line(frame, (630, 470), (605, 470), color_hud, 2)
    cv2.line(frame, (630, 470), (630, 445), color_hud, 2)
    
    return frame

def detect_person_in_zone(frame: np.ndarray):
    """Fallback camera detection logic using average brightness."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    mean_val = float(np.mean(gray))
    trigger = mean_val < 100
    confidence = min(0.99, max(0.1, (100 - mean_val) / 100)) if trigger else 0.05
    event_type = 'TRASH_ACCUMULATION' if trigger else 'NONE'
    return trigger, confidence, event_type

def encode_snapshot_jpeg(frame: np.ndarray):
    ok, buf = cv2.imencode('.jpg', frame, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    if not ok:
        raise RuntimeError('Failed to encode snapshot')
    return BytesIO(buf.tobytes())

def send_alert_with_snapshot(frame: np.ndarray, confidence: float, event_type: str, zone_id: str, timestamp_ms: int):
    url = f"{ADMIN_URL}/api/alerts-with-snapshot"
    snapshot_file = encode_snapshot_jpeg(frame)
    
    data = {
        'zoneId': zone_id,
        'confidence': str(confidence),
        'eventType': event_type,
        'timestamp': str(timestamp_ms),
        'meta': json.dumps({'source': 'edge_client_upgraded'})
    }

    files = {
        'snapshot': ('snapshot.jpg', snapshot_file.getvalue(), 'image/jpeg')
    }

    resp = requests.post(url, data=data, files=files, timeout=15)
    resp.raise_for_status()
    return resp.json()

def run_simulation():
    """Generates continuous simulated events for the dashboard without requiring a camera."""
    print("--- CivicLens AI Camera Simulator Active ---")
    print(f"Server Target: {ADMIN_URL}")
    print("Press Ctrl+C to terminate.")

    while True:
        # Choose a random incident
        event_type, confidence, zone_id = random.choice(INCIDENTS)
        print(f"\n[Simulator] Simulating event: {event_type} in {zone_id}...")
        
        # Draw frame
        frame = generate_mock_incident(event_type, zone_id)
        timestamp_ms = int(time.time() * 1000)
        
        try:
            res = send_alert_with_snapshot(frame, confidence, event_type, zone_id, timestamp_ms)
            print(f"[Simulator] Alert posted successfully! DB ID: {res.get('id')}")
        except Exception as e:
            print(f"[Simulator] Failed to send alert: {e}")
            
        # Wait for debounce duration
        sleep_dur = ALERT_DEBOUNCE_SECONDS + random.randint(5, 15)
        print(f"[Simulator] Debouncing... Sleeping for {sleep_dur:.1f} seconds...")
        time.sleep(sleep_dur)

def initialize_camera():
    """Tries to initialize the camera using configured index and backend.
    Falls back to other indices and DirectShow on Windows if needed."""
    configured_index = int(os.environ.get('CAMERA_INDEX', '0'))
    
    # Try configured configuration first
    print(f"Attempting to open camera index {configured_index}...")
    cap = None
    
    # On Windows, try DirectShow first as it's more stable
    backends = []
    if os.name == 'nt':
        backends = [cv2.CAP_DSHOW, None]
    else:
        backends = [None]
        
    for backend in backends:
        try:
            if backend is not None:
                cap = cv2.VideoCapture(configured_index, backend)
            else:
                cap = cv2.VideoCapture(configured_index)
            if cap.isOpened():
                # Test grabbing a frame to ensure it actually works
                ret, _ = cap.read()
                if ret:
                    print(f"Successfully opened camera index {configured_index}!")
                    return cap
                cap.release()
        except Exception:
            if cap:
                cap.release()

    # If configured index failed, search for any working camera index
    print("Configured camera failed. Searching for any working camera index...")
    for idx in range(5):
        if idx == configured_index:
            continue
        for backend in (backends if os.name == 'nt' else [None]):
            try:
                if backend is not None:
                    cap = cv2.VideoCapture(idx, backend)
                else:
                    cap = cv2.VideoCapture(idx)
                if cap.isOpened():
                    ret, _ = cap.read()
                    if ret:
                        print(f"Found working camera at index {idx}!")
                        return cap
                    cap.release()
            except Exception:
                if cap:
                    cap.release()
                
    return None

def main():
    print('CivicLens Edge Client starting...')
    
    if MOCK_CAMERA:
        run_simulation()
        return

    # Attempt to open physical hardware camera
    cap = initialize_camera()
    if cap is None or not cap.isOpened():
        print("[WARNING] Could not open any working physical camera.")
        print("[INFO] Fallback: Starting AI Camera Simulator instead...")
        run_simulation()
        return

    print("--- Physical Hardware Camera Mode Active ---")
    print("Close the frame window or press 'q' to quit.")
    
    last_alert_ts = 0.0

    while True:
        ret, frame = cap.read()
        if not ret:
            print('Camera frame read failed; retrying...')
            time.sleep(0.5)
            continue

        trigger, confidence, event_type = detect_person_in_zone(frame)
        now = time.time()

        if trigger and (now - last_alert_ts) >= ALERT_DEBOUNCE_SECONDS:
            timestamp_ms = int(time.time() * 1000)
            try:
                print(f'[Camera Alert] Triggered: {event_type} in {ZONE_ID} (conf={confidence:.2f})')
                res = send_alert_with_snapshot(frame, confidence, event_type, ZONE_ID, timestamp_ms)
                print('[Camera Alert] Sent successfully:', res)
                last_alert_ts = now
            except Exception as e:
                print('[Camera Alert] Post failed:', e)

        # Draw local video frame preview HUD
        cv2.putText(
            frame,
            f"ZONE: {ZONE_ID} // AI STATE: RUNNING",
            (15, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 255, 0),
            2,
            cv2.LINE_AA
        )
        if trigger:
            cv2.putText(
                frame,
                f"ALERT: TRASH ACCUMULATION (CONF={confidence:.2f})",
                (15, 60),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                (0, 100, 255),
                2,
                cv2.LINE_AA
            )
            
        try:
            cv2.imshow('CivicLens AI Camera Feed', frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
        except Exception:
            # Fallback to keep CPU usage standard if running in a headless shell
            time.sleep(0.03)

    cap.release()
    try:
        cv2.destroyAllWindows()
    except Exception:
        pass

if __name__ == '__main__':
    main()

