from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

import cv2
import numpy as np
import pyrealsense2 as rs

# ----------------
# スクリプト自身の場所からパスを解決（ユーザー・配置場所非依存）
# depth_background/ は同じディレクトリに存在する
# ----------------
PROJECT_DIR = Path(__file__).parent
DEPTH_DIR = PROJECT_DIR / "depth_background"

ROI_FILE = DEPTH_DIR / "person_floor_roi.npy"
BACKGROUND_DEPTH_FILE = DEPTH_DIR / "background_depth_m.npy"

CAM_HIGH_SERIAL = "335122270822"
WIDTH = 640
HEIGHT = 480
FPS = 30

# 現在の環境ではノイズがあるため、やや厳しめ
DEPTH_DIFF_THRESHOLD_M = 0.18
MIN_AREA = 1800

OBSERVATION_FRAMES = 45
MIN_DIRECTION_VOTES = 12


def print_json(payload: dict) -> None:
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def classify_direction(center_x: int, roi_x: int, roi_w: int) -> str:
    relative_x = center_x - roi_x

    if relative_x < roi_w / 3:
        return "left"

    if relative_x < roi_w * 2 / 3:
        return "center"

    return "right"


def make_depth_preview(depth_m: np.ndarray) -> np.ndarray:
    depth_mm = np.clip(depth_m * 1000, 0, 3000).astype(np.uint16)
    normalized = cv2.convertScaleAbs(depth_mm, alpha=255.0 / 3000.0)
    return cv2.applyColorMap(normalized, cv2.COLORMAP_TURBO)


def detect_direction(preview: bool = False) -> dict:
    if not ROI_FILE.exists():
        return {
            "ok": False,
            "reason": "roi_file_not_found",
            "path": str(ROI_FILE),
        }

    if not BACKGROUND_DEPTH_FILE.exists():
        return {
            "ok": False,
            "reason": "background_depth_file_not_found",
            "path": str(BACKGROUND_DEPTH_FILE),
        }

    roi_x, roi_y, roi_w, roi_h = np.load(ROI_FILE).astype(int)
    background_depth = np.load(BACKGROUND_DEPTH_FILE)

    roi_mask = np.zeros((HEIGHT, WIDTH), dtype=np.uint8)
    roi_mask[roi_y:roi_y + roi_h, roi_x:roi_x + roi_w] = 255

    border_1 = int(roi_x + roi_w / 3)
    border_2 = int(roi_x + roi_w * 2 / 3)

    pipeline = rs.pipeline()
    config = rs.config()

    config.enable_device(CAM_HIGH_SERIAL)
    config.enable_stream(rs.stream.depth, WIDTH, HEIGHT, rs.format.z16, FPS)

    votes: list[str] = []
    areas: list[float] = []

    try:
        profile = pipeline.start(config)
        depth_scale = profile.get_device().first_depth_sensor().get_depth_scale()

        # センサー安定待ち
        for _ in range(20):
            pipeline.wait_for_frames()

        for _ in range(OBSERVATION_FRAMES):
            frames = pipeline.wait_for_frames()
            depth_frame = frames.get_depth_frame()

            if not depth_frame:
                continue

            depth_raw = np.asanyarray(depth_frame.get_data())
            current_depth = depth_raw.astype(np.float32) * depth_scale

            valid = (background_depth > 0) & (current_depth > 0)

            foreground = (
                ((background_depth - current_depth) > DEPTH_DIFF_THRESHOLD_M)
                & valid
            )

            mask = np.zeros((HEIGHT, WIDTH), dtype=np.uint8)
            mask[foreground] = 255
            mask = cv2.bitwise_and(mask, roi_mask)

            kernel = np.ones((7, 7), dtype=np.uint8)
            mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
            mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

            contours, _ = cv2.findContours(
                mask,
                cv2.RETR_EXTERNAL,
                cv2.CHAIN_APPROX_SIMPLE,
            )

            valid_contours = [
                contour
                for contour in contours
                if cv2.contourArea(contour) >= MIN_AREA
            ]

            direction = None
            target_box = None
            center = None

            if valid_contours:
                target = max(valid_contours, key=cv2.contourArea)
                area = float(cv2.contourArea(target))

                x, y, w, h = cv2.boundingRect(target)
                moments = cv2.moments(target)

                if moments["m00"] > 0:
                    center_x = int(moments["m10"] / moments["m00"])
                    center_y = int(moments["m01"] / moments["m00"])
                else:
                    center_x = x + w // 2
                    center_y = y + h // 2

                direction = classify_direction(center_x, roi_x, roi_w)

                votes.append(direction)
                areas.append(area)
                target_box = (x, y, w, h)
                center = (center_x, center_y)

            if preview:
                view = make_depth_preview(current_depth)

                cv2.rectangle(
                    view,
                    (roi_x, roi_y),
                    (roi_x + roi_w, roi_y + roi_h),
                    (255, 255, 255),
                    2,
                )
                cv2.line(view, (border_1, roi_y), (border_1, roi_y + roi_h), (255, 255, 255), 2)
                cv2.line(view, (border_2, roi_y), (border_2, roi_y + roi_h), (255, 255, 255), 2)

                cv2.putText(view, "LEFT", (roi_x + 5, roi_y + 24),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
                cv2.putText(view, "CENTER", (border_1 + 5, roi_y + 24),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)
                cv2.putText(view, "RIGHT", (border_2 + 5, roi_y + 24),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 2)

                if target_box is not None and center is not None and direction is not None:
                    x, y, w, h = target_box
                    cv2.rectangle(view, (x, y), (x + w, y + h), (0, 255, 0), 3)
                    cv2.circle(view, center, 6, (0, 0, 255), -1)
                    cv2.putText(view, f"CANDIDATE: {direction.upper()}",
                                (20, HEIGHT - 25),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 255, 0), 2)
                else:
                    cv2.putText(view, "NO TARGET",
                                (20, HEIGHT - 25),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.75, (0, 0, 255), 2)

                mask_view = cv2.cvtColor(mask, cv2.COLOR_GRAY2BGR)
                cv2.imshow("Detect Person Direction | Depth / Mask", np.hstack((view, mask_view)))
                cv2.waitKey(1)

    except Exception as e:
        return {
            "ok": False,
            "reason": "exception",
            "error": str(e),
        }

    finally:
        try:
            pipeline.stop()
        except Exception:
            pass

        if preview:
            cv2.destroyAllWindows()

    if not votes:
        return {
            "ok": False,
            "reason": "no_person_detected",
            "direction": None,
            "votes": {},
            "threshold_m": DEPTH_DIFF_THRESHOLD_M,
            "min_area": MIN_AREA,
        }

    counts = Counter(votes)
    direction, vote_count = counts.most_common(1)[0]

    if vote_count < MIN_DIRECTION_VOTES:
        return {
            "ok": False,
            "reason": "unstable_direction",
            "direction": direction,
            "votes": dict(counts),
            "max_votes": vote_count,
            "required_votes": MIN_DIRECTION_VOTES,
            "avg_area": float(np.mean(areas)) if areas else 0.0,
        }

    return {
        "ok": True,
        "direction": direction,
        "votes": dict(counts),
        "max_votes": vote_count,
        "required_votes": MIN_DIRECTION_VOTES,
        "avg_area": float(np.mean(areas)) if areas else 0.0,
        "roi": {
            "x": int(roi_x),
            "y": int(roi_y),
            "w": int(roi_w),
            "h": int(roi_h),
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args()

    result = detect_direction(preview=args.preview)
    print_json(result)

    return 0 if result.get("ok") else 2


if __name__ == "__main__":
    sys.exit(main())
