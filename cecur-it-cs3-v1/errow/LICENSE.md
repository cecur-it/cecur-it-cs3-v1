# Licensing

Copyright (c) 2024-2026 CECUR-IT and the errow™ contributors.

This repository contains software, documentation, knowledge bases, container specifications,
and related materials that are distributed under multiple licenses. The license that applies
to a given file or directory depends on its location and, where noted, on the presence of a
license header. Read this document carefully before using, modifying, or redistributing any
part of this repository.

---

## 1. Summary

| Component | Path(s) | License |
|---|---|---|
| Core engine, CLI, TUI, web viewer, cloud CLI | `errow/`, `scripts/`, `tests/`, `benchmarks/`, root build files | Apache License 2.0 |
| Sandbox container definitions | `containers/` | Apache License 2.0 |
| Internal offensive agent knowledge packs | `errow/skills/` | Apache License 2.0 (with use restrictions, see §4) |
| External coding-agent skills | `skills/` | Apache License 2.0 |
| Documentation site | `docs/` | Apache License 2.0 (docs) / CC BY 4.0 (prose) |
| Third-party dependencies and vendored tools | See `NOTICE` and dependency manifests | Their respective licenses |
| errow™ name, logos, and brand assets | `**/brand/`, `**/logo*`, marketing copy | All rights reserved (see §5) |
| Managed cloud service | `app.errow.ai`, `errow cloud` backend | Proprietary (see §6) |

If a file contains an explicit SPDX license identifier or license header, that header
controls over this summary.

---

## 2. Apache License 2.0 (Primary License)

Except as otherwise noted in this document, the contents of this repository are licensed
under the Apache License, Version 2.0 (the "License"). You may obtain a copy of the License at:

    https://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software distributed under the
License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND,
either express or implied. See the License for the specific language governing permissions
and limitations under the License.

### 2.1 Required Notices

When redistributing this software or derivative works, you must:

1. Include a copy of the Apache License 2.0.
2. Retain all copyright, patent, trademark, and attribution notices in the source.
3. Include the contents of the `NOTICE` file, if present, or reproduce its attributions
   in documentation accompanying the distribution.
4. Clearly mark any files you have modified.
5. Comply with the trademark restrictions in §5.

### 2.2 Contributions

Unless you explicitly state otherwise, any contribution intentionally submitted for
inclusion in this repository by you shall be licensed under the Apache License 2.0, without
any additional terms or conditions. By submitting a pull request or patch you represent that
you have the right to license the contribution under these terms. A Developer Certificate of
Origin ("Signed-off-by") line is required on all commits.

### 2.3 Upstream Attribution

errow™ is engineered atop the open-source `errow-agent` (v1.7.0) codebase, which is licensed
under the Apache License 2.0. Portions of this repository may be derived from or incorporate
that upstream project. All upstream copyright notices are retained in the relevant files and
in the `NOTICE` file. Nothing in this repository grants rights to upstream trademarks beyond
those permitted by the upstream project's own trademark policy.

---

## 3. Documentation License

Prose documentation under `docs/` is licensed under the Creative Commons Attribution 4.0
International License (CC BY 4.0), available at:

    https://creativecommons.org/licenses/by/4.0/

Code samples embedded in documentation remain under the Apache License 2.0. When reusing
documentation, provide attribution to "CECUR-IT | errow™ documentation" with a link to the
original source.

---

## 4. Acceptable Use of Offensive Security Knowledge Packs

The knowledge packs under `errow/skills/` and the external skills under `skills/` describe
offensive security techniques, exploitation methodology, and proof-of-concept tradecraft.
They are provided **for authorized security testing, defensive research, education, and
professional penetration testing only**.

By using these materials you agree that:

1. You will use them only against systems for which you have explicit, documented
   authorization from the system owner, or in controlled environments you own.
2. You are solely responsible for complying with all applicable local, national, and
   international laws, including computer-misuse, export-control, and sanctions laws.
3. You will not use these materials to cause harm, to conduct unauthorized access, or to
   develop malware intended for deployment against third parties.
4. You will not remove or alter responsible-use notices, and you will pass these
   restrictions on to any recipient of the materials.

These are conditions of use, not additional license restrictions on the Apache-2.0-licensed
code itself. If you do not agree, do not use the knowledge packs.

---

## 5. Trademarks and Brand Assets

"errow™", "CECUR-IT", the errow logo, and associated wordmarks, logos, and visual identity
(the "Marks") are trademarks or registered trademarks of CECUR-IT. All rights in the Marks
are reserved.

The Apache License 2.0 does **not** grant permission to use the Marks, except for reasonable
and customary descriptive uses such as:

- Referencing the project by name in factual statements (e.g., "built on errow™").
- Reproducing the name in unmodified copies of the `NOTICE`, `README.md`, or `LICENSE.md`.
- Describing compatibility or interoperability, provided you do not imply endorsement.

You may **not** use the Marks in a way that suggests sponsorship, affiliation, or
endorsement by CECUR-IT without prior written permission, including in the name of a
fork, a hosted service, a product, or a domain name. Forks must be renamed and must not
use errow™ branding. Requests for trademark use may be directed to legal@cecur-it.io.

---

## 6. Managed Cloud Service

The hosted platform at `app.errow.ai` and the backend services supporting `errow cloud`
commands, team dashboards, pull-request gates, compliance reporting, and billing are
proprietary to CECUR-IT and are **not** licensed under the Apache License 2.0. Use of the
managed service is governed by the applicable Terms of Service and Privacy Policy presented
at signup or at https://cecur-it.io/legal. Nothing in this repository grants any license to
the managed service's source code, infrastructure, or operational data.

The client-side cloud CLI code in `errow/interface/cloud/` is Apache-2.0 licensed, which
permits you to build compatible clients; it does not grant access to the hosted service.

---

## 7. Third-Party Components

This repository depends on and, in some cases, vendors third-party software, including but
not limited to:

- ProjectDiscovery tools (httpx, katana, nuclei, subfinder, naabu, cvemap)
- Caido (`caido-cli`, `caido-sdk-client`)
- Semgrep, Bandit, Trivy, Gitleaks, TruffleHog
- LiteLLM, the OpenAI SDK, and `openai-agents`
- Go libraries (Bubble Tea, Lip Gloss, Glamour, Bubbles, Chroma)
- React, Vite, Tailwind CSS, XYFlow
- Kali Linux base images and Debian packages

Each is governed by its own license. See the `NOTICE` file, `pyproject.toml`, `uv.lock`,
`go.mod`, and `frontend/package.json` for the full dependency list and upstream licenses.
Where a third-party license conflicts with this document, the third-party license governs
that component.

Container images built from `containers/Dockerfile` aggregate software under multiple
licenses, including copyleft licenses for certain Debian/Kali packages. If you redistribute
such images, you are responsible for satisfying those licenses.

---

## 8. Export Control and Sanctions

The software and knowledge packs may be subject to export-control and sanctions laws,
including U.S. Export Administration Regulations and E.U. dual-use controls. You may not
use, export, or re-export the materials in violation of applicable law, or to persons or
entities subject to sanctions. You are responsible for obtaining any required export
authorizations.

---

## 9. No Warranty; Limitation of Liability

THE SOFTWARE AND MATERIALS ARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT. IN NO EVENT SHALL THE AUTHORS, COPYRIGHT
HOLDERS, OR CECUR-IT BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY, WHETHER IN AN
ACTION OF CONTRACT, TORT, OR OTHERWISE, ARISING FROM, OUT OF, OR IN CONNECTION WITH THE
SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

This section is subject to the full text of the Apache License 2.0, §7 and §8, which
controls in the event of any conflict.

---

## 10. Reporting License Issues

If you believe a file in this repository is mislabeled, missing a required attribution, or
otherwise fails to comply with an applicable license, please open an issue or contact
legal@cecur-it.io so we can correct it promptly.

---

## 11. Questions

For licensing questions, contact legal@cecur-it.io. For security-disclosure matters, follow
the process in `SECURITY.md` rather than the public issue tracker.
