import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import TokenAuth from './TokenAuth';
import { server } from '../test/server';


describe('TokenAuth', () => {
  it('stores the token and calls onAuthenticated when validation succeeds', async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();

    server.use(
      http.get('/api/browse/domains', () => HttpResponse.json([]))
    );

    render(<TokenAuth onAuthenticated={onAuthenticated} />);

    await user.type(screen.getByLabelText(/api token/i), 'secret-token');
    await user.click(screen.getByRole('button', { name: '连接' }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledTimes(1));
    expect(localStorage.getItem('api_token')).toBe('secret-token');
  });

  it('shows an error and clears the token when validation fails with 401', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(
        '/api/browse/domains',
        () => HttpResponse.json({ detail: 'Unauthorized' }, { status: 401 })
      )
    );

    render(<TokenAuth onAuthenticated={vi.fn()} />);

    await user.type(screen.getByLabelText(/api token/i), 'wrong-token');
    await user.click(screen.getByRole('button', { name: '连接' }));

    await waitFor(() => {
      expect(screen.getByText('Token 无效，请检查后重试')).toBeInTheDocument();
    });
    expect(localStorage.getItem('api_token')).toBeNull();
  });
});
