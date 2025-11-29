import os
from flask import Flask, render_template, request, jsonify
import google.generativeai as genai
from dotenv import load_dotenv
import PyPDF2
import io

# Load environment variables
# The user specified the .env file is in "file analysis" folder
env_path = os.path.join(os.path.dirname(__file__), 'file analysis', '.env')
load_dotenv(env_path)

app = Flask(__name__)

# Configure Gemini API
api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("Warning: GEMINI_API_KEY not found in environment variables.")

genai.configure(api_key=api_key)

generation_config = {
  "temperature": 1,
  "top_p": 0.95,
  "top_k": 64,
  "max_output_tokens": 8192,
  "response_mime_type": "application/json",
}

model = genai.GenerativeModel(
  model_name="gemini-2.0-flash",
  generation_config=generation_config,
)

def extract_text_from_pdf(pdf_file):
    pdf_reader = PyPDF2.PdfReader(pdf_file)
    text = ""
    for page in pdf_reader.pages:
        text += page.extract_text()
    return text

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and file.filename.lower().endswith('.pdf'):
        try:
            # Extract text from PDF
            text_content = extract_text_from_pdf(file)
            
            # Construct the prompt
            prompt = f"""
            Analyze the following health report text and provide a structured analysis.
            
            Report Text:
            {text_content}
            
            Please provide the output in the following JSON format:
            {{
                "symptoms": [
                    {{
                        "symptom": "Name of symptom",
                        "trigger_events": "From which events they might get triggered"
                    }}
                ],
                "chronic_disease_detected": "Name of detected chronic disease or 'None'",
                "recommendations": {{
                    "exercise": ["List of recommended exercises"],
                    "meditation": ["List of meditation techniques"],
                    "yoga": ["List of yoga poses"]
                }},
                "medicine_info": [
                    {{
                        "name": "Medicine name",
                        "description": "Description and why it has no side effects/harm if taken (consult specialist)"
                    }}
                ],
                "motivation": "Motivational message to prevent actions/events triggering the disease",
                "warning": "A short little cute warning that I am just an AI agent and you should talk to a specialist."
            }}
            """
            
            # Generate response
            response = model.generate_content(prompt)
            
            return response.text # Returns JSON string
            
        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({'error': str(e)}), 500
    else:
        return jsonify({'error': 'Invalid file type. Please upload a PDF.'}), 400

if __name__ == '__main__':
    app.run(debug=True)
