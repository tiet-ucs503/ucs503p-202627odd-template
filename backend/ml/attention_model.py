import os
from pathlib import Path
from typing import List, Dict
import torch
import torch.nn as nn
import numpy as np

# Ensure writable directories for caches if needed
os.environ.setdefault("KERAS_HOME", os.path.join(os.path.dirname(__file__), "..", ".keras"))
os.environ.setdefault("MPLCONFIGDIR", os.path.join(os.path.dirname(__file__), "..", ".matplotlib"))

class AdaptiveDifficultyLSTM(nn.Module):
    """
    Deep Knowledge Tracing variant that incorporates eye-tracking metrics.
    Predicts the probability of the student answering the next question correctly.
    """
    def __init__(self, input_size=11, hidden_size=32, num_layers=1):
        super(AdaptiveDifficultyLSTM, self).__init__()
        self.hidden_size = hidden_size
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers, batch_first=True)
        self.fc = nn.Linear(hidden_size, 1)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        # x shape: (batch_size, sequence_length, input_size)
        lstm_out, _ = self.lstm(x)
        # Take the output of the last time step
        last_out = lstm_out[:, -1, :]
        out = self.fc(last_out)
        return self.sigmoid(out)

WEIGHTS_FILE = Path(__file__).parent / "lstm_weights.pt"

def load_or_initialize_model() -> AdaptiveDifficultyLSTM:
    lstm_model = AdaptiveDifficultyLSTM()
    if WEIGHTS_FILE.exists():
        try:
            state_dict = torch.load(str(WEIGHTS_FILE), map_location=torch.device('cpu'), weights_only=True)
            lstm_model.load_state_dict(state_dict)
            print(f"[AttentionModel] Loaded pre-trained LSTM weights from {WEIGHTS_FILE.name}")
        except Exception as e:
            print(f"[AttentionModel] Failed to load weights ({e}). Running uninitialized baseline.")
    else:
        print(f"[AttentionModel] No weights found at {WEIGHTS_FILE}. Running baseline.")
    lstm_model.eval()
    return lstm_model

# Singleton instance of the model
model = load_or_initialize_model()

# One-hot encoding map for cognitive states
STATE_MAP = {
    "Focused": [1.0, 0.0, 0.0, 0.0],
    "Drifting": [0.0, 1.0, 0.0, 0.0],
    "Impulsive": [0.0, 0.0, 1.0, 0.0],
    "Overwhelmed": [0.0, 0.0, 0.0, 1.0]
}

def preprocess_history(history: List[Dict]) -> torch.Tensor:
    """
    Converts a list of dicts from the eye_tracker and attempt records into a normalized tensor.
    """
    seq = []
    for record in history:
        # 1. Performance metrics
        correct = float(record.get('correct', 0))
        # Normalize response time (assuming 60s is typical max)
        rt = min(record.get('response_time_s', 0.0) / 60.0, 1.0)
        
        # 2. Categorical eye state
        state = record.get('attention_state_eye', 'Focused')
        state_encoded = STATE_MAP.get(state, [1.0, 0.0, 0.0, 0.0])
        
        # 3. Continuous eye metrics (rough heuristic normalization)
        blink = record.get('eye_blink_rate', 20.0) / 60.0
        pupil = record.get('eye_pupil_dilation', 0.0) / 100.0
        fix = record.get('eye_fixation_duration', 300.0) / 2000.0
        saccade = record.get('eye_saccade_rate', 2.0) / 10.0
        gaze = record.get('eye_gaze_stability', 1.0)
        
        features = [correct, rt] + state_encoded + [blink, pupil, fix, saccade, gaze]
        seq.append(features)
        
    # If history is empty (first attempt), provide a dummy 'baseline' row
    if not seq:
        seq.append([0.5, 0.5] + STATE_MAP["Focused"] + [0.3, 0.0, 0.15, 0.2, 1.0])
        
    # Shape: (batch_size=1, sequence_length, input_size)
    return torch.tensor([seq], dtype=torch.float32)

def predict_risk(user_history: List[Dict]) -> float:
    """
    Returns the probability (0.0 to 1.0) of the student getting the next question correct.
    
    Higher probability = lower risk (student is doing well).
    Lower probability = higher risk (needs easier question / hint).
    """
    with torch.no_grad():
        x = preprocess_history(user_history)
        prediction = model(x)
        prob = float(prediction.item())
        print(f"[AttentionModel] Sequence length: {len(user_history)} -> Predicted Success Prob: {prob:.2%}")
        return prob
