#!/usr/bin/env python3
import argparse
import json
import os
import pathlib
import shlex
import subprocess
import sys


def _to_int(value, default=0):
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def _normalize_stages(raw_value):
    if not raw_value or raw_value.strip() in {"", "null"}:
        return []
    try:
        data = json.loads(raw_value)
    except json.JSONDecodeError as exc:
        print(f"Warning: unable to parse K6_STAGES (fallback to empty): {exc}", file=sys.stderr)
        return []
    if not isinstance(data, list):
        return []
    normalized = []
    for item in data:
        if not isinstance(item, dict):
            continue
        duration = str(item.get("duration", "")).strip()
        target = item.get("target")
        if not duration:
            continue
        try:
            target_int = int(target)
        except (TypeError, ValueError):
            continue
        normalized.append({"duration": duration, "target": target_int})
    return normalized


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a k6 script with pipeline configuration")
    parser.add_argument("--script", required=True, help="Path to the k6 script to execute")
    args = parser.parse_args()

    script_path = pathlib.Path(args.script.strip())
    if not script_path.is_file():
        print(f"Script {script_path} not found", file=sys.stderr)
        return 1

    env = os.environ.copy()

    target_env = env.get("TARGET_ENV", "uat")
    scenario_type = env.get("K6_SCENARIO_TYPE", "constant-arrival-rate")
    duration = env.get("K6_DURATION", "")
    iterations = _to_int(env.get("K6_ITERATIONS"), 0)
    vus = _to_int(env.get("K6_VUS"), 1)
    rate = env.get("K6_RATE", "")
    time_unit = env.get("K6_TIME_UNIT", "")
    rps = _to_int(env.get("K6_RPS"), 0)
    start_vus = env.get("K6_START_VUS", "")
    pre_allocated_vus = env.get("K6_PRE_ALLOCATED_VUS", "")
    max_vus = env.get("K6_MAX_VUS", "")

    stages_raw = env.get("K6_STAGES_PARAM") or env.get("K6_STAGES_JSON") or env.get("K6_STAGES") or "[]"
    stages_normalized = _normalize_stages(stages_raw)
    stage_flags = []
    if stages_normalized:
        env["K6_STAGES_JSON"] = json.dumps(stages_normalized)
        stage_flags = [flag for stage in stages_normalized for flag in ("--stage", f"{stage['duration']}:{stage['target']}")]
    else:
        env.pop("K6_STAGES_JSON", None)

    print(f"Running ./xk6 run {script_path}")
    print("Using environment variables:")
    print(f"  TARGET_ENV      : {target_env}")
    print(f"  K6_SCENARIO_TYPE: {scenario_type}")
    print(f"  K6_DURATION     : {duration}")
    print(f"  K6_ITERATIONS   : {iterations}")
    print(f"  K6_VUS          : {vus}")
    print(f"  K6_RATE         : {rate}")
    print(f"  K6_TIME_UNIT    : {time_unit}")
    print(f"  K6_RPS          : {rps}")
    print(f"  K6_START_VUS    : {start_vus}")
    print(f"  K6_PRE_ALLOCATED_VUS: {pre_allocated_vus}")
    print(f"  K6_MAX_VUS      : {max_vus}")
    print(f"  K6_STAGES_JSON  : {env.get('K6_STAGES_JSON', '[]')}")
    print(f"  CLI --stage args: {stage_flags if stage_flags else '[]'}")

    cmd = [
        "./xk6",
        "run",
        str(script_path),
        "--vus",
        str(vus),
        "--tag",
        f"environment={target_env}",
    ]

    if duration and duration != "0":
        cmd.extend(["--duration", duration])
    if iterations > 0:
        cmd.extend(["--iterations", str(iterations)])
    if rps > 0:
        cmd.extend(["--rps", str(rps)])
    if stage_flags:
        cmd.extend(stage_flags)

    print(f"Command: {' '.join(shlex.quote(part) for part in cmd)}")

    completed = subprocess.run(cmd, env=env)
    return completed.returncode


if __name__ == "__main__":
    sys.exit(main())
