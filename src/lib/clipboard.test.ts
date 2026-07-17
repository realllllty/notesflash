// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

describe('copyText', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes the matched note line through the Clipboard API', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });

    await expect(copyText('Cloudflare 后端部署')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText).toHaveBeenCalledWith('Cloudflare 后端部署');
  });
});
