# IntraLink Navigator v0.9 — Ask AMOS Action Import

Controlled bounded enhancement under SharePoint Restructuring & Integration — AMOS Steward.

## Purpose
Close the Ask AMOS → Executive Actions loop without creating a second task database or a separate Microsoft credential channel.

## Behavior
- Accept an AMOS Action Import payload in Navigator.
- Present proposed Executive Actions for on-device approval.
- Detect exact-title duplicates before creation.
- Use Navigator's existing delegated Microsoft Graph session to write to the existing SharePoint-backed Executive Actions list.
- Refresh My To-Do and surface the resulting items under This Week.

## System of Record
SharePoint remains authoritative. Navigator remains the gateway and write surface.

## Release Artifact
Authoritative package: IntraLink Enterprise → 04 - Digital Presence → 04 IntraLink Enterprise Navigator → Web App v1 → 05 Releases → `IntraLink_Navigator_LIVE_v0_9_Ask_AMOS_Action_Import_Production.zip`

SHA-256: `e98cf6df54219b9edb3d1f537733ff3f3ae4405eeec1914e465b0ebe69c35bb6`

## Deployment Control
Production v0.8 remains controlling until v0.9 passes preview verification. Do not alter existing production aliases until the preview gate clears.
