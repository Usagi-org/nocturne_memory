import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import ReviewPage from './ReviewPage';
import { server } from '../../test/server';
import { renderWithRouter } from '../../test/test-utils';


describe('ReviewPage', () => {
  it('loads a pending group and integrates it', async () => {
    const user = userEvent.setup();
    let groups = [
      {
        node_uuid: 'node-1',
        display_uri: 'core://review_item',
        top_level_table: 'memories',
        action: 'modified',
        row_count: 2,
      },
    ];
    const integrateSpy = vi.fn();

    server.use(
      http.get('/api/review/groups', () => HttpResponse.json(groups)),
      http.get('/api/review/groups/node-1/diff', () =>
        HttpResponse.json({
          uri: 'node-1',
          change_type: 'memories',
          action: 'modified',
          before_content: 'Original review content',
          current_content: 'Original review content\nPending review update',
          before_meta: { priority: 2, disclosure: 'When reviewing' },
          current_meta: { priority: 2, disclosure: 'When reviewing' },
          path_changes: null,
          glossary_changes: null,
          active_paths: ['core://review_item'],
          has_changes: true,
        })
      ),
      http.delete('/api/review/groups/node-1', () => {
        integrateSpy();
        groups = [];
        return HttpResponse.json({ message: 'Approved node' });
      })
    );

    renderWithRouter(<ReviewPage />);

    expect(await screen.findByRole('heading', { name: 'core://review_item' })).toBeInTheDocument();
    expect(await screen.findByText(/Pending review update/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /integrate group/i }));

    await waitFor(() => expect(integrateSpy).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Empty Sequence')).toBeInTheDocument();
  });

  it('rejects a pending group after confirmation', async () => {
    const user = userEvent.setup();
    const rollbackSpy = vi.fn();

    vi.stubGlobal('confirm', vi.fn(() => true));

    server.use(
      http.get('/api/review/groups', () =>
        HttpResponse.json([
          {
            node_uuid: 'node-2',
            display_uri: 'core://rollback_item',
            top_level_table: 'memories',
            action: 'modified',
            row_count: 2,
          },
        ])
      ),
      http.get('/api/review/groups/node-2/diff', () =>
        HttpResponse.json({
          uri: 'node-2',
          change_type: 'memories',
          action: 'modified',
          before_content: 'Before',
          current_content: 'After',
          before_meta: { priority: 2, disclosure: 'When reviewing' },
          current_meta: { priority: 2, disclosure: 'When reviewing' },
          path_changes: null,
          glossary_changes: null,
          active_paths: ['core://rollback_item'],
          has_changes: true,
        })
      ),
      http.post('/api/review/groups/node-2/rollback', () => {
        rollbackSpy();
        return HttpResponse.json({ node_uuid: 'node-2', success: true, message: 'rolled back' });
      })
    );

    renderWithRouter(<ReviewPage />);

    expect(await screen.findByRole('heading', { name: 'core://rollback_item' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /reject group/i }));

    await waitFor(() => expect(rollbackSpy).toHaveBeenCalledTimes(1));
  });
});
