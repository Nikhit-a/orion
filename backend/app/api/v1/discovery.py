from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from app.db.session import get_db
from app.models.inventory import Destination, Guide, Activity
from app.schemas.discovery import DestinationResponse, GuideResponse, ActivityResponse

router = APIRouter()

@router.get("/destinations", response_model=List[DestinationResponse])
def get_destinations(db: Session = Depends(get_db)):
    return db.query(Destination).all()

@router.get("/guides", response_model=List[GuideResponse])
def get_guides(
    destination_id: str = None,
    language: str = None,
    specialization: str = None,
    db: Session = Depends(get_db),
):
    query = db.query(Guide)
    if destination_id:
        query = query.filter(Guide.destination_id == destination_id)
    if language:
        query = query.filter(Guide.languages.contains([language]))
    if specialization:
        query = query.filter(Guide.specializations.contains([specialization]))
    return query.all()

@router.get("/destinations/{destination_id}/activities", response_model=List[ActivityResponse])
def get_activities_for_destination(destination_id: str, db: Session = Depends(get_db)):
    return db.query(Activity).filter(Activity.destination_id == destination_id).all()
