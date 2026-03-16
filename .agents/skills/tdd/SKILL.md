---
name: tdd
description: Drive implementation with tests first. Use when adding or changing code where behavior can be specified by automated tests, including bug fixes, small features, refactors with behavior preservation, parser changes, and provider/LSP feature work. Prefer this skill when the task benefits from a red-green-refactor loop and from proving the change with focused tests before broad verification.
---

# TDD

Use a strict red-green-refactor loop unless that is impossible.

## Workflow

1. Identify the smallest observable behavior change.
2. Find the narrowest existing test file that covers the behavior, or create one if none exists.
3. Write or update a test so it fails for the right reason.
4. Run the smallest test command that exercises only that behavior.
5. Make the smallest production change that turns the test green.
6. Re-run the focused test.
7. Refactor only after the behavior is proven.
8. During refactor, explicitly check whether the new implementation duplicated an existing helper, transform, parser pass, or lifecycle path. If it did, either consolidate it now or document why duplication is intentional.
9. Finish with the smallest broader verification justified by the change.

## Test Selection

Prefer the tightest scope that can fail and pass quickly:

- Existing unit test file before a new integration test
- Existing integration test before a new end-to-end test
- Single test target before a whole package or workspace run

Follow repo conventions. Do not invent a parallel testing style.

## Writing the First Failing Test

Make the failure precise:

- Assert externally visible behavior, not implementation detail
- Keep fixtures minimal
- Name the test after the intended behavior or regression
- Avoid mixing multiple behaviors into one new test

For bug fixes:

- Reproduce the bug with one test first
- Confirm it fails on the current code before fixing

For refactors:

- Add or tighten characterization tests first if behavior is under-specified

## Implementation Rules

- Do not edit production code until the new or tightened test demonstrates the gap, unless the environment prevents running tests at all
- Prefer one small production patch over speculative cleanup
- If the test exposes missing seams, introduce only the seam needed to make the behavior testable
- Keep test and production changes paired; do not leave broad unrelated cleanup in the same pass
- If the green fix required copying logic from another code path, treat deduplication review as part of the refactor step before you call the task done

## Verification

Always report:

- The focused failing test you added or changed
- The focused command used to make it pass
- Whether the refactor step found any duplicated logic and what you did about it
- Any broader verification you ran
- Any reason TDD could not be followed exactly

## Exceptions

Relax strict TDD only when one of these is true:

- There is no runnable test environment
- The change is purely mechanical with existing coverage already proving behavior
- The task is documentation-only, configuration-only, or non-code

When deviating, say so explicitly and get back to executable verification as soon as possible.
