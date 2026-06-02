# Security Specification: Toheera's Video Editing Journey

## 1. Data Invariants
* **User Profile**: A user node can only describe the authenticated client UID. Field keys must stay immutable except for explicit visual preferences and setup states.
* **Progress Mapping**: Progress checks must remain bounded to the specific authenticated `userId`. Checklist maps can only be controlled by the user.
* **Journal Ledger**: Learning entries are authenticated exclusively using the creator's identity. No client can inject log notes with a spoofed status or other users' profiles.

## 2. The "Dirty Dozen" Payloads (Abridged Red Team Vectors)
1. **The Ghost Field Attack**: Creating a user record with an unmapped field `isAdmin: true`. Rejected.
2. **The Identity Spoofing Attack**: Posting progress for user `Toheera` but with auth context of another UID. Rejected.
3. **The ID Poisoning Attack**: Submitting journal posts with a 10MB document key instead of alphanumeric strings. Rejected.
4. **The Time Hijack**: Forging `createdAt` or `updatedAt` to historical epochs rather than using `request.time`. Rejected.
5. **The Cross-Read Intrusion**: Querying another user's progress index under a generic list. Rejected.
6. **The Outcome Hijack**: Directly modifying someone else's week completion maps. Rejected.
7. **The Blanket Leak**: Requesting list views without a UID binding match. Rejected.

## 3. Test Invariants Checked
- Standard clients are contained under strict identity matching gates.
- Shadow writes are filtered via `request.resource.data.diff(resource.data).affectedKeys().hasOnly()`.
- Maximum length limits are set for string fields (`id`, `note`, `feeling`) to prevent wallet exhaustion attacks.
