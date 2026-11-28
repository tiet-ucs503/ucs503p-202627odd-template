import os
import sys
import importlib.util

_base_dir = os.path.dirname(os.path.abspath(__file__))
_app_dir = os.path.join(_base_dir, "code", "BHARATASSIST")

if os.path.isdir(_app_dir):
    sys.path.insert(0, _app_dir)
    os.chdir(_app_dir)
    spec = importlib.util.spec_from_file_location("bharatassist_app", os.path.join(_app_dir, "app.py"))
    bharatassist_app = importlib.util.module_from_spec(spec)
    sys.modules["bharatassist_app"] = bharatassist_app
    spec.loader.exec_module(bharatassist_app)
    app = bharatassist_app.app
else:
    from app import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    host = os.environ.get("HOST", "0.0.0.0")
    app.run(host=host, port=port)
