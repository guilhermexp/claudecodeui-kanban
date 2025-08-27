# Changeset Enforcement

This repository enforces the creation of changesets for all changes merged to the main branch.

## How It Works

1. The CI workflow includes a job that verifies changesets exist in pull requests targeting the main branch.
2. This check will fail if no changeset file is found.

## Creating a Changeset

To create a changeset:

```bash
pnpm changeset
```

Follow the prompts to:
1. Select the packages that have changed
2. Choose the semver impact (patch, minor, major)
3. Provide a description of the changes

## Setting Up Branch Protection Rules

For this enforcement to be effective, you need to set up branch protection rules in GitHub:

1. Go to your repository on GitHub
2. Navigate to Settings > Branches
3. Click "Add rule" next to "Branch protection rules"
4. Set "Branch name pattern" to `main`
5. Enable "Require status checks to pass before merging"
6. Search for and select the `verify-changeset` check
7. Enable "Require branches to be up to date before merging"
8. Save changes

## Exemptions

If your change doesn't require a changeset (e.g., documentation-only changes that don't affect consumers of the packages), you can create an empty changeset:

```bash
pnpm changeset --empty
```

And explain in the changeset why no version change is needed. 