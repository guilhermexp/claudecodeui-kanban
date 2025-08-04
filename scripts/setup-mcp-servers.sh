#!/bin/bash

# Setup script for common MCP servers in Claude Code UI
# This script uses the Claude CLI to add MCP servers

echo "🚀 Setting up MCP Servers for Claude Code UI"
echo "=========================================="

# Function to check if claude CLI is available
check_claude_cli() {
    if ! command -v claude &> /dev/null; then
        echo "❌ Claude CLI not found. Please install it first:"
        echo "   npm install -g @anthropic-ai/claude-cli"
        exit 1
    fi
    echo "✅ Claude CLI found"
}

# Function to add a server
add_server() {
    local name=$1
    local command=$2
    shift 2
    local args=("$@")
    
    echo "📦 Adding $name server..."
    
    # Build the command
    local cmd="claude mcp add $name"
    
    # Add environment variables if they exist
    for arg in "${args[@]}"; do
        if [[ $arg == *"="* ]]; then
            cmd="$cmd -e $arg"
        else
            cmd="$cmd $arg"
        fi
    done
    
    cmd="$cmd $command"
    
    # Execute the command
    if eval $cmd; then
        echo "✅ $name server added successfully"
    else
        echo "⚠️  Failed to add $name server"
    fi
}

# Main setup
main() {
    check_claude_cli
    
    echo ""
    echo "Select which MCP servers to install:"
    echo "1) Filesystem Server"
    echo "2) GitHub Server" 
    echo "3) Memory Server"
    echo "4) All of the above"
    echo ""
    
    read -p "Enter your choice (1-4): " choice
    
    case $choice in
        1)
            echo ""
            read -p "Enter the root directory for filesystem access [default: $HOME]: " fs_root
            fs_root=${fs_root:-$HOME}
            add_server "filesystem" "npx" "-y" "@modelcontextprotocol/server-filesystem" "FILESYSTEM_ROOT=$fs_root"
            ;;
        2)
            echo ""
            echo "⚠️  GitHub server requires a personal access token"
            echo "   Create one at: https://github.com/settings/tokens"
            read -p "Enter your GitHub token: " github_token
            if [ -n "$github_token" ]; then
                add_server "github" "npx" "-y" "@modelcontextprotocol/server-github" "GITHUB_TOKEN=$github_token"
            else
                echo "❌ GitHub token is required"
            fi
            ;;
        3)
            add_server "memory" "npx" "-y" "@modelcontextprotocol/server-memory"
            ;;
        4)
            echo ""
            read -p "Enter the root directory for filesystem access [default: $HOME]: " fs_root
            fs_root=${fs_root:-$HOME}
            add_server "filesystem" "npx" "-y" "@modelcontextprotocol/server-filesystem" "FILESYSTEM_ROOT=$fs_root"
            
            echo ""
            add_server "memory" "npx" "-y" "@modelcontextprotocol/server-memory"
            
            echo ""
            echo "⚠️  GitHub server requires a personal access token"
            read -p "Enter your GitHub token (or press Enter to skip): " github_token
            if [ -n "$github_token" ]; then
                add_server "github" "npx" "-y" "@modelcontextprotocol/server-github" "GITHUB_TOKEN=$github_token"
            else
                echo "⏭️  Skipping GitHub server"
            fi
            ;;
        *)
            echo "❌ Invalid choice"
            exit 1
            ;;
    esac
    
    echo ""
    echo "🎉 Setup complete!"
    echo ""
    echo "Next steps:"
    echo "1. Open Claude Code UI at http://localhost:9000"
    echo "2. Go to Settings → Tools"
    echo "3. Enable the tools for your new MCP servers"
    echo ""
    echo "To list your MCP servers, run: claude mcp list"
}

# Run main function
main