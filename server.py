from fastapi import FastAPI, UploadFile, File, HTTPException, Response
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import List, Dict, Any
import uvicorn
import os
import csv
from email_manager import EmailManager
from scheduler import CampaignScheduler

app = FastAPI()

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files (built frontend) in production
if os.path.exists("frontend/dist"):
    app.mount("/assets", StaticFiles(directory="frontend/dist/assets"), name="assets")
    
    @app.get("/")
    def serve_frontend():
        with open("frontend/dist/index.html", "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())

manager = EmailManager()
scheduler = CampaignScheduler(manager)

# Start the scheduler on app startup
@app.on_event("startup")
def startup_event():
    scheduler.start_scheduler()

class ConfigUpdate(BaseModel):
    configs: List[Dict[str, Any]]

class TemplateUpdate(BaseModel):
    content: str

class TestEmailRequest(BaseModel):
    recipient: str

# --- Tracking & Analytics ---
@app.get("/track/open")
def track_open(email: str):
    manager.record_open(email)
    # Return a 1x1 transparent pixel
    return Response(content=b'\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00\x21\xf9\x04\x01\x00\x00\x00\x00\x2c\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b', media_type="image/gif")

@app.get("/unsubscribe")
def unsubscribe(email: str):
    manager.unsubscribe_user(email)
    return HTMLResponse(content=f"<h1>Unsubscribed</h1><p>{email} has been removed from our mailing list.</p>")

@app.get("/analytics")
def get_analytics():
    return manager.get_analytics()

# --- Standard Endpoints ---
@app.get("/")
def root():
    return {
        "message": "MailFlow AI Backend is running.",
        "frontend_url": "http://localhost:5173",
        "docs_url": "http://localhost:8000/docs"
    }

@app.get("/status")
def get_status():
    return manager.get_status()

@app.post("/start")
def start_process():
    manager.start_process()
    return {"message": "Started"}

@app.post("/stop")
def stop_process():
    manager.stop_process()
    return {"message": "Stopped"}

@app.get("/config")
def get_config():
    return {
        "configs": manager.smtp_configs,
        "public_url": manager.public_url
    }

@app.post("/config")
def update_config(data: ConfigUpdate):
    manager.update_configs(data.configs)
    # We'll handle public_url update separately or add it to the model if needed, 
    # but for now let's assume it's part of the config object or a separate endpoint.
    # Let's update the model to include it.
    return {"message": "Updated"}

class PublicUrlUpdate(BaseModel):
    url: str

@app.post("/config/url")
def update_public_url(data: PublicUrlUpdate):
    manager.public_url = data.url.rstrip("/")
    return {"message": "Public URL Updated"}

@app.get("/unsubscribes")
def get_unsubscribes():
    return {"unsubscribes": list(manager.unsubscribes)}

class UnsubscribeRemove(BaseModel):
    email: str

@app.post("/unsubscribes/remove")
def remove_unsubscribe(data: UnsubscribeRemove):
    if data.email in manager.unsubscribes:
        manager.unsubscribes.remove(data.email)
        # Update the file
        with open("unsubscribes.txt", "w", encoding="utf-8") as f:
            for email in manager.unsubscribes:
                f.write(email + "\n")
        manager.log(f"Removed from unsubscribe list: {data.email}")
        return {"message": f"{data.email} removed from unsubscribe list"}
    return {"message": "Email not found in unsubscribe list"}

# --- Scheduler Endpoints ---
class ScheduleCreate(BaseModel):
    name: str
    scheduled_time: str  # YYYY-MM-DD HH:MM:SS
    timezone: str = "UTC"
    recurring: str = "none"  # none, daily, weekly

@app.get("/schedules")
def get_schedules():
    return {"schedules": scheduler.get_schedules()}

@app.post("/schedules")
def create_schedule(data: ScheduleCreate):
    schedule_id = scheduler.add_schedule({
        "name": data.name,
        "scheduled_time": data.scheduled_time,
        "timezone": data.timezone,
        "recurring": data.recurring if data.recurring != "none" else False
    })
    return {"message": "Schedule created", "schedule_id": schedule_id}

@app.delete("/schedules/{schedule_id}")
def delete_schedule(schedule_id: str):
    success = scheduler.delete_schedule(schedule_id)
    if success:
        return {"message": "Schedule deleted"}
    raise HTTPException(status_code=404, detail="Schedule not found")

@app.get("/template")
def get_template():
    if os.path.exists(manager.HTML_FILE):
        with open(manager.HTML_FILE, "r", encoding="utf-8") as f:
            return {"content": f.read()}
    return {"content": ""}

@app.post("/template")
def update_template(data: TemplateUpdate):
    with open(manager.HTML_FILE, "w", encoding="utf-8") as f:
        f.write(data.content)
    return {"message": "Template updated"}

@app.post("/test-email")
def send_test_email(data: TestEmailRequest):
    success, msg = manager.send_test_email(data.recipient)
    if not success:
        raise HTTPException(status_code=500, detail=msg)
    return {"message": msg}

@app.get("/history")
def get_history():
    logs = []
    if os.path.exists("campaign_logs.txt"):
        with open("campaign_logs.txt", "r", encoding="utf-8") as f:
            logs = f.readlines()
    # Return last 200 lines reversed
    return {"logs": logs[-200:][::-1]}

@app.post("/upload_csv")
async def upload_csv(file: UploadFile = File(...)):
    try:
        content = await file.read()
        with open(manager.CSV_FILE, "wb") as f:
            f.write(content)
        # Reload CSV in manager if needed, or it will be picked up on next start
        return {"message": f"Uploaded {file.filename}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/recipients")
def get_recipients():
    if os.path.exists(manager.CSV_FILE):
        with open(manager.CSV_FILE, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            return {"recipients": list(reader)[:100]} # Return first 100 for preview
    return {"recipients": []}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
