import { Panel, PanelContent } from '@/components/ui/panel';
import flappyGame from '@stagewise/flappy-game/index.html?raw';

export function EddyModePanel() {
  return (
    <Panel>
      <PanelContent className="flex items-center justify-center">
        <iframe
          srcDoc={flappyGame}
          title="Flappy Game"
          className="aspect-[1/1.5] max-h-[50vh] w-3/4 rounded-2xl ring-2 ring-black"
        />
      </PanelContent>
    </Panel>
  );
}
