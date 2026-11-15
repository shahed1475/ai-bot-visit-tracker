#!/usr/bin/env python3
"""Run every test suite: registry, Node, PWA assets, Python (Flask/Django), PHP, and the Cloudflare Worker.

    python3 tests/run_all_tests.py            # all suites
    python3 tests/run_all_tests.py node php   # only some

Python/Flask/Django tests need `pip install flask django`; the Worker needs `npm install` in cloudflare/.
"""
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SUITES = {
    "registry": ([sys.executable, "-I", "tests/test_registry.py"], ROOT),
    "node": (["node", "--test", "tests/test_nodejs_middleware.js"], ROOT),
    "pwa": (["node", "--test", "tests/test_pwa_assets.js"], ROOT),
    "python": ([sys.executable, "-I", "tests/test_python_core.py"], ROOT),
    "php-detector": (["php", "tests/test_php_detector.php"], ROOT),
    "php-tracker": (["php", "tests/test_php_tracker.php"], ROOT),
    "php-reporter": (["php", "tests/test_php_reporter.php"], ROOT),
    "worker": (["npm", "test", "--silent"], ROOT / "cloudflare"),
}


def main() -> int:
    wanted = sys.argv[1:] or list(SUITES)
    failed = []
    for name, (cmd, cwd) in SUITES.items():
        if not any(name.startswith(w) for w in wanted):
            continue
        if shutil.which(cmd[0]) is None:
            print(f"SKIP {name}: {cmd[0]} not installed")
            continue
        print(f"\n=== {name} ===", flush=True)
        if subprocess.run(cmd, cwd=cwd).returncode != 0:
            failed.append(name)
    print("\nFAILED: " + ", ".join(failed) if failed else "\nAll suites passed")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
