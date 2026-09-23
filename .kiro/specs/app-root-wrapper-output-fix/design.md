# Design Document: Fix AppRootWrapperBlueprint Parameter Name

## Executive Summary

This bugfix changes the parameter name in `AppRootWrapperBlueprint.make()` from the deprecated `Component` (capital C) to the required `component` (lowercase c). This single-character case change aligns with the Backstage API requirements and resolves the `EXTENSION_OUTPUT_MISSING` error that prevents application startup.

## Problem Statement

The application fails to start with an `EXTENSION_OUTPUT_MISSING` error because the `tenantRootWrapper` extension uses the deprecated `Component` parameter name instead of the required `component` parameter name when calling `AppRootWrapperBlueprint.make()`. The Backstage new frontend system requires the lowercase `component` parameter to generate the proper extension output structure.

## Proposed Solution

### Architecture Overview

The fix involves a single parameter name change in the `tenantRootWrapper` extension definition. No architectural changes are required. The TenantProvider wrapper functionality remains identical; only the parameter name used to pass it to the blueprint changes.

**Location:** `packages/app/src/App.tsx`, line 96

**Current Code:**
```typescript
const tenantRootWrapper = AppRootWrapperBlueprint.make({
  params: {
    Component: ({ children }) => <TenantProvider>{children}</TenantProvider>,
  },
});
```

**Fixed Code:**
```typescript
const tenantRootWrapper = AppRootWrapperBlueprint.make({
  params: {
    component: ({ children }) => <TenantProvider>{children}</TenantProvider>,
  },
});
```

### Technical Details

**Blueprint API Contract:**
- The `AppRootWrapperBlueprint` expects a `component` parameter (lowercase) in its params object
- The deprecated `Component` parameter (capital C) does not generate the required extension output
- The error message explicitly states: "Use the `component` parameter instead"

**Extension Output Structure:**
- With correct parameter: Blueprint generates `app.root.wrapper` output reference
- With deprecated parameter: Blueprint fails to generate required output, causing EXTENSION_OUTPUT_MISSING error

**Component Behavior:**
- The arrow function `({ children }) => <TenantProvider>{children}</TenantProvider>` remains unchanged
- TenantProvider wrapping behavior is preserved
- Only the parameter key name changes from `Component` to `component`

## Implementation Plan

### Change Summary

| File | Line | Change Type | Description |
|------|------|-------------|-------------|
| `packages/app/src/App.tsx` | 96 | Parameter rename | Change `Component:` to `component:` |

### Detailed Changes

**File: packages/app/src/App.tsx**

```diff
const tenantRootWrapper = AppRootWrapperBlueprint.make({
  params: {
-   Component: ({ children }) => <TenantProvider>{children}</TenantProvider>,
+   component: ({ children }) => <TenantProvider>{children}</TenantProvider>,
  },
});
```

### Risk Assessment

**Risk Level:** Low

**Rationale:**
- Single character case change in parameter name
- No logic changes to the wrapper component
- No changes to TenantProvider implementation
- Aligns with official Backstage API requirements
- Error message explicitly directs to use lowercase `component`

**Potential Issues:**
- None identified - this is a straightforward API compliance fix

### Testing Strategy

**Manual Testing:**
1. Start the application with `yarn dev`
2. Verify no `EXTENSION_OUTPUT_MISSING` error appears in console
3. Confirm application loads successfully
4. Verify TenantProvider context is available throughout the app
5. Test tenant-related features to ensure wrapper functionality is preserved

**Expected Results:**
- Application starts without errors
- Console shows successful extension initialization
- TenantProvider wraps the authenticated app shell
- Tenant context is accessible in all child components

### Rollback Plan

If issues occur, revert the single-character change from `component` back to `Component`. However, this would restore the original error, so rollback is not recommended unless a critical regression is discovered.

## Acceptance Criteria

### Functional Requirements

✓ **AC 1.1:** When the application starts, the system SHALL NOT display EXTENSION_OUTPUT_MISSING errors

✓ **AC 2.1:** When AppRootWrapperBlueprint.make() is called with lowercase `component` parameter, the system SHALL generate valid extension output

✓ **AC 3.1:** When the TenantProvider wraps the application, the system SHALL continue to provide tenant context to all child components

### Non-Functional Requirements

✓ **Performance:** No performance impact - parameter name change only

✓ **Compatibility:** Aligns with Backstage new frontend system API requirements

✓ **Maintainability:** Uses non-deprecated API parameter name

## Correctness Properties

### Property 1: Extension Output Generation
**Description:** The blueprint must generate the required extension output structure when called with the correct parameter name.

**Formal Statement:**
```
GIVEN AppRootWrapperBlueprint.make() is called with params.component
WHEN the extension is initialized
THEN the system SHALL generate extension output containing app.root.wrapper reference
AND EXTENSION_OUTPUT_MISSING error SHALL NOT occur
```

### Property 2: Tenant Context Preservation
**Description:** The TenantProvider wrapper functionality must remain unchanged after the parameter rename.

**Formal Statement:**
```
GIVEN the application has started successfully with the fixed parameter
WHEN child components access tenant context
THEN the context SHALL be available and functional
AND tenant-related features SHALL work identically to before the fix
```

### Property 3: Application Startup Success
**Description:** The application must start without frontend system errors after the parameter fix.

**Formal Statement:**
```
GIVEN the tenantRootWrapper uses lowercase component parameter
WHEN yarn dev starts the application
THEN the application SHALL load successfully
AND no EXTENSION_OUTPUT_MISSING errors SHALL appear
AND the authenticated app shell SHALL render
```

## Dependencies

**No external dependencies required** - this is a parameter name change only.

**Affected Modules:**
- `packages/app/src/App.tsx` - Single file change

## Deployment Considerations

**Build Impact:** None - change is in source code that gets compiled

**Configuration Changes:** None required

**Database Migrations:** None required

**Environment Variables:** None affected

**Deployment Steps:**
1. Apply the parameter name change
2. Rebuild the application
3. Restart the development server or deploy updated build

## Monitoring and Validation

**Success Indicators:**
- Application starts without console errors
- No `EXTENSION_OUTPUT_MISSING` messages
- TenantProvider functionality works as expected

**Validation Commands:**
```bash
# Start the development server
yarn dev

# Watch console output for successful extension initialization
# Expected: No EXTENSION_OUTPUT_MISSING errors
```

**Console Output Check:**
Look for extension initialization messages without errors mentioning `tenantRootWrapper` or `app.root.wrapper`.

## Conclusion

This bugfix addresses a simple API compliance issue where a deprecated parameter name prevents proper extension output generation. The one-character case change from `Component` to `component` aligns with Backstage requirements and resolves the startup error without affecting any functionality.

The fix is minimal, low-risk, and directly addresses the root cause identified in the error message.
