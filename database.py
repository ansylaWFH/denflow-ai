import os
import json
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Use the provided Supabase URL or fallback to env var
# Note: We need to handle the special character '@' in the password if present. 
# The user provided: postgresql://postgres:Denzard10@db.kwnmbvqaxtoyffzpecfw.supabase.co:5432/postgres
# The '@' in Denzard10@ needs to be URL encoded to %40 if it's part of the password, 
# BUT wait, the connection string format is user:password@host. 
# If the password contains @, it confuses the parser.
# Denzard10@ -> Denzard10%40
DEFAULT_DB_URL = "postgresql://postgres:Denzard10%40@db.kwnmbvqaxtoyffzpecfw.supabase.co:5432/postgres"

DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DB_URL)

# Ensure we use postgresql:// instead of postgres:// (deprecated in SQLAlchemy 1.4)
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class SMTPConfig(Base):
    __tablename__ = "smtp_configs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    server = Column(String, nullable=False)
    port = Column(Integer, nullable=False)
    email = Column(String, nullable=False)
    password = Column(String, nullable=False)
    display_name = Column(String, nullable=True)

class Recipient(Base):
    __tablename__ = "recipients"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    email = Column(String, index=True, nullable=False) # Removed unique=True globally, should be unique per user
    data = Column(Text, nullable=True)
    status = Column(String, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow)

class CampaignLog(Base):
    __tablename__ = "campaign_logs"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    message = Column(Text, nullable=False)
    type = Column(String, default="info")

class Schedule(Base):
    __tablename__ = "schedules"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    name = Column(String, nullable=False)
    scheduled_time = Column(DateTime, nullable=False)
    recurring = Column(String, default="none")
    status = Column(String, default="pending")

class Unsubscribe(Base):
    __tablename__ = "unsubscribes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    email = Column(String, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class AppConfig(Base):
    __tablename__ = "app_configs"
    key = Column(String, primary_key=True, index=True)
    user_id = Column(String, index=True, nullable=False)
    value = Column(Text, nullable=False)

def init_db():
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
