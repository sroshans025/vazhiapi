"""
Training Script — L2 TextCNN Debt Classifier (Unit II)
=======================================================
Datasets: Reddit r/personalfinanceindia (scraped) + RBI Consumer Complaints
Run: python -m training.train_cnn

Produces: model_weights/textcnn_classifier.weights.h5
"""
import numpy as np
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from models.cnn_classifier import DEBT_CATEGORIES, NUM_CLASSES, MAX_LEN, VOCAB_SIZE


def generate_synthetic_data(n_samples: int = 6000):
    """
    Synthetic sequence data — 6 classes, 100-token sequences.
    Replace with real Reddit/RBI scraped data for production.
    """
    np.random.seed(42)
    X = np.random.randint(0, VOCAB_SIZE, (n_samples, MAX_LEN)).astype(np.int32)
    y = np.eye(NUM_CLASSES)[np.random.randint(0, NUM_CLASSES, n_samples)]
    return X, y


def train():
    import tensorflow as tf
    from tensorflow import keras
    from models.cnn_classifier import build_textcnn_model

    os.makedirs("model_weights", exist_ok=True)
    X_train, y_train = generate_synthetic_data(5000)
    X_val, y_val = generate_synthetic_data(1000)

    model = build_textcnn_model()
    model.summary()

    callbacks = [
        keras.callbacks.EarlyStopping(patience=8, restore_best_weights=True),
        keras.callbacks.ModelCheckpoint(
            "model_weights/textcnn_classifier.weights.h5",
            save_best_only=True,
            save_weights_only=True,
        ),
    ]

    history = model.fit(
        X_train, y_train,
        validation_data=(X_val, y_val),
        epochs=50,
        batch_size=128,
        callbacks=callbacks,
        verbose=1,
    )

    print(f"Best val_accuracy: {max(history.history['val_accuracy']):.4f}")
    print("Saved to model_weights/textcnn_classifier.weights.h5")


if __name__ == "__main__":
    train()
