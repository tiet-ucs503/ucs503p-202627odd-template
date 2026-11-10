import os
import torch
import torch.nn as nn
import torch.optim as optim
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
        last_out = lstm_out[:, -1, :]
        out = self.fc(last_out)
        return self.sigmoid(out)

def generate_synthetic_data(num_samples=1500, max_seq_len=8):
    """
    Generates realistic knowledge tracing sequences with multi-modal eye tracking features.
    """
    np.random.seed(42)
    X = []
    y = []

    state_map = {
        0: [1.0, 0.0, 0.0, 0.0], # Focused
        1: [0.0, 1.0, 0.0, 0.0], # Drifting
        2: [0.0, 0.0, 1.0, 0.0], # Impulsive
        3: [0.0, 0.0, 0.0, 1.0]  # Overwhelmed
    }

    for _ in range(num_samples):
        seq_len = np.random.randint(1, max_seq_len + 1)
        # Latent student mastery starts between 0.2 and 0.8
        mastery = np.random.uniform(0.2, 0.8)
        seq = []

        for t in range(seq_len):
            # Probability of answering correctly depends on current mastery and state
            state_idx = np.random.choice([0, 1, 2, 3], p=[0.55, 0.20, 0.15, 0.10])
            
            if state_idx == 0:  # Focused
                p_correct = min(0.95, mastery + 0.15)
                rt = np.random.uniform(10.0, 30.0) / 60.0
                blink = np.random.uniform(15.0, 25.0) / 60.0
                pupil = np.random.uniform(5.0, 15.0) / 100.0
                fix = np.random.uniform(300.0, 600.0) / 2000.0
                saccade = np.random.uniform(1.5, 2.5) / 10.0
                gaze = np.random.uniform(0.85, 1.0)
            elif state_idx == 1: # Drifting
                p_correct = max(0.15, mastery - 0.25)
                rt = np.random.uniform(30.0, 55.0) / 60.0
                blink = np.random.uniform(30.0, 45.0) / 60.0
                pupil = np.random.uniform(-10.0, 5.0) / 100.0
                fix = np.random.uniform(80.0, 200.0) / 2000.0
                saccade = np.random.uniform(3.5, 5.5) / 10.0
                gaze = np.random.uniform(0.35, 0.6)
            elif state_idx == 2: # Impulsive
                p_correct = max(0.10, mastery - 0.35)
                rt = np.random.uniform(2.0, 8.0) / 60.0 # very fast response
                blink = np.random.uniform(35.0, 50.0) / 60.0
                pupil = np.random.uniform(10.0, 25.0) / 100.0
                fix = np.random.uniform(50.0, 120.0) / 2000.0
                saccade = np.random.uniform(6.0, 9.0) / 10.0
                gaze = np.random.uniform(0.4, 0.65)
            else: # Overwhelmed
                p_correct = max(0.05, mastery - 0.45)
                rt = np.random.uniform(45.0, 60.0) / 60.0
                blink = np.random.uniform(6.0, 14.0) / 60.0
                pupil = np.random.uniform(25.0, 45.0) / 100.0
                fix = np.random.uniform(800.0, 1800.0) / 2000.0
                saccade = np.random.uniform(0.4, 1.2) / 10.0
                gaze = np.random.uniform(0.7, 0.9)

            correct = 1.0 if np.random.rand() < p_correct else 0.0
            # Update latent mastery based on outcome
            if correct == 1.0:
                mastery = min(0.98, mastery + 0.08)
            else:
                mastery = max(0.05, mastery - 0.08)

            feature_vec = [correct, rt] + state_map[state_idx] + [blink, pupil, fix, saccade, gaze]
            seq.append(feature_vec)

        # Target is the predicted probability of correctly solving the NEXT question
        # High mastery + last correct = high prob
        next_prob = mastery
        X.append(seq)
        y.append([next_prob])

    return X, y

def pad_collate(batch):
    sequences, targets = zip(*batch)
    lengths = [len(s) for s in sequences]
    max_len = max(lengths)
    padded = np.zeros((len(sequences), max_len, 11), dtype=np.float32)
    for i, s in enumerate(sequences):
        padded[i, :len(s), :] = s
    return torch.tensor(padded), torch.tensor(targets, dtype=torch.float32)

def train_and_save_weights(output_path: str = None):
    if output_path is None:
        output_path = os.path.join(os.path.dirname(__file__), "lstm_weights.pt")

    print("[LSTM Trainer] Generating synthetic cognitive knowledge tracing dataset...")
    X, y = generate_synthetic_data(num_samples=2000, max_seq_len=8)

    dataset = list(zip(X, y))
    train_size = int(0.85 * len(dataset))
    train_data = dataset[:train_size]
    val_data = dataset[train_size:]

    model = AdaptiveDifficultyLSTM(input_size=11, hidden_size=32)
    criterion = nn.MSELoss()
    optimizer = optim.Adam(model.parameters(), lr=0.005, weight_decay=1e-4)

    batch_size = 64
    num_epochs = 40

    print(f"[LSTM Trainer] Training AdaptiveDifficultyLSTM over {num_epochs} epochs...")
    model.train()
    for epoch in range(num_epochs):
        np.random.shuffle(train_data)
        epoch_loss = 0.0
        num_batches = 0

        for i in range(0, len(train_data), batch_size):
            batch = train_data[i:i+batch_size]
            b_x, b_y = pad_collate(batch)

            optimizer.zero_grad()
            preds = model(b_x)
            loss = criterion(preds, b_y)
            loss.backward()
            optimizer.step()

            epoch_loss += loss.item()
            num_batches += 1

        if (epoch + 1) % 10 == 0 or epoch == num_epochs - 1:
            val_x, val_y = pad_collate(val_data)
            model.eval()
            with torch.no_grad():
                val_preds = model(val_x)
                val_loss = criterion(val_preds, val_y).item()
            model.train()
            print(f"  Epoch [{epoch+1}/{num_epochs}] Train Loss: {epoch_loss/num_batches:.4f} | Val Loss: {val_loss:.4f}")

    torch.save(model.state_dict(), output_path)
    print(f"[LSTM Trainer] Weights successfully saved to: {output_path}")
    return output_path

if __name__ == "__main__":
    train_and_save_weights()

