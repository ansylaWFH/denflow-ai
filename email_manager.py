import smtplib
import time
import json
import os
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from datetime import datetime
from sqlalchemy.orm import Session
from database import get_db, SMTPConfig, Recipient, CampaignLog, Unsubscribe, init_db

class EmailManager:
    def __init__(self, user_id: str):
        self.user_id = user_id
        # State
        self.is_running = False
        self.stop_event = threading.Event()
        self.thread = None
        self.status = "IDLE"
        self.current_email = ""
        
        # Configs
        self.SWITCH_LIMIT = 200
        self.BATCH_SIZE = 30
        self.SHORT_WAIT_SECONDS = 120
        self.LONG_WAIT_SECONDS = 2800
        self.DAILY_LIMIT_PAUSE_SECONDS = 12 * 3600
        
        self.public_url = "" 
        
        # Initialize DB (Global init, safe to call multiple times)
        init_db()

    def get_db_session(self):
        return next(get_db())

    def get_configs(self):
        db = self.get_db_session()
        configs = db.query(SMTPConfig).filter(SMTPConfig.user_id == self.user_id).all()
        return [
            {
                "SERVER": c.server,
                "PORT": c.port,
                "EMAIL": c.email,
                "PASSWORD": c.password,
                "DISPLAY_NAME": c.display_name
            } for c in configs
        ]

    def save_configs(self, new_configs):
        db = self.get_db_session()
        db.query(SMTPConfig).filter(SMTPConfig.user_id == self.user_id).delete()
        for c in new_configs:
            config = SMTPConfig(
                user_id=self.user_id,
                server=c.get("SERVER", "smtp.gmail.com"),
                port=int(c.get("PORT", 587)),
                email=c["EMAIL"],
                password=c["PASSWORD"],
                display_name=c.get("DISPLAY_NAME", "")
            )
            db.add(config)
        db.commit()
        self.log("Configurations updated in DB.")

    def is_unsubscribed(self, email):
        db = self.get_db_session()
        return db.query(Unsubscribe).filter(Unsubscribe.user_id == self.user_id, Unsubscribe.email == email).first() is not None

    def unsubscribe_user(self, email):
        if not self.is_unsubscribed(email):
            db = self.get_db_session()
            db.add(Unsubscribe(user_id=self.user_id, email=email))
            db.commit()
            self.log(f"Unsubscribed: {email}")

    def get_analytics(self):
        db = self.get_db_session()
        total_sent = db.query(Recipient).filter(Recipient.user_id == self.user_id, Recipient.status == 'sent').count()
        unsubscribes = db.query(Unsubscribe).filter(Unsubscribe.user_id == self.user_id).count()
        return {
            "total_sent": total_sent,
            "opens": 0, 
            "unsubscribes": unsubscribes
        }

    def log(self, message):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"[{self.user_id}] [{timestamp}] {message}")
        
        try:
            db = self.get_db_session()
            db.add(CampaignLog(user_id=self.user_id, message=message))
            db.commit()
        except Exception as e:
            print(f"Logging failed: {e}")

    def get_recent_logs(self, limit=50):
        db = self.get_db_session()
        logs = db.query(CampaignLog).filter(CampaignLog.user_id == self.user_id).order_by(CampaignLog.timestamp.desc()).limit(limit).all()
        return [f"[{l.timestamp}] {l.message}" for l in logs][::-1]

    def get_status(self):
        db = self.get_db_session()
        total = db.query(Recipient).filter(Recipient.user_id == self.user_id).count()
        sent = db.query(Recipient).filter(Recipient.user_id == self.user_id, Recipient.status == 'sent').count()
        
        return {
            "status": self.status,
            "current_index": sent,
            "total_recipients": total,
            "current_email": self.current_email,
            "logs": self.get_recent_logs(),
            "configs": self.get_configs()
        }

    def _inject_tracking(self, html, email):
        if not self.public_url:
            return html
        
        # Append user_id to tracking links so backend knows which user to attribute to
        pixel_url = f"{self.public_url}/track/open?email={email}&uid={self.user_id}"
        pixel_tag = f'<img src="{pixel_url}" width="1" height="1" style="display:none;" />'
        unsub_url = f"{self.public_url}/unsubscribe?email={email}&uid={self.user_id}"
        footer = f'''
        <div style="text-align: center; font-size: 12px; color: #888; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px;">
            <a href="{unsub_url}" style="color: #888;">Unsubscribe</a>
        </div>
        '''
        if "</body>" in html:
            html = html.replace("</body>", f"{pixel_tag}{footer}</body>")
        else:
            html += f"{pixel_tag}{footer}"
        return html

    def _personalize_email(self, html_template, row_data):
        html = html_template
        for key, value in row_data.items():
            placeholder = f"{{{key}}}"
            html = html.replace(placeholder, str(value) if value else "")
        return html

    def send_test_email(self, recipient_email):
        self.log(f"Sending test email to {recipient_email}...")
        try:
            configs = self.get_configs()
            if not configs:
                raise Exception("No SMTP configurations found.")
            
            config = configs[0]
            
            # Load template from DB or file (fallback to file for now as template isn't in DB yet)
            # TODO: Move template to DB
            if os.path.exists("mail.html"):
                with open("mail.html", encoding="utf-8") as f:
                    html_template = f.read()
            else:
                html_template = "<h1>Hello {first_name},</h1><p>This is a test.</p>"

            test_data = {"first_name": "Test", "email": recipient_email}
            html = self._personalize_email(html_template, test_data)
            html = self._inject_tracking(html, recipient_email)
            
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "[TEST] Campaign Email"
            msg["From"] = formataddr((config["DISPLAY_NAME"], config["EMAIL"]))
            msg["To"] = recipient_email
            msg.attach(MIMEText(html, "html"))
            
            with smtplib.SMTP(config["SERVER"], config["PORT"], timeout=30) as s:
                s.starttls()
                s.login(config["EMAIL"], config["PASSWORD"])
                s.send_message(msg)
                
            self.log(f"Test email sent to {recipient_email}")
            return True, "Sent"
        except Exception as e:
            self.log(f"Test email failed: {e}")
            return False, str(e)

    def start_process(self):
        if self.is_running:
            return
        self.is_running = True
        self.stop_event.clear()
        self.status = "RUNNING"
        self.thread = threading.Thread(target=self._run_loop)
        self.thread.daemon = True
        self.thread.start()
        self.log("Process started.")

    def stop_process(self):
        if not self.is_running:
            return
        self.log("Stopping process...")
        self.stop_event.set()
        self.is_running = False
        self.status = "STOPPED"

    def _sleep_interruptible(self, seconds, message="Waiting"):
        for i in range(seconds, 0, -1):
            if self.stop_event.is_set():
                return False
            if i % 10 == 0 or i < 10:
                self.status = f"{message} ({i}s)"
            time.sleep(1)
        self.status = "RUNNING"
        return True

    def _run_loop(self):
        try:
            db = self.get_db_session()
            
            # Load Template
            if os.path.exists("mail.html"):
                with open("mail.html", encoding="utf-8") as f:
                    html_template = f.read()
            else:
                self.log("Error: mail.html not found.")
                self.is_running = False
                self.status = "ERROR"
                return

            # Fetch Pending Recipients
            recipients = db.query(Recipient).filter(Recipient.status == 'pending').all()
            total_recipients = db.query(Recipient).count()
            
            if not recipients:
                self.log("No pending recipients.")
                self.is_running = False
                self.status = "FINISHED"
                return

            configs = self.get_configs()
            if not configs:
                self.log("Error: No SMTP configs.")
                self.is_running = False
                self.status = "ERROR"
                return

            self.log(f"Starting campaign with {len(recipients)} pending recipients.")

            sent_count_in_batch = 0
            
            for i, recipient in enumerate(recipients):
                if self.stop_event.is_set():
                    break
                
                self.current_email = recipient.email
                
                # Check Unsubscribe
                if self.is_unsubscribed(recipient.email):
                    self.log(f"Skipping {recipient.email}: Unsubscribed")
                    recipient.status = 'unsubscribed'
                    db.commit()
                    continue

                # Config Rotation
                config_index = (i // self.SWITCH_LIMIT) % len(configs)
                current_config = configs[config_index]

                # Prepare Data
                row_data = json.loads(recipient.data) if recipient.data else {}
                row_data['email'] = recipient.email
                
                html = self._personalize_email(html_template, row_data)
                html = self._inject_tracking(html, recipient.email)

                msg = MIMEMultipart("alternative")
                msg["Subject"] = "How Ghanaians Are Making ₵200–₵500/Day With AI & Phone" # TODO: Make subject dynamic
                msg["From"] = formataddr((current_config["DISPLAY_NAME"], current_config["EMAIL"]))
                msg["To"] = recipient.email
                msg.attach(MIMEText(html, "html"))

                try:
                    with smtplib.SMTP(current_config["SERVER"], current_config["PORT"], timeout=30) as s:
                        s.starttls()
                        s.login(current_config["EMAIL"], current_config["PASSWORD"])
                        s.send_message(msg)
                    
                    self.log(f"SUCCESS -> {recipient.email}")
                    recipient.status = 'sent'
                    db.commit()
                    sent_count_in_batch += 1

                except Exception as e:
                    self.log(f"Error -> {recipient.email}: {e}")
                    # Don't mark as failed immediately? Or maybe 'retry'?
                    # For now, keep as pending or mark failed
                    # recipient.status = 'failed' 
                    # db.commit()
                    time.sleep(5)

                # Rate Limiting
                if sent_count_in_batch >= self.BATCH_SIZE:
                    self.log(f"Batch limit reached. Sleeping {self.LONG_WAIT_SECONDS}s...")
                    if not self._sleep_interruptible(self.LONG_WAIT_SECONDS, "Batch Pause"):
                        break
                    sent_count_in_batch = 0
                else:
                    if not self._sleep_interruptible(self.SHORT_WAIT_SECONDS, "Waiting"):
                        break

            self.is_running = False
            self.status = "FINISHED" if not self.stop_event.is_set() else "STOPPED"
            self.log("Process finished.")

        except Exception as e:
            self.log(f"Critical Loop Error: {e}")
            self.is_running = False
            self.status = "ERROR"
