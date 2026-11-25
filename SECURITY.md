# Security policy

NovaProse is embedded into other people's sites and handles untrusted HTML, so we treat security
reports as a priority.

## Reporting a vulnerability

Please email **security@novaprose.com** and do not open a public issue. Include:

- the affected package and version;
- steps or a minimal HTML payload to reproduce;
- the impact you observed (for example, script execution, data exfiltration, bypassing
  `validElements`).

We will acknowledge your report within 3 business days and keep you updated until it is fixed.
Please give us reasonable time to release a fix before public disclosure. We are happy to credit
you in the release notes.

## Supported versions

Until 1.0, security fixes are released for the latest 0.x minor version only.

## Scope

In scope: XSS or script execution through content, paste, drag-and-drop or the public API; URL or
CSS allowlist bypasses; content-restriction bypasses; vulnerabilities in the CDN build.
Out of scope: issues that require a malicious plugin or `prosemirrorPlugins` supplied by the host
application.
