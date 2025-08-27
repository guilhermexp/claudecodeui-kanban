'use client';
import type { ToolbarPlugin } from '@stagewise/plugin-sdk';
import { ExampleComponent } from './component';

const Plugin: ToolbarPlugin = {
  displayName: 'Example',
  description: 'Example Plugin',
  iconSvg: null,
  pluginName: 'example',
  onActionClick: () => <ExampleComponent />,
};

/**
 * WARNING: Make sure that the plugin is exported as default as this is a required format for the plugin builder.
 */
export default Plugin;
