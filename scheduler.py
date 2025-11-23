import json
import os
import threading
import time
from datetime import datetime
from typing import List, Dict

class CampaignScheduler:
    def __init__(self, email_manager):
        self.email_manager = email_manager
        self.schedules_file = "schedules.json"
        self.schedules = []
        self.is_running = False
        self.thread = None
        self.load_schedules()
        
    def load_schedules(self):
        """Load scheduled campaigns from file"""
        if os.path.exists(self.schedules_file):
            try:
                with open(self.schedules_file, "r", encoding="utf-8") as f:
                    self.schedules = json.load(f)
            except Exception as e:
                print(f"Error loading schedules: {e}")
                self.schedules = []
        else:
            self.schedules = []
    
    def save_schedules(self):
        """Save scheduled campaigns to file"""
        try:
            with open(self.schedules_file, "w", encoding="utf-8") as f:
                json.dump(self.schedules, f, indent=2)
        except Exception as e:
            print(f"Error saving schedules: {e}")
    
    def add_schedule(self, schedule_data: Dict) -> str:
        """
        Add a new scheduled campaign
        schedule_data = {
            "name": "Campaign Name",
            "scheduled_time": "2025-01-15 14:30:00",  # YYYY-MM-DD HH:MM:SS
            "timezone": "UTC",
            "recurring": False,  # or "daily", "weekly"
            "status": "pending"  # pending, completed, cancelled
        }
        """
        schedule_id = str(int(time.time() * 1000))
        schedule = {
            "id": schedule_id,
            "name": schedule_data.get("name", "Untitled Campaign"),
            "scheduled_time": schedule_data.get("scheduled_time"),
            "timezone": schedule_data.get("timezone", "UTC"),
            "recurring": schedule_data.get("recurring", False),
            "status": "pending",
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        self.schedules.append(schedule)
        self.save_schedules()
        return schedule_id
    
    def delete_schedule(self, schedule_id: str) -> bool:
        """Delete a scheduled campaign"""
        original_len = len(self.schedules)
        self.schedules = [s for s in self.schedules if s["id"] != schedule_id]
        if len(self.schedules) < original_len:
            self.save_schedules()
            return True
        return False
    
    def get_schedules(self) -> List[Dict]:
        """Get all scheduled campaigns"""
        return self.schedules
    
    def start_scheduler(self):
        """Start the background scheduler thread"""
        if self.is_running:
            return
        
        self.is_running = True
        self.thread = threading.Thread(target=self._scheduler_loop, daemon=True)
        self.thread.start()
        print("Campaign scheduler started")
    
    def stop_scheduler(self):
        """Stop the scheduler"""
        self.is_running = False
        print("Campaign scheduler stopped")
    
    def _scheduler_loop(self):
        """Background loop that checks for scheduled campaigns"""
        while self.is_running:
            try:
                now = datetime.now()
                
                for schedule in self.schedules:
                    if schedule["status"] != "pending":
                        continue
                    
                    # Parse scheduled time
                    try:
                        scheduled_dt = datetime.strptime(schedule["scheduled_time"], "%Y-%m-%d %H:%M:%S")
                    except Exception:
                        continue
                    
                    # Check if it's time to run
                    if now >= scheduled_dt:
                        print(f"Triggering scheduled campaign: {schedule['name']}")
                        
                        # Start the email campaign
                        if not self.email_manager.is_running:
                            self.email_manager.start_process()
                            schedule["status"] = "completed"
                            schedule["executed_at"] = now.strftime("%Y-%m-%d %H:%M:%S")
                            
                            # Handle recurring
                            if schedule["recurring"]:
                                # For daily recurring, schedule next day
                                if schedule["recurring"] == "daily":
                                    next_time = scheduled_dt.replace(day=scheduled_dt.day + 1)
                                    schedule["scheduled_time"] = next_time.strftime("%Y-%m-%d %H:%M:%S")
                                    schedule["status"] = "pending"
                                # For weekly recurring
                                elif schedule["recurring"] == "weekly":
                                    next_time = scheduled_dt.replace(day=scheduled_dt.day + 7)
                                    schedule["scheduled_time"] = next_time.strftime("%Y-%m-%d %H:%M:%S")
                                    schedule["status"] = "pending"
                            
                            self.save_schedules()
                
                # Check every 30 seconds
                time.sleep(30)
                
            except Exception as e:
                print(f"Scheduler error: {e}")
                time.sleep(30)
