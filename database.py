import os
import json
from datetime import datetime
from sqlalchemy import create_engine, Column, Integer, String, Text, DateTime, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Render PostgreSQL Database (Internal connection for faster performance)
DEFAULT_DB_URL = "postgresql://mailflow_user:HrKwbiuyfAytFq6EXA85ZQpZ3mXEH54F@dpg-d4hggg4hg0os738e105g-a/mailflow"

DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DB_URL)

# Ensure we use postgresql:// instead of postgres://
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Create engine with connection pooling optimized for serverless
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Verify connections before using
    pool_recycle=300,    # Recycle connections after 5 minutes
    pool_size=5,         # Smaller pool for serverless
    max_overflow=10,
    connect_args={
        "connect_timeout": 10,
        "keepalives": 1,
        "keepalives_idle": 30,
        "keepalives_interval": 10,
        "keepalives_count": 5,
    }
)
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
