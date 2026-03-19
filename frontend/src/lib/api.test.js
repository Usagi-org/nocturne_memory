import { AxiosError } from 'axios';

import { AUTH_ERROR_EVENT, api } from './api';


describe('api client', () => {
  let originalAdapter;

  beforeEach(() => {
    originalAdapter = api.defaults.adapter;
  });

  afterEach(() => {
    api.defaults.adapter = originalAdapter;
  });

  it('adds the bearer token from localStorage to outgoing requests', async () => {
    localStorage.setItem('api_token', 'secret-token');

    api.defaults.adapter = async (config) => ({
      data: { ok: true },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    });

    const response = await api.get('/probe');

    expect(response.config.headers.Authorization).toBe('Bearer secret-token');
  });

  it('clears the token and emits an auth error event on 401 responses', async () => {
    const listener = vi.fn();
    localStorage.setItem('api_token', 'secret-token');
    window.addEventListener(AUTH_ERROR_EVENT, listener);

    api.defaults.adapter = async (config) => {
      throw new AxiosError(
        'Unauthorized',
        'ERR_BAD_REQUEST',
        config,
        null,
        {
          status: 401,
          data: { detail: 'Unauthorized' },
          headers: {},
          config,
          statusText: 'Unauthorized',
        }
      );
    };

    await expect(api.get('/probe')).rejects.toBeInstanceOf(AxiosError);

    expect(localStorage.getItem('api_token')).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(AUTH_ERROR_EVENT, listener);
  });
});
