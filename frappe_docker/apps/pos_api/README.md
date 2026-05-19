# pos_api

Custom Frappe app that powers the Aiwa POS Electron client.
See `../../docs/BACKEND.md` (relative to repo root) for the full spec.

## Install

```bash
bench get-app pos_api /workspace/development/apps/pos_api
bench --site aiwapos.localhost install-app pos_api
bench --site aiwapos.localhost execute pos_api.seed.seed_demo.run
```
