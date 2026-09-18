from typing import Any, Dict, List, Optional
from typing_extensions import TypedDict


class AgentState(TypedDict, total=False):
    # Event metadata
    event_id: Optional[str]
    event_type: Optional[str]
    payload: Dict[str, Any]

    # Context
    trip_id: Optional[str]
    current_itinerary: List[Dict[str, Any]]
    constraints: Dict[str, Any]

    # Search
    search_results: List[Dict[str, Any]]

    # Planning
    proposed_changes: Dict[str, Any]
    reasoning_summary: Optional[str]

    # Validation & finalization
    validation_result: Dict[str, Any]
    status: Optional[str]
