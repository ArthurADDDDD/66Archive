# Public web shadow build

`release-web.yml` runs on `main` pushes and manual dispatch on `main`. It validates
public data, tests game search and artifact safety gates, reproduces the snapshot,
and performs a production build with live public content. Set repository variable
`PUBLIC_SITE_ORIGIN` to the public HTTPS origin. Missing configuration or a failed
content bake stops the build.

The image is named `66archive-web:<40-character public SHA>`. It uses `scratch` and
contains only `/site` and `/snapshot/dataset-snapshot.json` plus its SHA-256 sidecar.
Every OCI layer is inspected before upload. There is no registry login, package
write permission, registry push, or deployment step. Download the Actions artifact
`66archive-web-<SHA>` to obtain the OCI tar and `image-report.json`.

Snapshot version 1 retains the existing payload and ordering. `source` contains
only `commit` and `generatedAt`; the latter is the Git commit timestamp in UTC,
not the time the exporter ran. A Git checkout is required. Run
`npx tsx scripts/build-snapshot.ts` in a clean checkout; output goes to `.local/`.
A snapshot generated from modified source files is only a local preview and must
not be released under that checkout's HEAD SHA. The workflow uses a fresh checkout.

For the same SHA, the workflow serializes execution and compares the OCI manifest
digest and snapshot hash with all retained artifacts of that name. Mismatch,
expired evidence, unexpected source, and API/download errors fail closed. Missing
artifacts also fail closed on a rerun or when any prior same-SHA workflow run exists
(including failed runs). A first publication requires a first attempt with no prior
same-SHA run. This prevents rerun cleanup from being mistaken for a new SHA. An equal
artifact is reused without replacement. Use a new manual dispatch to compare a rebuild while preserving the previous
run artifact: rerunning the original run can remove its earlier artifact.
Evidence is retained for 30 days; deleted
history cannot establish a permanent immutable registry contract. This is a shadow
validation mechanism, not a production artifact resolver.

Snapshot determinism does not imply whole-site determinism: live content, page
render dates, the Next build ID, and toolchain versions can change the image digest.
The gate deliberately rejects such differences. Before using these artifacts as a
release source, define a durable digest record, trusted publisher/provenance checks,
registry visibility and access, retention, and the policy for same-SHA content
refreshes. Pin or capture all build inputs if rebuild reproducibility is required.

Local checks:

```sh
npm run validate
npm run test:vote-search
node --test scripts/release/test-compare-shadow.cjs
python3 scripts/release/test-audit-image.py
```

The OCI audit uses blob digests, uncompressed layer digests, a root-directory
allowlist, rejection of links and hidden files, and snapshot source/hash checks.
It is not a general content or secret scanner; only public checkout output may be
placed in the build context.
