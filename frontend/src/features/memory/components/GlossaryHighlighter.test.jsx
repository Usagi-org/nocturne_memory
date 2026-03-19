import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import GlossaryHighlighter from './GlossaryHighlighter';


describe('GlossaryHighlighter', () => {
  it('opens the glossary popup and navigates to the linked node', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <GlossaryHighlighter
        content="Workspace note mentions Salem."
        glossary={[
          {
            keyword: 'Salem',
            nodes: [
              {
                node_uuid: 'node-2',
                uri: 'core://glossary_target',
                content_snippet: 'Target memory for Salem',
              },
            ],
          },
        ]}
        currentNodeUuid="node-1"
        onNavigate={onNavigate}
      />
    );

    await user.click(screen.getByText('Salem'));
    expect(await screen.findByText('core://glossary_target')).toBeInTheDocument();

    await user.click(screen.getByText('core://glossary_target'));

    expect(onNavigate).toHaveBeenCalledWith('glossary_target', 'core');
  });
});
