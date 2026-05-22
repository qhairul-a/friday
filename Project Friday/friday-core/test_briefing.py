from dotenv import load_dotenv
load_dotenv()

from main import send_morning_briefing

print("Sending morning briefing...")
send_morning_briefing()
print("Done.")
