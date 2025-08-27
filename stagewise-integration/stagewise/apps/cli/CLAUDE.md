# Workflow

- Package manager: pnpm
- Build the app with `pnpm build`
- Start the app in dev mode with `pnpm dev`
- Whenever implementing a new feature or changing the code, test the CLI app by running it in dev mode
- Run tests with `pnpm test`. You have to watch the outputs and close the test runnter once the test are done because it runs in file watching mode.
- Whenever making changes, run `pnpm typecheck` to see if the TypeScript compiles.

## Build and Bundle Strategy

The CLI uses ESBuild to create an optimized bundle. The build configuration:

1. **Bundles most dependencies** - Common dependencies like `axios`, `chalk`, `commander`, `zod`, `express`, `winston`, etc. are bundled into the output file
2. **Keeps problematic dependencies external**:
   - Workspace packages (`@stagewise/*`) - These are linked packages not available on npm
3. **Extracts licenses** - All third-party licenses are extracted to `dist/THIRD_PARTY_LICENSES.txt`
4. **Copies static assets** - Toolbar and plugin files are copied to the dist folder

The bundled output is approximately 2.4MB and includes most runtime dependencies.

### Running the Bundle

Due to module resolution issues with linked packages, the bundle currently requires:
- Running from the project directory where workspace packages can be resolved
- For production use, the workspace packages would need to be published to npm

For development, use `pnpm dev` which runs from source without bundling issues.

- If necessary, update and document the build pipeline for the app
- Develop code based on the guidelines of the user and the specs in the folder `/specs`
- Always check specs for consistency and ask the users to make questions if you see that there is an incosistency or issue
- When making changes to the spec, always implement changes to the code as well
- When making changes to the code, always implement changes to the spec as well
- When making changes to the code, first write or update unit tests to test the new/updated functionality.
- When removing functionality, also remove the related unit tests
- Always write concise, well structured code
- Keep the codebase well structured and the archtiecture aligned with functionalities
- Prefer writing asnyc code where applicable
- Write unit tests with vitest
- Where applicable, write tests that combine multiple functionalities of the app and make integration tests
- Apply Test-Driven-Development where applicable
- When writing a significant chunk of code, first make a plan on how to implement the change and whether it makes change to update or change the software architecture
- Create or update the file `/specs/99-architecture.md` with the archtiecture of the impleented source code whenever you ake changes to the code base.
  - Use this file as a reference to understand how the current software codebase is structured and implemented.

- After making a significant chunk of changes, make commits.
  - Use conventional commits as format. The scope is always "cli". suffix commits with "- Created by Claude Code"

- Never push code to the server on your own and also don't ask to do it.
- Only stay active on the current git branch.
