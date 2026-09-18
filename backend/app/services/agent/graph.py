from langgraph.graph import StateGraph, START, END
from app.services.agent.state import AgentState
from app.services.agent.nodes import (
    retrieve_context,
    search_alternatives,
    plan_resolution,
    validate_plan,
    commit_action,
)

graph_builder = StateGraph(AgentState)

graph_builder.add_node("retrieve_context", retrieve_context)
graph_builder.add_node("search_alternatives", search_alternatives)
graph_builder.add_node("plan_resolution", plan_resolution)
graph_builder.add_node("validate_plan", validate_plan)
graph_builder.add_node("commit_action", commit_action)

graph_builder.add_edge(START, "retrieve_context")
graph_builder.add_edge("retrieve_context", "search_alternatives")
graph_builder.add_edge("search_alternatives", "plan_resolution")
graph_builder.add_edge("plan_resolution", "validate_plan")
graph_builder.add_edge("validate_plan", "commit_action")
graph_builder.add_edge("commit_action", END)

agent_graph = graph_builder.compile()
