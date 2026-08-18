-- 0024: complete the delivery lifecycle (audit Phase 1.3). The enum stops at
-- 'care', so nothing distinguished "signed, being onboarded" from "building",
-- there was no launch-preparation step, and no project could ever be finished.
-- Additive enum values only — existing rows and code paths are untouched.
--
-- Full stage language after this migration (display order lives in app code):
--   discovery → onboarding → build → review → launch_prep → live → care → complete

alter type project_stage add value if not exists 'onboarding';
alter type project_stage add value if not exists 'launch_prep';
alter type project_stage add value if not exists 'complete';
