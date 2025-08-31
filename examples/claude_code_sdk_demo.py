#!/usr/bin/env python3
"""
Claude Code SDK Python Demo
Example of using the Claude Code SDK in Python
"""

import asyncio
import sys
from pathlib import Path
from typing import Optional, List, Dict, Any

# Add the SDK to path if needed
sys.path.insert(0, str(Path(__file__).parent.parent / 'claude-code-sdk' / 'src'))

from claude_code_sdk import query, ClaudeCodeOptions, AssistantMessage, TextBlock
from claude_code_sdk import (
    ClaudeSDKError,
    CLINotFoundError,
    CLIConnectionError,
    ProcessError,
    CLIJSONDecodeError,
)


class ClaudeCodeClient:
    """Wrapper class for Claude Code SDK with utility methods"""
    
    def __init__(self, system_prompt: Optional[str] = None):
        self.system_prompt = system_prompt or "You are a helpful coding assistant"
    
    async def simple_query(self, prompt: str) -> str:
        """Execute a simple query and return text response"""
        result = []
        async for message in query(prompt=prompt):
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        result.append(block.text)
        return '\n'.join(result)
    
    async def query_with_tools(
        self, 
        prompt: str, 
        tools: List[str],
        permission_mode: str = 'acceptEdits'
    ) -> str:
        """Execute query with specific tools enabled"""
        options = ClaudeCodeOptions(
            system_prompt=self.system_prompt,
            allowed_tools=tools,
            permission_mode=permission_mode,
            max_turns=3
        )
        
        result = []
        async for message in query(prompt=prompt, options=options):
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        result.append(block.text)
        return '\n'.join(result)
    
    async def analyze_code(self, file_path: str) -> Dict[str, Any]:
        """Analyze a code file and return structured analysis"""
        prompt = f"""
        Analyze the code in {file_path} and provide:
        1. Brief summary
        2. Code quality assessment
        3. Potential improvements
        4. Security considerations
        """
        
        options = ClaudeCodeOptions(
            allowed_tools=["Read"],
            max_turns=1
        )
        
        analysis = {
            'file': file_path,
            'summary': '',
            'quality': '',
            'improvements': [],
            'security': []
        }
        
        async for message in query(prompt=prompt, options=options):
            if isinstance(message, AssistantMessage):
                for block in message.content:
                    if isinstance(block, TextBlock):
                        # Parse the response (simplified)
                        analysis['summary'] = block.text
        
        return analysis
    
    async def generate_tests(
        self, 
        file_path: str, 
        framework: str = 'pytest'
    ) -> str:
        """Generate unit tests for a file"""
        prompt = f"""
        Generate comprehensive unit tests for {file_path} using {framework}.
        Include edge cases and error handling tests.
        """
        
        return await self.query_with_tools(
            prompt, 
            tools=['Read', 'Write'],
            permission_mode='acceptEdits'
        )
    
    async def refactor_code(
        self,
        file_path: str,
        improvements: List[str]
    ) -> str:
        """Refactor code with specific improvements"""
        improvements_list = '\n'.join(f"- {imp}" for imp in improvements)
        prompt = f"""
        Refactor the code in {file_path} with these improvements:
        {improvements_list}
        """
        
        return await self.query_with_tools(
            prompt,
            tools=['Read', 'Edit'],
            permission_mode='acceptEdits'
        )
    
    async def create_feature(
        self,
        feature_name: str,
        description: str,
        tech_stack: List[str]
    ) -> str:
        """Create a complete feature with multiple files"""
        tech = ', '.join(tech_stack)
        prompt = f"""
        Create a complete {feature_name} feature:
        Description: {description}
        Tech stack: {tech}
        
        Include:
        - Main implementation
        - Tests
        - Documentation
        - Configuration if needed
        """
        
        return await self.query_with_tools(
            prompt,
            tools=['Write', 'Read', 'Bash'],
            permission_mode='acceptEdits'
        )


async def example_simple_query():
    """Example 1: Simple query"""
    print("📝 Example 1: Simple Query")
    print("-" * 40)
    
    client = ClaudeCodeClient()
    response = await client.simple_query("What is Python's GIL?")
    print(f"Response: {response}\n")


async def example_code_analysis():
    """Example 2: Analyze code"""
    print("🔍 Example 2: Code Analysis")
    print("-" * 40)
    
    client = ClaudeCodeClient()
    # Analyze this file itself
    analysis = await client.analyze_code(__file__)
    print(f"Analysis: {analysis}\n")


async def example_test_generation():
    """Example 3: Generate tests"""
    print("🧪 Example 3: Test Generation")
    print("-" * 40)
    
    client = ClaudeCodeClient()
    
    # First, create a sample file to test
    sample_code = '''
def calculate_factorial(n):
    """Calculate factorial of n"""
    if n < 0:
        raise ValueError("Factorial not defined for negative numbers")
    if n == 0 or n == 1:
        return 1
    return n * calculate_factorial(n - 1)
    '''
    
    # Write the sample file
    with open('sample_factorial.py', 'w') as f:
        f.write(sample_code)
    
    # Generate tests
    tests = await client.generate_tests('sample_factorial.py', 'pytest')
    print(f"Generated tests: {tests}\n")


async def example_refactoring():
    """Example 4: Refactor code"""
    print("♻️ Example 4: Code Refactoring")
    print("-" * 40)
    
    client = ClaudeCodeClient()
    
    # Create a sample file to refactor
    old_code = '''
def process_data(data):
    result = []
    for item in data:
        if item > 0:
            result.append(item * 2)
    return result
    '''
    
    with open('sample_old_code.py', 'w') as f:
        f.write(old_code)
    
    improvements = [
        "Add type hints",
        "Use list comprehension",
        "Add docstring",
        "Handle edge cases"
    ]
    
    refactored = await client.refactor_code('sample_old_code.py', improvements)
    print(f"Refactored code: {refactored}\n")


async def example_feature_creation():
    """Example 5: Create a feature"""
    print("🚀 Example 5: Feature Creation")
    print("-" * 40)
    
    client = ClaudeCodeClient()
    
    feature = await client.create_feature(
        feature_name="CacheManager",
        description="In-memory cache with TTL support and LRU eviction",
        tech_stack=["Python", "asyncio", "typing"]
    )
    print(f"Feature created: {feature}\n")


async def example_error_handling():
    """Example 6: Error handling"""
    print("⚠️ Example 6: Error Handling")
    print("-" * 40)
    
    try:
        async for message in query(prompt="Test error handling"):
            print(f"Message: {message}")
    except CLINotFoundError:
        print("❌ Claude Code CLI not installed. Please install it first.")
    except CLIConnectionError as e:
        print(f"❌ Connection error: {e}")
    except ProcessError as e:
        print(f"❌ Process failed with exit code: {e.exit_code}")
    except CLIJSONDecodeError as e:
        print(f"❌ Failed to parse response: {e}")
    except ClaudeSDKError as e:
        print(f"❌ SDK error: {e}")


async def main():
    """Main function to run all examples"""
    print("🎯 Claude Code SDK Python Demo")
    print("=" * 40)
    print()
    
    # Get example to run from command line
    if len(sys.argv) > 1:
        example = sys.argv[1]
    else:
        example = 'all'
    
    examples = {
        'simple': example_simple_query,
        'analysis': example_code_analysis,
        'tests': example_test_generation,
        'refactor': example_refactoring,
        'feature': example_feature_creation,
        'error': example_error_handling
    }
    
    if example == 'all':
        for func in examples.values():
            await func()
    elif example in examples:
        await examples[example]()
    else:
        print(f"Usage: python {sys.argv[0]} [all|simple|analysis|tests|refactor|feature|error]")
        print("\nAvailable examples:")
        for name, func in examples.items():
            print(f"  {name}: {func.__doc__.strip()}")


if __name__ == "__main__":
    asyncio.run(main())