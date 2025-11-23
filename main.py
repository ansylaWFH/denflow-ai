import smtplib, time, csv, json, os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formataddr
from datetime import datetime

# --- Global Configuration ---
# Number of messages to send per configuration before switching
SWITCH_LIMIT = 200

# --- SMTP Configurations ---
# Configuration 1 (Index 0)
SMTP_CONFIG_1 = {
    "SERVER": "smtp.gmail.com",
    "PORT": 587,
    "EMAIL": "prmoted@gmail.com",
    "PASSWORD": "oklp rmem ajlc bvtz",
    "DISPLAY_NAME": "MG from Prmoted"
}

# Configuration 2 (Index 1)
SMTP_CONFIG_2 = {
    "SERVER": "smtp.gmail.com",
    "PORT": 587,
    "EMAIL": "dftmori@gmail.com",
    "PASSWORD": "gwfs cibd iyek krqq",
    "DISPLAY_NAME": "MG from Prmoted"
}

# List of all configurations
SMTP_CONFIGS = [SMTP_CONFIG_1, SMTP_CONFIG_2]
NUM_CONFIGS = len(SMTP_CONFIGS) # Should be 2

# --- Rate Limiting Configuration (Can be kept the same) ---
BATCH_SIZE = 30         # Number of emails to send before a long break
SHORT_WAIT_SECONDS = 120 # Wait time between individual emails (60 seconds)
LONG_WAIT_SECONDS = 2800 # Wait time after a batch (1800 seconds = 30 minutes)

# --- NEW: Limit Exceeded Pause ---
DAILY_LIMIT_PAUSE_SECONDS = 12 * 3600 # 12 hours

# --- File Paths ---
CSV_FILE = "mail list.csv"
HTML_FILE = "mail.html"
INTERRUPT_FILE = "last_processed.json"
HEARTBEAT_FILE = "last_processed.json" # NOTE: Your original had this set to heartbeat.txt. I'll stick to the original name, but use INTERRUPT_FILE for saving the index.

# --- Utility Function for Heartbeat ---
def write_heartbeat(status="RUNNING"):
    """Writes the current timestamp and status to a file."""
    try:
        with open("heartbeat.txt", "w", encoding="utf-8") as f:
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            f.write(f"STATUS: {status}\n")
            f.write(f"LAST UPDATE: {timestamp}\n")
            f.write(f"PID: {os.getpid()}\n")
    except Exception as e:
        # Fails silently if it can't write the heartbeat
        print(f"\n[Heartbeat Error] Could not write to file: {e}", flush=True)

# --- Utility Function for Pausing ---
def pause_with_countdown(seconds, message, is_long_wait=False):
    """
    Pauses execution, displays a countdown, and updates the heartbeat
    during long waits.
    """
    write_heartbeat("PAUSED") # Update status before entering the wait

    # Define the interval for file updates (e.g., every 5 minutes during long waits)
    HEARTBEAT_UPDATE_INTERVAL = 300 # 300 seconds = 5 minutes
    
    for remaining in range(seconds, 0, -1):
        # Calculate time remaining in H:M:S format for a clearer message
        hours = remaining // 3600
        minutes = (remaining % 3600) // 60
        sec = remaining % 60
        
        # Display the countdown
        print(f"{message} {hours:02d}h {minutes:02d}m {sec:02d}s", end="\r", flush=True)
        time.sleep(1)
        
        # Headless Heartbeat Logic: Only during long waits and on the interval
        if is_long_wait and remaining % HEARTBEAT_UPDATE_INTERVAL == 0:
            write_heartbeat(f"LONG WAIT ({hours}h {minutes}m remaining)")

    print() # Newline after countdown finishes
    write_heartbeat("RUNNING") # Update status after the wait is done

# --- Script Initialization ---
write_heartbeat("INITIALIZING")

# --- Load HTML template ---
with open(HTML_FILE, encoding="utf-8") as f:
    html_template = f.read()

# --- Load recipient list ---
with open(CSV_FILE, encoding="utf-8") as f:
    rows = list(csv.DictReader(f))
    total_recipients = len(rows)

# --- Load progress checkpoint ---
start_index = 0
if os.path.exists(INTERRUPT_FILE):
    try:
        with open(INTERRUPT_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            start_index = data.get("last_index", 0)
    except Exception:
        start_index = 0

print(f"Starting at index: {start_index}. Total recipients: {total_recipients}.")

# --- Variable to track total sent count since the start of the script/resumption ---
total_sent_since_start = start_index

write_heartbeat("RUNNING")

# --- Main loop ---
sent_count_in_batch = 0
for i, row in enumerate(rows[start_index:], start=start_index):
    first = row.get("first_name", "")
    email = row.get("email", "")
    
    if not email:
        print(f"Skipping row {i+1}: No email address found.")
        continue

    # --- SMTP Alternating Logic ---
    config_index = (i // SWITCH_LIMIT) % NUM_CONFIGS
    current_config = SMTP_CONFIGS[config_index]

    SMTP_SERVER = current_config["SERVER"]
    SMTP_PORT = current_config["PORT"]
    SENDER_EMAIL = current_config["EMAIL"]
    PASSWORD = current_config["PASSWORD"]
    DISPLAY_NAME = current_config["DISPLAY_NAME"]

    print(f"\n--- Using Config Index {config_index + 1} ({SENDER_EMAIL}) ---")

    # 1. Personalize email content
    html = html_template.replace("{first_name}", first)
    # NOTE: You'd want to handle the {preview_text} substitution here if you updated your HTML template

    # 2. CONSTRUCT THE EMAIL MESSAGE
    msg = MIMEMultipart("alternative")
    msg["Subject"] = "How Ghanaians Are Making ₵200–₵500/Day With AI & Phone"
    msg["From"] = formataddr((DISPLAY_NAME, SENDER_EMAIL))
    msg["To"] = email
    msg.attach(MIMEText(html, "html"))
    
    try:
        # 3. Connect to the SMTP server and send
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT, timeout=30) as s:
            s.starttls()
            s.login(SENDER_EMAIL, PASSWORD)
            s.send_message(msg)
            
        print(f"SUCCESS {i+1}/{total_recipients} -> {email}")
        sent_count_in_batch += 1
        
    except smtplib.SMTPDataError as e:
        # Check for the specific Gmail daily limit error (status code 550)
        # Note: 'e.smtp_code' is the numerical code (e.g., 550)
        # and 'e.smtp_error' is the byte string containing the message.
        if e.smtp_code == 550 and b'Daily user sending limit exceeded' in e.smtp_error:
            print(f"FAILURE {i+1}/{total_recipients} -> {email}: DAILY SENDING LIMIT EXCEEDED FOR {SENDER_EMAIL}!")
            print(f"Pausing for {DAILY_LIMIT_PAUSE_SECONDS // 3600} hours (12 hours) to reset the limit.")
            
            # Pause for 12 hours. is_long_wait=True ensures heartbeat updates.
            pause_with_countdown(
                DAILY_LIMIT_PAUSE_SECONDS, 
                "DAILY LIMIT REACHED! Long pause...", 
                is_long_wait=True
            )
            
            # After the long pause, we want to retry the current email (i).
            # We decrement 'i' in the index-relative variables to ensure the loop 
            # attempts the SAME email again after the 12-hour break.
            start_index = i # Re-set the starting point to the current email
            break # Break out of the for loop to restart the script, or just continue the loop
                  # For simplicity and robust recovery, using 'break' here is safest, 
                  # assuming the script is run again, but for an endless loop, we just 'continue'.
                  # To keep the script running, we'll use a 'continue' and rely on the saved index.
            continue # Continue to the next iteration (which will re-read the CSV starting at the failed index 'i')

        else:
            # Handle other SMTP data errors (e.g., invalid recipient, message too large)
            print(f"FAILURE {i+1}/{total_recipients} -> {email}: SMTP Data Error: {e}")
            time.sleep(5) 
            
    except Exception as e:
        # Handle all other non-SMTP errors (e.g., connection timeout, general code issues)
        print(f"FAILURE {i+1}/{total_recipients} -> {email}: General Error: {e}")
        time.sleep(5) 

    # --- Save progress ---
    # Always save the *next* index to start from (i + 1)
    with open(INTERRUPT_FILE, "w", encoding="utf-8") as f:
        json.dump({"last_index": i + 1}, f)

    # --- Pause logic (Rate Limiting) ---
    if sent_count_in_batch % BATCH_SIZE == 0 and sent_count_in_batch != 0:
        print(f"Reached {BATCH_SIZE} emails. Sleeping {LONG_WAIT_SECONDS//60} minutes...")
        pause_with_countdown(LONG_WAIT_SECONDS, "long wait...", is_long_wait=True)
        sent_count_in_batch = 0 # Reset batch counter
    
    else:
        # Only wait if there are more recipients to process
        if (i + 1) < total_recipients:
            pause_with_countdown(SHORT_WAIT_SECONDS, "waiting...")

# --- Final Cleanup ---
write_heartbeat("FINISHED")
print("\nMailing process completed.")