#!/bin/bash

echo "╔════════════════════════════════════════════╗"
echo "║  Starting Stagewise Integration             ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Start adapter server
echo "🚀 Starting adapter server..."
CLI_TYPE=claude node adapter-server.js &
ADAPTER_PID=$!
echo "   Adapter server PID: $ADAPTER_PID"

# Wait for adapter to be ready
sleep 2

# Start toolbar server
echo "🎨 Starting toolbar server..."
node serve-toolbar.js &
TOOLBAR_PID=$!
echo "   Toolbar server PID: $TOOLBAR_PID"

# Wait for toolbar to be ready
sleep 1

echo ""
echo "✅ Stagewise integration ready!"
echo ""
echo "📝 Instructions:"
echo "1. Start your Codeui development server (npm run dev)"
echo "2. Open Preview Panel in Codeui"
echo "3. Click the '🤖 Stagewise OFF' button to enable Stagewise"
echo "4. The Stagewise toolbar will appear over your preview"
echo ""
echo "🔗 Adapter server: http://localhost:3456"
echo "🎨 Toolbar server: http://localhost:5555"
echo ""
echo "Press Ctrl+C to stop..."

# Wait for interrupt
trap "echo 'Shutting down...'; kill $ADAPTER_PID $TOOLBAR_PID; exit" INT TERM
wait $ADAPTER_PID $TOOLBAR_PID