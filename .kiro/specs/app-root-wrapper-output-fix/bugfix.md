# Bugfix Requirements Document

## Introduction

The application fails to start due to an `EXTENSION_OUTPUT_MISSING` error when using `AppRootWrapperBlueprint.make()` in packages/app/src/App.tsx. The issue occurs because the blueprint is being called with an incorrect parameter name (`Component` with capital C) instead of the required parameter name (`component` with lowercase c). According to the Backstage API, the `Component` parameter is deprecated and the error type definition explicitly states: "Use the `component` parameter instead".

This bug prevents the entire application from starting properly because the `tenantRootWrapper` extension does not generate the required output structure expected by the new frontend system.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN AppRootWrapperBlueprint.make() is called with the `Component` parameter (capital C) THEN the system throws an EXTENSION_OUTPUT_MISSING error

1.2 WHEN the tenantRootWrapper extension is created with the deprecated parameter name THEN the system fails to generate the required extension output structure

1.3 WHEN the application attempts to start with the incorrectly configured extension THEN the system prevents the application from starting

### Expected Behavior (Correct)

2.1 WHEN AppRootWrapperBlueprint.make() is called with the `component` parameter (lowercase c) THEN the system SHALL generate the correct extension output structure without errors

2.2 WHEN the tenantRootWrapper extension is created with the correct parameter name THEN the system SHALL produce valid extension output containing the app.root.wrapper data reference

2.3 WHEN the application attempts to start with the correctly configured extension THEN the system SHALL start successfully without EXTENSION_OUTPUT_MISSING errors

### Unchanged Behavior (Regression Prevention)

3.1 WHEN the TenantProvider wraps the application children THEN the system SHALL CONTINUE TO provide tenant context to all child components

3.2 WHEN other blueprints (SignInPageBlueprint, createFrontendModule) are used in the app THEN the system SHALL CONTINUE TO function correctly

3.3 WHEN the application starts successfully THEN the system SHALL CONTINUE TO render the authenticated app shell with sidebar and pages wrapped by TenantProvider

3.4 WHEN other features (catalogPlugin, scaffolderPlugin, etc.) are loaded THEN the system SHALL CONTINUE TO initialize and function as expected
