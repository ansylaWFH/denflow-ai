from fastapi import FastAPI, UploadFile, File, HTTPException, Response, Depends, Header
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import uvicorn
import os
import csv
import io
import json
from sqlalchemy.orm import Session
from database import get_db, Recipient, CampaignLog, Schedule, SMTPConfig, Unsubscribe, init_db
from email_manager import EmailManager
from supabase_client import verify_token

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files
if os.path.exists("frontend/dist"):
    app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")
    @app.get("/")
    def serve_frontend():
        with open("frontend/dist/index.html", "r", encoding="utf-8") as f:
            content = f.read()
            response = HTMLResponse(content=content)
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            return response

from scheduler import CampaignScheduler

# ... (imports)

# Active Managers: user_id -> EmailManager
managers: Dict[str, EmailManager] = {}

def get_current_user(authorization: Optional[str] = Header(None)):
    # ... (existing code)
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization Header")
    
    try:
        scheme, token = authorization.split()
        if scheme.lower() != 'bearer':
            raise HTTPException(status_code=401, detail="Invalid Authentication Scheme")
        
        user = verify_token(token)
        if not user:
            raise HTTPException(status_code=401, detail="Invalid Token")
        
        return user.user
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

def get_manager(user_id: str) -> EmailManager:
    if user_id not in managers:
        managers[user_id] = EmailManager(user_id)
    return managers[user_id]

# Initialize Scheduler
scheduler = CampaignScheduler(get_manager)

@app.on_event("startup")
def startup_event():
    init_db()
    scheduler.start_scheduler()

@app.on_event("shutdown")
def shutdown_event():
    scheduler.stop_scheduler()

# ... (rest of models)
class ConfigUpdate(BaseModel):
    configs: List[Dict[str, Any]]

class TemplateUpdate(BaseModel):
    content: str

class TestEmailRequest(BaseModel):
    recipient: str

class PublicUrlUpdate(BaseModel):
    url: str

class ScheduleCreate(BaseModel):
    name: str
    scheduled_time: str
    recurring: str = "none"

class UnsubscribeRemove(BaseModel):
    email: str

# --- Endpoints ---

@app.get("/status")
def get_status(user = Depends(get_current_user)):
    manager = get_manager(user.id)
    return manager.get_status()

@app.post("/start")
def start_process(user = Depends(get_current_user)):
    manager = get_manager(user.id)
    manager.start_process()
    return {"message": "Started"}

@app.post("/stop")
def stop_process(user = Depends(get_current_user)):
    manager = get_manager(user.id)
    manager.stop_process()
    return {"message": "Stopped"}

@app.get("/config")
def get_config(user = Depends(get_current_user)):
    manager = get_manager(user.id)
    return {
        "configs": manager.get_configs(),
        "public_url": manager.public_url
    }

@app.post("/config")
def update_config(data: ConfigUpdate, user = Depends(get_current_user)):
    manager = get_manager(user.id)
    manager.save_configs(data.configs)
    return {"message": "Updated"}

@app.post("/config/url")
def update_public_url(data: PublicUrlUpdate, user = Depends(get_current_user)):
    manager = get_manager(user.id)
    manager.public_url = data.url.rstrip("/")
    # TODO: Persist public_url in DB (AppConfig table)
    return {"message": "Public URL Updated"}

@app.get("/analytics")
def get_analytics(user = Depends(get_current_user)):
    manager = get_manager(user.id)
    return manager.get_analytics()

@app.get("/history")
def get_history(user = Depends(get_current_user)):
    manager = get_manager(user.id)
    return {"logs": manager.get_recent_logs(200)}

@app.get("/recipients")
def get_recipients(user = Depends(get_current_user), db: Session = Depends(get_db)):
    recipients = db.query(Recipient).filter(Recipient.user_id == user.id).limit(100).all()
    result = []
    for r in recipients:
        data = json.loads(r.data) if r.data else {}
        data['email'] = r.email
        data['status'] = r.status
        result.append(data)
    return {"recipients": result}

@app.post("/upload_csv")
async def upload_csv(file: UploadFile = File(...), user = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        content = await file.read()
        csv_text = content.decode('utf-8')
        reader = csv.DictReader(io.StringIO(csv_text))
        
        # Clear existing recipients for THIS user
        db.query(Recipient).filter(Recipient.user_id == user.id).delete()
        
        count = 0
        for row in reader:
            email = row.get('email')
            if not email:
                continue
            
            extra_data = {k: v for k, v in row.items() if k != 'email'}
            
            recipient = Recipient(
                user_id=user.id,
                email=email,
                data=json.dumps(extra_data),
                status='pending'
            )
            db.add(recipient)
            count += 1
            
        db.commit()
        return {"message": f"Uploaded {count} recipients"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/template")
def get_template(user = Depends(get_current_user)):
    # TODO: DB per user
    if os.path.exists(f"mail_{user.id}.html"):
        with open(f"mail_{user.id}.html", "r", encoding="utf-8") as f:
            return {"content": f.read()}
    elif os.path.exists("mail.html"): # Fallback
        with open("mail.html", "r", encoding="utf-8") as f:
            return {"content": f.read()}
    return {"content": ""}

@app.post("/template")
def update_template(data: TemplateUpdate, user = Depends(get_current_user)):
    # Save per user
    with open(f"mail_{user.id}.html", "w", encoding="utf-8") as f:
        f.write(data.content)
    return {"message": "Template updated"}

@app.post("/test-email")
def send_test_email(data: TestEmailRequest, user = Depends(get_current_user)):
    manager = get_manager(user.id)
    success, msg = manager.send_test_email(data.recipient)
    if not success:
        raise HTTPException(status_code=500, detail=msg)
    return {"message": msg}

# --- Tracking (Public) ---
@app.get("/track/open")
def track_open(email: str, uid: str):
    # Record open directly to DB or via manager if active
    # Direct DB is safer as manager might not be in memory
    # But manager.record_open handles logic.
    # Let's use manager if active, else DB.
    # Actually, just DB is fine for analytics.
    # But EmailManager has 'opens' in-memory dict.
    # Let's instantiate a temporary manager or just use DB.
    # For simplicity, let's log to DB.
    try:
        # TODO: Add Open model or just log it
        # manager = get_manager(uid) 
        # manager.record_open(email)
        pass # Placeholder until Open model is ready
    except Exception:
        pass
    return Response(content=b'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b', media_type="image/gif")

@app.get("/unsubscribe")
def unsubscribe(email: str, uid: str):
    # Direct DB unsubscribe
    try:
        db = next(get_db())
        # Check if already unsubscribed
        exists = db.query(Unsubscribe).filter(Unsubscribe.user_id == uid, Unsubscribe.email == email).first()
        if not exists:
            db.add(Unsubscribe(user_id=uid, email=email))
            db.commit()
    except Exception as e:
        print(f"Unsubscribe failed: {e}")
        
    return HTMLResponse(content=f"<h1>Unsubscribed</h1><p>{email} has been removed from our mailing list.</p>")

@app.get("/unsubscribes")
def get_unsubscribes(user = Depends(get_current_user), db: Session = Depends(get_db)):
    unsubs = db.query(Unsubscribe).filter(Unsubscribe.user_id == user.id).all()
    return {"unsubscribes": [u.email for u in unsubs]}

@app.post("/unsubscribes/remove")
def remove_unsubscribe(data: UnsubscribeRemove, user = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Unsubscribe).filter(Unsubscribe.user_id == user.id, Unsubscribe.email == data.email).delete()
    db.commit()
    return {"message": "Removed"}

# --- Scheduler (DB Based) ---
@app.get("/schedules")
def get_schedules(user = Depends(get_current_user), db: Session = Depends(get_db)):
    schedules = db.query(Schedule).filter(Schedule.user_id == user.id).all()
    return {"schedules": [
        {"id": s.id, "name": s.name, "scheduled_time": str(s.scheduled_time), "status": s.status, "recurring": s.recurring}
        for s in schedules
    ]}

@app.post("/schedules")
def create_schedule(data: ScheduleCreate, user = Depends(get_current_user), db: Session = Depends(get_db)):
    from datetime import datetime
    try:
        dt = datetime.strptime(data.scheduled_time, "%Y-%m-%d %H:%M:%S")
        schedule = Schedule(
            user_id=user.id,
            name=data.name,
            scheduled_time=dt,
            recurring=data.recurring,
            status="pending"
        )
        db.add(schedule)
        db.commit()
        return {"message": "Schedule created", "id": schedule.id}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.delete("/schedules/{schedule_id}")
def delete_schedule(schedule_id: int, user = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Schedule).filter(Schedule.id == schedule_id, Schedule.user_id == user.id).delete()
    db.commit()
    return {"message": "Deleted"}

if __name__ == "__main__":
    # Initialize DB on startup
    init_db()
    uvicorn.run(app, host="0.0.0.0", port=8000)
