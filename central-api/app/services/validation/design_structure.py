"""Group D — design.md structural checks."""
import re

from .models import CheckResult, CheckStatus


def _extract_module_map(text: str) -> list[dict]:
    modules = []
    in_table = False
    for line in text.splitlines():
        if "module map" in line.lower():
            in_table = True
            continue
        if in_table:
            if line.startswith("|") and "---" not in line:
                cells = [c.strip() for c in line.strip("|").split("|")]
                if len(cells) >= 2 and cells[0].strip().isdigit():
                    modules.append({
                        "title": cells[1].strip(),
                        "duration": cells[2].strip() if len(cells) > 2 else "",
                    })
            elif in_table and not line.startswith("|") and line.strip():
                break
    return modules


def run_checks(design_text: str | None, policy: dict, spec_data: dict | None = None) -> list[CheckResult]:
    results = []

    if not design_text:
        results.append(CheckResult(
            check_id="D-01", group="D", status=CheckStatus.FAIL,
            message="design.md not found",
            field="publishing-house/spec/design.md",
        ))
        return results

    # D-01: H1 title is not a placeholder
    first_line = design_text.split("\n")[0].strip()
    if not first_line.startswith("# "):
        results.append(CheckResult(
            check_id="D-01", group="D", status=CheckStatus.FAIL,
            message="design.md missing H1 title (first line must start with '# ')",
            field="publishing-house/spec/design.md",
        ))
    elif "[Project Title]" in first_line or (first_line.startswith("# [") and "]" in first_line):
        results.append(CheckResult(
            check_id="D-01", group="D", status=CheckStatus.FAIL,
            message="H1 title is still a placeholder — replace with actual project name",
            field="publishing-house/spec/design.md",
        ))
    else:
        results.append(CheckResult(
            check_id="D-01", group="D", status=CheckStatus.PASS,
            message="H1 title present",
            field="publishing-house/spec/design.md",
        ))

    # D-02: All required sections present (with conditional logic for some)
    required_sections = policy.get("required_design_sections", [])
    conditional_sections = policy.get("conditional_required_sections", [])
    headings = [m.group(1).strip().lower() for m in re.finditer(r"^#{2,3}\s+(.+)$", design_text, re.MULTILINE)]

    # Get project metadata for conditional checks
    content_type = spec_data.get("project", {}).get("content_type", "") if spec_data else ""
    showroom_type = spec_data.get("project", {}).get("showroom_type", "") if spec_data else ""

    missing = []
    total_expected = 0

    for section in required_sections:
        has_section = any(section.lower() in h for h in headings)

        # Check if this section has conditional requirements
        if section.lower() in [s.lower() for s in conditional_sections]:
            # Apply conditional logic
            # Assessment strategy is optional for demos or classic labs
            if section.lower() == "assessment strategy":
                is_optional = (
                    content_type == "demo" or
                    (content_type == "lab" and showroom_type == "classic")
                )
                if not is_optional:
                    total_expected += 1
                    if not has_section:
                        missing.append(section)
        else:
            # Unconditionally required
            total_expected += 1
            if not has_section:
                missing.append(section)

    if missing:
        results.append(CheckResult(
            check_id="D-02", group="D", status=CheckStatus.FAIL,
            message=f"Missing required sections: {', '.join(missing)}",
            field="publishing-house/spec/design.md",
        ))
    else:
        results.append(CheckResult(
            check_id="D-02", group="D", status=CheckStatus.PASS,
            message=f"All {total_expected} required sections present",
            field="publishing-house/spec/design.md",
        ))

    # D-03: No unfilled template placeholders
    clean = re.sub(r"<!--.*?-->", "", design_text, flags=re.DOTALL)
    ph_pattern = re.compile(
        r"\[(?:Project Title|XX\s*min|Module title|Action verb|"
        r"Official Red Hat|PLACEHOLDER|TODO|REPLACE_ME|TBD|"
        r"specific,?\s*measurable)[^\]]*\]",
        re.IGNORECASE,
    )
    found = ph_pattern.findall(clean)
    if found:
        results.append(CheckResult(
            check_id="D-03", group="D", status=CheckStatus.FAIL,
            message=f"Unfilled placeholders: {', '.join(found[:3])}",
            field="publishing-house/spec/design.md",
        ))
    else:
        results.append(CheckResult(
            check_id="D-03", group="D", status=CheckStatus.PASS,
            message="No unfilled placeholders",
            field="publishing-house/spec/design.md",
        ))

    # D-04: Learning objectives use valid action verbs
    valid_verbs = [v.lower() for v in policy.get("action_verbs_valid", [])]
    rejected_verbs = [v.lower() for v in policy.get("action_verbs_rejected", [])]

    obj_section = ""
    in_obj = False
    for line in design_text.splitlines():
        heading_match = re.match(r"^#{2,3}\s+(.+)$", line)
        if heading_match and "learning objectives" in heading_match.group(1).lower():
            in_obj = True
            continue
        if in_obj:
            if heading_match:
                break
            obj_section += line + "\n"

    bad_verbs = []
    if obj_section:
        for line in obj_section.splitlines():
            line = line.strip().lstrip("-*").strip()
            if not line:
                continue
            first_word = line.split()[0].lower().rstrip(".,:")
            if first_word in rejected_verbs:
                bad_verbs.append(first_word)

    if bad_verbs:
        results.append(CheckResult(
            check_id="D-04", group="D", status=CheckStatus.FAIL,
            message=f"Rejected action verbs in objectives: {', '.join(set(bad_verbs))}. Use: {', '.join(valid_verbs[:5])}...",
            field="publishing-house/spec/design.md",
        ))
    else:
        results.append(CheckResult(
            check_id="D-04", group="D", status=CheckStatus.PASS,
            message="Learning objectives use valid action verbs",
            field="publishing-house/spec/design.md",
        ))

    # D-05: Module Map table exists with at least one row
    module_map = _extract_module_map(design_text)
    if not module_map:
        results.append(CheckResult(
            check_id="D-05", group="D", status=CheckStatus.FAIL,
            message="Module Map table missing or empty in design.md",
            field="publishing-house/spec/design.md",
        ))
    else:
        results.append(CheckResult(
            check_id="D-05", group="D", status=CheckStatus.PASS,
            message=f"Module Map has {len(module_map)} module(s)",
            field="publishing-house/spec/design.md",
        ))

    # D-06: Module durations are in 10-30 min range
    if module_map:
        out_of_range = []
        for mod in module_map:
            m = re.search(r"(\d+)\s*(min|hour|hr)", mod.get("duration", "").lower())
            if m:
                val = int(m.group(1))
                minutes = val if "min" in m.group(2) else val * 60
                if minutes < 10 or minutes > 60:
                    out_of_range.append(f"{mod['title']} ({minutes}min)")
        if out_of_range:
            results.append(CheckResult(
                check_id="D-06", group="D", status=CheckStatus.WARN,
                message=f"Module durations outside 10-60min: {', '.join(out_of_range[:3])}",
                field="publishing-house/spec/design.md",
            ))
        else:
            results.append(CheckResult(
                check_id="D-06", group="D", status=CheckStatus.PASS,
                message="Module durations within expected range",
                field="publishing-house/spec/design.md",
            ))

    return results
