import pytest
from app.services.agent.graph import agent_graph
from app.services.agent.validation import validate_agent_plan


def test_agent_graph_execution():
    """
    Runs the full LangGraph workflow end-to-end:
    retrieve_context -> search_alternatives -> plan_resolution ->
    validate_plan -> commit_action.

    Without an OPENAI_API_KEY configured, plan_resolution falls back to a
    deterministic mock plan, so this test exercises the whole graph
    (including a real DB read/write via commit_action) without hitting any
    external LLM API. Requires a Postgres instance reachable at
    settings.DATABASE_URL, same as the CI 'backend' job.
    """
    initial_state = {
        "event_id": "test-123",
        "event_type": "ATTRACTION_CLOSED",
        "payload": {"attraction": "Eiffel Tower", "reason": "Weather"},
    }

    result = agent_graph.invoke(initial_state)

    # The graph should reach its terminal commit_action node.
    assert result["status"] == "COMPLETED"

    # Context retrieval always populates these, even when falling back to
    # defaults because there's no active trip in the DB.
    assert "trip_id" in result
    assert "constraints" in result

    # A plan should always be proposed (falls back to a mock plan when no
    # OPENAI_API_KEY is set).
    assert "proposed_changes" in result
    assert "reasoning_summary" in result

    # Deterministic validation should have run and produced a structured result.
    assert "validation_result" in result
    assert "is_valid" in result["validation_result"]


def test_validate_agent_plan_rejects_self_replacement():
    """The deterministic validation layer should reject a no-op replacement."""
    proposed = {"replace": {"old": "Eiffel Tower", "new": "Eiffel Tower"}}
    constraints = {"preserve_budget": True, "max_extra_cost": 50}

    is_valid, errors = validate_agent_plan(proposed, constraints)

    assert is_valid is False
    assert any("itself" in e.lower() for e in errors)


def test_validate_agent_plan_rejects_over_budget():
    """The deterministic validation layer should reject a plan that exceeds the allowed extra cost."""
    proposed = {"replace": {"old": "A", "new": "B"}, "new_cost": 100}
    constraints = {"preserve_budget": True, "max_extra_cost": 50}

    is_valid, errors = validate_agent_plan(proposed, constraints)

    assert is_valid is False
    assert any("exceeds" in e.lower() for e in errors)


def test_validate_agent_plan_rejects_missing_replace_key():
    """A proposal without a 'replace' key is structurally invalid."""
    proposed = {"new_cost": 10}
    constraints = {"preserve_budget": True, "max_extra_cost": 50}

    is_valid, errors = validate_agent_plan(proposed, constraints)

    assert is_valid is False
    assert any("replace" in e.lower() for e in errors)


def test_validate_agent_plan_rejects_empty_proposal():
    is_valid, errors = validate_agent_plan({}, {"preserve_budget": True})

    assert is_valid is False
    assert len(errors) == 1


def test_validate_agent_plan_accepts_valid_plan():
    """A well-formed, within-budget, non-self replacement should pass."""
    proposed = {"replace": {"old": "A", "new": "B"}, "new_cost": 10}
    constraints = {"preserve_budget": True, "max_extra_cost": 50}

    is_valid, errors = validate_agent_plan(proposed, constraints)

    assert is_valid is True
    assert errors == []
