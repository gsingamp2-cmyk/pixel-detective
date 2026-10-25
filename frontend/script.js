const imageInput = document.getElementById('imageInput');
const uploadArea = document.getElementById('uploadArea');
const chooseBtn = document.getElementById('chooseBtn');
const previewArea = document.getElementById('previewArea');
const imagePreview = document.getElementById('imagePreview');
const fileName = document.getElementById('fileName');
const removeBtn = document.getElementById('removeBtn');
const analyzeBtn = document.getElementById('analyzeBtn');
const newImageBtn = document.getElementById('newImageBtn');
const statusText = document.getElementById('status');
const resultSection = document.getElementById('result');
const predictionText = document.getElementById('prediction');
const confidenceText = document.getElementById('confidence');
const confidenceBar = document.getElementById('confidenceBar');
const STORAGE_KEY = 'pixelDetectiveSession';
let selectedFile = null;
let previewUrl = null;
function showResult(data) {
    const isReal = data.prediction === 'REAL';
    const confidence = Number(data.confidence);
    predictionText.textContent = isReal
        ? 'Likely Real Image'
        : 'Likely AI-Generated Image';
    confidenceText.textContent = `${confidence.toFixed(2)}%`;
    confidenceBar.style.width = `${Math.min(100, Math.max(0, confidence))}%`;
    resultSection.hidden = false;
}
function clearPreviewUrl() {
    if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = null;
    }
}
function resetInterface(clearSavedResult = true) {
    selectedFile = null;
    imageInput.value = '';
    clearPreviewUrl();
    imagePreview.removeAttribute('src');
    fileName.textContent = '';
    previewArea.hidden = true;
    uploadArea.hidden = false;
    resultSection.hidden = true;
    analyzeBtn.disabled = true;
    statusText.textContent = '';
    if (clearSavedResult) {
        sessionStorage.removeItem(STORAGE_KEY);
    }
}
function restoreSession() {
    try {
        const saved = sessionStorage.getItem(STORAGE_KEY);
        if (!saved) {
            return;
        }
        const data = JSON.parse(saved);
        if (!data.image || !data.result) {
            sessionStorage.removeItem(STORAGE_KEY);
            return;
        }
        imagePreview.src = data.image;
        imagePreview.hidden = false;
        previewArea.hidden = false;
        uploadArea.hidden = true;
        fileName.textContent = 'Previously analyzed image';
        showResult(data.result);
        statusText.textContent =
            'Previous result restored. You can analyze another image.';
    } catch (error) {
        sessionStorage.removeItem(STORAGE_KEY);
        console.error('Could not restore the previous session:', error);
    }
}
chooseBtn.addEventListener('click', () => {
    imageInput.click();
});
imageInput.addEventListener('change', () => {
    const file = imageInput.files[0];
    if (!file) {
        return;
    }
    const allowedTypes = [
        'image/jpeg',
        'image/png',
        'image/webp'
    ];
    if (!allowedTypes.includes(file.type)) {
        statusText.textContent =
            'Choose a JPG, PNG, or WebP image.';
        imageInput.value = '';
        return;
    }
    if (file.size > 10 * 1024 * 1024) {
        statusText.textContent =
            'Image must be smaller than 10 MB.';
        imageInput.value = '';
        return;
    }
    resetInterface();
    selectedFile = file;
    previewUrl = URL.createObjectURL(file);
    imagePreview.src = previewUrl;
    fileName.textContent = file.name;
    uploadArea.hidden = true;
    previewArea.hidden = false;
    resultSection.hidden = true;
    analyzeBtn.disabled = false;
    statusText.textContent = '';
});
removeBtn.addEventListener('click', () => {
    resetInterface();
});
newImageBtn.addEventListener('click', () => {
    resetInterface();
});
analyzeBtn.addEventListener('click', async () => {
    if (!selectedFile) {
        statusText.textContent = 'Please select an image first.';
        return;
    }
    analyzeBtn.disabled = true;
    statusText.textContent = 'Analyzing image...';
    resultSection.hidden = true;
    try {
        const formData = new FormData();
        formData.append('image', selectedFile);
        const response = await fetch('/api/predict', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(
                data.error || 'Image analysis failed.'
            );
        }
        if (
            !['REAL', 'FAKE'].includes(data.prediction) ||
            !Number.isFinite(Number(data.confidence))
        ) {
            throw new Error('The backend returned an invalid prediction.');
        }
        const imageData = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(
                new Error('Could not read the selected image.')
            );
            reader.readAsDataURL(selectedFile);
        });
        sessionStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                image: imageData,
                result: data
            })
        );
        showResult(data);
        statusText.textContent = 'Analysis complete.';
    } catch (error) {
        statusText.textContent =
            error.message || 'Could not connect to the backend.';
    } finally {
        analyzeBtn.disabled = false;
    }
});
restoreSession();