"""
Training Script — L1 FFNN Stress Scorer (Unit I)
================================================
Dataset: FinancialPhraseBank (Kaggle) + augmented TN distress texts
Run: python -m training.train_ffnn

Produces: model_weights/ffnn_stress.weights.h5
"""
import numpy as np
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))


def generate_synthetic_data(n_samples: int = 5000):
    """
    Synthetic training data mirroring FinancialPhraseBank distribution.
    Replace with real dataset loading for production training.
    """
    np.random.seed(42)
    X = np.random.randn(n_samples, 64).astype(np.float32)
    # Stress score: high urgency + negative sentiment → high score
    y = np.clip(
        30 + 40 * X[:, 0] + 20 * X[:, 4] + 10 * np.random.randn(n_samples),
        0, 100,
    ).astype(np.float32) / 100.0  # normalize to 0-1 for sigmoid output
    return X, y


def train():
    import tensorflow as tf
    from tensorflow import keras
    from models.ffnn_stress import build_ffnn_model

    os.makedirs("model_weights", exist_ok=True)
    X_train, y_train = generate_synthetic_data(4000)
    X_val, y_val = generate_synthetic_data(1000)

    model = build_ffnn_model()
    model.summary()

    callbacks = [
        keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True),
        keras.callbacks.ModelCheckpoint(
            "model_weights/ffnn_stress.weights.h5",
            save_best_only=True,
            save_weights_only=True,
        ),
        keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=5),
    ]

    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=100,
        batch_size=64,
        callbacks=callbacks,
        verbose=1,
    )

    print(f"Best val_loss: {min(history.history['val_loss']):.4f}")
    print("Saved to model_weights/ffnn_stress.weights.h5")


if __name__ == "__main__":
    train()
