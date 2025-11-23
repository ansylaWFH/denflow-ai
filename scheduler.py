import threading
import time
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import get_db, Schedule

class CampaignScheduler:
    def __init__(self, get_manager_func):
        self.get_manager = get_manager_func
        self.is_running = False
        self.thread = None
        
    def start_scheduler(self):
        if self.is_running:
            return
        self.is_running = True
        self.thread = threading.Thread(target=self._scheduler_loop, daemon=True)
        self.thread.start()
        print("Campaign scheduler started")
    
    def stop_scheduler(self):
        self.is_running = False
        print("Campaign scheduler stopped")
    
    def _scheduler_loop(self):
        while self.is_running:
            try:
                db = next(get_db())
                now = datetime.now()
                
                # Find pending schedules due now or in the past
                pending_schedules = db.query(Schedule).filter(
                    Schedule.status == 'pending',
                    Schedule.scheduled_time <= now
                ).all()
                
                for schedule in pending_schedules:
                    print(f"Triggering scheduled campaign: {schedule.name} for user {schedule.user_id}")
                    
                    # Get manager for this user
                    manager = self.get_manager(schedule.user_id)
                    
                    if not manager.is_running:
                        manager.start_process()
                        
                        # Update status
                        schedule.status = "completed"
                        
                        # Handle Recurring
                        if schedule.recurring and schedule.recurring != "none":
                            next_time = None
                            if schedule.recurring == "daily":
                                next_time = schedule.scheduled_time + timedelta(days=1)
                            elif schedule.recurring == "weekly":
                                next_time = schedule.scheduled_time + timedelta(weeks=1)
                            
                            if next_time:
                                # Create new schedule for next run
                                new_schedule = Schedule(
                                    user_id=schedule.user_id,
                                    name=schedule.name,
                                    scheduled_time=next_time,
                                    recurring=schedule.recurring,
                                    status="pending"
                                )
                                db.add(new_schedule)
                                print(f"Rescheduled '{schedule.name}' for {next_time}")

                        db.commit()
                    else:
                        print(f"Skipping schedule {schedule.id}: Manager already running for user {schedule.user_id}")
                
                db.close()
                time.sleep(30) # Check every 30s
                
            except Exception as e:
                print(f"Scheduler error: {e}")
                time.sleep(30)
