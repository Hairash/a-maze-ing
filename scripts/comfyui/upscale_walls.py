#!/usr/bin/env python3
"""
Batch-upscale wall*.png images in public/images/ using ComfyUI + Real-ESRGAN.

Each image is uploaded to ComfyUI, upscaled 4x with RealESRGAN_x4plus, then
downscaled to TARGET_SIZE so the on-disk asset stays reasonable while gaining
sharper edges/cleaner texture.

Usage:
    # 1) start ComfyUI:
    #      cd ~/Projects/ComfyUI && source venv/bin/activate && python main.py --force-fp16
    # 2) run this script from anywhere:
    python scripts/comfyui/upscale_walls.py
    python scripts/comfyui/upscale_walls.py --target-size 384
    python scripts/comfyui/upscale_walls.py --pattern 'wall[0-9]*.png' --dry-run
"""

import argparse
import json
import mimetypes
import shutil
import sys
import time
import urllib.error
import urllib.request
import uuid
from pathlib import Path

COMFYUI_URL = "http://127.0.0.1:8188"
COMFYUI_DIR = Path.home() / "Projects" / "ComfyUI"
UPSCALE_MODEL = "RealESRGAN_x4plus.pth"

REPO_ROOT = Path(__file__).resolve().parents[2]
IMAGES_DIR = REPO_ROOT / "public" / "images"


def check_comfyui_running() -> bool:
    try:
        urllib.request.urlopen(f"{COMFYUI_URL}/system_stats", timeout=5)
        return True
    except (urllib.error.URLError, TimeoutError):
        return False


def upload_image(path: Path) -> str:
    """POST an image to ComfyUI /upload/image. Returns the server-side filename."""
    boundary = f"----ComfyUpload{uuid.uuid4().hex}"
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    body = bytearray()
    # subfolder=""
    body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"subfolder\"\r\n\r\n\r\n".encode()
    # overwrite=true
    body += f"--{boundary}\r\nContent-Disposition: form-data; name=\"overwrite\"\r\n\r\ntrue\r\n".encode()
    # the file
    body += (
        f"--{boundary}\r\n"
        f"Content-Disposition: form-data; name=\"image\"; filename=\"{path.name}\"\r\n"
        f"Content-Type: {mime}\r\n\r\n"
    ).encode()
    body += path.read_bytes()
    body += f"\r\n--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        f"{COMFYUI_URL}/upload/image",
        data=bytes(body),
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
    )
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())["name"]


def build_workflow(input_name: str, target_size: int, output_prefix: str) -> dict:
    """Load → 4x upscale model → scale down to target_size → save."""
    return {
        "1": {
            "class_type": "LoadImage",
            "inputs": {"image": input_name, "upload": "image"},
        },
        "2": {
            "class_type": "UpscaleModelLoader",
            "inputs": {"model_name": UPSCALE_MODEL},
        },
        "3": {
            "class_type": "ImageUpscaleWithModel",
            "inputs": {"upscale_model": ["2", 0], "image": ["1", 0]},
        },
        "4": {
            "class_type": "ImageScale",
            "inputs": {
                "image": ["3", 0],
                "upscale_method": "lanczos",
                "width": target_size,
                "height": target_size,
                "crop": "disabled",
            },
        },
        "5": {
            "class_type": "SaveImage",
            "inputs": {"filename_prefix": output_prefix, "images": ["4", 0]},
        },
    }


def queue_prompt(workflow: dict) -> str:
    data = json.dumps({"prompt": workflow}).encode()
    req = urllib.request.Request(
        f"{COMFYUI_URL}/prompt",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read())["prompt_id"]


def wait_for_completion(prompt_id: str, timeout: int = 300) -> dict:
    start = time.time()
    while time.time() - start < timeout:
        resp = urllib.request.urlopen(f"{COMFYUI_URL}/history/{prompt_id}")
        history = json.loads(resp.read())
        if prompt_id in history:
            return history[prompt_id]
        elapsed = int(time.time() - start)
        print(f"\r    processing... {elapsed}s", end="", flush=True)
        time.sleep(1)
    print()
    raise TimeoutError(f"Generation timed out after {timeout}s")


def find_output_file(history_entry: dict) -> Path | None:
    for node_output in history_entry.get("outputs", {}).values():
        for img in node_output.get("images", []):
            subfolder = img.get("subfolder", "")
            path = COMFYUI_DIR / "output"
            if subfolder:
                path = path / subfolder
            path = path / img["filename"]
            if path.exists():
                return path
    return None


def upscale_one(src: Path, target_size: int) -> Path | None:
    print(f"  → uploading {src.name} ...")
    server_name = upload_image(src)
    prefix = f"upscaled_{src.stem}"
    workflow = build_workflow(server_name, target_size, prefix)
    prompt_id = queue_prompt(workflow)
    result = wait_for_completion(prompt_id)
    print()
    return find_output_file(result)


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--pattern",
        default="wall[0-9]*.png",
        help="Glob inside public/images/ (default: wall[0-9]*.png)",
    )
    parser.add_argument(
        "--target-size",
        type=int,
        default=512,
        help="Final PNG side length in pixels after 4x upscale (default: 512)",
    )
    parser.add_argument(
        "--replace",
        action="store_true",
        default=True,
        help="Overwrite the originals in public/images/ (default: true)",
    )
    parser.add_argument(
        "--no-replace",
        dest="replace",
        action="store_false",
        help="Leave originals alone; only write results to scripts/comfyui/output/",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List matched files and exit",
    )
    args = parser.parse_args()

    files = sorted(IMAGES_DIR.glob(args.pattern))
    if not files:
        print(f"No files matched {IMAGES_DIR}/{args.pattern}")
        sys.exit(1)

    print(f"Matched {len(files)} file(s):")
    for f in files:
        print(f"  {f.relative_to(REPO_ROOT)}")
    if args.dry_run:
        return

    if not check_comfyui_running():
        print("\nERROR: ComfyUI not reachable at " + COMFYUI_URL)
        print("Start it first:")
        print("  cd ~/Projects/ComfyUI && source venv/bin/activate && python main.py --force-fp16")
        sys.exit(1)

    staging = Path(__file__).parent / "output"
    staging.mkdir(parents=True, exist_ok=True)

    ok = fail = 0
    for i, src in enumerate(files, 1):
        print(f"\n[{i}/{len(files)}] {src.name}")
        try:
            produced = upscale_one(src, args.target_size)
        except Exception as e:
            print(f"  ! error: {e}")
            fail += 1
            continue

        if not produced:
            print("  ! no output file found")
            fail += 1
            continue

        staged = staging / f"{src.stem}.png"
        shutil.copy(produced, staged)
        print(f"  ✓ staged: {staged.relative_to(REPO_ROOT)}")

        if args.replace:
            shutil.copy(staged, src)
            print(f"  ✓ replaced: {src.relative_to(REPO_ROOT)}")
        ok += 1

    print(f"\nDone. success={ok} fail={fail} target={args.target_size}px")


if __name__ == "__main__":
    main()
