# Web artifact identity and provenance

A public commit is a source identity, not a complete web release identity.

| Field | Meaning |
| --- | --- |
| `publicSha` | Exact public source commit, including the snapshot exporter and build recipe |
| `snapshotSha256` | SHA-256 of snapshot version 1 bytes; deterministic for a clean source commit |
| `bakedContentSha256` | SHA-256 of the exact frozen JSON input bytes read by every rendering worker |
| `bakedRevisions` | Independent narrative/copy/editorial revisions, for diagnostics only |
| `inputIdentity` | Hash of source, snapshot, content, origin and dependency-lock identities |
| `releaseId` | Unique `web-v2-<GitHub run ID>-<attempt>` publication; never repointed or overwritten |
| `image.digest` | OCI image manifest digest; the only image reference accepted by a verified consumer |

One source SHA may have many content captures and releases. One input identity can
also have more than one image digest (render time, build IDs or toolchain changes).
This is recorded as a new release, never an overwrite. Revisions alone are not
content identities: public responses may contain resolved fields that change
without a document revision increment.

## Frozen input

Capture the three public HTTPS responses before building. Require two consecutive
identical complete response sets, with bounded retries. This detects observed
concurrent changes; it does not claim the endpoints form an atomic transaction.
Canonicalize object keys, preserve arrays, and hash the saved envelope bytes.
All Next workers read the same file and require its expected hash and origin.
Missing, changed or malformed frozen input aborts a release; it never falls back
to another network fetch or the source baseline. Legacy builds retain their
existing behavior until explicitly switched to frozen input.

## Durable candidate publication

Build and inspect the scratch OCI archive on a read-only job. A separate publisher
rechecks the archive and input hashes, copies the exact image to a dedicated
candidate package while preserving the digest, signs the release record and image
binding using GitHub OIDC attestations, and publishes a prerelease with immutable
assets. Pin third-party actions to commits. No existing production image tag is
written. The candidate package is `66archive-web-releases`.

The immutable Release retains the record, signature bundles, frozen content,
snapshot, and OCI archive beyond Actions artifact retention. Publication uses a
new tag, a draft with all assets attached, then finalizes it and requires
`immutable: true`. Any existing release/tag collision fails closed. Partial
uploads, unsigned records, failed builds or mutable releases are not consumable.
A registry upload alone is not an approved release. Registry deletion is an
availability failure; never resolve a mutable tag or rebuild as a fallback.

## Consumer trust policy

An operator selects an exact release ID and expected public SHA. Verify GitHub's
immutable release asset attestation plus the record's Sigstore provenance. Require
the exact repository, signer workflow, `refs/heads/main`, source/signer commit and
a GitHub-hosted runner. Verify the image attestation binds the same record and
image digest, and confirm the originating run/attempt completed successfully.
Reject a different image repository, source, signature, content/snapshot hash,
release identity, workflow, or platform. A digest in unsigned JSON is insufficient.

Selection is explicit, never `latest`, “highest revision”, or “most recent SHA
tag”. Preserve the complete verified record and signature bundles with each local
release. Rollback uses the previous verified digest/record, not tag resolution.
A later content edit creates a new candidate even when `publicSha` is unchanged.

GitHub repository administrators and approved main-branch workflow changes remain
trust roots. Immutability prevents rewriting a published release; deletion or
registry garbage collection can still make it unavailable. Keep an independently
verified copy of the OCI archive and proof for the required rollback window.

This phase publishes candidates and verification tooling only. Production consumer
selection and removal of another build are separate decisions after acceptance.
