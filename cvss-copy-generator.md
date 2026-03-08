````markdown
# CVSS-Aware Security Copy Generator

This document provides:

1. **Reusable security copy templates**
2. **Instructions for dynamically generating copy from CVSS vectors**
3. **Example outputs**
4. **A full legend for CVSS v3.1 base metrics**

The goal is to communicate **real exploit risk** when vulnerabilities are present in packages and their dependency trees.

**Package severity:** Packages are listed under their severity from the npm audit JSON payload (`vulnerabilities[name].severity`). A package with mixed advisories (e.g. 1 low and 1 moderate) is classified by the payload's `severity` field—e.g. `"severity": "moderate"` means the package appears under Moderate, not Low.

Base copy concept:

> Resolving these vulnerable packages protects `{dep_count}` dependent packages.

This generator expands that copy using **CVSS exploitability signals**. The phrase uses "these" (not a vuln count) so the copy reads naturally in the severity inspector context.

---

# 1. Input Data

The generator requires:

```json
{
  "dep_count": 20,
  "vectorString": "CVSS:3.1/AV:N/AC:H/PR:N/UI:R"
}
````

Parsed values:

| Field               | Example |
| ------------------- | ------- |
| dependent packages  | 20      |
| attack vector       | N       |
| attack complexity   | H       |
| privileges required | N       |
| user interaction    | R       |

---

# 2. Base Copy Templates

## Standard (no CVSS)

```
Resolving these vulnerable packages protects {dep_count} dependent package(s).
```

## With CVSS metrics

```
Resolving these vulnerable packages protects {dep_count} dependent package(s) from attacks that are {attack_vector}, {privileges}, {interaction}, and {complexity}.
```

Alternative variants:

```
Fixing these vulnerable packages secures {dep_count} downstream packages.

Addressing these vulnerabilities protects {dep_count} dependent packages.

Patching these vulnerable packages reduces risk across {dep_count} packages in your dependency tree.
```

---

# 3. CVSS Phrase Dictionary

Each metric expands into a **human-readable risk phrase**.

## Attack Vector

| Code | Phrase                                     |
| ---- | ------------------------------------------ |
| N    | exploitable over the network               |
| A    | exploitable by systems on the same network |
| L    | exploitable by a local system user         |
| P    | exploitable with physical device access    |

---

## Attack Complexity

| Code | Phrase                                   |
| ---- | ---------------------------------------- |
| L    | relatively easy to exploit               |
| H    | requiring specific conditions to exploit |

---

## Privileges Required

| Code | Phrase                            |
| ---- | --------------------------------- |
| N    | requiring no privileges           |
| L    | requiring a low-privilege account |
| H    | requiring high privileges         |

---

## User Interaction

| Code | Phrase                     |
| ---- | -------------------------- |
| N    | without user interaction   |
| R    | requiring user interaction |

---

# 4. Dynamic Copy Structure

Recommended format:

```
Resolving these vulnerable packages protects {dep_count} dependent packages from attacks that are:

{attack_vector_phrase},
{privileges_phrase},
{interaction_phrase},
and {complexity_phrase}.
```

---

# 5. Generator Logic

Pseudo-code example:

```pseudo
function generateCopy(depCount, vector):

  metrics = parseVector(vector)

  attackVector = AV_MAP[metrics.AV]
  privileges = PR_MAP[metrics.PR]
  interaction = UI_MAP[metrics.UI]
  complexity = AC_MAP[metrics.AC]

  if (!metrics) {
    return "Resolving these vulnerable packages protects " + depCount + " dependent package(s)."
  }

  return "Resolving these vulnerable packages protects " + depCount + " dependent package(s)" +
      " from attacks that are " +
      attackVector + ", " +
      privileges + ", " +
      interaction + ", and " +
      complexity + "."
```

---

# 6. Example Outputs

## Example 1

Input:

```
dependent packages: 20

vector:
AV:N
AC:H
PR:N
UI:R
```

Output:

```
Resolving these vulnerable packages protects 20 dependent packages from attacks that are exploitable over the network, requiring no privileges, requiring user interaction, and requiring specific conditions to exploit.
```

---

## Example 2

Vector:

```
AV:N
AC:L
PR:N
UI:N
```

Output:

```
Resolving these vulnerable packages protects 20 dependent packages from attacks that are exploitable over the network, requiring no privileges, without user interaction, and relatively easy to exploit.
```

This represents **a highly dangerous vulnerability**.

---

## Example 3

Vector:

```
AV:A
AC:L
PR:L
UI:N
```

Output:

```
Resolving these vulnerable packages protects 20 dependent packages from attacks that are exploitable by systems on the same network, requiring a low-privilege account, without user interaction, and relatively easy to exploit.
```

---

## Example 4

Vector:

```
AV:L
AC:L
PR:L
UI:R
```

Output:

```
Resolving these vulnerable packages protects 20 dependent packages from attacks that are exploitable by a local system user, requiring a low-privilege account, requiring user interaction, and relatively easy to exploit.
```

---

# 7. Compact UI Version (Optional)

For dashboards or badges:

```
Fix these packages → protect {dep_count} dependencies
```

Or:

```
These vulnerabilities impact {dep_count} packages
```

---

# 8. CVSS v3.1 Base Metrics Legend

These metrics describe **how a vulnerability can be exploited**.

---

## Attack Vector (AV)

| Code | Meaning  | Developer Interpretation                   |
| ---- | -------- | ------------------------------------------ |
| N    | Network  | exploitable over the internet              |
| A    | Adjacent | attacker must be on the same network       |
| L    | Local    | attacker must already have local access    |
| P    | Physical | attacker must physically access the device |

---

## Attack Complexity (AC)

| Code | Meaning | Developer Interpretation    |
| ---- | ------- | --------------------------- |
| L    | Low     | easy to exploit             |
| H    | High    | special conditions required |

---

## Privileges Required (PR)

| Code | Meaning |
| ---- | ------- |
| N    | None    |
| L    | Low     |
| H    | High    |

This indicates whether an attacker must **already have authentication or permissions**.

---

## User Interaction (UI)

| Code | Meaning  |
| ---- | -------- |
| N    | None     |
| R    | Required |

If required, exploitation typically depends on **user actions like clicking links or opening files**.

---

# 9. Why This Messaging Works

Developers understand risk better when vulnerabilities are explained in terms of:

* **Remote vs local attack paths**
* **Authentication requirements**
* **User interaction**
* **Exploit complexity**

CVSS-based copy converts abstract scores into **realistic attack scenarios**, helping teams prioritize fixes more effectively.

---

```
```
