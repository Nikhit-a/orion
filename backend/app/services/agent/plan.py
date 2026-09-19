"""Turn disruption context + search results (and optional LLM text) into a structured plan."""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional, Tuple


def extract_json_object(text: str) -> Optional[Dict[str, Any]]:
    """Parse a JSON object from raw LLM output, including fenced markdown."""
    if not text:
        return None
    stripped = text.strip()
    fenced = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", stripped, re.DOTALL)
    if fenced:
        stripped = fenced.group(1)
    else:
        start = stripped.find("{")
        end = stripped.rfind("}")
        if start >= 0 and end > start:
            stripped = stripped[start : end + 1]
    try:
        data = json.loads(stripped)
    except json.JSONDecodeError:
        return None
    return data if isinstance(data, dict) else None


def _norm(value: Any) -> str:
    return str(value or "").strip().lower()


def _find_itinerary_item(
    itinerary: List[Dict[str, Any]],
    name: Optional[str],
) -> Optional[Dict[str, Any]]:
    if name:
        needle = _norm(name)
        for item in itinerary:
            if needle and needle in _norm(item.get("name")):
                return item
            if needle and needle == _norm(item.get("component_id")):
                return item
    planned = [i for i in itinerary if str(i.get("status", "PLANNED")).upper() == "PLANNED"]
    return planned[0] if planned else (itinerary[0] if itinerary else None)


def _find_alternative(
    search_results: List[Dict[str, Any]],
    old_item: Optional[Dict[str, Any]],
    requested_name: Optional[str],
) -> Optional[Dict[str, Any]]:
    old_id = str(old_item.get("component_id")) if old_item else None
    old_name = _norm(old_item.get("name") if old_item else "")
    if requested_name:
        needle = _norm(requested_name)
        for result in search_results:
            if needle in _norm(result.get("name")) and str(result.get("id")) != old_id:
                return result
    for result in search_results:
        if str(result.get("id")) != old_id and _norm(result.get("name")) != old_name:
            return result
    return search_results[0] if search_results else None


def _cost_delta(old_item: Optional[Dict[str, Any]], new_item: Optional[Dict[str, Any]], parsed_cost: Any) -> float:
    if parsed_cost is not None:
        try:
            return float(parsed_cost)
        except (TypeError, ValueError):
            pass
    old_price = float(old_item.get("price") or 0) if old_item else 0.0
    new_price = float(new_item.get("price") or 0) if new_item else 0.0
    return round(new_price - old_price, 2)


def build_resolution_plan(
    itinerary: List[Dict[str, Any]],
    search_results: List[Dict[str, Any]],
    payload: Dict[str, Any],
    llm_content: Optional[str] = None,
) -> Tuple[Dict[str, Any], str]:
    """
    Returns (proposed_changes, reasoning_summary).

    proposed_changes always includes:
      replace.old / replace.new (names)
      replace.old_item_id / replace.new_component_id
      new_cost (extra cost vs the replaced item)
    """
    parsed = extract_json_object(llm_content or "") or {}
    replace = parsed.get("replace") if isinstance(parsed.get("replace"), dict) else {}

    disrupted_hint = (
        replace.get("old")
        or payload.get("attraction")
        or payload.get("activity")
        or payload.get("guide")
    )
    old_item = _find_itinerary_item(itinerary, disrupted_hint)
    new_item = _find_alternative(search_results, old_item, replace.get("new"))

    if not old_item or not new_item:
        return {}, "No viable replacement found for the disrupted itinerary item."

    new_cost = _cost_delta(old_item, new_item, parsed.get("new_cost"))
    old_name = old_item.get("name") or disrupted_hint or "Affected item"
    new_name = new_item.get("name") or "Alternative"

    proposed = {
        "replace": {
            "old": old_name,
            "new": new_name,
            "old_item_id": old_item.get("item_id"),
            "new_component_id": new_item.get("id"),
            "component_type": old_item.get("component_type") or new_item.get("type") or "ACTIVITY",
        },
        "new_cost": new_cost,
        "new_price": float(new_item.get("price") or 0),
    }
    summary = parsed.get("reasoning_summary") or (
        f"Replacing {old_name} with {new_name} (cost delta {new_cost:+.2f})."
    )
    return proposed, str(summary)
