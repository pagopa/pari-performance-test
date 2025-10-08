#!/usr/bin/env node
/**
 * Orchestrates a k6 run with the environment managed by the pipeline.
 * Mirrors the behaviour of the former Python implementation while
 * improving log readability for multiline/JSON values.
 */

import { access } from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { spawn } from 'node:child_process'
import { resolve, relative } from 'node:path'
import { cwd, env as processEnv, exit } from 'node:process'

const INTERESTING_PREFIXES = ['K6PERF_']
const INTERESTING_KEYS = new Set(['TARGET_ENV'])

function usage() {
    console.error('Usage: node .devops/scripts/run_k6.mjs --script <path-to-k6-script>')
}

function parseScriptArg(argv) {
    let script
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index]
        if (arg === '--script') {
            script = argv[index + 1]
            index += 1
            break
        }
        if (arg.startsWith('--script=')) {
            script = arg.slice('--script='.length)
            break
        }
    }
    return typeof script === 'string' ? script.trim() : ''
}

function collectInterestingEnv(env) {
    return Object.entries(env)
        .filter(([key]) => INTERESTING_KEYS.has(key) || INTERESTING_PREFIXES.some((prefix) => key.startsWith(prefix)))
        .sort(([a], [b]) => a.localeCompare(b))
}

function maybeParseJson(value) {
    const trimmed = value.trim()
    if (trimmed === '') {
        return ''
    }
    try {
        const parsed = JSON.parse(trimmed)
        if (typeof parsed === 'object' && parsed !== null) {
            return JSON.stringify(parsed, null, 2)
        }
        return String(parsed)
    } catch (_error) {
        return value
    }
}

function indentMultiline(value, indent = '    ') {
    return value
        .split('\n')
        .map((line) => indent + line)
        .join('\n')
}

function logRunSummary(scriptDisplayPath, cmd, interestingEntries) {
    console.log(`🚀 Running ./xk6 run ${scriptDisplayPath}`)
    console.log('ℹ️ Environment variables forwarded to k6:')

    if (interestingEntries.length === 0) {
        console.log('  <none found>')
    } else {
        for (const [key, rawValue] of interestingEntries) {
            const formattedValue = maybeParseJson(rawValue)
            if (formattedValue.includes('\n')) {
                console.log(`  ${key} =`)
                console.log(indentMultiline(formattedValue))
            } else {
                console.log(`  ${key} = ${formattedValue}`)
            }
        }
    }

    console.log(`🛠️ Command: ${cmd.join(' ')}`)
}

function buildCommand(scriptPath) {
    return ['./xk6', 'run', scriptPath]
}

async function ensureScriptExists(pathToScript, displayPath) {
    try {
        await access(pathToScript, fsConstants.F_OK)
    } catch (_error) {
        console.error(`❌ Script ${displayPath} not found`)
        exit(1)
    }
}

async function runCommand(cmd, env) {
    return new Promise((resolvePromise, rejectPromise) => {
        const child = spawn(cmd[0], cmd.slice(1), {
            env,
            stdio: 'inherit',
        })

        child.on('exit', (code, signal) => {
            if (code !== null) {
                resolvePromise(code)
            } else if (signal) {
                console.error(`❌ k6 run terminated by signal ${signal}`)
                resolvePromise(1)
            } else {
                resolvePromise(1)
            }
        })

        child.on('error', (error) => {
            rejectPromise(error)
        })
    })
}

async function main() {
    const scriptArg = parseScriptArg(process.argv.slice(2))
    if (!scriptArg) {
        usage()
        exit(1)
    }

    const resolvedScriptPath = resolve(cwd(), scriptArg)
    const displayPath = scriptArg.includes('/') ? scriptArg : relative(cwd(), resolvedScriptPath)

    await ensureScriptExists(resolvedScriptPath, scriptArg)

    const interestingEntries = collectInterestingEnv(processEnv)
    const command = buildCommand(resolvedScriptPath)

    logRunSummary(displayPath, command, interestingEntries)

    try {
        const exitCode = await runCommand(command, processEnv)
        exit(exitCode)
    } catch (error) {
        console.error('❌ Failed to launch k6:', error)
        exit(1)
    }
}

await main()
