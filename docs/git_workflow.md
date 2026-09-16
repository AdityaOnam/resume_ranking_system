# Git Collaboration Workflow

This document outlines the standard professional Git workflow used in this project, based on the Fork and Pull model.

## Current Structure

- **Upstream Repository (B's Repo)**: `adityaonam/resume-ranking-system` (Branch: `feature/ai-phase3-embeddings`)
- **Your Fork (Your Repo)**: `adi-kernelx/resume-ranking-system` (Branch: `feature/ai-phase`)

Your branch (`feature/ai-phase`) is based on the upstream branch (`feature/ai-phase3-embeddings`).

---

## Daily Professional Workflow

Every day, follow these steps to keep your work in sync with the upstream repository:

1. **Fetch Latest from Upstream**
   ```bash
   git fetch adityaonam
   ```
2. **Switch To Your Branch**
   ```bash
   git checkout feature/ai-phase
   ```
3. **Update From Upstream Branch (Rebase)**
   ```bash
   git rebase adityaonam/feature/ai-phase3-embeddings
   ```
4. **Work on Your Code**
   Edit files, write code, etc.
5. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "message"
   ```
6. **Push to Your Fork**
   ```bash
   git push origin feature/ai-phase
   ```
   *Note: If you rebased in Step 3, you must force push:*
   ```bash
   git push origin feature/ai-phase --force
   ```

---

## Important Rules

### MERGE vs REBASE
- **Merge** (`git merge upstream_branch`): Creates extra merge commits. History becomes messy.
- **Rebase** (`git rebase upstream_branch`): **PREFERRED**. Cleaner professional history. Preferred for feature branches.

### VERY IMPORTANT SAFETY RULE
**Never do:**
```bash
git push --force
```
Only do `git push origin branch_name --force` on your own feature branch in your own fork.

---

## Common Scenarios

### CASE 1 — You Make Changes Locally
1. `git add .`
2. `git commit -m "Add feature"`
3. `git push origin feature/ai-phase`

### CASE 2 — Create PR To Upstream Feature Branch
When creating a Pull Request on GitHub, ensure you set:
- **Base Repo**: `AdityaOnam/resume_ranking_system`
- **Base Branch**: `feature/ai-phase3-embeddings`
- **Head Repo**: `adi-kernelx/resume-ranking-system`
- **Compare Branch**: `feature/ai-phase`

### CASE 3 — Upstream Updated Feature Branch BEFORE You Start Working
Just update your branch using Rebase:
```bash
git fetch adityaonam
git checkout feature/ai-phase
git rebase adityaonam/feature/ai-phase3-embeddings
git push origin feature/ai-phase --force
```

### CASE 4 — Upstream Updated Feature Branch AFTER You Made Local Changes BUT BEFORE PUSH
1. `git fetch adityaonam`
2. `git rebase adityaonam/feature/ai-phase3-embeddings`
3. Resolve any conflicts in your editor, then:
   ```bash
   git add .
   git rebase --continue
   ```
4. `git push origin feature/ai-phase --force`

### CASE 5 — Upstream Updated Feature Branch AFTER You Already PUSHED To YOUR Fork
1. `git fetch adityaonam`
2. `git checkout feature/ai-phase`
3. `git rebase adityaonam/feature/ai-phase3-embeddings`
4. `git push origin feature/ai-phase --force`
*(Your open PR will automatically update on GitHub)*

### CASE 6 — Upstream Updated MASTER But NOT Feature Branch
DO NOTHING. Your branch depends on `feature/ai-phase3-embeddings`, not `master`. Only sync from the branch you are contributing to.

### CASE 7 — Upstream Merged MASTER INTO Feature Branch
Rebase again:
```bash
git fetch adityaonam
git rebase adityaonam/feature/ai-phase3-embeddings
git push origin feature/ai-phase --force
```

### CASE 8 — Upstream Deleted/Recreated Feature Branch
1. `git fetch --prune adityaonam`
2. Check branches: `git branch -a`
3. Rebase to the latest branch.

---

## What Happens After Your PR is Merged?

Your branch does **NOT** automatically update. You should:
```bash
git fetch adityaonam
git checkout feature/ai-phase
git rebase adityaonam/feature/ai-phase3-embeddings
```
Afterward, you can optionally delete your old branch if the feature is fully complete:
```bash
git branch -d feature/ai-phase
git push origin --delete feature/ai-phase
```

## The Real Industry Model
This workflow is a simplified **GitFlow** used by major open-source projects like Linux, Kubernetes, React, and TensorFlow.
The upstream feature branch (`feature/ai-phase3-embeddings`) acts as an **Integration Branch** where related work accumulates and testing happens before eventually merging into `master`.
