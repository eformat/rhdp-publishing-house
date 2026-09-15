# Epic Description Schemas

**Date:** 2026-09-15  
**Status:** Implementation Spec  
**Purpose:** Define Jira ADF (Atlassian Document Format) schemas for epic descriptions

---

## Overview

Epic descriptions are formatted as rich Jira ADF documents with structured sections. Each epic type (onboarded, field_source) has its own formatter function that builds the description from template fields.

---

## Onboarded Epic Description Schema

### Sections

1. **Header** - Asset title as H1
2. **Overview** - Description paragraph
3. **Content Plan** - Type, showroom type, outline, objectives
4. **Environment Requirements** - Platform, cloud, cluster, versions
5. **Business Context** - Sales play, opportunities
6. **Team** - Owner and collaborators
7. **Technical Details** - Automation, AI, tags
8. **Footer** - Metadata

### Template

```markdown
# {Asset Title}

## Overview
{Project Description}

## Content Plan

**Type:** {Lab | Demo}  
**Showroom Type:** {Classic | Zero Touch}

### Content Outline
{Content Outline - multiline}

### Learning Objectives
{Learning Objectives - multiline or bullets}

## Environment Requirements

**Platform:** OpenShift  
**Cloud Provider:** {CNV | AWS | Azure}  
**Cluster Type:** {SNO | Multinode}  
**OCP Version:** {4.20 | 4.21 | 4.22}

## Business Context

**Sales Play / TDP:** {text or "N/A"}  
**Associated Opportunities:** {text or "N/A"}

## Team

**Owner:** {owner email}  
**Collaborators:**
- {GitHub username} ({email})
- {GitHub username} ({email})

## Technical Details

**Automation Type:** {Ansible | GitOps | Both}  
**AI Requirements:** {None | MaaS | GPU}  
**Initiative:** {RH1 2027 | Summit 2027 | None}  
**Tags:** {comma-separated}

---
*Created via Publishing House Template*
```

### Jira ADF Structure

```json
{
  "type": "doc",
  "version": 1,
  "content": [
    {
      "type": "heading",
      "attrs": {"level": 1},
      "content": [{"type": "text", "text": "{assetTitle}"}]
    },
    {
      "type": "heading",
      "attrs": {"level": 2},
      "content": [{"type": "text", "text": "Overview"}]
    },
    {
      "type": "paragraph",
      "content": [{"type": "text", "text": "{projectDescription}"}]
    },
    {
      "type": "heading",
      "attrs": {"level": 2},
      "content": [{"type": "text", "text": "Content Plan"}]
    },
    {
      "type": "paragraph",
      "content": [
        {"type": "text", "text": "Type: ", "marks": [{"type": "strong"}]},
        {"type": "text", "text": "{contentType}"},
        {"type": "hardBreak"},
        {"type": "text", "text": "Showroom Type: ", "marks": [{"type": "strong"}]},
        {"type": "text", "text": "{showroomType}"}
      ]
    },
    {
      "type": "heading",
      "attrs": {"level": 3},
      "content": [{"type": "text", "text": "Content Outline"}]
    },
    {
      "type": "paragraph",
      "content": [{"type": "text", "text": "{contentOutline}"}]
    },
    {
      "type": "heading",
      "attrs": {"level": 3},
      "content": [{"type": "text", "text": "Learning Objectives"}]
    },
    {
      "type": "paragraph",
      "content": [{"type": "text", "text": "{learningObjectives}"}]
    },
    {
      "type": "heading",
      "attrs": {"level": 2},
      "content": [{"type": "text", "text": "Environment Requirements"}]
    },
    {
      "type": "paragraph",
      "content": [
        {"type": "text", "text": "Platform: ", "marks": [{"type": "strong"}]},
        {"type": "text", "text": "OpenShift"},
        {"type": "hardBreak"},
        {"type": "text", "text": "Cloud Provider: ", "marks": [{"type": "strong"}]},
        {"type": "text", "text": "{cloudProvider}"},
        {"type": "hardBreak"},
        {"type": "text", "text": "Cluster Type: ", "marks": [{"type": "strong"}]},
        {"type": "text", "text": "{clusterType}"},
        {"type": "hardBreak"},
        {"type": "text", "text": "OCP Version: ", "marks": [{"type": "strong"}]},
        {"type": "text", "text": "{ocpVersion}"}
      ]
    },
    {
      "type": "heading",
      "attrs": {"level": 2},
      "content": [{"type": "text", "text": "Business Context"}]
    },
    {
      "type": "paragraph",
      "content": [
        {"type": "text", "text": "Sales Play / TDP: ", "marks": [{"type": "strong"}]},
        {"type": "text", "text": "{salesPlayTdp}"},
        {"type": "hardBreak"},
        {"type": "text", "text": "Associated Opportunities: ", "marks": [{"type": "strong"}]},
        {"type": "text", "text": "{associatedOpportunities}"}
      ]
    },
    {
      "type": "heading",
      "attrs": {"level": 2},
      "content": [{"type": "text", "text": "Team"}]
    },
    {
      "type": "paragraph",
      "content": [
        {"type": "text", "text": "Owner: ", "marks": [{"type": "strong"}]},
        {"type": "text", "text": "{ssoEmail}"}
      ]
    },
    {
      "type": "paragraph",
      "content": [{"type": "text", "text": "Collaborators:", "marks": [{"type": "strong"}]}]
    },
    {
      "type": "bulletList",
      "content": [
        {
          "type": "listItem",
          "content": [{
            "type": "paragraph",
            "content": [{"type": "text", "text": "{user} ({email})"}]
          }]
        }
      ]
    },
    {
      "type": "heading",
      "attrs": {"level": 2},
      "content": [{"type": "text", "text": "Technical Details"}]
    },
    {
      "type": "paragraph",
      "content": [
        {"type": "text", "text": "Automation Type: ", "marks": [{"type": "strong"}]},
        {"type": "text", "text": "{automationType}"},
        {"type": "hardBreak"},
        {"type": "text", "text": "AI Requirements: ", "marks": [{"type": "strong"}]},
        {"type": "text", "text": "{aiRequirements}"},
        {"type": "hardBreak"},
        {"type": "text", "text": "Initiative: ", "marks": [{"type": "strong"}]},
        {"type": "text", "text": "{initiativeKey}"},
        {"type": "hardBreak"},
        {"type": "text", "text": "Tags: ", "marks": [{"type": "strong"}]},
        {"type": "text", "text": "{tags}"}
      ]
    },
    {
      "type": "rule"
    },
    {
      "type": "paragraph",
      "content": [
        {"type": "text", "text": "Created via Publishing House Template", "marks": [{"type": "em"}]}
      ]
    }
  ]
}
```

### Field Mapping

| Template Field | Epic Section | Required |
|----------------|--------------|----------|
| `assetTitle` | H1 heading | Yes |
| `projectDescription` | Overview paragraph | Yes |
| `contentType` | Content Plan → Type | Yes |
| `showroomType` | Content Plan → Showroom Type | Yes |
| `contentOutline` | Content Plan → Outline | Yes |
| `learningObjectives` | Content Plan → Objectives | No |
| `cloudProvider` | Environment → Cloud Provider | No (default CNV) |
| `clusterType` | Environment → Cluster Type | No |
| `ocpVersion` | Environment → OCP Version | No |
| `salesPlayTdp` | Business Context | No |
| `associatedOpportunities` | Business Context | No |
| `ssoEmail` | Team → Owner | Yes |
| `teamMembers` | Team → Collaborators | Yes |
| `automationType` | Technical Details | Yes |
| `aiRelated`, `gpuNeeded`, `maasInstead` | Technical Details → AI Requirements | No |
| `initiativeKey` | Technical Details → Initiative | Yes |
| `tags` | Technical Details → Tags | No |

### AI Requirements Logic

```python
def _format_ai_requirements(fields: dict) -> str:
    if not fields.get("aiRelated"):
        return "None"
    if fields.get("gpuNeeded"):
        return f"GPU ({fields.get('gpuType', 'unspecified')})"
    if fields.get("maasInstead"):
        return "MaaS"
    return "AI (unspecified)"
```

---

## Field Source Epic Description Schema

### Sections

1. **Header** - Asset title with [Field Source] badge
2. **Overview** - Description paragraph
3. **Content Plan** - Type, outline, objectives
4. **Environment Configuration** - Cloud, cluster, workers, base workloads
5. **Business Context** - Sales play
6. **Team** - Owner and collaborators
7. **Automation** - Where automation lives (PH repo or external)
8. **Footer** - Metadata

### Template

```markdown
🏷️ Field Source Content

# {Asset Title}

## Overview
{Description}

## Content Plan

**Type:** {Lab | Demo}

### Content Outline
{Content Outline}

### Learning Objectives
{Learning Objectives}

## Environment Configuration

**Cloud Provider:** {CNV | AWS | Azure} {+ justification if not CNV}  
**Cluster Type:** {SNO | Multinode}  
**OCP Version:** {4.20 | 4.21 | 4.22}  

{if multinode:}
**Workers:** {count} x {cpu} vCPU, {ram} GB RAM

**Base Workloads:**
{list of selected workloads}

**Multi-User:** {Yes/No}  
{if yes:} **User Count:** {count}

## Business Context

**Sales Play / TDP:** {text or "N/A"}

## Team

**Owner:** {owner email}  
**Collaborators:**
- {GitHub username} ({email})

## Automation

**Automation Location:** {PH Monorepo | External Repo}  
{if external:} **Repo URL:** {url}

**Tags:** {comma-separated}

---
*Field Source - Created via Publishing House Template*
```

### Jira ADF Structure

Similar to onboarded, but with:
- Badge/emoji at top: 🏷️ Field Source Content
- Different sections (no Initiative, different environment details)
- Automation location section

### Field Mapping

| Template Field | Epic Section | Required |
|----------------|--------------|----------|
| `assetTitle` | H1 heading | Yes |
| `description` | Overview | Yes |
| `contentType` | Content Plan → Type | Yes |
| `contentOutline` | Content Plan → Outline | Yes |
| `learningObjectives` | Content Plan → Objectives | No |
| `cloudProvider` | Environment → Cloud Provider | Yes |
| `cloudProviderJustification` | Environment (if not CNV) | Conditional |
| `clusterType` | Environment → Cluster Type | Yes |
| `ocpVersion` | Environment → OCP Version | Yes |
| `workerCount`, `workerCpu`, `workerRam` | Environment → Workers | Conditional |
| `baseWorkloads` | Environment → Base Workloads | No |
| `multiUser`, `userCount` | Environment | No |
| `salesPlayTdp` | Business Context | No |
| `teamMembers` | Team | Yes |
| `automationLocation` | Automation | Yes |
| `existingRepoUrl` | Automation (if BYO) | Conditional |
| `tags` | Tags | No |

---

## Python Implementation Hints

### Builder Helper

```python
def _build_adf_heading(level: int, text: str) -> dict:
    """Build ADF heading node."""
    return {
        "type": "heading",
        "attrs": {"level": level},
        "content": [{"type": "text", "text": text}]
    }

def _build_adf_paragraph(text: str, strong: bool = False) -> dict:
    """Build ADF paragraph node."""
    marks = [{"type": "strong"}] if strong else []
    return {
        "type": "paragraph",
        "content": [{"type": "text", "text": text, "marks": marks}]
    }

def _build_adf_key_value(key: str, value: str) -> dict:
    """Build ADF paragraph with 'Key: Value' pattern."""
    return {
        "type": "paragraph",
        "content": [
            {"type": "text", "text": f"{key}: ", "marks": [{"type": "strong"}]},
            {"type": "text", "text": value}
        ]
    }

def _build_adf_bullet_list(items: list[str]) -> dict:
    """Build ADF bullet list."""
    return {
        "type": "bulletList",
        "content": [
            {
                "type": "listItem",
                "content": [{
                    "type": "paragraph",
                    "content": [{"type": "text", "text": item}]
                }]
            }
            for item in items
        ]
    }
```

### Formatter Function

```python
def _format_onboarded_epic(fields: dict) -> tuple[str, dict]:
    """Build onboarded epic summary and description."""
    asset_title = fields.get("assetTitle", "Untitled")
    
    # Summary
    summary = f"[PH] {asset_title}"
    
    # Description ADF
    content = [
        _build_adf_heading(1, asset_title),
        _build_adf_heading(2, "Overview"),
        _build_adf_paragraph(fields.get("projectDescription", "")),
        _build_adf_heading(2, "Content Plan"),
        _build_adf_key_value("Type", fields.get("contentType", "lab")),
        # ... continue building sections
    ]
    
    description = {
        "type": "doc",
        "version": 1,
        "content": content
    }
    
    return summary, description
```

---

## Validation Rules

### Required Fields (Onboarded)

- `assetTitle`
- `projectDescription`
- `contentType`
- `contentOutline`
- `ssoEmail`
- `teamMembers` (at least one)
- `automationType`
- `initiativeKey`

### Required Fields (Field Source)

- `assetTitle`
- `description`
- `contentType`
- `contentOutline`
- `cloudProvider`
- `clusterType`
- `ocpVersion`
- `teamMembers` (at least one)
- `automationLocation`

### Conditional Fields

**If cloudProvider != "cnv":**
- `cloudProviderJustification` required

**If clusterType == "multinode":**
- `workerCount` required
- `workerCpu` required
- `workerRam` required

**If multiUser == true:**
- `userCount` required

**If automationLocation == "external":**
- `existingRepoUrl` required

---

**Status:** Ready for implementation
