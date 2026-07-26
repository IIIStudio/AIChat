#!/usr/bin/env python3
"""解析 JSON 文件，找到所有 base64 图片，上传到图床后替换为 URL。"""

import json
import re
import base64
import time
import sys
import os
import hashlib
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

OUTPUT_FILE = '/workspace/chat-providers.json'
UPLOAD_URL = 'https://p.sda1.dev/api/v1/upload_external_noform'

# 匹配 data:image/...;base64,<base64数据> 的正则
BASE64_RE = re.compile(r'data:image/\w+;base64,([A-Za-z0-9+/=]+)')


def extract_base64_entries(obj, path=None, results=None):
    """递归查找 JSON 对象中所有的 base64 数据 URI。"""
    if results is None:
        results = []
    if path is None:
        path = []

    if isinstance(obj, dict):
        for key, value in obj.items():
            new_path = path + [key]
            if isinstance(value, str) and BASE64_RE.match(value):
                results.append((new_path, value))
            else:
                extract_base64_entries(value, new_path, results)
    elif isinstance(obj, list):
        for idx, item in enumerate(obj):
            new_path = path + [idx]
            if isinstance(item, str) and BASE64_RE.match(item):
                results.append((new_path, item))
            else:
                extract_base64_entries(item, new_path, results)
    elif isinstance(obj, str) and BASE64_RE.match(obj):
        results.append((path, obj))

    return results


def upload_image(base64_data: str, counter: int) -> str:
    """解码 base64 图片并上传到图床，返回 URL。"""
    match = BASE64_RE.match(base64_data)
    if not match:
        raise ValueError(f"不是有效的 base64 数据 URI: {base64_data[:50]}...")

    raw_b64 = match.group(1)
    image_bytes = base64.b64decode(raw_b64)

    # 根据图片哈希生成唯一文件名
    img_hash = hashlib.md5(image_bytes).hexdigest()[:12]
    filename = f"image_{counter}_{img_hash}.png"

    # 上传：API 接受二进制 body，文件名通过 query 参数传递
    req_url = f"{UPLOAD_URL}?filename={filename}"
    req = Request(
        req_url,
        data=image_bytes,
        method='POST',
        headers={
            'Content-Type': 'application/octet-stream',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Referer': 'https://p.sda1.dev/',
            'Origin': 'https://p.sda1.dev',
        }
    )

    try:
        with urlopen(req, timeout=60) as resp:
            resp_data = json.loads(resp.read().decode('utf-8'))
    except HTTPError as e:
        body = e.read().decode('utf-8', errors='replace')
        raise RuntimeError(f"HTTP {e.code}: {body}")
    except URLError as e:
        raise RuntimeError(f"网络连接错误: {e.reason}")

    # 响应格式: {"data": {"url": "...", "delete_url": "..."}}
    url = resp_data.get('data', {}).get('url', '')
    if not url:
        raise RuntimeError(f"响应异常，未找到 url: {json.dumps(resp_data)}")

    return url


def set_nested(obj, path, value):
    """在嵌套的 dict/list 结构中设置指定路径的值。"""
    for key in path[:-1]:
        if isinstance(obj, list) and isinstance(key, int):
            obj = obj[key]
        else:
            obj = obj[key]
    last = path[-1]
    if isinstance(obj, list) and isinstance(last, int):
        obj[last] = value
    else:
        obj[last] = value


def main():
    # 获取输入文件路径
    if len(sys.argv) > 1:
        input_file = sys.argv[1]
    else:
        input_file = input("请输入 JSON 文件路径: ").strip()

    print(f"正在读取 {input_file}...")
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print("正在扫描 base64 图片条目...")
    entries = extract_base64_entries(data)
    print(f"找到 {len(entries)} 个 base64 图片待上传。")

    success = 0
    failed = 0

    for i, (path, b64_data) in enumerate(entries):
        print(f"\n[{i+1}/{len(entries)}] 正在上传图片，路径: {' -> '.join(str(p) for p in path)}")

        m = BASE64_RE.match(b64_data)
        img_type = m.group(1) if m else "unknown"
        data_len = len(img_type) if m else 0
        print(f"  Base64 数据长度: {data_len} 字符")

        try:
            url = upload_image(b64_data, i + 1)
            # 去掉文件名，只保留目录部分 + 结尾斜杠
            dir_url = os.path.dirname(url) + '/'
            print(f"  上传成功: {url}")
            print(f"  实际写入: {dir_url}")
            set_nested(data, path, dir_url)
            success += 1
        except Exception as e:
            print(f"  上传失败: {e}")
            failed += 1
            # 保存当前进度，以便断点续传
            print("  保存进度后继续...")
            with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

        # 短暂延时，避免请求过快被限流
        time.sleep(1)

    print(f"\n{'='*50}")
    print(f"完成！成功: {success}, 失败: {failed}")

    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"结果已保存到: {OUTPUT_FILE}")


if __name__ == '__main__':
    main()
