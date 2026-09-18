"""Group A — Required spec.yaml field checks."""
from .models import CheckResult, CheckStatus


def run_checks(spec_data: dict, policy: dict) -> list[CheckResult]:
    results = []
    project = spec_data.get("project", {})
    spec = spec_data.get("spec", {})
    env = spec.get("environment", {})
    platform = env.get("platform", "")

    required = [
        ("A-01", "spec.title", spec.get("title")),
        ("A-02", "project.slug", project.get("slug")),
        ("A-03", "project.content_type", project.get("content_type")),
        ("A-04", "spec.audience", spec.get("audience")),
        ("A-05", "spec.modules", spec.get("modules")),
        ("A-06", "spec.learning_objectives", spec.get("learning_objectives")),
        ("A-07", "spec.environment.topology", env.get("topology")),
        ("A-09", "spec.environment.cloud_provider", env.get("cloud_provider")),
    ]

    for check_id, field, value in required:
        if value is None or value == "" or value == []:
            results.append(CheckResult(
                check_id=check_id, group="A", status=CheckStatus.FAIL,
                message=f"{field} is required but missing or empty",
                field=field,
            ))
        else:
            results.append(CheckResult(
                check_id=check_id, group="A", status=CheckStatus.PASS,
                message=f"{field} is set",
                field=field,
            ))

    # A-08: ocp_version — only required when platform = ocp
    ocp_version = env.get("ocp_version", "")
    minimum = policy.get("ocp_version_minimum", "4.20")
    if platform == "rhel-vms" or not ocp_version:
        results.append(CheckResult(
            check_id="A-08", group="A", status=CheckStatus.SKIP,
            message="ocp_version not required for this platform",
            field="spec.environment.ocp_version",
        ))
    else:
        try:
            current = [int(x) for x in str(ocp_version).split(".")]
            min_ver = [int(x) for x in minimum.split(".")]
            if current < min_ver:
                results.append(CheckResult(
                    check_id="A-08", group="A", status=CheckStatus.FAIL,
                    message=f"OCP {ocp_version} is below minimum {minimum}",
                    field="spec.environment.ocp_version",
                ))
            else:
                results.append(CheckResult(
                    check_id="A-08", group="A", status=CheckStatus.PASS,
                    message=f"ocp_version {ocp_version} meets minimum {minimum}",
                    field="spec.environment.ocp_version",
                ))
        except ValueError:
            results.append(CheckResult(
                check_id="A-08", group="A", status=CheckStatus.FAIL,
                message=f"ocp_version '{ocp_version}' is not a valid version number",
                field="spec.environment.ocp_version",
            ))

    # A-10: cluster_type — only required when platform = ocp
    cluster_type = env.get("cluster_type", "")
    valid_cluster_types = policy.get("valid_cluster_types", ["sno", "multinode"])
    if platform == "rhel-vms":
        results.append(CheckResult(
            check_id="A-10", group="A", status=CheckStatus.SKIP,
            message="cluster_type not required for rhel-vms platform",
            field="spec.environment.cluster_type",
        ))
    elif not cluster_type:
        results.append(CheckResult(
            check_id="A-10", group="A", status=CheckStatus.FAIL,
            message="spec.environment.cluster_type is required for OCP labs",
            field="spec.environment.cluster_type",
        ))
    elif cluster_type not in valid_cluster_types:
        results.append(CheckResult(
            check_id="A-10", group="A", status=CheckStatus.FAIL,
            message=f"cluster_type '{cluster_type}' not in allowed list: {valid_cluster_types}",
            field="spec.environment.cluster_type",
        ))
    else:
        results.append(CheckResult(
            check_id="A-10", group="A", status=CheckStatus.PASS,
            message=f"cluster_type is set to {cluster_type}",
            field="spec.environment.cluster_type",
        ))

    # A-11: platform — must be set and valid
    valid_platforms = policy.get("valid_platforms", ["ocp", "rhel-vms"])
    if not platform:
        results.append(CheckResult(
            check_id="A-11", group="A", status=CheckStatus.FAIL,
            message=f"spec.environment.platform is required ({', '.join(valid_platforms)})",
            field="spec.environment.platform",
        ))
    elif platform not in valid_platforms:
        results.append(CheckResult(
            check_id="A-11", group="A", status=CheckStatus.FAIL,
            message=f"platform '{platform}' not in allowed list: {valid_platforms}",
            field="spec.environment.platform",
        ))
    else:
        results.append(CheckResult(
            check_id="A-11", group="A", status=CheckStatus.PASS,
            message=f"platform is set to {platform}",
            field="spec.environment.platform",
        ))

    return results
