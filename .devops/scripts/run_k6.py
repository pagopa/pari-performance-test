#!/usr/bin/env python3
import argparse
import json
import os
import pathlib
import re
import shlex
import subprocess
import sys

ITERATION_SCENARIOS = {"shared-iterations", "per-vu-iterations"}
VU_SCENARIOS = {"manual", "constant-vus", "ramping-vus"}
ARRIVAL_SCENARIOS = {"constant-arrival-rate", "ramping-arrival-rate"}
RAMPING_SCENARIOS = {"ramping-vus", "ramping-arrival-rate"}
ALL_SCENARIOS = ITERATION_SCENARIOS | VU_SCENARIOS | ARRIVAL_SCENARIOS

_ZEROISH_PATTERN = re.compile(r"^0+(\.0+)?([a-z]+)?$")


def _parse_int_or_default(value, default=0):
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return default


def _is_disabled_string(value) -> bool:
    normalized = (str(value or "").strip().lower()).replace(" ", "")
    if not normalized:
        return True
    if normalized in {"disabled", "none", "null"}:
        return True
    return bool(_ZEROISH_PATTERN.fullmatch(normalized))


def _parse_stage_list(raw_value):
    if not raw_value or raw_value.strip() in {"", "null"}:
        return []
    try:
        data = json.loads(raw_value)
    except json.JSONDecodeError as exc:
        print(
            f"⚠️ Warning: unable to parse K6_STAGES (fallback to empty): {exc}",
            file=sys.stderr,
        )
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


def _apply_positive_env_value(env, key, value):
    if value > 0:
        env[key] = str(value)
    else:
        env.pop(key, None)


def _format_int_for_display(value):
    return str(value) if value > 0 else "<disabled>"


def _format_text_for_display(value):
    return value if value else "<disabled>"


def _parse_configuration(env):
    errors = []

    target_env = (env.get("TARGET_ENV", "uat") or "").strip() or "uat"

    scenario_type_raw = env.get("K6_SCENARIO_TYPE", "")
    scenario_type_candidate = scenario_type_raw.strip().lower()
    if not scenario_type_candidate:
        errors.append("K6_SCENARIO_TYPE must be provided (no default fallback).")
    scenario_type = scenario_type_candidate

    duration_raw = env.get("K6_DURATION", "")
    duration_value = (duration_raw or "").strip()
    duration_enabled = not _is_disabled_string(duration_value)
    if not duration_enabled:
        duration_value = ""

    iterations = _parse_int_or_default(env.get("K6_ITERATIONS"), 0)
    vus = _parse_int_or_default(env.get("K6_VUS"), 0)
    rate = _parse_int_or_default(env.get("K6_RATE"), 0)

    time_unit_raw = env.get("K6_TIME_UNIT", "")
    time_unit_value = (time_unit_raw or "").strip()
    time_unit_enabled = not _is_disabled_string(time_unit_value)
    if not time_unit_enabled:
        time_unit_value = ""

    rps = _parse_int_or_default(env.get("K6_RPS"), 0)
    start_vus = _parse_int_or_default(env.get("K6_START_VUS"), 0)
    pre_allocated_vus = _parse_int_or_default(env.get("K6_PRE_ALLOCATED_VUS"), 0)
    max_vus = _parse_int_or_default(env.get("K6_MAX_VUS"), 0)

    stages_raw = (
        env.get("K6_STAGES_PARAM")
        or env.get("K6_STAGES_JSON")
        or env.get("K6_STAGES")
        or "[]"
    )
    stages = _parse_stage_list(stages_raw)

    k6_run_settings = {
        "target_env": target_env,
        "scenario_type": scenario_type,
        "scenario_type_raw": scenario_type_raw,
        "duration_value": duration_value,
        "duration_enabled": duration_enabled,
        "iterations": iterations,
        "vus": vus,
        "rate": rate,
        "time_unit_value": time_unit_value,
        "time_unit_enabled": time_unit_enabled,
        "rps": rps,
        "start_vus": start_vus,
        "pre_allocated_vus": pre_allocated_vus,
        "max_vus": max_vus,
        "stages": stages,
    }

    return k6_run_settings, errors


def _validate_configuration(k6_run_settings):
    errors = []
    ignored_params = set()

    scenario_label = k6_run_settings["scenario_type_raw"].strip() or k6_run_settings["scenario_type"]

    if k6_run_settings["scenario_type"] not in ALL_SCENARIOS:
        errors.append(
            "Unsupported K6_SCENARIO_TYPE "
            f"'{scenario_label}'. Valid options: "
            f"{', '.join(sorted(ALL_SCENARIOS))}."
        )
        return errors, ignored_params

    scenario_type = k6_run_settings["scenario_type"]

    if scenario_type == "manual":
        if k6_run_settings["vus"] <= 0:
            errors.append("'manual' executor requires K6_VUS > 0.")
        if k6_run_settings["iterations"] <= 0 and not k6_run_settings["duration_enabled"]:
            errors.append(
                "'manual' executor needs either K6_DURATION (> 0) or K6_ITERATIONS (> 0)."
            )

    elif scenario_type in ITERATION_SCENARIOS:
        if k6_run_settings["iterations"] <= 0:
            errors.append(
                f"{scenario_type} requires K6_ITERATIONS > 0."
            )
        if k6_run_settings["vus"] <= 0:
            errors.append(
                f"{scenario_type} requires K6_VUS > 0."
            )

    elif scenario_type == "constant-vus":
        if k6_run_settings["vus"] <= 0:
            errors.append("constant-vus requires K6_VUS > 0.")
        if not k6_run_settings["duration_enabled"]:
            errors.append("constant-vus requires K6_DURATION (e.g. '5m').")
        if k6_run_settings["iterations"] > 0:
            errors.append(
                "K6_ITERATIONS is incompatible with constant-vus; use shared-iterations or per-vu-iterations."
            )

    elif scenario_type == "ramping-vus":
        if k6_run_settings["start_vus"] <= 0:
            errors.append("ramping-vus requires K6_START_VUS > 0.")
        if not k6_run_settings["stages"]:
            errors.append("ramping-vus requires K6_STAGES to define the ramp sequence.")

    elif scenario_type == "constant-arrival-rate":
        if k6_run_settings["rate"] <= 0:
            errors.append("constant-arrival-rate requires K6_RATE > 0.")
        if not k6_run_settings["time_unit_enabled"]:
            errors.append("constant-arrival-rate requires K6_TIME_UNIT (e.g. '1s').")
        if not k6_run_settings["duration_enabled"]:
            errors.append("constant-arrival-rate requires K6_DURATION (e.g. '10m').")
        if k6_run_settings["pre_allocated_vus"] <= 0:
            errors.append("constant-arrival-rate requires K6_PRE_ALLOCATED_VUS > 0.")
        if (
            k6_run_settings["max_vus"] > 0
            and k6_run_settings["max_vus"] < k6_run_settings["pre_allocated_vus"]
        ):
            errors.append("K6_MAX_VUS must be >= K6_PRE_ALLOCATED_VUS.")

    elif scenario_type == "ramping-arrival-rate":
        if not k6_run_settings["stages"]:
            errors.append(
                "ramping-arrival-rate requires K6_STAGES with duration/target entries."
            )
        if not k6_run_settings["time_unit_enabled"]:
            errors.append("ramping-arrival-rate requires K6_TIME_UNIT (e.g. '1s').")
        if k6_run_settings["pre_allocated_vus"] <= 0:
            errors.append("ramping-arrival-rate requires K6_PRE_ALLOCATED_VUS > 0.")
        if k6_run_settings["max_vus"] <= 0:
            errors.append("ramping-arrival-rate requires K6_MAX_VUS > 0.")
        if (
            k6_run_settings["pre_allocated_vus"] > 0
            and k6_run_settings["max_vus"] > 0
            and k6_run_settings["max_vus"] < k6_run_settings["pre_allocated_vus"]
        ):
            errors.append("K6_MAX_VUS must be >= K6_PRE_ALLOCATED_VUS.")

    if scenario_type not in ITERATION_SCENARIOS and scenario_type != "manual":
        if k6_run_settings["iterations"] > 0:
            errors.append(
                "K6_ITERATIONS is only honoured by shared-iterations and per-vu-iterations."
            )

    if scenario_type not in ARRIVAL_SCENARIOS:
        if k6_run_settings["rate"] > 0:
            ignored_params.add("K6_RATE")
        if k6_run_settings["time_unit_enabled"]:
            ignored_params.add("K6_TIME_UNIT")
        if k6_run_settings["pre_allocated_vus"] > 0:
            ignored_params.add("K6_PRE_ALLOCATED_VUS")
        if k6_run_settings["max_vus"] > 0:
            ignored_params.add("K6_MAX_VUS")

    if scenario_type not in RAMPING_SCENARIOS and k6_run_settings["stages"]:
        ignored_params.add("K6_STAGES")

    return errors, ignored_params


def _prepare_environment(env, k6_run_settings):
    env["TARGET_ENV"] = k6_run_settings["target_env"]
    env["K6_SCENARIO_TYPE"] = k6_run_settings["scenario_type"]

    if k6_run_settings["duration_enabled"]:
        env["K6_DURATION"] = k6_run_settings["duration_value"]
    else:
        env.pop("K6_DURATION", None)

    _apply_positive_env_value(env, "K6_ITERATIONS", k6_run_settings["iterations"])
    _apply_positive_env_value(env, "K6_VUS", k6_run_settings["vus"])
    _apply_positive_env_value(env, "K6_RPS", k6_run_settings["rps"])

    if k6_run_settings["scenario_type"] in ARRIVAL_SCENARIOS:
        if k6_run_settings["time_unit_enabled"]:
            env["K6_TIME_UNIT"] = k6_run_settings["time_unit_value"]
        else:
            env.pop("K6_TIME_UNIT", None)
        _apply_positive_env_value(env, "K6_RATE", k6_run_settings["rate"])
        _apply_positive_env_value(env, "K6_PRE_ALLOCATED_VUS", k6_run_settings["pre_allocated_vus"])
        _apply_positive_env_value(env, "K6_MAX_VUS", k6_run_settings["max_vus"])
    else:
        env.pop("K6_TIME_UNIT", None)
        for key in ("K6_RATE", "K6_PRE_ALLOCATED_VUS", "K6_MAX_VUS"):
            env.pop(key, None)

    if k6_run_settings["scenario_type"] == "ramping-vus":
        _apply_positive_env_value(env, "K6_START_VUS", k6_run_settings["start_vus"])
    else:
        env.pop("K6_START_VUS", None)

    stage_flags = []
    if k6_run_settings["scenario_type"] in RAMPING_SCENARIOS and k6_run_settings["stages"]:
        env["K6_STAGES_JSON"] = json.dumps(k6_run_settings["stages"])
        stage_flags = [
            flag
            for stage in k6_run_settings["stages"]
            for flag in ("--stage", f"{stage['duration']}:{stage['target']}")
        ]
    else:
        env.pop("K6_STAGES_JSON", None)

    return stage_flags


def _print_invalid_configuration_summary(script_path, k6_run_settings):
    scenario_raw = k6_run_settings["scenario_type_raw"].strip() or "<missing>"
    scenario_normalized = k6_run_settings["scenario_type"] or "<invalid>"

    print(f"📋 Requested configuration for {script_path}:")
    print(f"  TARGET_ENV        : {k6_run_settings['target_env']}")
    print(f"  K6_SCENARIO_TYPE  : {scenario_raw} (normalized: {scenario_normalized})")
    print(f"  K6_DURATION       : {_format_text_for_display(k6_run_settings['duration_value'])}")
    print(f"  K6_ITERATIONS     : {_format_int_for_display(k6_run_settings['iterations'])}")
    print(f"  K6_VUS            : {_format_int_for_display(k6_run_settings['vus'])}")
    print(f"  K6_RATE           : {_format_int_for_display(k6_run_settings['rate'])}")
    print(f"  K6_TIME_UNIT      : {_format_text_for_display(k6_run_settings['time_unit_value'])}")
    print(f"  K6_RPS            : {_format_int_for_display(k6_run_settings['rps'])}")
    print(f"  K6_START_VUS      : {_format_int_for_display(k6_run_settings['start_vus'])}")
    print(f"  K6_PRE_ALLOCATED_VUS: {_format_int_for_display(k6_run_settings['pre_allocated_vus'])}")
    print(f"  K6_MAX_VUS        : {_format_int_for_display(k6_run_settings['max_vus'])}")
    print(f"  K6_STAGES (count) : {len(k6_run_settings['stages'])}")


def _print_run_summary(script_path, k6_run_settings, env, stage_flags, ignored_params):
    print(f"🚀 Running ./xk6 run {script_path}")
    print("ℹ️ Using environment variables:")
    print(f"  TARGET_ENV      : {k6_run_settings['target_env']}")
    print(f"  K6_SCENARIO_TYPE: {k6_run_settings['scenario_type']}")
    print(f"  K6_DURATION     : {_format_text_for_display(k6_run_settings['duration_value'])}")
    print(f"  K6_ITERATIONS   : {_format_int_for_display(k6_run_settings['iterations'])}")
    print(f"  K6_VUS          : {_format_int_for_display(k6_run_settings['vus'])}")
    print(f"  K6_RATE         : {_format_int_for_display(k6_run_settings['rate'])}")
    print(f"  K6_TIME_UNIT    : {_format_text_for_display(k6_run_settings['time_unit_value'])}")
    print(f"  K6_RPS          : {_format_int_for_display(k6_run_settings['rps'])}")
    print(f"  K6_START_VUS    : {_format_int_for_display(k6_run_settings['start_vus'])}")
    print(f"  K6_PRE_ALLOCATED_VUS: {_format_int_for_display(k6_run_settings['pre_allocated_vus'])}")
    print(f"  K6_MAX_VUS      : {_format_int_for_display(k6_run_settings['max_vus'])}")
    print(f"  K6_STAGES_JSON  : {env.get('K6_STAGES_JSON', '[]')}")
    print(f"  CLI --stage args: {stage_flags if stage_flags else '[]'}")

    if ignored_params:
        ignored_list = ", ".join(sorted(ignored_params))
        print(
            f"⚠️ Ignoring parameters for scenario '{k6_run_settings['scenario_type']}': {ignored_list}",
            file=sys.stderr,
        )


def _build_command(script_path, k6_run_settings, stage_flags):
    cmd = ["./xk6", "run", str(script_path)]

    cmd.extend(["--tag", f"environment={k6_run_settings['target_env']}"] )
    cmd.extend(["--http-debug", "failed"])

    if k6_run_settings["vus"] > 0:
        cmd.extend(["--vus", str(k6_run_settings["vus"])])
    if k6_run_settings["duration_value"]:
        cmd.extend(["--duration", k6_run_settings["duration_value"]])
    if k6_run_settings["iterations"] > 0:
        cmd.extend(["--iterations", str(k6_run_settings["iterations"])])
    if k6_run_settings["rps"] > 0:
        cmd.extend(["--rps", str(k6_run_settings["rps"])])
    if stage_flags:
        cmd.extend(stage_flags)

    return cmd


def main() -> int:
    parser = argparse.ArgumentParser(description="Run a k6 script with pipeline configuration")
    parser.add_argument("--script", required=True, help="Path to the k6 script to execute")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate configuration without invoking xk6",
    )
    args = parser.parse_args()

    script_path = pathlib.Path(args.script.strip())
    if not script_path.is_file():
        print(f"❌ Script {script_path} not found", file=sys.stderr)
        return 1

    env = os.environ.copy()

    k6_run_settings, parse_errors = _parse_configuration(env)

    errors = []
    ignored_params = set()

    if parse_errors:
        errors.extend(parse_errors)

    validation_errors, ignored_from_validation = _validate_configuration(k6_run_settings)
    errors.extend(validation_errors)
    ignored_params.update(ignored_from_validation)

    if errors:
        _print_invalid_configuration_summary(script_path, k6_run_settings)
        print("❌ Parameter validation failed:", file=sys.stderr)
        for item in errors:
            print(f"  - {item}", file=sys.stderr)
        return 1

    stage_flags = _prepare_environment(env, k6_run_settings)

    _print_run_summary(script_path, k6_run_settings, env, stage_flags, ignored_params)

    cmd = _build_command(script_path, k6_run_settings, stage_flags)

    print(f"🛠️ Command: {' '.join(cmd)}")

    if args.dry_run:
        print("✅ Dry run successful; skipping xk6 execution.")
        return 0

    completed = subprocess.run(cmd, env=env)
    return completed.returncode


if __name__ == "__main__":
    sys.exit(main())
