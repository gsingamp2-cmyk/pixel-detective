import os
import json
import torch
import torch.nn as nn
from flask import Flask, request, jsonify, send_from_directory
from PIL import Image, UnidentifiedImageError
from torchvision import models, transforms

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "model")
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

with open(os.path.join(MODEL_DIR, "model_config.json"), "r") as f:
    config = json.load(f)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

model = models.efficientnet_b0(weights=None)
in_features = model.classifier[1].in_features
model.classifier[1] = nn.Linear(in_features, config["num_classes"])

state_dict = torch.load(
    os.path.join(MODEL_DIR, "model.pth"),
    map_location=device,
    weights_only=True
)

model.load_state_dict(state_dict)
model.to(device)
model.eval()

transform = transforms.Compose([
    transforms.Resize((config["image_size"], config["image_size"])),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=config["normalization_mean"],
        std=config["normalization_std"]
    )
])

app = Flask(__name__, static_folder=FRONTEND_DIR)
app.config["MAX_CONTENT_LENGTH"] = 10 * 1024 * 1024

@app.route("/")
def home():
    return send_from_directory(FRONTEND_DIR, "index.html")

@app.route("/api/predict", methods=["POST"])
def predict():
    if "image" not in request.files:
        return jsonify({"error": "Please upload an image."}), 400

    file = request.files["image"]

    if not file.filename:
        return jsonify({"error": "No image selected."}), 400

    try:
        with Image.open(file.stream) as image:
            image = image.convert("RGB")
            tensor = transform(image).unsqueeze(0).to(device)

        with torch.inference_mode():
            outputs = model(tensor)
            probabilities = torch.softmax(outputs, dim=1)[0]

        predicted_index = int(probabilities.argmax().item())
        prediction = config["classes"][predicted_index]
        confidence = float(probabilities[predicted_index].item())

        return jsonify({
            "prediction": prediction,
            "confidence": round(confidence * 100, 2)
        })

    except (UnidentifiedImageError, OSError, ValueError):
        return jsonify({"error": "Invalid or unsupported image."}), 400

@app.errorhandler(413)
def too_large(_error):
    return jsonify({"error": "Image must be smaller than 10 MB."}), 413

@app.route("/style.css")
def style():
    return send_from_directory(FRONTEND_DIR, "style.css")

@app.route("/script.js")
def script():
    return send_from_directory(FRONTEND_DIR, "script.js")

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=False)