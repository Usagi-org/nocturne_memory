import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import MemoryBrowser from './MemoryBrowser';
import { server } from '../../test/server';
import { renderWithRouter } from '../../test/test-utils';


describe('MemoryBrowser', () => {
  it('loads a node and only submits changed fields when saving edits', async () => {
    const user = userEvent.setup();
    const putPayloads = [];
    let nodeState = {
      node: {
        path: 'workspace',
        domain: 'core',
        uri: 'core://workspace',
        name: 'workspace',
        content: 'Workspace note mentions Salem.',
        priority: 2,
        disclosure: 'When browsing workspace',
        created_at: null,
        is_virtual: false,
        aliases: [],
        node_uuid: 'node-1',
        glossary_keywords: [],
        glossary_matches: [],
      },
      children: [],
      breadcrumbs: [
        { path: '', label: 'root' },
        { path: 'workspace', label: 'workspace' },
      ],
    };

    server.use(
      http.get('/api/browse/domains', () => {
        return HttpResponse.json([{ domain: 'core', root_count: 1 }]);
      }),
      http.get('/api/browse/node', ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('nav_only') === 'true' && url.searchParams.get('path') === '') {
          return HttpResponse.json({
            node: null,
            children: [
              {
                path: 'workspace',
                name: 'workspace',
                approx_children_count: 0,
              },
            ],
            breadcrumbs: [],
          });
        }
        if (url.searchParams.get('path') === 'workspace') {
          return HttpResponse.json(nodeState);
        }
        return HttpResponse.json({ node: null, children: [], breadcrumbs: [] });
      }),
      http.put('/api/browse/node', async ({ request }) => {
        const body = await request.json();
        putPayloads.push(body);
        nodeState = {
          ...nodeState,
          node: {
            ...nodeState.node,
            ...body,
          },
        };
        return HttpResponse.json({ success: true, memory_id: 2 });
      })
    );

    renderWithRouter(<MemoryBrowser />, {
      route: '/?domain=core&path=workspace',
    });

    expect(await screen.findByRole('heading', { name: 'workspace' })).toBeInTheDocument();
    expect(screen.getByText('Workspace note mentions Salem.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /edit/i }));
    await user.clear(screen.getByLabelText('Memory content'));
    await user.type(screen.getByLabelText('Memory content'), 'Workspace note mentions Salem and GraphService.');
    await user.clear(screen.getByLabelText('Disclosure'));
    await user.type(screen.getByLabelText('Disclosure'), 'When saving workspace');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => {
      expect(putPayloads).toEqual([
        {
          content: 'Workspace note mentions Salem and GraphService.',
          disclosure: 'When saving workspace',
        },
      ]);
    });
    expect(await screen.findByText('Workspace note mentions Salem and GraphService.')).toBeInTheDocument();
  });
});
