from typing import Any, Dict, List, Tuple


def validate_agent_plan(
    proposed_changes: Dict[str, Any],
    constraints: Dict[str, Any],
) -> Tuple[bool, List[str]]:
    """
    Deterministic rule engine that validates a proposed itinerary change.
    Returns (is_valid, list_of_errors).
    """
    errors: List[str] = []

    if not proposed_changes:
        errors.append("proposed_changes is empty.")
        return False, errors

    replace = proposed_changes.get("replace")
    if not replace:
        errors.append("proposed_changes must contain a 'replace' key.")
        return False, errors

    old_item = replace.get("old", "")
    new_item = replace.get("new", "")

    if old_item == new_item:
        errors.append("Proposed replacement is the same as the current item.")

    max_extra_cost = constraints.get("max_extra_cost", 50)
    new_cost = proposed_changes.get("new_cost", 0)
    if new_cost > max_extra_cost:
        errors.append(
            f"New cost {new_cost} exceeds max allowed extra cost {max_extra_cost}."
        )

    is_valid = len(errors) == 0
    return is_valid, errors
