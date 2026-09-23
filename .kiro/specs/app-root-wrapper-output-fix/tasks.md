# Task Breakdown: Fix AppRootWrapperBlueprint Parameter Name

## Overview

This task list implements the bugfix for the `EXTENSION_OUTPUT_MISSING` error by changing the parameter name from `Component` to `component` in the `AppRootWrapperBlueprint.make()` call.

**Spec Location:** `.kiro/specs/app-root-wrapper-output-fix/`

**Total Estimated Time:** 15 minutes

---

## Tasks

### Task 1: Update Parameter Name in tenantRootWrapper Definition

**Description:** Change the parameter name from `Component` (capital C) to `component` (lowercase c) in the `AppRootWrapperBlueprint.make()` call.

**File:** `packages/app/src/App.tsx`

**Location:** Line 96 (approximately)

**Change Required:**
```diff
const tenantRootWrapper = AppRootWrapperBlueprint.make({
  params: {
-   Component: ({ children }) => <TenantProvider>{children}</TenantProvider>,
+   component: ({ children }) => <TenantProvider>{children}</TenantProvider>,
  },
});
```

**Acceptance Criteria:**
- [ ] Parameter name changed from `Component` to `component`
- [ ] Arrow function and TenantProvider implementation remain unchanged
- [ ] Code formatting is preserved
- [ ] No syntax errors introduced

**Estimated Time:** 2 minutes

---

### Task 2: Verify Application Starts Without EXTENSION_OUTPUT_MISSING Error

**Description:** Start the development server and confirm that the `EXTENSION_OUTPUT_MISSING` error no longer appears in the console.

**Commands:**
```bash
yarn dev
```

**Validation Steps:**
1. Start the application using `yarn dev`
2. Monitor console output during startup
3. Verify no `EXTENSION_OUTPUT_MISSING` errors appear
4. Confirm extension initialization completes successfully
5. Check browser console for any runtime errors

**Acceptance Criteria:**
- [ ] Application starts successfully
- [ ] No `EXTENSION_OUTPUT_MISSING` error in console output
- [ ] No errors mentioning `tenantRootWrapper` or `app.root.wrapper`
- [ ] Extension system initializes without warnings
- [ ] Application loads in browser without errors

**Estimated Time:** 5 minutes

---

### Task 3: Confirm TenantProvider Still Wraps App Correctly

**Description:** Verify that the TenantProvider continues to wrap the application correctly and tenant context is available throughout the app.

**Validation Steps:**
1. Navigate to a page that uses tenant context (e.g., tenant projects page)
2. Open browser DevTools React Components tab (if available)
3. Verify TenantProvider is in the component tree wrapping the app
4. Check that tenant-related features work as expected
5. Confirm no regression in tenant functionality

**Acceptance Criteria:**
- [ ] TenantProvider wraps the authenticated app shell
- [ ] Tenant context is accessible in child components
- [ ] Tenant-related UI features render correctly
- [ ] No console warnings or errors related to tenant context
- [ ] Existing tenant functionality works identically to before the fix

**Estimated Time:** 8 minutes

---

## Success Criteria

The bugfix is complete when:

1. ✓ Parameter name is changed from `Component` to `component`
2. ✓ Application starts without `EXTENSION_OUTPUT_MISSING` error
3. ✓ TenantProvider wrapper functionality is preserved
4. ✓ No regressions in tenant-related features
5. ✓ Extension system generates proper output structure

---

## Notes

- This is a minimal, low-risk change affecting only parameter naming
- The actual wrapper component implementation (`<TenantProvider>{children}</TenantProvider>`) remains unchanged
- The fix aligns with Backstage API requirements for the new frontend system
- If any issues occur, the change can be easily reverted (though this would restore the original error)

---

## Context

**Bug:** `EXTENSION_OUTPUT_MISSING` error prevents application startup

**Root Cause:** Using deprecated `Component` parameter instead of required `component` parameter

**Solution:** Change parameter name to comply with Backstage API requirements

**Risk Level:** Low - single character case change in parameter name
