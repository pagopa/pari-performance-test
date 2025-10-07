#!/usr/bin/env python3
import argparse
import os
import pathlib
import subprocess
import sys

_INTERESTING_PREFIXES = ("K6PERF_",)
_INTERESTING_KEYS = {"TARGET_ENV"}


def _collect_interesting_env(env):
    relevant = {}
    for key, value in env.items():
        if key in _INTERESTING_KEYS or key.startswith(_INTERESTING_PREFIXES):
            relevant[key] = value
    return dict(sorted(relevant.items()))


def _print_run_summary(script_path, cmd, env):
    print(f"🚀 Running ./xk6 run {script_path}")
    print("ℹ️ Environment variables forwarded to k6:")

    interesting_env = _collect_interesting_env(env)
    if not interesting_env:
        print("  <none found>")
    else:
        for key, value in interesting_env.items():
            print(f"  {key}: {value}")

    print(f"🛠️ Command: {' '.join(cmd)}")


def _build_command(script_path):
    return ["./xk6", "run", str(script_path)]


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a k6 script with pipeline configuration")
    parser.add_argument("--script", required=True, help="Path to the k6 script to execute")
    parser.add_argument("--dry-run", action="store_true", help="Skip executing xk6")
    args = parser.parse_args()

    script_path = pathlib.Path(args.script.strip())
    if not script_path.is_file():
        print(f"❌ Script {script_path} not found", file=sys.stderr)
        return 1

    env = os.environ.copy()
    cmd = _build_command(script_path)

    _print_run_summary(script_path, cmd, env)

    if args.dry_run:
        print("✅ Dry run successful; skipping xk6 execution.")
        return 0

    completed = subprocess.run(cmd, env=env)
    return completed.returncode


if __name__ == "__main__":
    sys.exit(main())
