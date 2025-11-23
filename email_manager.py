import smtplib
import time
import csv
import json
import os
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from datetime import datetime

class EmailManager:
    def __init__(self):
        # State
        self.is_running = False
        self.stop_event = threading.Event()
        self.thread = None
        self.status = "IDLE"
        self.logs = []
        self.current_index = 0
        self.total_recipients = 0
        self.sent_count_in_batch = 0
        self.current_email = ""
        
        # Files
        self.CSV_FILE = "mail list.csv"
        self.HTML_FILE = "mail.html"
        self.INTERRUPT_FILE = "last_processed.json"
        
        # Configs (Default from main.py)
        self.SWITCH_LIMIT = 200
        self.BATCH_SIZE = 30
        self.SHORT_WAIT_SECONDS = 120
        self.LONG_WAIT_SECONDS = 2800
        self.DAILY_LIMIT_PAUSE_SECONDS = 12 * 3600
        
        self.public_url = "" # Set via API
        self.unsubscribes = set()
        self.opens = {} # email -> timestamp
        self.load_unsubscribes()
        
        self.smtp_configs = [
            {
                "SERVER": "smtp.gmail.com",
                "PORT": 587,
                "EMAIL": "prmoted@gmail.com",
                "PASSWORD": "oklp rmem ajlc bvtz",
                "DISPLAY_NAME": "MG from Prmoted"
            },
            {
                "SERVER": "smtp.gmail.com",
                "PORT": 587,
                "EMAIL": "dftmori@gmail.com",
                "PASSWORD": "gwfs cibd iyek krqq",
                "DISPLAY_NAME": "MG from Prmoted"
            }
        ]

    def load_unsubscribes(self):
        if os.path.exists("unsubscribes.txt"):
            with open("unsubscribes.txt", "r", encoding="utf-8") as f:
                self.unsubscribes = set(line.strip() for line in f if line.strip())

    def unsubscribe_user(self, email):
        if email not in self.unsubscribes:
            self.unsubscribes.add(email)
            with open("unsubscribes.txt", "a", encoding="utf-8") as f:
                f.write(email + "\n")
            self.log(f"Unsubscribed: {email}")

    def record_open(self, email):
        if email not in self.opens:
            self.opens[email] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            self.log(f"Email Opened: {email}")

    def get_analytics(self):
        return {
            "total_sent": self.current_index, # Approximate
            "opens": len(self.opens),
            "unsubscribes": len(self.unsubscribes)
        }

    def log(self, message):
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        entry = f"[{timestamp}] {message}"
        print(entry)
        self.logs.append(entry)
        if len(self.logs) > 1000:
            self.logs.pop(0)
        
        # Persist to file
        try:
            with open("campaign_logs.txt", "a", encoding="utf-8") as f:
                f.write(entry + "\n")
        except Exception:
            pass

    def get_status(self):
        return {
            "status": self.status,
            "current_index": self.current_index,
            "total_recipients": self.total_recipients,
            "current_email": self.current_email,
            "logs": self.logs[-50:], # Return last 50 logs
            "configs": self.smtp_configs
        }

    def update_configs(self, new_configs):
        self.smtp_configs = new_configs
        self.log("Configurations updated.")

    def _inject_tracking(self, html, email):
        if not self.public_url:
            return html
            
        # Add Open Pixel
        pixel_url = f"{self.public_url}/track/open?email={email}"
        pixel_tag = f'<img src="{pixel_url}" width="1" height="1" style="display:none;" />'
        
        # Add Unsubscribe Link
        unsub_url = f"{self.public_url}/unsubscribe?email={email}"
        footer = f'''
        <div style="text-align: center; font-size: 12px; color: #888; margin-top: 20px; border-top: 1px solid #eee; padding-top: 10px;">
            <a href="{unsub_url}" style="color: #888;">Unsubscribe</a>
        </div>
        '''
        
        # Insert before </body> if exists, else append
        if "</body>" in html:
            html = html.replace("</body>", f"{pixel_tag}{footer}</body>")
        else:
            html += f"{pixel_tag}{footer}"
            
        return html

    def _personalize_email(self, html_template, row_data):
        """Replace all {field_name} placeholders with actual data from CSV row"""
        html = html_template
        for key, value in row_data.items():
            placeholder = f"{{{key}}}"
            html = html.replace(placeholder, str(value) if value else "")
        return html

    def send_test_email(self, recipient_email):
        self.log(f"Sending test email to {recipient_email}...")
        try:
            # Use the first config for testing
            config = self.smtp_configs[0]
            
            if not os.path.exists(self.HTML_FILE):
                raise Exception("HTML Template not found.")
                
            with open(self.HTML_FILE, encoding="utf-8") as f:
                html_template = f.read()
            
            # Create test data with common fields
            test_data = {
                "first_name": "Test",
                "last_name": "User",
                "email": recipient_email,
                "company": "Test Company",
                "location": "Test City"
            }
            
            # Use dynamic personalization
            html = self._personalize_email(html_template, test_data)
            
            # Inject Tracking for Test
            html = self._inject_tracking(html, recipient_email)
            
            msg = MIMEMultipart("alternative")
            msg["Subject"] = "[TEST] " + "How Ghanaians Are Making ₵200–₵500/Day With AI & Phone"
            msg["From"] = formataddr((config["DISPLAY_NAME"], config["EMAIL"]))
            msg["To"] = recipient_email
            msg.attach(MIMEText(html, "html"))
            
            with smtplib.SMTP(config["SERVER"], config["PORT"], timeout=30) as s:
                s.starttls()
                s.login(config["EMAIL"], config["PASSWORD"])
                s.send_message(msg)
                
            self.log(f"Test email sent successfully to {recipient_email}")
            return True, "Sent successfully"
        except Exception as e:
            self.log(f"Test email failed: {e}")
            return False, str(e)

    def start_process(self):
        if self.is_running:
            self.log("Process is already running.")
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
        # We don't join here to avoid blocking API, just set flag
        self.is_running = False
        self.status = "STOPPED"

    def _sleep_interruptible(self, seconds, message="Waiting"):
        """Sleeps for `seconds` but checks stop_event every second."""
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
            # Load HTML
            if not os.path.exists(self.HTML_FILE):
                self.log(f"Error: {self.HTML_FILE} not found.")
                self.is_running = False
                self.status = "ERROR"
                return
                
            with open(self.HTML_FILE, encoding="utf-8") as f:
                html_template = f.read()

            # Load CSV
            if not os.path.exists(self.CSV_FILE):
                self.log(f"Error: {self.CSV_FILE} not found.")
                self.is_running = False
                self.status = "ERROR"
                return

            with open(self.CSV_FILE, encoding="utf-8") as f:
                rows = list(csv.DictReader(f))
                self.total_recipients = len(rows)

            # Load Checkpoint
            start_index = 0
            if os.path.exists(self.INTERRUPT_FILE):
                try:
                    with open(self.INTERRUPT_FILE, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        start_index = data.get("last_index", 0)
                except Exception:
                    start_index = 0
            
            self.current_index = start_index
            self.log(f"Starting at index: {start_index}/{self.total_recipients}")

            # Main Loop
            i = start_index
            while i < len(rows):
                if self.stop_event.is_set():
                    break
                
                self.current_index = i
                row = rows[i]
                first = row.get("first_name", "")
                email = row.get("email", "")
                self.current_email = email

                if not email:
                    self.log(f"Skipping row {i+1}: No email.")
                    i += 1
                    continue

                if email in self.unsubscribes:
                    self.log(f"Skipping row {i+1}: Unsubscribed ({email})")
                    i += 1
                    continue

                # Config Selection
                num_configs = len(self.smtp_configs)
                config_index = (i // self.SWITCH_LIMIT) % num_configs
                current_config = self.smtp_configs[config_index]

                # Prepare Email - Use dynamic personalization
                html = self._personalize_email(html_template, row)
                html = self._inject_tracking(html, email)
                
                msg = MIMEMultipart("alternative")
                msg["Subject"] = "How Ghanaians Are Making ₵200–₵500/Day With AI & Phone"
                msg["From"] = formataddr((current_config["DISPLAY_NAME"], current_config["EMAIL"]))
                msg["To"] = email
                msg.attach(MIMEText(html, "html"))

                # Send
                try:
                    with smtplib.SMTP(current_config["SERVER"], current_config["PORT"], timeout=30) as s:
                        s.starttls()
                        s.login(current_config["EMAIL"], current_config["PASSWORD"])
                        s.send_message(msg)
                    
                    self.log(f"SUCCESS {i+1}/{self.total_recipients} -> {email} (Config {config_index+1})")
                    self.sent_count_in_batch += 1
                    
                    # Save Progress
                    with open(self.INTERRUPT_FILE, "w", encoding="utf-8") as f:
                        json.dump({"last_index": i + 1}, f)
                    
                    i += 1 # Move to next only on success or non-critical error

                except smtplib.SMTPDataError as e:
                    if e.smtp_code == 550 and b'Daily user sending limit exceeded' in e.smtp_error:
                        self.log(f"DAILY LIMIT EXCEEDED for {current_config['EMAIL']}. Pausing 12h...")
                        if not self._sleep_interruptible(self.DAILY_LIMIT_PAUSE_SECONDS, "Daily Limit Pause"):
                            break
                        # Retry same index
                        continue 
                    else:
                        self.log(f"SMTP Error {i+1} -> {email}: {e}")
                        time.sleep(5)
                        i += 1 # Skip on other errors? Original script seemed to continue.
                
                except Exception as e:
                    self.log(f"Error {i+1} -> {email}: {e}")
                    time.sleep(5)
                    i += 1

                # Rate Limiting
                if self.sent_count_in_batch >= self.BATCH_SIZE:
                    self.log(f"Batch limit {self.BATCH_SIZE} reached. Sleeping {self.LONG_WAIT_SECONDS}s...")
                    if not self._sleep_interruptible(self.LONG_WAIT_SECONDS, "Batch Pause"):
                        break
                    self.sent_count_in_batch = 0
                else:
                    if i < self.total_recipients:
                        if not self._sleep_interruptible(self.SHORT_WAIT_SECONDS, "Waiting"):
                            break

            self.is_running = False
            self.status = "FINISHED" if not self.stop_event.is_set() else "STOPPED"
            self.log("Process finished.")

        except Exception as e:
            self.log(f"Critical Loop Error: {e}")
            self.is_running = False
            self.status = "ERROR"
