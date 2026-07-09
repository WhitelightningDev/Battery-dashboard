import json
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from decimal import Decimal
from pathlib import Path
from time import monotonic
from typing import Annotated, Any, Literal
from uuid import uuid4

from fastapi import FastAPI
from fastapi import HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

#logging for the application 
logger = logging.getLogger(__name__)
DATA_FILE = Path(__file__).resolve().parents[1] / "take-home-data.json"
RUN_QUEUED_SECONDS = 1.0
RUN_COMPLETE_SECONDS = 2.5

RunStatus = Literal["queued", "running", "complete"]


class RunResponse(BaseModel):
    id: str
    status: RunStatus

# Loads data from the json file and then validates the data
def load_dashboard_data(path: Path) -> dict[str, Any]:
    with path.open(encoding="utf-8") as data_file:
        data = json.load(data_file)
# validating the  the structure of the loaded data.
    if not isinstance(data, dict): # it not a dictionary 
        raise ValueError("The dashboard data root must be a JSON object.") # raise a ValueError indicating that the dashboard data root must be a JSON object.
    if not isinstance(data.get("strikeMatrix"), list): # it not a list
        raise ValueError("The dashboard data must contain a strikeMatrix array.") # raise a ValueError indicating that the dashboard data must contain a strikeMatrix array.
    if not isinstance(data.get("pnlCurves"), dict): # it not a dictionary
        raise ValueError("The dashboard data must contain a pnlCurves object.") # raise a ValueError indicating that the dashboard data must contain a pnlCurves object.

    return data

# defining the lifespan context manager for the FastAPI application.
# This context manager loads the dashboard data when the application starts and handles any errors that may occur during loading.
@asynccontextmanager
async def lifespan(application: FastAPI) -> AsyncIterator[None]:
    application.state.runs = {}

    try:
        application.state.dashboard_data = load_dashboard_data(DATA_FILE)
        application.state.dashboard_data_error = None
    except (OSError, json.JSONDecodeError, ValueError) as exc:
        logger.exception("Unable to load dashboard data from %s", DATA_FILE)
        application.state.dashboard_data = None
        application.state.dashboard_data_error = str(exc)

    yield

# Create the FastAPI application instance with the specified title, version, and lifespan context manager.
app = FastAPI(
    title="Battery Revenue Mini-Dashboard API",
    version="0.1.0",
    lifespan=lifespan,
)
# Add CORS middleware to the application to allow cross-origin requests from specified origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define a health check endpoint that returns a simple status message indicating that the application is running.
@app.get("/api/health", tags=["system"])
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


def get_run_status(created_at: float) -> RunStatus:
    elapsed = monotonic() - created_at

    if elapsed < RUN_QUEUED_SECONDS:
        return "queued"
    if elapsed < RUN_COMPLETE_SECONDS:
        return "running"

    return "complete"


@app.post("/runs", response_model=RunResponse, status_code=201, tags=["runs"])
async def create_run(request: Request) -> RunResponse:
    run_id = str(uuid4())
    request.app.state.runs[run_id] = monotonic()
    return RunResponse(id=run_id, status="queued")


@app.get("/runs/{run_id}", response_model=RunResponse, tags=["runs"])
async def get_run(run_id: str, request: Request) -> RunResponse:
    created_at = request.app.state.runs.get(run_id)

    if created_at is None:
        raise HTTPException(status_code=404, detail="Run not found.")

    return RunResponse(id=run_id, status=get_run_status(created_at))

# Define a helper function to retrieve the dashboard data from the application state.
def get_dashboard_data(request: Request) -> dict[str, Any]:
    data = getattr(request.app.state, "dashboard_data", None)
# If the dashboard data is not available, raise an HTTPException with a 500 status code and a detailed error message.
    if data is None:
        raise HTTPException(
            status_code=500,
            detail=(
                "Dashboard data is unavailable. Ensure "
                "backend/take-home-data.json exists and contains valid data."
            ),
        )

    return data

# Define a helper function to format Decimal values as strings, ensuring that whole numbers are represented without decimal places.
# this basically checks if the value is a whole number and formats it accordingly
# otherwise it normalizes the value to remove any trailing zeros.
def format_key_number(value: Decimal) -> str:
    if value == value.to_integral_value():
        return format(value.quantize(Decimal(1)), "f")

    return format(value.normalize(), "f")

# Define an endpoint to retrieve the strike matrix data from the dashboard data.
@app.get("/strike-matrix", tags=["dashboard"])
async def get_strike_matrix(request: Request) -> list[Any]:
    data = get_dashboard_data(request)
    return data["strikeMatrix"]

# Define an endpoint to retrieve the P&L curve data based on the provided query parameters.
@app.get("/pnl-curve", tags=["dashboard"])
async def get_pnl_curve(
    request: Request,
    term: Annotated[Decimal, Query()],
    merchant_pct: Annotated[Decimal, Query(alias="merchantPct")],
    cycling: Annotated[Decimal, Query()],
    profile: Annotated[str, Query(min_length=1)],
) -> Any:
    lookup_key = "|".join(
        (
            format_key_number(term),
            format_key_number(merchant_pct),
            format_key_number(cycling),
            profile,
        )
    )
    data = get_dashboard_data(request)
    pnl_curves = data["pnlCurves"]

# Check if the lookup key exists in the P&L curves data. If not
# raise an HTTPException with a 404 status code and a detailed error message.
    if lookup_key not in pnl_curves:
        raise HTTPException(
            status_code=404,
            detail=f"No P&L curve found for lookup key: {lookup_key}",
        )
    
# If the lookup key exists, return the corresponding P&L curve data.
    return pnl_curves[lookup_key]
