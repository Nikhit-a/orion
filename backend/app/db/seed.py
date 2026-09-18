import asyncio
import json
import uuid
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text
from app.models.inventory import Destination, Activity, Guide
from app.models.user import User
from app.models.trip import Trip, ItineraryItem

# Synchronous engine logic for simpler seeding
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from app.core.config import settings

engine = create_engine(settings.DATABASE_URL)

def seed_db():
    with Session(engine) as session:
        # Check if already seeded
        if session.query(Destination).first():
            print("Database already seeded.")
            return

        print("Seeding destinations...")
        d1 = Destination(name="Kyoto", country="Japan", description="Historic city with many temples and shrines.")
        d2 = Destination(name="Rome", country="Italy", description="Capital of Italy, known for its nearly 3,000 years of globally influential art, architecture and culture.")
        session.add_all([d1, d2])
        session.flush()

        print("Seeding activities...")
        a1 = Activity(destination_id=d1.id, name="Kinkaku-ji Temple Visit", activity_type="ATTRACTION", description="Golden Pavilion", base_price=10.00, duration_mins=120)
        a2 = Activity(destination_id=d1.id, name="Fushimi Inari Taisha", activity_type="ATTRACTION", description="Famous shrine with thousands of vermilion torii gates.", base_price=0.00, duration_mins=180)
        a3 = Activity(destination_id=d2.id, name="Colosseum Tour", activity_type="ATTRACTION", description="Ancient gladiatorial arena.", base_price=25.00, duration_mins=150)
        session.add_all([a1, a2, a3])
        
        print("Seeding guides...")
        g1 = Guide(destination_id=d1.id, name="Kenji Sato", bio="Local historian.", languages=["en", "ja"], specializations=["Heritage"], base_price_per_day=150.00, rating=4.9)
        g2 = Guide(destination_id=d2.id, name="Maria Rossi", bio="Art and history expert.", languages=["en", "it", "es"], specializations=["Art", "History"], base_price_per_day=200.00, rating=4.8)
        session.add_all([g1, g2])
        
        print("Seeding default user...")
        u1 = User(email="traveler@example.com", full_name="Test Traveler", role="TRAVELER", preferences={"languages": ["en"], "budget_level": "MODERATE", "interests": ["Heritage", "Food"]})
        session.add(u1)
        
        session.commit()
        print("Seeding completed successfully.")

if __name__ == "__main__":
    seed_db()
