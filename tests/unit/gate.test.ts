import { describe, expect, it, vi } from 'vitest';
import * as core from '@actions/core';
import { run } from '../../src/index';

describe('release-gate-action', () => {
  it('observe never fails', async () => {
    vi.spyOn(core, 'setOutput').mockImplementation(() => {});
    vi.spyOn(core, 'info').mockImplementation(() => {});
    vi.spyOn(core, 'getInput').mockImplementation((name: string) => {
      const m: Record<string, string> = {
        decision: 'BLOCK',
        score: '0',
        reason: 'test',
        mode: 'observe',
        'minimum-score': '100',
        'fail-on-warn': 'false',
        'output-summary': 'false',
        'trust-graph-url': '',
        'policy-result-file': '',
      };
      return m[name] ?? '';
    });
    await expect(run()).resolves.toBeUndefined();
  });
});
