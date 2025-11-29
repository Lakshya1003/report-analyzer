import { GoogleGenerativeAI } from "@google/generative-ai";

document.addEventListener('DOMContentLoaded', () => {
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const removeFileBtn = document.getElementById('removeFile');
    const analyzeBtn = document.getElementById('analyzeBtn');
    const loadingSection = document.getElementById('loadingSection');
    const resultSection = document.getElementById('resultSection');

    // API Key Elements
    const apiKeyInput = document.getElementById('apiKeyInput');
    const saveKeyBtn = document.getElementById('saveKeyBtn');
    const apiKeySection = document.getElementById('apiKeySection');

    let currentFile = null;
    let genAI = null;

    // Load saved API Key
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
        apiKeyInput.value = savedKey;
        initializeGenAI(savedKey);
    }

    // Save API Key
    saveKeyBtn.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (key) {
            localStorage.setItem('gemini_api_key', key);
            initializeGenAI(key);
            alert('API Key saved!');
        } else {
            alert('Please enter a valid API Key.');
        }
    });

    function initializeGenAI(key) {
        try {
            genAI = new GoogleGenerativeAI(key);
        } catch (error) {
            console.error("Error initializing GenAI:", error);
            alert("Invalid API Key format.");
        }
    }

    // Drag and Drop Events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        uploadArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        uploadArea.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
        uploadArea.classList.add('dragover');
    }

    function unhighlight(e) {
        uploadArea.classList.remove('dragover');
    }

    uploadArea.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    // Click to upload
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });

    fileInput.addEventListener('change', function () {
        handleFiles(this.files);
    });

    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];
            if (file.type === 'application/pdf') {
                currentFile = file;
                fileName.textContent = file.name;
                uploadArea.classList.add('hidden');
                fileInfo.classList.remove('hidden');
                analyzeBtn.disabled = false;
            } else {
                alert('Please upload a PDF file.');
            }
        }
    }

    // Remove file
    removeFileBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering uploadArea click
        currentFile = null;
        fileInput.value = '';
        uploadArea.classList.remove('hidden');
        fileInfo.classList.add('hidden');
        analyzeBtn.disabled = true;
        resultSection.classList.add('hidden');
        resultSection.innerHTML = '';
    });

    // PDF Text Extraction
    async function extractTextFromPDF(file) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n';
        }
        return fullText;
    }

    // Analyze button
    analyzeBtn.addEventListener('click', async () => {
        if (!currentFile) return;
        if (!genAI) {
            alert('Please enter and save your API Key first.');
            apiKeyInput.focus();
            return;
        }

        loadingSection.classList.remove('hidden');
        resultSection.classList.add('hidden');
        analyzeBtn.disabled = true;

        try {
            const textContent = await extractTextFromPDF(currentFile);

            const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

            const prompt = `
            Analyze the following health report text and provide a structured analysis.
            
            Report Text:
            ${textContent}
            
            Please provide the output in the following JSON format:
            {
                "symptoms": [
                    {
                        "symptom": "Name of symptom",
                        "trigger_events": "From which events they might get triggered"
                    }
                ],
                "chronic_disease_detected": "Name of detected chronic disease or 'None'",
                "recommendations": {
                    "exercise": ["List of recommended exercises"],
                    "meditation": ["List of meditation techniques"],
                    "yoga": ["List of yoga poses"]
                },
                "medicine_info": [
                    {
                        "name": "Medicine name",
                        "description": "Description and why it has no side effects/harm if taken (consult specialist)"
                    }
                ],
                "motivation": "Motivational message to prevent actions/events triggering the disease",
                "warning": "A short little cute warning that I am just an AI agent and you should talk to a specialist."
            }
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Clean up the response to ensure it's valid JSON
            const jsonString = text.replace(/```json/g, '').replace(/```/g, '').trim();
            const data = JSON.parse(jsonString);

            renderResult(data);

        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred during analysis. Please check your API Key and try again.');
        } finally {
            loadingSection.classList.add('hidden');
            analyzeBtn.disabled = false;
        }
    });

    function renderResult(data) {
        resultSection.innerHTML = '';
        resultSection.classList.remove('hidden');

        // Helper to create sections
        const createSection = (title, content) => {
            return `
                <div class="glass-panel result-card">
                    <h2>${title}</h2>
                    ${content}
                </div>
            `;
        };

        // 1. Chronic Disease Detected
        if (data.chronic_disease_detected && data.chronic_disease_detected !== 'None') {
            const diseaseHtml = `<p style="color: #ef4444; font-size: 1.2rem; font-weight: bold;">${data.chronic_disease_detected}</p>`;
            resultSection.innerHTML += createSection('Chronic Disease Detected', diseaseHtml);
        }

        // 2. Symptoms
        if (data.symptoms && data.symptoms.length > 0) {
            const symptomsHtml = data.symptoms.map(s => `
                <div class="symptom-item">
                    <strong>${s.symptom}</strong>
                    <p style="font-size: 0.9rem; color: #94a3b8; margin-top: 0.2rem;">Trigger: ${s.trigger_events}</p>
                </div>
            `).join('');
            resultSection.innerHTML += createSection('Symptoms & Triggers', symptomsHtml);
        }

        // 3. Recommendations
        if (data.recommendations) {
            let recHtml = '';

            if (data.recommendations.exercise) {
                recHtml += `<h3>Exercise</h3><div style="margin-bottom: 1rem;">${data.recommendations.exercise.map(item => `<span class="tag">${item}</span>`).join('')}</div>`;
            }
            if (data.recommendations.meditation) {
                recHtml += `<h3>Meditation</h3><div style="margin-bottom: 1rem;">${data.recommendations.meditation.map(item => `<span class="tag">${item}</span>`).join('')}</div>`;
            }
            if (data.recommendations.yoga) {
                recHtml += `<h3>Yoga</h3><div style="margin-bottom: 1rem;">${data.recommendations.yoga.map(item => `<span class="tag">${item}</span>`).join('')}</div>`;
            }

            resultSection.innerHTML += createSection('Recommendations', recHtml);
        }

        // 4. Medicine Info
        if (data.medicine_info && data.medicine_info.length > 0) {
            const medHtml = data.medicine_info.map(m => `
                <div class="medicine-item">
                    <strong>${m.name}</strong>
                    <p>${m.description}</p>
                </div>
            `).join('');
            resultSection.innerHTML += createSection('Safe Medicines', medHtml);
        }

        // 5. Motivation
        if (data.motivation) {
            resultSection.innerHTML += createSection('Motivation', `<p style="font-style: italic; font-size: 1.1rem;">"${data.motivation}"</p>`);
        }

        // 6. Warning
        if (data.warning) {
            const warningHtml = `
                <div class="warning-box">
                    <i class="fa-solid fa-robot fa-2x"></i>
                    <p class="cute-warning">${data.warning}</p>
                </div>
            `;
            resultSection.innerHTML += warningHtml;
        }

        // Scroll to results
        resultSection.scrollIntoView({ behavior: 'smooth' });
    }
});
