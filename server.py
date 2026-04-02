"""
쟁의 참여 현황 서버
실행: python server.py [옵션]
  --port 8080   포트 지정 (기본: 8080)
접속: http://localhost:8080  (같은 망: http://<내IP>:8080)
"""

import argparse
import json
import os
import shutil
from datetime import datetime
from http.server import HTTPServer, SimpleHTTPRequestHandler

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_FILE = os.path.join(BASE_DIR, 'data.json')
BACKUP_DIR = os.path.join(BASE_DIR, 'backup')

# CLI args
parser = argparse.ArgumentParser()
parser.add_argument('--port', type=int, default=8080, help='포트 (기본: 8080)')
args = parser.parse_args()
PORT = args.port


def backup_data():
    """저장 전 기존 data.json을 backup/ 폴더에 타임스탬프로 복사"""
    if not os.path.exists(DATA_FILE):
        return
    os.makedirs(BACKUP_DIR, exist_ok=True)
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    dest = os.path.join(BACKUP_DIR, f'data_{ts}.json')
    shutil.copy2(DATA_FILE, dest)


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            self.path = '/strike-status.html'
        if self.path == '/api/data':
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Private-Network', 'true')
            self.end_headers()
            if os.path.exists(DATA_FILE):
                with open(DATA_FILE, 'r', encoding='utf-8') as f:
                    self.wfile.write(f.read().encode('utf-8'))
            else:
                self.wfile.write(b'[]')
            return

        return super().do_GET()

    def do_POST(self):
        if self.path == '/api/data':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8')
            parsed = json.loads(body)
            backup_data()
            with open(DATA_FILE, 'w', encoding='utf-8') as f:
                json.dump(parsed, f, ensure_ascii=False, indent=2)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Access-Control-Allow-Private-Network', 'true')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': True, 'count': len(parsed)}).encode('utf-8'))
            return
        self.send_error(404)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.end_headers()


if __name__ == '__main__':
    import socket
    # Get local IP
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        local_ip = s.getsockname()[0]
    except Exception:
        local_ip = '127.0.0.1'
    finally:
        s.close()

    print(f'\n  쟁의 참여 현황 서버 시작!')
    print(f'  로컬 접속:  http://localhost:{PORT}')
    print(f'  네트워크:   http://{local_ip}:{PORT}')
    print(f'  데이터 저장: {DATA_FILE}')
    print(f'  백업 폴더:  {BACKUP_DIR}')
    print(f'\n  종료하려면 Ctrl+C\n')

    server = HTTPServer(('0.0.0.0', PORT), Handler)
    server.serve_forever()
