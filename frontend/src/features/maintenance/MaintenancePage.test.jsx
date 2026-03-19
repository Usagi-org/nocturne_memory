import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import MaintenancePage from './MaintenancePage';
import { server } from '../../test/server';
import { renderWithRouter } from '../../test/test-utils';


describe('MaintenancePage', () => {
  it('loads orphan records, expands detail, and batch deletes selected rows', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('confirm', vi.fn(() => true));

    let orphans = [
      {
        id: 1,
        content_snippet: 'Original review content',
        created_at: '2026-03-19T10:00:00',
        deprecated: true,
        migrated_to: 2,
        category: 'deprecated',
        migration_target: {
          id: 2,
          paths: ['core://review_item'],
          content_snippet: 'Pending review update',
        },
      },
      {
        id: 2,
        content_snippet: 'Orphan me',
        created_at: '2026-03-19T10:00:01',
        deprecated: true,
        migrated_to: null,
        category: 'orphaned',
        migration_target: null,
      },
    ];
    const deleteSpy = vi.fn();

    server.use(
      http.get('/api/maintenance/orphans', () => HttpResponse.json(orphans)),
      http.get('/api/maintenance/orphans/1', () =>
        HttpResponse.json({
          id: 1,
          content: 'Original review content',
          created_at: '2026-03-19T10:00:00',
          deprecated: true,
          migrated_to: 2,
          category: 'deprecated',
          migration_target: {
            id: 2,
            content: 'Pending review update',
            paths: ['core://review_item'],
            created_at: '2026-03-19T10:00:01',
          },
        })
      ),
      http.delete('/api/maintenance/orphans/1', () => {
        deleteSpy(1);
        orphans = orphans.filter((item) => item.id !== 1);
        return HttpResponse.json({ success: true });
      }),
      http.delete('/api/maintenance/orphans/2', () => {
        deleteSpy(2);
        orphans = orphans.filter((item) => item.id !== 2);
        return HttpResponse.json({ success: true });
      })
    );

    renderWithRouter(<MaintenancePage />);

    expect(await screen.findByText('Original review content')).toBeInTheDocument();
    expect(screen.getByText('Orphan me')).toBeInTheDocument();

    await user.click(screen.getByText('Original review content'));
    expect(await screen.findByText('Pending review update')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Select memory 1' }));
    await user.click(screen.getByRole('button', { name: 'Select memory 2' }));
    await user.click(screen.getByRole('button', { name: /delete 2 selected/i }));

    await waitFor(() => expect(deleteSpy).toHaveBeenCalledTimes(2));
  });
});
