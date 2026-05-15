import * as core from '@actions/core';
import { fail, getOptionalInput, getRequiredInput } from './lib/action-core';
import { getBooleanInput } from './lib/inputs';
import { setOutputs } from './lib/outputs';
import { appendJobSummary, escapeCell } from './lib/summary';
import { ConfigurationError } from './lib/errors';
import { parseEnum } from './lib/validation';

function parseScore(raw: string): number {
  const n = Number(String(raw ?? '').trim());
  if (!Number.isFinite(n)) throw new ConfigurationError(`Invalid score: ${raw}`);
  return n;
}

export async function run(): Promise<void> {
  const decision = parseEnum('decision', getRequiredInput('decision'), ['ALLOW', 'WARN', 'BLOCK'] as const);
  const score = parseScore(getRequiredInput('score'));
  const reason = getOptionalInput('reason');
  const mode = parseEnum('mode', getOptionalInput('mode') || 'enforce', ['observe', 'warn', 'enforce'] as const);
  const minimumScore = parseScore(getOptionalInput('minimum-score') || '0');
  const failOnWarn = getBooleanInput('fail-on-warn', false);
  const outputSummary = getBooleanInput('output-summary', true);
  const trustGraphUrl = getOptionalInput('trust-graph-url');
  const policyResultFile = getOptionalInput('policy-result-file');

  const hardFail = decision === 'BLOCK' || score < minimumScore;
  const warnFail = decision === 'WARN' && failOnWarn;

  let outcome: 'pass' | 'warn' | 'fail' = 'pass';
  if (hardFail) outcome = 'fail';
  else if (decision === 'WARN') outcome = 'warn';

  const enforced = mode === 'enforce' && (hardFail || warnFail);

  if (outputSummary) {
    await appendJobSummary(
      [
        '## BridgedAI release gate',
        '',
        '| Field | Value |',
        '| --- | --- |',
        `| decision | ${escapeCell(decision)} |`,
        `| score | ${escapeCell(String(score))} |`,
        `| minimum-score | ${escapeCell(String(minimumScore))} |`,
        `| mode | ${escapeCell(mode)} |`,
        `| outcome | ${escapeCell(outcome)} |`,
        `| reason | ${escapeCell(reason)} |`,
        trustGraphUrl ? `| trust-graph-url | ${escapeCell(trustGraphUrl)} |` : '',
        policyResultFile ? `| policy-result-file | ${escapeCell(policyResultFile)} |` : '',
        '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  setOutputs({
    enforced: enforced ? 'true' : 'false',
    outcome,
  });

  if (mode === 'observe') {
    core.info('observe mode: never failing the step');
    return;
  }

  if (mode === 'warn') {
    if (hardFail) {
      core.warning(`BridgedAI release gate would BLOCK: ${reason || 'no reason provided'}`);
    } else if (decision === 'WARN') {
      core.warning(`BridgedAI release gate decision is WARN: ${reason || 'no reason provided'}`);
      if (failOnWarn) {
        fail(`fail-on-warn=true: ${reason || 'no reason provided'}`);
      }
    }
    return;
  }

  // enforce
  if (hardFail) {
    fail(`BridgedAI release gate BLOCKED: ${reason || 'no reason provided'}`);
  }
  if (warnFail) {
    fail(`BridgedAI release gate WARN treated as failure: ${reason || 'no reason provided'}`);
  }
}

if (process.env.VITEST !== 'true') {
  void run().catch((e) => {
    fail(e instanceof Error ? e : new Error(String(e)));
  });
}
