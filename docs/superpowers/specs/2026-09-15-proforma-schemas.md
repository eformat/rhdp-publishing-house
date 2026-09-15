# ProForma Form Schemas

**Date:** 2026-09-15  
**Status:** Implementation Spec  
**Purpose:** Define ProForma form structures for Jira epic attachments

---

## Overview

ProForma is a Jira add-on that allows attaching editable forms to issues. We use it to create structured, editable onboarding forms on epic issues during pre-intake.

**REST API Base:** `/rest/api/1/form`

**Key Operations:**
- Create form on issue
- Read form data
- Update form data (implicitly via Jira UI edits)

---

## Onboarded ProForma Form Schema

### Form Definition

```json
{
  "name": "publishing-house-onboarded-preintake",
  "description": "Publishing House Pre-Intake Form - Onboarded Content",
  "version": 1,
  "sections": [
    {
      "id": "content-details",
      "name": "Content Details",
      "description": "Core content definition",
      "questions": [
        {
          "id": "asset_title",
          "type": "text",
          "label": "Asset Title",
          "description": "Name for your lab/demo",
          "required": true,
          "maxLength": 100
        },
        {
          "id": "project_description",
          "type": "textarea",
          "label": "Description / Abstract",
          "description": "What is this asset and why is it needed? High-level but clear.",
          "required": true,
          "rows": 4
        },
        {
          "id": "content_outline",
          "type": "textarea",
          "label": "Content Outline",
          "description": "Rough outline of the modules or sections. Doesn't need to be final — just show the shape of what you're building.",
          "required": true,
          "rows": 8
        },
        {
          "id": "learning_objectives",
          "type": "textarea",
          "label": "Learning Objectives",
          "description": "What will participants learn or be able to do? Draft quality is fine.",
          "required": false,
          "rows": 6
        },
        {
          "id": "content_type",
          "type": "select",
          "label": "Lab or Demo?",
          "description": "Choose the content format",
          "required": true,
          "options": [
            {"value": "lab", "label": "Lab"},
            {"value": "demo", "label": "Demo"}
          ],
          "defaultValue": "lab"
        }
      ]
    },
    {
      "id": "business-context",
      "name": "Business Context",
      "description": "Marketing and sales alignment",
      "questions": [
        {
          "id": "associated_opportunities",
          "type": "textarea",
          "label": "Associated Opportunities",
          "description": "Is this associated with any specific opportunities, projects, or marketing campaigns? N/A is acceptable.",
          "required": false,
          "rows": 3
        },
        {
          "id": "sales_play_tdp",
          "type": "textarea",
          "label": "Sales Play / TDP Relevance",
          "description": "Which TDP, Sales Play, and/or Sales Tactic is this most relevant to?",
          "required": false,
          "rows": 3
        },
        {
          "id": "ai_related",
          "type": "checkbox",
          "label": "Is this related to AI?",
          "description": "Check if this content involves AI/ML technologies",
          "required": false,
          "defaultValue": false
        },
        {
          "id": "gpu_needed",
          "type": "checkbox",
          "label": "Do you need direct GPU access?",
          "description": "Check if GPU hardware is required",
          "required": false,
          "defaultValue": false,
          "condition": {
            "field": "ai_related",
            "value": true
          }
        },
        {
          "id": "maas_instead",
          "type": "checkbox",
          "label": "Can you use MaaS instead?",
          "description": "Check if Model-as-a-Service can substitute for GPU",
          "required": false,
          "defaultValue": false,
          "condition": {
            "field": "ai_related",
            "value": true,
            "and": {
              "field": "gpu_needed",
              "value": false
            }
          }
        },
        {
          "id": "partners_access",
          "type": "checkbox",
          "label": "Should it be available to Partners?",
          "description": "Check if this content should be accessible to Red Hat partners",
          "required": false,
          "defaultValue": false
        }
      ]
    },
    {
      "id": "environment",
      "name": "Environment Configuration",
      "description": "Infrastructure requirements",
      "questions": [
        {
          "id": "cloud_provider",
          "type": "select",
          "label": "Cloud Provider",
          "description": "Where will this run?",
          "required": false,
          "options": [
            {"value": "cnv", "label": "CNV (Default)"},
            {"value": "aws", "label": "AWS"},
            {"value": "azure", "label": "Azure"}
          ],
          "defaultValue": "cnv"
        },
        {
          "id": "cluster_type",
          "type": "select",
          "label": "Cluster Type",
          "description": "SNO or Multinode?",
          "required": false,
          "options": [
            {"value": "sno", "label": "SNO (Single Node)"},
            {"value": "multinode", "label": "Multinode"}
          ],
          "defaultValue": "sno"
        },
        {
          "id": "ocp_version",
          "type": "select",
          "label": "OCP Version",
          "description": "Minimum OpenShift version",
          "required": false,
          "options": [
            {"value": "4.20", "label": "4.20"},
            {"value": "4.21", "label": "4.21"},
            {"value": "4.22", "label": "4.22"}
          ],
          "defaultValue": "4.21"
        }
      ]
    },
    {
      "id": "technical",
      "name": "Technical Details",
      "description": "Automation and delivery",
      "questions": [
        {
          "id": "automation_type",
          "type": "select",
          "label": "Automation Type",
          "description": "How will you automate environment setup?",
          "required": true,
          "options": [
            {"value": "ansible", "label": "Ansible"},
            {"value": "gitops", "label": "GitOps"},
            {"value": "both", "label": "Both (Ansible + GitOps)"}
          ],
          "defaultValue": "ansible"
        },
        {
          "id": "showroom_type",
          "type": "select",
          "label": "Showroom Type",
          "description": "Classic or Zero Touch?",
          "required": true,
          "options": [
            {"value": "classic", "label": "Classic (standard Showroom)"},
            {"value": "zero_touch", "label": "Zero Touch (embedded automation)"}
          ],
          "defaultValue": "classic"
        },
        {
          "id": "initiative_key",
          "type": "select",
          "label": "Initiative",
          "description": "Which initiative is this content for?",
          "required": true,
          "options": [
            {"value": "rh1_2027", "label": "RH1 2027"},
            {"value": "summit_2027", "label": "Summit 2027"},
            {"value": "none", "label": "None"}
          ],
          "defaultValue": "rh1_2027"
        },
        {
          "id": "tags",
          "type": "text",
          "label": "Tags",
          "description": "Comma-separated tags (e.g., openshift,ai,workshop)",
          "required": false,
          "maxLength": 200
        }
      ]
    }
  ]
}
```

---

## Field Source ProForma Form Schema

### Form Definition

```json
{
  "name": "publishing-house-field-source-preintake",
  "description": "Publishing House Pre-Intake Form - Field Source Content",
  "version": 1,
  "sections": [
    {
      "id": "content-details",
      "name": "Your Project",
      "questions": [
        {
          "id": "asset_title",
          "type": "text",
          "label": "Asset Title",
          "description": "Name for your lab/demo",
          "required": true,
          "maxLength": 100
        },
        {
          "id": "description",
          "type": "textarea",
          "label": "Description",
          "description": "What is this asset and why is it needed?",
          "required": true,
          "rows": 4
        },
        {
          "id": "content_outline",
          "type": "textarea",
          "label": "Content Outline",
          "description": "Rough outline of the modules or sections",
          "required": true,
          "rows": 8
        },
        {
          "id": "learning_objectives",
          "type": "textarea",
          "label": "Learning Objectives",
          "description": "What will participants learn?",
          "required": false,
          "rows": 6
        },
        {
          "id": "content_type",
          "type": "select",
          "label": "Lab or Demo?",
          "required": true,
          "options": [
            {"value": "lab", "label": "Lab"},
            {"value": "demo", "label": "Demo"}
          ],
          "defaultValue": "lab"
        },
        {
          "id": "sales_play_tdp",
          "type": "textarea",
          "label": "Sales Play / TDP",
          "description": "Relevant sales play or technical decision point",
          "required": false,
          "rows": 2
        }
      ]
    },
    {
      "id": "environment",
      "name": "Environment Configuration",
      "questions": [
        {
          "id": "cloud_provider",
          "type": "select",
          "label": "Cloud Provider",
          "required": true,
          "options": [
            {"value": "cnv", "label": "CNV"},
            {"value": "aws", "label": "AWS"},
            {"value": "azure", "label": "Azure"}
          ],
          "defaultValue": "cnv"
        },
        {
          "id": "cloud_provider_justification",
          "type": "textarea",
          "label": "Cloud Provider Justification",
          "description": "Required if not CNV",
          "required": false,
          "rows": 3,
          "condition": {
            "field": "cloud_provider",
            "value": "cnv",
            "operator": "not_equals"
          }
        },
        {
          "id": "cluster_type",
          "type": "select",
          "label": "Cluster Type",
          "required": true,
          "options": [
            {"value": "sno", "label": "SNO"},
            {"value": "multinode", "label": "Multinode"}
          ],
          "defaultValue": "sno"
        },
        {
          "id": "ocp_version",
          "type": "select",
          "label": "OCP Version",
          "required": true,
          "options": [
            {"value": "4.20", "label": "4.20"},
            {"value": "4.21", "label": "4.21"},
            {"value": "4.22", "label": "4.22"}
          ],
          "defaultValue": "4.21"
        },
        {
          "id": "worker_count",
          "type": "number",
          "label": "Worker Count",
          "description": "Number of worker nodes (if multinode)",
          "required": false,
          "min": 2,
          "max": 10,
          "condition": {
            "field": "cluster_type",
            "value": "multinode"
          }
        },
        {
          "id": "worker_memory_gb",
          "type": "select",
          "label": "Worker Memory (GB)",
          "required": false,
          "options": [
            {"value": "32", "label": "32 GB"},
            {"value": "64", "label": "64 GB"},
            {"value": "128", "label": "128 GB"}
          ],
          "defaultValue": "64",
          "condition": {
            "field": "cluster_type",
            "value": "multinode"
          }
        },
        {
          "id": "worker_cpu",
          "type": "select",
          "label": "Worker CPU",
          "required": false,
          "options": [
            {"value": "8", "label": "8 vCPU"},
            {"value": "16", "label": "16 vCPU"},
            {"value": "32", "label": "32 vCPU"}
          ],
          "defaultValue": "16",
          "condition": {
            "field": "cluster_type",
            "value": "multinode"
          }
        },
        {
          "id": "base_workloads",
          "type": "multiselect",
          "label": "Base Workloads",
          "description": "Select required base workloads",
          "required": false,
          "options": [
            {"value": "virt", "label": "OpenShift Virtualization"},
            {"value": "ai", "label": "OpenShift AI"},
            {"value": "aap", "label": "Ansible Automation Platform"}
          ]
        },
        {
          "id": "multi_user",
          "type": "checkbox",
          "label": "Multi-user?",
          "description": "Support multiple concurrent users",
          "required": false,
          "defaultValue": false
        },
        {
          "id": "user_count",
          "type": "number",
          "label": "User Count",
          "description": "Number of concurrent users (1-50)",
          "required": false,
          "min": 1,
          "max": 50,
          "condition": {
            "field": "multi_user",
            "value": true
          }
        },
        {
          "id": "ai_related",
          "type": "checkbox",
          "label": "AI-related?",
          "required": false,
          "defaultValue": false
        },
        {
          "id": "gpu_needed",
          "type": "checkbox",
          "label": "Need GPU?",
          "required": false,
          "defaultValue": false,
          "condition": {
            "field": "ai_related",
            "value": true
          }
        },
        {
          "id": "maas_instead",
          "type": "checkbox",
          "label": "Use MaaS instead?",
          "required": false,
          "defaultValue": false,
          "condition": {
            "field": "ai_related",
            "value": true,
            "and": {
              "field": "gpu_needed",
              "value": false
            }
          }
        }
      ]
    },
    {
      "id": "automation",
      "name": "Automation",
      "questions": [
        {
          "id": "automation_location",
          "type": "select",
          "label": "Where will your automation live?",
          "description": "PH repo or your existing repo",
          "required": true,
          "options": [
            {"value": "ph_repo", "label": "PH Monorepo"},
            {"value": "existing_repo", "label": "Existing Repo"}
          ],
          "defaultValue": "ph_repo"
        },
        {
          "id": "existing_repo_url",
          "type": "text",
          "label": "Existing Repo URL",
          "description": "URL of your existing GitOps repo",
          "required": false,
          "maxLength": 200,
          "condition": {
            "field": "automation_location",
            "value": "existing_repo"
          }
        },
        {
          "id": "tags",
          "type": "text",
          "label": "Tags",
          "description": "Comma-separated tags",
          "required": false,
          "maxLength": 200
        }
      ]
    }
  ]
}
```

---

## ProForma REST API Usage

### Create Form on Epic

```python
POST /rest/api/1/form/{epic_key}
Content-Type: application/json
Authorization: Basic {base64(email:api_token)}

{
  "formName": "publishing-house-onboarded-preintake",
  "sections": [...],  # Full form definition
  "answers": {        # Pre-populate with template values
    "asset_title": "OpenShift AI Workshop",
    "project_description": "Hands-on lab...",
    "content_outline": "Module 1: Intro\nModule 2: Deploy...",
    "content_type": "lab",
    ...
  }
}
```

**Response:**
```json
{
  "formId": "12345",
  "issueKey": "RHDPCD-1234",
  "formName": "publishing-house-onboarded-preintake",
  "created": "2026-09-15T10:00:00Z"
}
```

### Read Form Data

```python
GET /rest/api/1/form/{epic_key}/{form_id}
Authorization: Basic {base64(email:api_token)}
```

**Response:**
```json
{
  "formId": "12345",
  "issueKey": "RHDPCD-1234",
  "formName": "publishing-house-onboarded-preintake",
  "answers": {
    "asset_title": "OpenShift AI Workshop - Updated",
    "project_description": "Hands-on lab...",
    "content_outline": "Module 1: Updated intro...",
    "content_type": "lab",
    "learning_objectives": "- Deploy AI workloads\n- Configure...",
    ...
  },
  "updated": "2026-09-15T14:30:00Z"
}
```

---

## Python Implementation

### Form Template Storage

```python
# Store form templates as Python dicts or JSON files
ONBOARDED_FORM_TEMPLATE = {
    "name": "publishing-house-onboarded-preintake",
    "description": "Publishing House Pre-Intake Form - Onboarded Content",
    "sections": [...]  # Full definition from above
}

FIELD_SOURCE_FORM_TEMPLATE = {
    "name": "publishing-house-field-source-preintake",
    "description": "Publishing House Pre-Intake Form - Field Source Content",
    "sections": [...]  # Full definition from above
}
```

### Create ProForma Form

```python
def _create_proforma_form(
    epic_key: str,
    epic_type: str,
    fields: dict,
    settings: Settings
) -> str:
    """Create ProForma form on epic, returns form_id."""
    
    # Select template
    if epic_type == "onboarded" or epic_type == "rhdp_published":
        template = ONBOARDED_FORM_TEMPLATE
        answers = _map_onboarded_fields_to_form(fields)
    elif epic_type == "field_source":
        template = FIELD_SOURCE_FORM_TEMPLATE
        answers = _map_field_source_fields_to_form(fields)
    else:
        raise ValueError(f"Unknown epic_type: {epic_type}")
    
    # Build request
    form_data = {
        "formName": template["name"],
        "sections": template["sections"],
        "answers": answers
    }
    
    # POST to ProForma API
    url = f"{settings.jira_url}/rest/api/1/form/{epic_key}"
    headers = _jira_headers(settings)
    headers["Content-Type"] = "application/json"
    
    req = urllib.request.Request(
        url,
        data=json.dumps(form_data).encode(),
        headers=headers,
        method="POST"
    )
    
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            response = json.loads(r.read().decode())
            return response["formId"]
    except Exception as e:
        logger.warning("ProForma form creation failed: %s", e)
        return ""  # Fallback - epic description only
```

### Read ProForma Form

```python
def _read_proforma_form(
    epic_key: str,
    form_id: str,
    settings: Settings
) -> dict:
    """Read current form values from ProForma."""
    
    url = f"{settings.jira_url}/rest/api/1/form/{epic_key}/{form_id}"
    headers = _jira_headers(settings)
    
    req = urllib.request.Request(url, headers=headers)
    
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            response = json.loads(r.read().decode())
            return response.get("answers", {})
    except Exception as e:
        logger.warning("ProForma form read failed: %s", e)
        return {}
```

### Field Mapping

```python
def _map_onboarded_fields_to_form(fields: dict) -> dict:
    """Map workflow fields to ProForma form answers."""
    return {
        "asset_title": fields.get("assetTitle", ""),
        "project_description": fields.get("projectDescription", ""),
        "content_outline": fields.get("contentOutline", ""),
        "learning_objectives": fields.get("learningObjectives", ""),
        "content_type": fields.get("contentType", "lab"),
        "associated_opportunities": fields.get("associatedOpportunities", ""),
        "sales_play_tdp": fields.get("salesPlayTdp", ""),
        "ai_related": fields.get("aiRelated", False),
        "gpu_needed": fields.get("gpuNeeded", False),
        "maas_instead": fields.get("maasInstead", False),
        "partners_access": fields.get("partnersAccess", False),
        "cloud_provider": fields.get("cloudProvider", "cnv"),
        "cluster_type": fields.get("clusterType", "sno"),
        "ocp_version": fields.get("ocpVersion", "4.21"),
        "automation_type": fields.get("automationType", "ansible"),
        "showroom_type": fields.get("showroomType", "classic"),
        "initiative_key": fields.get("initiativeKey", "rh1_2027"),
        "tags": ",".join(fields.get("tags", [])),
    }
```

---

## Fallback Strategy

If ProForma API fails or is not available:

```python
form_id = ""
try:
    form_id = _create_proforma_form(epic_key, epic_type, fields, settings)
except Exception as e:
    logger.warning("ProForma not available, using epic description only: %s", e)

# Always create epic description as primary source
description = _build_epic_description(epic_type, fields)

# Store form_id in workflow (empty string if ProForma failed)
return {
    "epic_key": epic_key,
    "jira_url": jira_url,
    "proforma_form_id": form_id
}
```

On UpdateEpic, check if form_id exists:
```python
if proforma_form_id:
    answers = _read_proforma_form(epic_key, proforma_form_id, settings)
    # Use ProForma answers
else:
    # Use workflow data directly (no form edits possible)
    answers = workflow_data
```

---

**Status:** Ready for implementation
