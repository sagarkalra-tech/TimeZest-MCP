# TimeZest MCP - Standard Operating Procedure (SOP) for Releases

This project uses a fully automated CI/CD pipeline via GitHub Actions. **Never run `npm publish` manually.** All releases are handled by the pipeline to ensure NPM Provenance and security.

Follow these exact steps every time you make changes to the code and want to publish a new version.

---

## The Release Workflow

### 1. Test Your Changes Locally
Before releasing, ensure your code compiles and passes all tests.
```powershell
npm run build
npm test
```

### 2. Stage and Commit Your Code
Save your working changes to the local git repository.
```powershell
git add .
git commit -m "feat: describe the new feature or fix here"
```

### 3. Bump the Version (The Trigger)
Use NPM's built-in versioning tool to automatically update the `package.json` version, create a git commit, and generate a new Git Tag (e.g., `v1.0.10`). 

Choose **one** of the following based on what you changed:

*   **Patch** (Bug fixes, typos, small non-breaking tweaks):
    ```powershell
    npm version patch -m "chore: release v%s"
    ```
*   **Minor** (New features, like adding a new MCP tool, completely backward compatible):
    ```powershell
    npm version minor -m "chore: release v%s"
    ```
*   **Major** (Complete rewrites, breaking changes to the setup process):
    ```powershell
    npm version major -m "chore: release v%s"
    ```

### 4. Push to GitHub (Ignites the Pipeline)
Push your code **and** the new tag to GitHub. The `--tags` flag is mandatory; without it, the CI/CD pipeline will not wake up.
```powershell
git push origin main --tags
```

---

## 🤖 What Happens Next? (The Automation)

Once you run that final push command, your job is done. In the cloud, GitHub Actions takes over:

1. **Trigger**: The `.github/workflows/release.yml` file detects the new `v*` tag.
2. **Validation**: It spins up an isolated Ubuntu server, installs dependencies (`npm ci`), builds the TypeScript, and runs the Vitest suite.
3. **Publish**: Using the encrypted `NPM_TOKEN` (which bypasses 2FA for automation), it publishes the new version to the public NPM registry.
4. **Provenance**: It cryptographically signs the release, giving it the NPM Provenance checkmark.
5. **GitHub Release**: It generates a formal "Release" on your GitHub sidebar, automatically writing the changelog based on your commit messages.

## ⚠️ Troubleshooting & Rules
* **Never un-publish:** Once a version is on NPM, it's immutable. If you push a bug in `v1.0.10`, simply fix the code, run `npm version patch` to make it `v1.0.11`, and push again.
* **Failed Actions:** If a release doesn't show up on NPM within 2 minutes, check the **Actions** tab on your GitHub repository to read the failure logs.