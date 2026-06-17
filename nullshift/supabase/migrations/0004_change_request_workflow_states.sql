-- The §5 client-collaboration workflow runs:
--   submitted → triaged → scoped → awaiting_approval → approved
--            → in_progress → review → shipped
-- The §3 enum omitted the two delivery states; add them so the admin delivery
-- board and portal approvals advance through the full lifecycle.
alter type change_request_status add value if not exists 'in_progress' after 'approved';
alter type change_request_status add value if not exists 'review' after 'in_progress';
