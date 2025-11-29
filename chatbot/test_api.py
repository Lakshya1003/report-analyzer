import os
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
env_path = os.path.join(os.path.dirname(__file__), 'file analysis', '.env')
load_dotenv(env_path)

api_key = os.getenv("GEMINI_API_KEY")

try:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")
    response = model.generate_content("Hello")
    print("Success: " + response.text)
except Exception as e:
    with open("error_log.txt", "w") as f:
        f.write(str(e))
    print("Error occurred, check error_log.txt")
