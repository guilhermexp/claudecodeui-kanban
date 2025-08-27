---
description: 
globs: plugins/**
alwaysApply: false
---
# Toolbar Plugin Development Guide

This guide outlines how to create plugins for the toolbar. Plugins extend the functionality of the toolbar and are defined by implementing the `ToolbarPlugin` interface. All type definitions can be found in `[toolbar/core/src/plugin.ts](mdc:toolbar/core/src/plugin.ts)`.

## The `ToolbarPlugin` Interface

The core of a plugin is the `ToolbarPlugin` object. Here are its properties:

*   `displayName: string`
    *   The name of the plugin that will be shown to the user.
*   `promptContextName: string`
    *   This name is used in the XML-like tag that wraps the context provided by this plugin in the prompt.
*   `description: string`
    *   A short description of what the plugin does.
*   `iconSvg: string | null`
    *   A monochrome SVG icon (as a string) that will be rendered in places where the plugin is shown. Can be `null` if no icon is provided.
*   `toolbarAction: { onClick: (context: ToolbarContext) => void; } | null`
    *   If defined, a button for this plugin is rendered in the toolbar.
    *   `onClick`: A function that is called when the button is clicked. It receives a `ToolbarContext` object, which currently provides a `sendPrompt` method.
*   `mcp?: MCP | null`
    *   An optional Multi-Capability Peer (MCP) server implementation. If provided, this allows the plugin to expose capabilities (prompts, resources, tools) to an AI agent.
*   `onLoad?: (() => void) | null`
    *   An optional function called when the toolbar and the plugin are loaded.
*   `onPromptingStart?: (() => PromptingExtension | null) | null`
    *   An optional function called when the prompting mode (e.g., user starts typing a prompt) begins.
    *   It can return a `PromptingExtension` object, which contains `contextSnippetOffers` (an array of `ContextSnippetOffer`). These are user-selectable context snippets.
*   `onPromptingAbort?: (() => void) | null`
    *   An optional function called when the prompting mode is aborted by the user.
*   `onResponse?: (() => void) | null`
    *   **Note:** This is not implemented right now.
*   `onPromptSend?: ((prompt: UserMessage) => PromptContext | Promise<PromptContext> | null) | null`
    *   An optional function called when a prompt is sent by the user.
    *   It receives the `UserMessage` object.
    *   It can return a `PromptContext` object (or a Promise resolving to one), which contains `contextSnippets` that are automatically added to the prompt.
*   `onContextElementSelect?: ((element: HTMLElement) => ContextElementContext) | null`
    *   An optional function called when a context element is selected (e.g., via a context menu) in prompting mode.
    *   It receives the selected `HTMLElement`.
    *   It should return a `ContextElementContext` object, which can provide an `annotation` (a short string) to be displayed for the selected element.

## Key Supporting Types

These types are frequently used when developing plugins. Refer to `[toolbar/core/src/plugin.ts](mdc:toolbar/core/src/plugin.ts)` for their full definitions.

*   `ToolbarContext`: Passed to `toolbarAction.onClick`. Contains:
    *   `sendPrompt(prompt: string): void`: A function to send a prompt programmatically.
*   `UserMessage`: Passed to `onPromptSend`. Contains:
    *   `id: string`: Unique ID of the message.
    *   `text: string`: The text content of the user's prompt.
    *   `contextElements: HTMLElement[]`: Any HTML elements associated with the prompt.
    *   `sentByPlugin: boolean`: Indicates if the prompt was sent by a plugin.
*   `ContextSnippet`: A piece of context to be added to a prompt.
    *   `promptContextName: string`: Name for the context (often the plugin's `promptContextName`).
    *   `content: (() => string | Promise<string>) | string`: The actual content, which can be a string or a function returning a string (or a Promise of one).
*   `ContextSnippetOffer`: Extends `ContextSnippet` by adding:
    *   `displayName: string`: A user-friendly name for the offered snippet. Used in `PromptingExtension`.
*   `PromptingExtension`: Returned by `onPromptingStart`. Contains:
    *   `contextSnippetOffers: ContextSnippetOffer[]`: A list of user-selectable context snippets.
*   `PromptContext`: Returned by `onPromptSend`. Contains:
    *   `contextSnippets: ContextSnippet[]`: A list of context snippets to be automatically included in the prompt.
*   `ContextElementContext`: Returned by `onContextElementSelect`. Contains:
    *   `annotation: string | null`: A short text annotation (max ~50 chars) displayed for a selected context element.

*   `MCP`: An interface for a Multi-Capability Peer. This allows plugins to expose functionalities to an AI agent. It has three main parts:
    *   `prompts`: For listing and getting predefined prompts.
        *   `MCPPrompt`: Defines a prompt with name, description, arguments, and a generator function.
        *   `MCPPromptMessage`: Defines the structure of a message in a prompt (role and content).
    *   `resources`: For listing and reading resources.
        *   `MCPResource`: Defines a resource with URI, name, description, MIME type, and size.
        *   `MCPResourceContent`: Defines the content of a resource (text or binary data).
    *   `tools`: For listing and calling tools.
        *   `MCPTool`: Defines a tool with name, description, input schema, and optional annotations.
        *   `MCPToolResponse`: Defines the response from a tool call, including content and an error flag.

## Plugin Lifecycle and Interaction

1.  **Loading**:
    *   Implement `onLoad` for any setup tasks when your plugin is loaded.
2.  **Toolbar Button**:
    *   Define `toolbarAction` to add a button to the toolbar. Use its `onClick` handler to react to button presses, for example, to trigger `sendPrompt` from the `ToolbarContext`.
3.  **Prompting Phase**:
    *   `onPromptingStart`: When the user begins to type a prompt, this is called. Use it to offer `ContextSnippetOffer`s that the user can choose to include.
    *   `onPromptSend`: When the user sends a prompt, this is called. Use it to automatically inject relevant `ContextSnippet`s based on the `UserMessage`.
    *   `onContextElementSelect`: If your plugin cares about specific elements on the page, use this to provide an `annotation` when the user selects an element in prompting mode.
    *   `onPromptingAbort`: If the user cancels prompting, this hook allows for cleanup or state reset.

4.  **Exposing Capabilities via MCP** (Optional):
    *   If your plugin needs to offer more complex interactions or data to an AI agent, implement the `MCP` interface and assign it to the `mcp` property of your `ToolbarPlugin`.
    *   Define `prompts` that the agent can retrieve and use.
    *   Make `resources` (like files or data snippets) available for the agent to read.
    *   Expose `tools` that the agent can call to perform actions.

This guide should help you get started with creating powerful plugins for the toolbar. Remember to consult `[toolbar/core/src/plugin.ts](mdc:toolbar/core/src/plugin.ts)` for precise type definitions.
