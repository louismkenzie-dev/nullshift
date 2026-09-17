<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.

<!-- END:nextjs-agent-rules -->

## Website release workflow

User approval recorded on 17 September 2026: after making requested website changes, run the relevant checks, commit and push the source to GitHub, and deploy to production at `nullshift.co.uk` without asking for routine release approval again. An explicit preview-only or do-not-deploy request overrides this default.

Before pushing, fetch and preserve newer work on `origin/main`. Never force-push or overwrite unrelated work. Stop and report failing checks, unresolved conflicts, or changes requiring new authority over live billing or client data. Verify the deployment is ready and the production domain points to it; report the source commit and deployment outcome separately. Do not include credentials or private client data in commits.
